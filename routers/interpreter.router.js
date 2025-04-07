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
    
    const Rule = require('../models/Rule');
    
    // First check if this is a MongoDB ID (not an interpreter ID)
    let dbRule = null;
    
    try {
      // Try to find the rule by the MongoDB _id first
      dbRule = await Rule.findById(ruleId);
    } catch (error) {
      // Not a valid MongoDB ID, continue with normal flow
      console.log(`${ruleId} is not a valid MongoDB ID, treating as interpreter ID`);
    }
    
    if (dbRule) {
      console.log(`Found rule by MongoDB ID: ${dbRule._id}`);
      
      // If we found by MongoDB ID but the rule has no interpreter ID or the interpreter
      // doesn't recognize it, we need to re-create it in the interpreter
      let interpreterRuleId = dbRule.interpreterId;
      
      if (!interpreterRuleId || !interpreterService.getRuleById(interpreterRuleId)) {
        console.log(`Rule ${dbRule._id} needs to be recreated in interpreter`);
        
        // Get rule string
        const ruleString = dbRule.ruleString || dbRule.description;
        
        if (ruleString) {
          // Create in interpreter
          const createResult = await interpreterService.createRule(ruleString);
          
          if (createResult.success) {
            // Update database with new interpreter ID
            interpreterRuleId = createResult.ruleId;
            dbRule.interpreterId = interpreterRuleId;
            await dbRule.save();
            console.log(`Rule recreated in interpreter with ID: ${interpreterRuleId}`);
          } else {
            return res.status(500).json({ 
              success: false, 
              error: `Failed to recreate rule: ${createResult.error}`
            });
          }
        } else {
          return res.status(400).json({ 
            success: false, 
            error: 'Rule has no valid rule string for recreation'
          });
        }
      }
      
      // Now activate/deactivate using the interpreter ID
      const result = interpreterService.setRuleActive(interpreterRuleId, active);
      
      if (result.success) {
        // Update database
        dbRule.isActive = active;
        await dbRule.save();
        console.log(`Updated rule active status in database: ${dbRule._id}, isActive=${active}`);
        
        return res.json({
          success: true,
          ruleId: interpreterRuleId,
          databaseId: dbRule._id,
          isActive: active
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update rule status in interpreter'
        });
      }
    } else {
      // Try to find by interpreter ID
      dbRule = await Rule.findOne({ interpreterId: ruleId });
      
      // Update the rule in the interpreter
      const result = interpreterService.setRuleActive(ruleId, active);
      
      if (result.success) {
        // If we found a matching database rule, update it
        if (dbRule) {
          // Update the isActive status in the database
          dbRule.isActive = active;
          await dbRule.save();
          console.log(`Updated rule active status in database: ${dbRule._id}, isActive=${active}`);
          
          // Return success with additional info about the database update
          return res.json({
            success: true,
            ruleId: ruleId,
            databaseId: dbRule._id,
            isActive: active
          });
        } else {
          console.log(`No database rule found with interpreter ID ${ruleId}`);
          return res.json({
            success: true,
            ruleId: ruleId,
            databaseUpdated: false,
            isActive: active
          });
        }
      } else {
        return res.status(404).json({ 
          success: false, 
          error: `Rule ${ruleId} not found in interpreter`
        });
      }
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

// Add a route to reinitialize sensor logging
router.post('/reinitialize-logging', async (req, res) => {
  try {
    console.log('Request to reinitialize sensor logging received');
    const result = await interpreterService.initializeSensorLogging();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Sensor logging service reinitialized successfully',
        columns: result.columns
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to reinitialize sensor logging'
      });
    }
  } catch (error) {
    console.error('Error reinitializing sensor logging:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 