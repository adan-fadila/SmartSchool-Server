const WebSocket = require("ws");
// Fix the import to correctly match how configurations are exported
const { handleControllers } = require('./controllers/handlersController');
const configurations = handleControllers.configurations;

// Log what we're importing to debug
console.log('WEBSOCKET: Imported configurations:', 
  configurations ? 
  `Found ${configurations.length} configurations` : 
  'No configurations found');

if (configurations && configurations.length > 0) {
  console.log('WEBSOCKET: First config:', {
    roomId: configurations[0].roomId,
    spaceId: configurations[0].spaceId,
    roomName: configurations[0].roomName
  });
}

const clients = [];

// Get roomId and spaceId from the first configuration
// We're using the first entry as default (typically "Living Room")
const defaultConfig = configurations && configurations.length > 0 ? configurations[0] : { roomId: '38197016', spaceId: '61097711' };
const configRoomId = defaultConfig.roomId;
const configSpaceId = defaultConfig.spaceId;
const configRoomName = defaultConfig.roomName || 'Living Room';

console.log(`WebSocket using configuration: Room=${configRoomName}, RoomID=${configRoomId}, SpaceID=${configSpaceId}`);

const connectToWs = () => {
  const wss = new WebSocket.Server({ 
    port: 8002,
    path: '/ws'
  });

  wss.on("connection", (ws) => {
    clients.push(ws);
    console.log("New client connected");

    // Send welcome message to only the newly connected client
    ws.send('Welcome to the WebSocket Server!');

    // Broadcast a message to all connected clients
    broadcast(wss, 'Hello, client!');

    // Handle message event
    ws.on('message', (message) => {
      console.log(`Received message => ${message}`);
      // Handle incoming messages here
    });

    // Handle close event
    ws.on('close', () => {
      console.log("Client has disconnected");
      // Remove the client from the array
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }
    });
  });

  console.log("WebSocket server started on port 8002");
};

