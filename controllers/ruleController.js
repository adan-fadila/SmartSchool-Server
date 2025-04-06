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
    getRuleById
  } = require("./../services/rules.service.js");

// Import the interpreter service
const interpreterService = require('../interpreter/src/server-integration');
// Import the AnomalyDescription model
const AnomalyDescription = require('../models/AnomalyDescription');

/**
 * Check if a rule condition string matches our required format: [event][condition] then [action]
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule matches our format, false otherwise
 */
function isValidRuleFormat(ruleString) {
    if (!ruleString) return false;
    
    // Normalize rule string to lowercase for consistent matching
    const normalizedRule = ruleString.toLowerCase();
    
    // Basic check for "if" and "then" keywords - case insensitive
    const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
    const ifThenMatch = normalizedRule.match(ifThenPattern);
    
    if (!ifThenMatch) return false;
    
    // Check that condition part has an operator
    const conditionPart = ifThenMatch[1].trim();
    const operatorPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
    const operatorMatch = conditionPart.match(operatorPattern);
    
    return !!operatorMatch;
}

/**
 * Check if a rule condition is related to an anomaly
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule is related to an anomaly, false otherwise
 */
function isAnomalyRule(ruleString) {
    if (!ruleString) return false;
    
    // Convert to lowercase for case-insensitive matching
    const lowerCaseRule = ruleString.toLowerCase();
    
    // Check if the rule contains keywords related to anomalies
    return (
        lowerCaseRule.includes('anomaly') || 
        lowerCaseRule.includes('pointwise') || 
        lowerCaseRule.includes('seasonality') || 
        lowerCaseRule.includes('trend')
    );
}

/**
 * Extract the anomaly description from a rule string
 * @param {string} ruleString - The rule string to parse
 * @returns {string|null} The anomaly description or null if not found
 */
