const express = require('express');
const { handleAnomalyResponse } = require('../controllers/anomalyController');
const anomalyRouter = express.Router();

// Route to handle anomaly detection responses
anomalyRouter.post('/anomaly_response', handleAnomalyResponse);

module.exports = { anomalyRouter };
