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
 * Check if a rule condition string matches our required formats
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule matches any of our accepted formats, false otherwise
 */
function isValidRuleFormat(ruleString) {
    if (!ruleString || typeof ruleString !== 'string') {
        return false;
    }
    
    // Basic if-then pattern
    const ifThenPattern = /if\s+.+\s+then\s+.+/i;
    if (!ifThenPattern.test(ruleString)) {
        return false;
    }
    
    // Check for multi-condition rules with AND or OR
    const andPattern = /\s+AND\s+/i;
    const orPattern = /\s+OR\s+/i;
    const hasAndOperator = andPattern.test(ruleString);
    const hasOrOperator = orPattern.test(ruleString);
    
    // Validate that we don't have mixed operators
    if (hasAndOperator && hasOrOperator) {
        return false; // Mixed AND/OR not supported
    }
    
    return true;
}

/**
 * Check if a single condition string is valid
 * @param {string} conditionStr - The condition string to check
 * @returns {boolean} True if the condition is valid, false otherwise
 */
function isValidSingleCondition(conditionStr) {
    if (!conditionStr || typeof conditionStr !== 'string') {
        return false;
    }
    
    // Check if this is an anomaly rule (contains "detected")
    if (conditionStr.includes('anomaly') && conditionStr.includes('detected')) {
        return true;
    }
    
    // Check if this is a motion detected rule
    const motionDetectedPattern = /(.+?)\s+motion\s+detected$/i;
    if (motionDetectedPattern.test(conditionStr)) {
        return true;
    }
    
    // Check if this is a rule with custom description using "detected" pattern
    if (conditionStr.endsWith('detected')) {
        return true;
    }
    
    // Check if this is a sensor value rule (has comparison operator)
    const operatorPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
    const operatorMatch = conditionStr.match(operatorPattern);
    
    if (operatorMatch) {
        return true;
    }
    
    // Check for "if [Device] [Sensor] [Value]" pattern
    // Example: "Living Room motion true"
    const deviceSensorValuePattern = /^(.+?)\s+(.+?)\s+(true|false|on|off|\d+)$/i;
    const conditionMatch = conditionStr.match(deviceSensorValuePattern);
    
    if (conditionMatch) {
        return true;
    }
    
    return false;
}

/**
 * Check if a rule string is related to anomalies
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule is anomaly-related, false otherwise
 */
function isAnomalyRule(ruleString) {
    if (!ruleString || typeof ruleString !== 'string') {
        console.log('isAnomalyRule: Invalid input:', ruleString);
        return false;
    }
    
    // Check if the rule contains keywords related to anomalies
    const normalizedRule = ruleString.toLowerCase();
    
    // For multi-condition rules, check if any condition contains anomaly keywords
    const andPattern = /\s+AND\s+/i;
    if (andPattern.test(normalizedRule)) {
        console.log('isAnomalyRule: Multi-condition rule detected, checking each condition');
        
        // Extract the condition part between "if" and "then"
        const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
        const ifThenMatch = normalizedRule.match(ifThenPattern);
        
        if (ifThenMatch) {
            const conditionPart = ifThenMatch[1].trim();
            const conditionStrings = conditionPart.split(andPattern).map(c => c.trim());
            
            // Check if any condition contains anomaly keywords
            for (const condition of conditionStrings) {
                if (condition.includes('anomaly') || 
                    condition.includes('detected') ||
                    condition.includes('collective') ||
                    condition.includes('pointwise')) {
                    console.log('isAnomalyRule: Found anomaly condition:', condition);
                    return true;
                }
            }
        }
        
        console.log('isAnomalyRule: No anomaly conditions found in multi-condition rule');
        return false;
    }
    
    // For single-condition rules, check the entire rule
    return normalizedRule.includes('anomaly') || 
           normalizedRule.includes('detected')  ||
           normalizedRule.includes('collective') ||
           normalizedRule.includes('pointwise');
}

/**
 * Extract the anomaly description from a rule string
 * @param {string} ruleString - The rule string to parse
 * @returns {string|null} The anomaly description or null if not found
 */
