const express = require('express');
const { handleAnomalyResponse ,handleCollectiveAnomalyResponse} = require('../controllers/anomalyController');
const anomalyRouter = express.Router();

// Route to handle anomaly detection responses
anomalyRouter.post('/anomaly_response', handleAnomalyResponse);
anomalyRouter.post('/coll_anomaly_response', handleCollectiveAnomalyResponse);
module.exports = { anomalyRouter };
