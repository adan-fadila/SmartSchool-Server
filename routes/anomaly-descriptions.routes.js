const express = require('express');
const router = express.Router();
const anomalyDescriptionController = require('../controllers/anomalyDescriptionController');

// Create a new anomaly description
router.post('/', anomalyDescriptionController.createDescription);

// Get all anomaly descriptions for a space
router.get('/space/:spaceId', anomalyDescriptionController.getDescriptionsBySpace);

// Get descriptions for a specific raw event name in a space
router.get('/event/:rawEventName', anomalyDescriptionController.getDescriptionsByEvent);

// Update an anomaly description
router.put('/:id', anomalyDescriptionController.updateDescription);

// Delete an anomaly description
router.delete('/:id', anomalyDescriptionController.deleteDescription);

module.exports = router; 