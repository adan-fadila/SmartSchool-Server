const express = require('express');
const { handleRecommendationResponse } = require('../controllers/recommendationController');
const recommendationRouter = express.Router();

// Route to handle recommendations
recommendationRouter.post('/recommendation_response', handleRecommendationResponse);

module.exports = { recommendationRouter };
