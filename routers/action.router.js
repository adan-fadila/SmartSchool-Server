const express = require('express');
const router = express.Router();
const actionController = require('../controllers/action.controller');

// Execute an action directly
router.post('/execute', actionController.executeAction);

// Get all available actions
router.get('/available', actionController.getAvailableActions);

module.exports = router; 