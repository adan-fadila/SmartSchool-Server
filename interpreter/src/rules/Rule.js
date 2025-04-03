const EventRegistry = require('../events/EventRegistry');
const ActionRegistry = require('../actions/ActionRegistry');
const { notifyRuleTriggered } = require('../../../utils/notificationService');

/**
 * Class representing a rule in the system
 */
class Rule {
    /**
     * Create a new rule
     * @param {string} ruleString - The rule string in natural language format
     * @param {string} id - The unique ID for this rule
     */
    constructor(ruleString, id) {
        this.id = id;
        this.ruleString = ruleString;
        this.active = true; // Rules are active by default
        this.observingActions = []; // Actions that are observing this rule
        
        // Parse the rule string
        const parsedRule = this.parseRule(ruleString);
        
        if (!parsedRule) {
            console.error(`Failed to parse rule: ${ruleString}`);
            throw new Error(`Invalid rule format: ${ruleString}`);
        }
        
        this.eventName = parsedRule.eventName;
        this.condition = parsedRule.condition;
        this.actionString = parsedRule.actionString;
        this.parsedActionParams = null; // Will store pre-parsed action parameters
        
        // Check if this is an anomaly event rule
        this.isAnomalyRule = this.checkIfAnomalyRule();
        
        // Register this rule with the appropriate event
        const event = EventRegistry.getEvent(this.eventName);
        if (!event) {
            console.error(`Event "${this.eventName}" not found in EventRegistry`);
            throw new Error(`Event not found: ${this.eventName}`);
        }
        
        // Add this rule as an observer to the event
        event.addObserver(this);
        console.log(`Rule added as observer to event ${this.eventName}`);
    }

    /**
     * Check if this rule is related to an anomaly event
     * @returns {boolean} True if this is an anomaly rule
     */
    checkIfAnomalyRule() {
        // Check the event name or condition
        const event = EventRegistry.getEvent(this.eventName);
        if (event && event.type === 'anomaly') {
            return true;
        }
        
        // Check if the rule string mentions anomaly
        const anomalyKeywords = ['anomaly', 'anomalies', 'pointwise', 'seasonality', 'trend'];
        const ruleStringLower = this.ruleString.toLowerCase();
        return anomalyKeywords.some(keyword => ruleStringLower.includes(keyword));
    }

    /**
     * Parse rule string into components
     * @param {string} ruleString - The rule string to parse
     * @returns {Object|null} Object with eventName, condition, and actionString, or null if parsing failed
     */
    parseRule(ruleString) {
        // Example rule: "if living room temperature > 25 then living room light on"
        const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
        const ifThenMatch = ruleString.match(ifThenPattern);
        
        if (!ifThenMatch) {
            console.error(`Rule does not match if-then pattern: ${ruleString}`);
            return null;
        }

        const conditionPart = ifThenMatch[1].trim();
        const actionString = ifThenMatch[2].trim();

        // Check if this is an anomaly rule with "detected" pattern
        const anomalyDetectedPattern = /(.+?)\s+anomaly\s+detected$/i;
        const anomalyDetectedMatch = conditionPart.match(anomalyDetectedPattern);
        
        // Check if this is an anomaly rule with "not detected" pattern
        const anomalyNotDetectedPattern = /(.+?)\s+anomaly\s+not\s+detected$/i;
        const anomalyNotDetectedMatch = conditionPart.match(anomalyNotDetectedPattern);
        
        if (anomalyDetectedMatch) {
            // This is an anomaly rule with "detected"
            const eventName = anomalyDetectedMatch[1].trim();
            console.log(`Parsed anomaly rule for event: "${eventName}" with condition "detected"`);
            
            return {
                eventName,
                condition: { operator: 'anomaly_detected', value: 'true' },
                actionString
            };
        } else if (anomalyNotDetectedMatch) {
            // This is an anomaly rule with "not detected"
            const eventName = anomalyNotDetectedMatch[1].trim();
            console.log(`Parsed anomaly rule for event: "${eventName}" with condition "not detected"`);
            
            return {
                eventName,
                condition: { operator: 'anomaly_detected', value: 'false' },
                actionString
            };
        }
        
        // Not an anomaly rule, use standard operator-based parsing
        const conditionPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
        const conditionMatch = conditionPart.match(conditionPattern);
        
        if (!conditionMatch) {
            console.error(`Condition part does not match expected pattern: ${conditionPart}`);
            return null;
        }

        const eventName = conditionMatch[1].trim();
        const operator = conditionMatch[2].trim();
        const value = conditionMatch[3].trim();

        return {
            eventName,
            condition: { operator, value },
            actionString
        };
    }

    /**
     * Add an action as an observer of this rule
     * @param {Action} action - The action to add as an observer
     */
    addObservingAction(action) {
        if (!this.observingActions.includes(action)) {
            this.observingActions.push(action);
            console.log(`Action ${action.name} (${action.type}) now observing rule ${this.id}`);
        }
    }

    /**
     * Remove an action as an observer of this rule
     * @param {Action} action - The action to remove as an observer
     */
    removeObservingAction(action) {
        const index = this.observingActions.indexOf(action);
        if (index !== -1) {
            this.observingActions.splice(index, 1);
            console.log(`Action ${action.name} (${action.type}) no longer observing rule ${this.id}`);
        }
    }