// Function to broadcast messages to all connected clients
function broadcast(wss, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
// Function to broadcast anomaly data
function broadcastAnomalyData(anomalyState) {
  console.log('WEBSOCKET: Attempting to broadcast anomaly data');
  console.log('WEBSOCKET: Connected clients:', clients.length);
  
  // Log received keys but filter out image-related ones
  const receivedKeys = Object.keys(anomalyState || {}).filter(key => !key.includes('plot') && !key.includes('image'));
  console.log('WEBSOCKET: Anomaly state received (excluding image data):', receivedKeys);
  
  console.log("WEBSOCKET: Full anomaly state:", JSON.stringify(anomalyState, (key, value) => {
    // Don't log image data to keep logs clean
    if (key === 'plot_image' || key === 'collective_plot' || (typeof value === 'string' && value.length > 1000)) {
      return '[LARGE DATA]';
    }
    return value;
  }));
  
  // Extract all relevant information from the anomaly state
  
  // Extract location from name or use provided location
  let location = anomalyState?.location;
  if (!location && anomalyState?.name) {
      // Extract location from name (assuming format: "location sensor_type anomaly_type anomaly")
      const nameParts = anomalyState.name.split(' ');
      // If there are at least 4 parts, first two likely form the location
      if (nameParts.length >= 4) {
          location = `${nameParts[0]} ${nameParts[1]}`;
      } else if (nameParts.length >= 3) {
          location = nameParts[0];
      }
  }
  location = location || configRoomName;
  
  // Extract sensor type from name or metric_name
  let sensorType;
  if (anomalyState?.metric_name) {
      const metricParts = anomalyState.metric_name.split(' ');
      sensorType = metricParts[metricParts.length - 1]; // Get the last part
  } else if (anomalyState?.name) {
      const nameParts = anomalyState.name.split(' ');
      // Sensor type is typically the second-to-last word before "anomaly"
      if (nameParts.length >= 4 && nameParts[nameParts.length - 1].toLowerCase() === 'anomaly') {
          sensorType = nameParts[nameParts.length - 3];
      } else if (nameParts.length >= 3) {
          sensorType = nameParts[1];
      }
  }
  sensorType = sensorType || "unknown";
  
  // Extract the anomaly type from the name or use the provided type
  let anomalyType = anomalyState?.anomaly_type;
  if (!anomalyType && anomalyState?.name) {
      const nameLower = anomalyState.name.toLowerCase();
      if (nameLower.includes('collective')) {
          anomalyType = 'collective';
      } else if (nameLower.includes('pointwise')) {
          anomalyType = 'pointwise';
      }
  }
  anomalyType = anomalyType || "unknown";
  
  console.log("WEBSOCKET: Detected sensor type:", sensorType);
  
  // Construct the complete anomaly event name for the frontend to use
  const completeAnomalyName = `${location} ${sensorType} ${anomalyType} anomaly`.toLowerCase();
  
  // Helper function to ensure a value is a valid number
  function ensureNumber(value, defaultValue = 0) {
    // Convert the value to a number
    const num = Number(value);
    
    // Check if it's a valid number (not NaN)
    if (isNaN(num)) {
        return defaultValue;
    }
    
    return num;
  }
  
  // Helper function to standardize voting_algorithms to a string format
  function standardizeVotingAlgorithms(algorithms) {
    if (Array.isArray(algorithms)) {
      return algorithms.join(',');
    } else if (typeof algorithms === 'string') {
      return algorithms;
    } else {
      return "";
    }
  }
  
  // Process anomalies based on their format:
  // 1. Could be an array of anomaly objects (with timestamp, anomaly_val, etc.)
  // 2. Could be an object with start/end/algorithm properties
  let processedAnomalies = [];
  
  if (anomalyState && anomalyState.anomalies) {
    // Case 1: anomalies is an array
    if (Array.isArray(anomalyState.anomalies)) {
      processedAnomalies = anomalyState.anomalies.map(anomaly => {
        const algorithms = anomaly.voting_algorithms || anomaly.algorithm;
        
        return {
          timestamp: anomaly.timestamp || new Date().toISOString(),
          // Ensure numeric values have defaults for toFixed calls
          value: ensureNumber(anomaly.value || anomaly.anomaly_val),
          anomaly_score: ensureNumber(anomaly.anomaly_score, 1),
          anomaly_val: ensureNumber(anomaly.anomaly_val || anomaly.value),
          // Standardize voting_algorithms to always be a string
          voting_algorithms: standardizeVotingAlgorithms(algorithms)
        };
      });
      console.log(`WEBSOCKET: Processed ${processedAnomalies.length} anomalies from array`);
    } 
    // Case 2: anomalies is an object with start/end/algorithm properties
    else if (typeof anomalyState.anomalies === 'object') {
      // For collective anomalies format
      const anomaliesObj = anomalyState.anomalies;
      const algorithms = anomaliesObj.voting_algorithms || anomaliesObj.algorithm;
      
      // Create a single entry for the collective anomaly
      processedAnomalies = [{
        start: (anomaliesObj.start),
        end: (anomaliesObj.end),
        // Standardize voting_algorithms to always be a string
        voting_algorithms: standardizeVotingAlgorithms(algorithms),
        // Add default values that might be expected by frontend
        value: 0,
        anomaly_score: 1,
        anomaly_val: 0
      }];
      console.log('WEBSOCKET: Processed collective anomaly object format');
    }
  } else {
    console.warn('WEBSOCKET: No anomalies found in anomalyState');
  }
  
  // Debugging
  console.log('WEBSOCKET: Processed anomalies:', JSON.stringify(processedAnomalies));
  
  const anomalyData = {
      type: 'anomaly_update',
      data: {
          anomalies: processedAnomalies,
          plot_image: anomalyState?.plot_image || null,
          collective_plot: anomalyState?.collective_plot || null,
          timestamp: anomalyState?.timestamp || new Date().toISOString(),
          spaceId: anomalyState?.spaceId || configSpaceId,
          roomId: anomalyState?.roomId || configRoomId,
          location: location,
          sensorType: sensorType,
          anomalyType: anomalyType,
          completeAnomalyName: completeAnomalyName,
          rawEventName: completeAnomalyName
      }
  };
  
  // Log broadcast info without image data
  console.log('WEBSOCKET: Broadcasting anomaly data:', {
      timestamp: anomalyData.data.timestamp,
      anomaliesCount: anomalyData.data.anomalies?.length,
      sensorType: anomalyData.data.sensorType,
      location: anomalyData.data.location,
      roomId: anomalyData.data.roomId,
      spaceId: anomalyData.data.spaceId,
      anomalyType: anomalyData.data.anomalyType,
      completeAnomalyName: anomalyData.data.completeAnomalyName,
      anomaliesData: JSON.stringify(anomalyData.data.anomalies)
  });
  
  let sentCount = 0;
  clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
          try {
              client.send(JSON.stringify(anomalyData));
              sentCount++;
          } catch (error) {
              console.error('WEBSOCKET: Error sending data to client:', error);
          }
      }
  });
  console.log(`WEBSOCKET: Sent anomaly data to ${sentCount} client(s)`);
}

// New function to broadcast recommendation data
function broadcastRecommendationData(recommendations) {
    const recommendationData = {
        type: 'recommendation_update',
        data: {
            recommendations: recommendations,
            timestamp: new Date().toISOString()
        }
    };

    console.log('Broadcasting recommendation data:', {
        timestamp: recommendationData.data.timestamp,
        recommendationsCount: recommendations?.length
    });

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(recommendationData));
            console.log('Sent recommendation data to client');
        }
    });
}

module.exports = { 
  connectToWs, 
  clients, 
  broadcast,
  broadcastAnomalyData,
  broadcastRecommendationData
};