function extractAnomalyDescription(ruleString) {
    if (!ruleString || typeof ruleString !== 'string') {
        console.log('extractAnomalyDescription: Invalid input:', ruleString);
        return null;
    }
    
    // Convert to lowercase
    const lowerCaseRule = ruleString.toLowerCase();
    
    // Extract the condition part between "if" and "then"
    const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
    const ifThenMatch = lowerCaseRule.match(ifThenPattern);
    
    if (!ifThenMatch) {
        console.log('extractAnomalyDescription: No if-then pattern found');
        return null;
    }
    
    let conditionPart = ifThenMatch[1].trim();
    
    // Check for multi-condition rules with AND
    const andPattern = /\s+AND\s+/i;
    if (andPattern.test(conditionPart)) {
        console.log('extractAnomalyDescription: Multi-condition rule detected, splitting by AND');
        
        // Split conditions by AND and look for anomaly-related conditions
        const conditionStrings = conditionPart.split(andPattern).map(c => c.trim());
        
        // Find the first condition that contains anomaly-related keywords
        for (const condition of conditionStrings) {
            if (condition.includes('anomaly') || condition.includes('detected') || 
                condition.includes('collective') || condition.includes('pointwise')) {
                conditionPart = condition;
                console.log('extractAnomalyDescription: Found anomaly condition:', conditionPart);
                break;
            }
        }
        
        // If no anomaly condition found, return null
        if (andPattern.test(conditionPart)) {
            console.log('extractAnomalyDescription: No anomaly condition found in multi-condition rule');
            return null;
        }
    }
    
    // Remove 'detected' from the end if it exists
    conditionPart = conditionPart.replace(/\s+detected$/, '');
    
    // Remove anomaly type keywords if they exist
    const anomalyTypes = ['pointwise', 'collective'];
    anomalyTypes.forEach(type => {
        conditionPart = conditionPart.replace(new RegExp(`\\s+${type}\\s+`, 'g'), ' ');
        conditionPart = conditionPart.replace(new RegExp(`\\s+${type}$`, 'g'), '');
    });
    
    // Remove the word 'anomaly' if it exists
    conditionPart = conditionPart.replace(/\s+anomaly\s*/g, '');
    
    // Clean up any multiple spaces and trim
    const description = conditionPart.replace(/\s+/g, ' ').trim();
    
    // Log the extracted description for debugging
    console.log('extractAnomalyDescription: Extracted description from rule:', {
        original: lowerCaseRule,
        extracted: description
    });
    
    return description;
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
    async add_Rule(req, res) {
        const rule = req.body;
        console.log("Adding new rule:", rule);
        
        try {
            // Check if the rule condition or description matches our format and can be added to the interpreter
            const ruleText = rule.description || rule.condition;
            
            // Check if this is an anomaly-related rule
            if (isAnomalyRule(ruleText)) {
                console.log("Rule appears to be related to anomalies, checking for anomaly descriptions");
                
                // Extract the potential anomaly description from the rule text
                const potentialDescription = extractAnomalyDescription(ruleText);
                console.log("Potential description extracted:", potentialDescription);
                
                // Find the matching anomaly description in the database
                const anomalyDescription = await AnomalyDescription.findOne({
                    spaceId: rule.space_id,
                    isActive: true,
                    $or: [
                        // Exact match
                        { description: potentialDescription },
                        // Case-insensitive match
                        { description: { $regex: new RegExp('^' + escapeRegExp(potentialDescription) + '$', 'i') } },
                        // Description contains the potential description
                        { description: { $regex: new RegExp(escapeRegExp(potentialDescription), 'i') } },
                        // Potential description contains the description
                        { $expr: { $regexMatch: { input: potentialDescription, regex: new RegExp(escapeRegExp('$description'), 'i') } } }
                    ]
                });
                
                if (!anomalyDescription) {
                    console.log(`No matching anomaly description found for: "${potentialDescription}"`);
                    return res.status(400).json({
                        status: 400,
                        message: "Cannot create anomaly rule without a corresponding anomaly description. Please create a description for this anomaly first."
                    });
                }
                
                console.log(`Found matching anomaly description:`, {
                    description: anomalyDescription.description,
                    rawEventName: anomalyDescription.rawEventName,
                    anomalyType: anomalyDescription.anomalyType
                });
                
                // Store the anomaly description ID with the rule for reference
                rule.anomalyDescriptionId = anomalyDescription._id;
                
                // If this is an SMS notification rule, use the description from the anomalyDescriptions table
                if (rule.isNotificationRule && rule.action && rule.action.toLowerCase().includes('send sms')) {
                    console.log("This is an SMS notification rule, using the anomaly description for the message");
                    rule.notificationMessage = anomalyDescription.description;
                }
                
                // Extract the action part from the original rule
                const actionMatch = ruleText.match(/then\s+(.+)$/i);
                if (!actionMatch) {
                    return res.status(400).json({
                        status: 400,
                        message: "Invalid rule format: Could not extract action part"
                    });
                }
                const action = actionMatch[1].trim();

                // Construct the rule using the rawEventName from the anomaly description
                const interpreterRuleText = `if ${anomalyDescription.rawEventName} detected then ${action}`;
                console.log("Constructed interpreter rule for interpreter:", interpreterRuleText);
                
                // Set the event using the rawEventName from the description
                rule.event = `${anomalyDescription.rawEventName} detected`;
                rule.ruleString = interpreterRuleText;

                // IMPORTANT: Use the constructed interpreter rule text when creating the rule
                const interpreterResult = interpreterService.createRule(interpreterRuleText);
                
                if (interpreterResult.success) {
                    console.log("Rule created in interpreter:", interpreterResult.ruleId);
                    rule.interpreterId = interpreterResult.ruleId;
                    rule.isActive = true;  // Ensure rule is active
                } else {
                    console.log("Failed to create rule in interpreter:", interpreterResult.error);
                    // Even if interpreter creation fails, continue to save the rule in the database
                }
            } else {
                // For non-anomaly rules, use the original rule text
                console.log("Rule is not anomaly-related, using original format");
                
                if (isValidRuleFormat(ruleText)) {
                    console.log("Rule text matches interpreter format:", ruleText);
                    
                    const interpreterResult = interpreterService.createRule(ruleText);
                    
                    if (interpreterResult.success) {
                        console.log("Rule created in interpreter:", interpreterResult.ruleId);
                        rule.interpreterId = interpreterResult.ruleId;
                        rule.ruleString = ruleText;
                        rule.isActive = true;  // Ensure rule is active
                    } else {
                        console.log("Failed to create rule in interpreter:", interpreterResult.error);
                    }
                } else {
                    console.log("Rule does not match interpreter format:", ruleText);
                }
            }
            
            console.log("Rule ready to save in the database:", {
                event: rule.event,
                ruleString: rule.ruleString,
                interpreterId: rule.interpreterId,
                isActive: rule.isActive,
                notificationMessage: rule.notificationMessage
            });
            
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

// Helper function to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}