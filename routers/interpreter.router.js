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
      
      // Sync all active rules from the database
      await syncRulesFromDatabase();
    } catch (error) {
      console.error('Failed to initialize interpreter:', error);
    }
  }
};

// Function to sync rules from database to interpreter
const syncRulesFromDatabase = async () => {
  try {
    console.log('Syncing rules from database to interpreter...');
    
    // Import the Rule model
    const Rule = require('../models/Rule');
    
    // Clear existing rules in interpreter
    const clearResult = await clearAllRules();
    if (!clearResult.success) {
      console.error('Failed to clear existing rules:', clearResult.error);
      return;
    }
    
    // Get ALL rules from database (both active and inactive)
    const allRules = await Rule.find({});
    console.log(`Found ${allRules.length} total rules in database`);
    
    // Create each rule in interpreter
    let successCount = 0;
    let failCount = 0;
    
    for (const rule of allRules) {
      // Get rule string from either the ruleString field or description
      const ruleString = rule.ruleString || rule.description;
      
      if (!ruleString) {
        console.log(`Skipping rule ${rule._id} - no valid rule string`);
        failCount++;
        continue;
      }
      
      // Create rule in interpreter
      console.log(`Creating rule: ${ruleString}`);
      const createResult = await interpreterService.createRule(ruleString);
      
      if (!createResult.success) {
        console.log(`Failed to create rule: ${createResult.error}`);
        failCount++;
        continue;
      }
      
      // If rule is inactive in the database, deactivate it in the interpreter
      if (!rule.isActive) {
        console.log(`Rule ${rule._id} is inactive in the database, deactivating in interpreter`);
        interpreterService.setRuleActive(createResult.ruleId, false);
      }
      
      // Update rule in database with new interpreter ID
      const updatedRule = await Rule.findByIdAndUpdate(
        rule._id,
        { interpreterId: createResult.ruleId },
        { new: true }
      );
      
      console.log(`Rule created with ID ${createResult.ruleId}, active: ${rule.isActive}`);
      successCount++;
    }
    
    console.log(`Sync complete: ${successCount} rules created, ${failCount} failed`);
  } catch (error) {
    console.error('Error syncing rules from database:', error);
  }
};

// Helper function to clear all rules
const clearAllRules = async () => {
  try {
    // Get all rules
    const allRules = interpreterService.getRules();
    
    if (!allRules.success) {
      return { success: false, error: 'Failed to get rules' };
    }
    
    // Delete each rule
    for (const rule of allRules.rules) {
      await interpreterService.deleteRule(rule.id);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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
    const result = interpreterService.getRules();
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
    
    // Update the rule in the interpreter
    const result = interpreterService.setRuleActive(ruleId, active);
    
    if (result.success) {
      // If successful, also update the database
      try {
        const Rule = require('../models/Rule');
        const dbRule = await Rule.findOne({ interpreterId: ruleId });
        
        if (dbRule) {
          // Update the isActive status in the database
          dbRule.isActive = active;
          await dbRule.save();
          console.log(`Updated rule active status in database: ${dbRule._id}, isActive=${active}`);
          
          // Return success with additional info about the database update
          return res.json({
            ...result,
            databaseUpdated: true,
            databaseId: dbRule._id
          });
        } else {
          console.log(`No database rule found with interpreter ID ${ruleId}`);
          return res.json({
            ...result,
            databaseUpdated: false
          });
        }
      } catch (dbError) {
        console.error(`Error updating rule in database: ${dbError.message}`);
        return res.json({
          ...result,
          databaseUpdated: false,
          databaseError: dbError.message
        });
      }
    } else {
      // If the interpreter update failed, return the error
      return res.json(result);
    }
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

// Rebuild all rules from database
router.post('/rebuild-rules', async (req, res) => {
  try {
    await syncRulesFromDatabase();
    res.json({ success: true, message: 'Rules rebuilt from database' });
  } catch (error) {
    console.error('Error rebuilding rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 