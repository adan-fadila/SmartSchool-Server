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
        console.error("Error fetching recommendations:", error.message);
    }
};

const updateRecommendations = (req, res) => {
    const recommendations = req.body.recommendations;
    latestRecommendations = recommendations;
    console.log("Received Recommendations:", recommendations);
    res.status(200).send('Recommendations received');
};

const refreshRecommendations = async (req, res) => {
    try {
        await fetchRecommendationsFromFlask();
        res.status(200).json({ message: 'Recommendations refreshed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh recommendations' });
    }
};

setInterval(fetchRecommendationsFromFlask, 1 * 60 * 1000);

fetchRecommendationsFromFlask();

module.exports = {
    getRecommendations,
    updateRecommendations,
    refreshRecommendations
}; 