const WebSocket = require("ws");

const clients = [];

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

// New function to broadcast anomaly data
function broadcastAnomalyData(anomalyState) {
  const anomalyData = {
    type: 'anomaly_update',
    data: {
      anomalies: anomalyState.anomalies.map(anomaly => ({
        timestamp: anomaly.timestamp,
        value: anomaly.value,
        voting_algorithms: anomaly.voting_algorithms,
        anomaly_val: anomaly.anomaly_val
      })),
      plot_image: anomalyState.plot_image,
      collective_plot: anomalyState.collective_plot,
      timestamp: anomalyState.timestamp,
      spaceId: '61097711',
      roomId: '38197016',
      deviceType: 'AC'
    }
  };

  console.log('Broadcasting anomaly data:', {
    timestamp: anomalyData.data.timestamp,
    hasPlotImage: !!anomalyData.data.plot_image,
    hasCollectivePlot: !!anomalyData.data.collective_plot,
    anomaliesCount: anomalyData.data.anomalies?.length
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(anomalyData));
      console.log('Sent anomaly data to client');
    }
  });
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