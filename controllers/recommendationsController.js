const axios = require('axios');
let latestRecommendations = [];

const FLASK_URL = 'http://127.0.0.1:5000/api/v1/recommendation/recommend_rules';

const getRecommendations = (req, res) => {
    res.status(200).json(latestRecommendations);
};

const fetchRecommendationsFromFlask = async () => {
    try {
        const response = await axios.get(FLASK_URL);
        latestRecommendations = response.data;
        console.log("Updated recommendations from Flask:", latestRecommendations);
    } catch (error) {
        console.error("Error fetching recommendations:", error);
    }
};

const updateRecommendations = (req, res) => {
    try {
        console.log('Request headers:', req.headers);
        console.log('Request origin:', req.get('origin'));
        console.log('Received request body:', req.body);
        const { recommendations } = req.body;
        
        if (!recommendations) {
            return res.status(400).json({ error: 'No recommendations provided' });
        }

        latestRecommendations = recommendations;
        
        console.log('Update successful');
        res.status(200).json({ 
            message: 'Recommendations updated successfully'
            
        });
    } catch (error) {
        console.error('Detailed error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to update recommendations',
            details: error.message 
        });
    }
};

const refreshRecommendations = async (req, res) => {
    try {
        const response = await axios.post('http://localhost:5000/api/recommendation/check_updates');
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error refreshing recommendations:', error);
        res.status(500).json({ error: 'Failed to refresh recommendations' });
    }
};

//setInterval(fetchRecommendationsFromFlask, 1 * 60 * 1000);
//fetchRecommendationsFromFlask();

module.exports = {
    getRecommendations,
    updateRecommendations,
    refreshRecommendations
}; 