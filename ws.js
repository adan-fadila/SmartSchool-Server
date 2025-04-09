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
  const wss = new WebSocket.Server({ port: 8002 });

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

    // Always use hardcoded sensorType if not provided
    const sensorType = anomalyState?.metric_name?.split(' ').pop() || 'temperature';
    
    // Extract the anomaly type from the name or use the provided type
    let anomalyType = anomalyState?.anomaly_type;
    if (!anomalyType && anomalyState?.name) {
        const nameLower = anomalyState.name.toLowerCase();
        if (nameLower.includes('trend')) {
            anomalyType = 'trend';
        } else if (nameLower.includes('seasonality')) {
            anomalyType = 'seasonality';
        } else if (nameLower.includes('pointwise')) {
            anomalyType = 'pointwise';
        }
    }
    
    // Construct the complete anomaly event name for the frontend to use
    const location = anomalyState?.location || configRoomName;
    const completeAnomalyName = `${location} ${sensorType} ${anomalyType} anomaly`.toLowerCase();
    
    const anomalyData = {
        type: 'anomaly_update',
        data: {
            anomalies: (anomalyState && Array.isArray(anomalyState.anomalies)) ? anomalyState.anomalies.map(anomaly => ({
                timestamp: anomaly.timestamp,
                value: anomaly.value,
                voting_algorithms: anomaly.voting_algorithms,
                anomaly_val: anomaly.anomaly_val
            })) : [],
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
        completeAnomalyName: anomalyData.data.completeAnomalyName
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