function extractAnomalyDescription(ruleString) {
    if (!ruleString) return null;
    
    // Convert to lowercase
    const lowerCaseRule = ruleString.toLowerCase();
    
    // Extract the condition part between "if" and "then"
    const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
    const ifThenMatch = lowerCaseRule.match(ifThenPattern);
    
    if (!ifThenMatch) return null;
    
    const conditionPart = ifThenMatch[1].trim();
    
    // For now, we'll consider the entire condition part as the potential anomaly description
    return conditionPart;
}
  
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
        const rule = req.body;
        console.log("Adding new rule:", rule);
        
        try {
            // Check if the rule condition or description matches our format and can be added to the interpreter
            const ruleText = rule.description || rule.condition;
            
            // Check if this is an anomaly-related rule
            if (isAnomalyRule(ruleText)) {
                console.log("Rule appears to be related to anomalies, checking for anomaly descriptions");
                
                // Extract the potential anomaly description
                const potentialDescription = extractAnomalyDescription(ruleText);
                
                // Check if this description exists in our database
                const anomalyDescription = await AnomalyDescription.findOne({
                    description: { $regex: new RegExp(potentialDescription, 'i') },
                    spaceId: rule.space_id,
                    isActive: true
                });
                
                if (!anomalyDescription) {
                    console.log(`No matching anomaly description found for: ${potentialDescription}`);
                    return res.status(400).json({
                        status: 400,
                        message: "Cannot create anomaly rule without a corresponding anomaly description. Please create a description for this anomaly first."
                    });
                }
                
                console.log(`Found matching anomaly description: ${anomalyDescription.description}`);
                
                // Store the anomaly description ID with the rule for reference
                rule.anomalyDescriptionId = anomalyDescription._id;
                rule.rawEventName = anomalyDescription.rawEventName;
            }
            
            if (ruleText && isValidRuleFormat(ruleText)) {
                console.log("Rule text matches interpreter format:", ruleText);
                
                // Create the rule in the interpreter system
                const interpreterResult = interpreterService.createRule(ruleText);
                
                if (interpreterResult.success) {
                    console.log("Rule created in interpreter:", interpreterResult.ruleId);
                    
                    // Add the interpreter rule ID to the rule object
                    rule.interpreterId = interpreterResult.ruleId;
                    rule.ruleString = ruleText;
                } else {
                    console.log("Failed to create rule in interpreter:", interpreterResult.error);
                }
            } else {
                console.log("Rule does not match interpreter format:", ruleText);
            }
            
            // Continue with adding the rule to the database
            const response = await add_new_Rule(rule);
            res.status(response.statusCode).send(response.message);
        } catch (error) {
            console.error("Error adding rule:", error);
            res.status(500).send({
                status: 500,
                message: `Error adding rule: ${error.message}`
            });
        }
    },
    
    async update_Rule(req, res){
        const updateFields = { ...req.body }; // Includes isActive and any other fields
        const id = req.params.id;
        
        try {
            // Get the rule to check if it has an interpreter ID
            const rule = await getRuleById(id);
            
            // Determine the current and new rule text
            const currentRuleText = rule ? (rule.description || rule.condition) : null;
            const newRuleText = updateFields.description || updateFields.condition;
            
            // Check if the new rule is anomaly-related
            if (newRuleText && isAnomalyRule(newRuleText) && newRuleText !== currentRuleText) {
                console.log("Updated rule appears to be related to anomalies, checking for anomaly descriptions");
                
                // Extract the potential anomaly description
                const potentialDescription = extractAnomalyDescription(newRuleText);
                
                // Check if this description exists in our database
                const anomalyDescription = await AnomalyDescription.findOne({
                    description: { $regex: new RegExp(potentialDescription, 'i') },
                    spaceId: rule.space_id,
                    isActive: true
                });
                
                if (!anomalyDescription) {
                    console.log(`No matching anomaly description found for: ${potentialDescription}`);
                    return res.status(400).json({
                        status: 400,
                        message: "Cannot update to an anomaly rule without a corresponding anomaly description. Please create a description for this anomaly first."
                    });
                }
                
                console.log(`Found matching anomaly description: ${anomalyDescription.description}`);
                
                // Store the anomaly description ID with the rule for reference
                updateFields.anomalyDescriptionId = anomalyDescription._id;
                updateFields.rawEventName = anomalyDescription.rawEventName;
            }
            
            // Check if this is an interpreter rule or if the rule text has changed
            if ((rule && rule.interpreterId) || 
                (newRuleText && isValidRuleFormat(newRuleText))) {
                
                // If the rule already has an interpreter ID
                if (rule && rule.interpreterId) {
                    // If active status is being updated
                    if (updateFields.hasOwnProperty('isActive')) {
                        console.log(`Updating rule active state in interpreter: ${rule.interpreterId} -> ${updateFields.isActive}`);
                        
                        // Update the rule in the interpreter
                        interpreterService.setRuleActive(rule.interpreterId, updateFields.isActive);
                    }
                    
                    // If the rule text is being updated, recreate the rule in the interpreter
                    if (newRuleText && newRuleText !== currentRuleText) {
                        console.log(`Updating rule text in interpreter: ${rule.interpreterId}`);
                        
                        // Delete the old rule
                        interpreterService.deleteRule(rule.interpreterId);
                        
                        // Create a new rule with the updated text
                        if (isValidRuleFormat(newRuleText)) {
                            const newInterpreterResult = interpreterService.createRule(newRuleText);
                            
                            if (newInterpreterResult.success) {
                                console.log(`Created new interpreter rule: ${newInterpreterResult.ruleId}`);
                                updateFields.interpreterId = newInterpreterResult.ruleId;
                                updateFields.ruleString = newRuleText;
                            } else {
                                console.log(`Failed to create new interpreter rule: ${newInterpreterResult.error}`);
                            }
                        } else {
                            // If the new text is not valid for interpreter, remove the interpreterId
                            console.log(`Updated rule text is not valid for interpreter: ${newRuleText}`);
                            updateFields.interpreterId = '';
                            updateFields.ruleString = '';
                        }
                    }
                } 
                // If this is a new rule being made compatible with the interpreter
                else if (newRuleText && isValidRuleFormat(newRuleText)) {
                    console.log(`Adding rule to interpreter with text: ${newRuleText}`);
                    
                    // Create the rule in the interpreter
                    const interpreterResult = interpreterService.createRule(newRuleText);
                    
                    if (interpreterResult.success) {
                        console.log(`Created interpreter rule: ${interpreterResult.ruleId}`);
                        updateFields.interpreterId = interpreterResult.ruleId;
                        updateFields.ruleString = newRuleText;
                    } else {
                        console.log(`Failed to create interpreter rule: ${interpreterResult.error}`);
                    }
                }
            }
            
            // Update the rule in the database
            const response = await updateRule(id, updateFields);
            return res.status(response.statusCode).send(response.message);
        } catch (error) {
            console.error(`Error updating rule ${id}:`, error);
            return res.status(500).send({
                status: 500,
                message: `Error updating rule: ${error.message}`
            });
        }
    },
    
    async delete_Rule_ByID(req, res){
        const id = req.params.id;
        try {
            // Get the rule to check if it has an interpreter ID
            const rule = await getRuleById(id);
            
            // If it has an interpreter ID, delete it from the interpreter too
            if (rule && rule.interpreterId) {
                console.log(`Deleting rule from interpreter: ${rule.interpreterId}`);
                interpreterService.deleteRule(rule.interpreterId);
            }
            
            // Delete the rule from the database
            const response = await deleteRuleById(id);
        
            if (response.status === 200) {
                res.status(200).json({ message: "Rule deleted successfully" });
            } else {
                res.status(400).json({ message: "Error deleting the rule" });
            }
        } catch (error) {
            console.error(`Error deleting rule ${id}:`, error);
            res.status(500).json({ message: `Server error: ${error.message}` });
        }
    },
}