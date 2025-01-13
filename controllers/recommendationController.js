const { clients } = require('../ws');
const WebSocket = require('ws');

const handleRecommendationResponse = (req, res) => {
    try {
        const recommendations = req.body;
        console.log("Received recommendations:", recommendations);

        // Broadcast recommendations to all connected clients
        const recommendationData = {
            type: 'recommendation_update',
            data: {
                recommendations: recommendations,
                timestamp: new Date().toISOString()
            }
        };

        // Broadcast to all connected clients
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(recommendationData));
                console.log('Sent recommendation data to client');
            }
        });

        res.status(200).json({ 
            message: "Recommendations received and broadcasted successfully!",
            received: recommendations 
        });
    } catch (error) {
        console.error("Error handling recommendations:", error);
        res.status(500).json({ 
            message: "Internal Server Error",
            error: error.message 
        });
    }
};

module.exports = { handleRecommendationResponse };
