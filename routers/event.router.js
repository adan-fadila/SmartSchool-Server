const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');

// Get all available events
router.get('/available', eventController.getAvailableEvents);

// Get specific event value
router.get('/:eventName', eventController.getEventValue);

module.exports = router; 