    /**
     * Evaluate the rule based on the current event value
     * Called when the observed event changes
     */
    evaluate() {
        if (!this.active) {
            console.log(`Rule ${this.id} is not active, skipping evaluation`);
            return;
        }
        
        // Get the current value of the event
        const event = EventRegistry.getEvent(this.eventName);
        if (!event) {
            console.error(`Event ${this.eventName} not found for rule ${this.id}`);
            return;
        }
        
        const eventValue = event.currentValue;
        console.log(`Rule ${this.id} evaluation: ${this.condition.operator} ${this.condition.value} with event value ${eventValue}`);
        
        // Evaluate the condition
        const conditionMet = this.evaluateCondition(
            eventValue,
            this.condition.operator,
            this.condition.value
        );
        
        console.log(`Rule ${this.id} condition met: ${conditionMet}`);
        
        // If the condition is met, notify all observing actions
        if (conditionMet) {
            // Create context with current values
            const context = {
                eventName: this.eventName,
                eventValue: eventValue,
                conditionOperator: this.condition.operator,
                conditionValue: this.condition.value,
                timestamp: Date.now()
            };
            
            // Notify all observing actions
            this.notifyObservingActions(context);
        }
    }

    /**
     * Notify all actions that are observing this rule
     * @param {Object} context - Context data to pass to the actions
     */
    notifyObservingActions(context) {
        console.log(`Rule ${this.id} notifying ${this.observingActions.length} observing actions`);
        
        // If this is an anomaly rule, send a notification
        if (this.isAnomalyRule) {
            this.sendAnomalyRuleNotification(context);
        }
        
        this.observingActions.forEach(action => {
            try {
                action.onRuleTriggered(this, context)
                    .then(result => {
                        if (result.success) {
                            console.log(`Action ${action.name} executed successfully: ${result.message}`);
                        } else {
                            console.error(`Action ${action.name} execution failed: ${result.message}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error in action execution for ${action.name}: ${error.message}`);
                    });
            } catch (error) {
                console.error(`Error notifying action ${action.name}: ${error.message}`);
            }
        });
    }
    
    /**
     * Send a notification when an anomaly rule is triggered
     * @param {Object} context - Context data from the event
     */
    async sendAnomalyRuleNotification(context) {
        try {
            // Get more information about the event
            const event = EventRegistry.getEvent(this.eventName);
            if (!event) return;
            
            // Only send for anomaly events
            if (event.type !== 'anomaly') return;
            
            // Get action information
            const actions = this.observingActions.map(action => `${action.name}`).join(', ');
            
            // Prepare notification data
            const ruleData = {
                id: this.id,
                ruleString: this.ruleString,
                eventName: this.eventName,
                actions: actions
            };
            
            const eventData = {
                name: event.name,
                location: event.location,
                metricType: event.metricType,
                anomalyType: event.anomalyType
            };
            
            // Send notification using the notification service
            console.log(`Sending notification for rule: ${this.id}`);
            await notifyRuleTriggered(ruleData, eventData);
        } catch (error) {
            console.error('Failed to send rule notification:', error);
        }
    }

    /**
     * Evaluate a condition
     * @param {any} eventValue - Current value of the event
     * @param {string} operator - Condition operator (>, <, >=, <=, ==, !=, anomaly_detected)
     * @param {string} conditionValue - Value to compare against
     * @returns {boolean} True if condition is met, false otherwise
     */
    evaluateCondition(eventValue, operator, conditionValue) {
        // Special handling for anomaly events
        if (operator === 'anomaly_detected') {
            // For anomaly events, check if the anomaly is detected or not detected
            if (typeof eventValue === 'object' && eventValue !== null) {
                // If conditionValue is "false", we want "not detected"
                const expectedDetectionState = conditionValue.toLowerCase() !== 'false';
                return eventValue.detected === expectedDetectionState;
            }
            return false;
        }
        
        // Convert values to appropriate types
        let parsedEventValue = eventValue;
        let parsedConditionValue = conditionValue;

        // Try to convert to numbers if possible
        if (!isNaN(Number(eventValue))) {
            parsedEventValue = Number(eventValue);
        }
        if (!isNaN(Number(conditionValue))) {
            parsedConditionValue = Number(conditionValue);
        }

        // Evaluate based on operator
        switch (operator) {
            case '>':
                return parsedEventValue > parsedConditionValue;
            case '<':
                return parsedEventValue < parsedConditionValue;
            case '>=':
                return parsedEventValue >= parsedConditionValue;
            case '<=':
                return parsedEventValue <= parsedConditionValue;
            case '==':
            case '=':
                return parsedEventValue == parsedConditionValue;
            case '!=':
                return parsedEventValue != parsedConditionValue;
            default:
                console.error(`Unsupported operator: ${operator}`);
                return false;
        }
    }

    /**
     * Execute the action part of the rule
     */
    async executeAction() {
        console.log(`Executing action for rule ${this.id}: ${this.actionString}`);
        
        try {
            // Use the ActionRegistry to execute the action
            const result = await ActionRegistry.executeAction(this.actionString);
            
            if (result.success) {
                console.log(`Rule ${this.id} action executed successfully: ${result.message}`);
            } else {
                console.error(`Rule ${this.id} action execution failed: ${result.message}`);
            }
            
            return result;
        } catch (error) {
            console.error(`Error executing action for rule ${this.id}: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Activate the rule
     */
    activate() {
        this.active = true;
        console.log(`Rule ${this.id} activated`);
    }

    /**
     * Deactivate the rule
     */
    deactivate() {
        this.active = false;
        console.log(`Rule ${this.id} deactivated`);
    }

    /**
     * Store pre-parsed action parameters
     * @param {Object} params - The parsed action parameters
     */
    setParsedActionParams(params) {
        this.parsedActionParams = params;
        console.log(`Pre-parsed action parameters stored for rule ${this.id}`);
    }

    /**
     * Get pre-parsed action parameters
     * @returns {Object|null} The parsed action parameters or null if not yet parsed
     */
    getParsedActionParams() {
        return this.parsedActionParams;
    }
}

module.exports = Rule; 