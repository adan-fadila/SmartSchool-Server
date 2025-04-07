const express = require('express');
const router = express.Router();
const actionController = require('../controllers/action.controller');

// Execute an action directly
router.post('/execute', actionController.executeAction);

// Force execute an AC action (bypassing state check)
router.post('/execute-force', async (req, res) => {
  try {
    const { actionString } = req.body;
    
    if (!actionString) {
      return res.status(400).json({
        success: false,
        error: 'Action string is required'
      });
    }
    
    // Execute with force=true context
    const ActionRegistry = require('../interpreter/src/actions/ActionRegistry');
    const result = await ActionRegistry.testExecuteAction(actionString, { force: true });
    
    res.json(result);
  } catch (error) {
    console.error('Error force executing action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all available actions
router.get('/available', actionController.getAvailableActions);

module.exports = router; 