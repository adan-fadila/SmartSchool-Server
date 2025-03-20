const express = require('express');
const router = express.Router();
const interpreterService = require('../interpreter/src/server-integration');
const { interpreterSensorController } = require('../controllers/interpreterSensorController');

console.log('Interpreter router module loaded');

// Initialize the interpreter on server start
let interpreterInitialized = false;
const initializeInterpreter = async () => {
  if (!interpreterInitialized) {
    try {
      console.log('Starting interpreter initialization...');
      await interpreterService.initializeInterpreter();
      interpreterInitialized = true;
      console.log('Interpreter initialized through router');
    } catch (error) {
      console.error('Failed to initialize interpreter:', error);
    }
  }
};

// Initialize as soon as this module is loaded
initializeInterpreter();

// Get all available events
router.get('/events', async (req, res) => {
  try {
    const result = interpreterService.getAvailableEvents();
    res.json(result);
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all rules
router.get('/rules', async (req, res) => {
  try {
    const result = interpreterService.getAllRules();
    res.json(result);
  } catch (error) {
    console.error('Error getting rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new rule
router.post('/rules', async (req, res) => {
  try {
    const { ruleString } = req.body;
    
    if (!ruleString) {
      return res.status(400).json({ success: false, error: 'Rule string is required' });
    }
    
    const result = interpreterService.createRule(ruleString);
    res.json(result);
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a rule
router.delete('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const result = interpreterService.deleteRule(ruleId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate or deactivate a rule
router.patch('/rules/:ruleId/active', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({ success: false, error: 'Active status is required' });
    }
    
    const result = interpreterService.setRuleActive(ruleId, active);
    res.json(result);
  } catch (error) {
    console.error('Error updating rule active status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update an event value (for testing purposes)
router.post('/events/:eventName/update', async (req, res) => {
  try {
    const { eventName } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    const result = interpreterService.updateEventValue(eventName, value);
    res.json(result);
  } catch (error) {
    console.error('Error updating event value:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test an action without creating a rule
router.post('/actions/test', async (req, res) => {
  try {
    const { actionString } = req.body;
    
    if (!actionString) {
      return res.status(400).json({ success: false, error: 'Action string is required' });
    }
    
    const result = await interpreterService.testExecuteAction(actionString);
    res.json(result);
  } catch (error) {
    console.error('Error testing action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all available actions
router.get('/actions', async (req, res) => {
  try {
    const result = interpreterService.getAvailableActions();
    res.json(result);
  } catch (error) {
    console.error('Error getting actions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current device states
router.get('/devices/states', async (req, res) => {
  try {
    const result = interpreterService.getDeviceStates();
    res.json(result);
  } catch (error) {
    console.error('Error fetching device states:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sensor integration routes
router.post('/sensors/update', interpreterSensorController.updateEventsFromSensibo);
router.post('/sensors/polling/start', interpreterSensorController.startSensorPolling);
router.post('/sensors/polling/stop', interpreterSensorController.stopSensorPolling);

module.exports = router; 