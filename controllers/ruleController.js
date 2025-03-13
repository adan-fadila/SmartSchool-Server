const {
    insertRuleToDB,
    add_new_Rule,
    getAllRules,
    updateRule,
    deleteRuleById,
    getRulesBySpaceId,
    checkIfRuleIsAlreadyExists,
    operatorFormatter,
    validateRule,
    insertRuleToDBMiddleware,
    removeAllRules,
    removeRuleFromDB,
  } = require("./../services/rules.service.js");

const Rule = require('../models/Rule'); // Import the Rule model
  
exports.ruleControllers={
// --------------------------------- Rules ---------------------------------

    async get_Rules(req, res){
        const response = await getAllRules();
        res.status(response.statusCode).json(response.data);
    },
    async get_Rules_By_SPACE_ID(req, res) {
      // Extracting space ID from request parameters
      const space_id = req.params.space_id;
      
      // Fetching rules by space ID
      const response = await getRulesBySpaceId(space_id);
    
      // Sending the response with appropriate status code and data
      if (response.statusCode === 200) {
        res.status(200).json(response.data);
      } else {
        res.status(response.statusCode).json({ message: response.message });
      }
    },
    // Define the route for adding a new rule
    async add_Rule(req, res){
        try {
            const ruleData = req.body;
            
            // Ensure the rule has the required fields
            if (!ruleData.description && (!ruleData.event || !ruleData.action)) {
                return res.status(400).json({ message: "Rule must have either a description or both event and action fields" });
            }
            
            // If description is not provided but event and action are, create the description
            if (!ruleData.description && ruleData.event && ruleData.action) {
                ruleData.description = `if ${ruleData.event} then ${ruleData.action}`;
            }
            
            // Add the rule
            const response = await add_new_Rule(ruleData);
            
            return res.status(response.statusCode).json(response.data);
        } catch (error) {
            console.error("Error adding rule:", error);
            return res.status(500).json({ message: error.message });
        }
    },
    async update_Rule(req, res){
        try {
            const ruleId = req.params.id;
            const updateFields = req.body;
            
            // If description is not provided but event and action are, create the description
            if (!updateFields.description && updateFields.event && updateFields.action) {
                updateFields.description = `if ${updateFields.event} then ${updateFields.action}`;
            }
            
            // Update the rule
            const response = await updateRule(ruleId, updateFields);
            
            return res.status(response.statusCode).json(response.data);
        } catch (error) {
            console.error("Error updating rule:", error);
            return res.status(500).json({ message: error.message });
        }
    },
    async delete_Rule_ByID(req, res){
        const id = req.params.id;
        try {
            const response = await deleteRuleById(id);
            
            if (response.status === 200) {
                return res.status(200).json({ message: "Rule deleted successfully" });
            } else if (response.status === 404) {
                return res.status(404).json({ message: "Rule not found" });
            } else {
                return res.status(400).json({ message: "Error deleting the rule" });
            }
        } catch (error) {
            console.error("Error deleting rule:", error);
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    },
    async reload_Rules(req, res) {
        try {
            // Import the loadRulesFromDatabase function from the integration module
            const { loadRulesFromDatabase } = require('../interpeter/src/new_interpreter/integration');
            
            // Reload rules from the database
            console.log('Manually reloading rules from the database...');
            await loadRulesFromDatabase();
            console.log('Rules reloaded successfully');
            
            return res.status(200).json({ message: "Rules reloaded successfully" });
        } catch (error) {
            console.error("Error reloading rules:", error);
            return res.status(500).json({ message: "Error reloading rules", error: error.message });
        }
    },
    
    // Activate a rule
    async activate_Rule(req, res) {
        try {
            const ruleId = req.params.id;
            
            // Find the rule
            const rule = await Rule.findById(ruleId);
            
            if (!rule) {
                return res.status(404).json({ message: "Rule not found" });
            }
            
            // Check if the rule is already active
            if (rule.isActive) {
                return res.status(200).json({ message: "Rule is already active" });
            }
            
            // Activate the rule in the database
            rule.isActive = true;
            await rule.save();
            
            // Log the activation
            console.log(`Rule ${ruleId} activated in the database: ${rule.description || (rule.event + ' -> ' + rule.action)}`);
            
            // Import the loadRulesFromDatabase function to ensure all rules are properly reloaded
            const { loadRulesFromDatabase } = require('../interpeter/src/new_interpreter/integration');
            
            // Reload all rules to ensure the rule is properly activated
            console.log(`Reloading all rules to ensure proper activation of rule ${ruleId}...`);
            await loadRulesFromDatabase();
            console.log('Rules reloaded successfully after activation');
            
            return res.status(200).json({ message: "Rule activated successfully" });
        } catch (error) {
            console.error("Error activating rule:", error);
            return res.status(500).json({ message: "Error activating rule", error: error.message });
        }
    },
    
    // Deactivate a rule
    async deactivate_Rule(req, res) {
        try {
            const ruleId = req.params.id;
            
            // Find the rule
            const rule = await Rule.findById(ruleId);
            
            if (!rule) {
                return res.status(404).json({ message: "Rule not found" });
            }
            
            // Check if the rule is already inactive
            if (!rule.isActive) {
                return res.status(200).json({ message: "Rule is already inactive" });
            }
            
            // Deactivate the rule in the database
            rule.isActive = false;
            await rule.save();
            
            // Log the deactivation
            console.log(`Rule ${ruleId} deactivated in the database: ${rule.description || (rule.event + ' -> ' + rule.action)}`);
            
            // Import the loadRulesFromDatabase function to ensure all rules are properly reloaded
            const { loadRulesFromDatabase } = require('../interpeter/src/new_interpreter/integration');
            
            // Reload all rules to ensure the rule is properly deactivated
            console.log(`Reloading all rules to ensure proper deactivation of rule ${ruleId}...`);
            await loadRulesFromDatabase();
            console.log('Rules reloaded successfully after deactivation');
            
            return res.status(200).json({ message: "Rule deactivated successfully" });
        } catch (error) {
            console.error("Error deactivating rule:", error);
            return res.status(500).json({ message: "Error deactivating rule", error: error.message });
        }
    }
}