const Action = require('./Action');
const { notifyAnomalyDetection } = require('../../../utils/notificationService');

/**
 * SMS Action class that extends the base Action
 * Handles sending SMS/WhatsApp notifications
 */
class SMSAction extends Action {
    /**
     * Constructor for the SMS Action class
     * @param {string} name - The name of the action
     * @param {string} location - The location (room) for this action
     * @param {string} type - The type of action ('sms')
     */
    constructor(name, location, type = 'sms') {
        super(name, type, location);
        console.log(`Created SMS Action: ${name} for location: ${location}`);
    }

    /**
     * Pre-parse the action string to extract parameters
     * @param {string} actionString - The action string to parse
     * @returns {Object} The parsed parameters
     */
    preParseActionString(actionString) {
        // Extract phone number from the action string
        // Format: "send sms to +1234567890"
        let phoneNumber = null;
        
        // Try to extract phone number from different patterns, prioritizing "send sms to" format
        const patterns = [
            // "send sms to +1234567890"
            /send\s+sms\s+to\s+(\+\d+)/i,
            // "send notification to +1234567890"
            /send\s+notification\s+to\s+(\+\d+)/i,
            // "notify +1234567890"
            /notify\s+(\+\d+)/i,
            // Just a phone number at the end
            /then\s+(\+\d+)$/i
        ];
        
        for (const pattern of patterns) {
            const match = actionString.match(pattern);
            if (match) {
                phoneNumber = match[1].trim();
                console.log(`Extracted phone number using pattern: ${phoneNumber}`);
                break;
            }
        }
        
        return {
            state: 'send',
            params: {
                // We don't extract message here - it will be derived from the rule condition
                phoneNumber: phoneNumber,
                isNotificationAction: true
            }
        };
    }

    /**
     * Parse the action string at runtime
     * @param {string} actionString - The action string to parse
     */
    parseActionString(actionString) {
        const parsedParams = this.preParseActionString(actionString);
        this.state = parsedParams.state;
        this.params = parsedParams.params;
    }

    /**
     * Check if this action can handle the given action string
     * @param {string} actionString - The action string to check
     * @returns {boolean} True if this action can handle the string
     */
    canHandleAction(actionString) {
        const lowerAction = actionString.toLowerCase();
        // Prioritize "send sms to" format but still support other formats
        return (
            lowerAction.includes('send sms to') ||
            lowerAction.includes('send notification to') ||
            lowerAction.includes('notify') ||
            lowerAction.includes('send whatsapp to') ||
            /then\s+\+\d+$/.test(actionString) // Matches if action ends with a phone number
        );
    }

    /**
     * Called when a rule this action is observing evaluates to true
     * @param {Rule} rule - The rule that was triggered
     * @param {Object} context - Additional context data (like event values)
     */
    async onRuleTriggered(rule, context = {}) {
        this.logAction(`Rule triggered: ${rule.id} - ${rule.ruleString}`);
        
        // Get pre-parsed parameters if available
        const parsedParams = rule.getParsedActionParams();
        if (parsedParams) {
            // Use pre-parsed parameters
            this.state = parsedParams.state;
            this.params = parsedParams.params;
            this.logAction(`Using pre-parsed action parameters for rule ${rule.id}`);
        } else {
            // Fall back to parsing at runtime if necessary
            this.logAction(`No pre-parsed parameters available for rule ${rule.id}, parsing at runtime`);
            this.parseActionString(rule.actionString);
        }
        
        // For notification actions, always check the database for specific parameters
        try {
            // Load the Rule model from the database to get notification fields
            const Rule = require('../../../models/Rule');
            const dbRule = await Rule.findOne({ id: rule.id });
            
            if (dbRule) {
                // Determine location based on context or rule
                let location = context.location;
                if (!location && dbRule.space_id) {
                    // Try to extract location from space_id if no context location
                    location = dbRule.space_id;
                }
                
                // Use any notification parameters from the database
                const isNotificationRule = dbRule.isNotificationRule === true;
                const hasPhoneNumber = dbRule.notificationPhoneNumber && dbRule.notificationPhoneNumber.length > 0;
                
                // If this is explicitly marked as a notification rule or has notification parameters
                if (isNotificationRule || hasPhoneNumber || this.params.phoneNumber) {
                    this.logAction(`Rule ${rule.id} identified as notification rule`);
                    
                    // Extract the condition part from the rule string to use as the message
                    // The condition is everything between "if" and "then"
                    const conditionMatch = dbRule.ruleString.match(/if\s+(.+?)\s+then/i);
                    const condition = conditionMatch ? conditionMatch[1].trim() : null;
                    
                    // Use provided message or derive from rule condition
                    if (dbRule.notificationMessage && dbRule.notificationMessage.length > 0) {
                        this.params.message = dbRule.notificationMessage;
                        this.logAction(`Using notification message from database: ${this.params.message}`);
                    } else if (condition) {
                        // Auto-generate message from the rule condition
                        this.params.message = `ALERT: ${condition}`;
                        this.logAction(`Using rule condition as message: ${this.params.message}`);
                    }
                    
                    // Use phone number from database, or from action string, in that order
                    if (hasPhoneNumber) {
                        this.params.phoneNumber = dbRule.notificationPhoneNumber;
                        this.logAction(`Using phone number from database: ${this.params.phoneNumber}`);
                    } else if (this.params.phoneNumber) {
                        this.logAction(`Using phone number from action string: ${this.params.phoneNumber}`);
                    } else {
                        this.logAction(`No phone number specified, will use default numbers`);
                    }
                    
                    this.params.location = location;
                } else {
                    this.logAction(`Rule ${rule.id} does not have notification parameters in database`);
                    
                    // Extract message from rule condition
                    const conditionMatch = dbRule.ruleString.match(/if\s+(.+?)\s+then/i);
                    if (conditionMatch) {
                        this.params.message = `ALERT: ${conditionMatch[1].trim()}`;
                        this.logAction(`Using rule condition as message: ${this.params.message}`);
                    } else {
                        this.params.message = `Rule triggered: ${rule.id}`;
                    }
                    
                    // If no notification parameters found, check if we should still proceed
                    if (!this.params.isNotificationAction && !this.params.phoneNumber) {
                        this.logAction(`Rule ${rule.id} is not a notification action, skipping execution`);
                        return {
                            success: false,
                            message: 'Not a notification action'
                        };
                    }
                }
            } else {
                this.logAction(`Rule ${rule.id} not found in database`);
                
                // Fall back to extracting message from the rule condition
                const conditionMatch = rule.ruleString.match(/if\s+(.+?)\s+then/i);
                if (conditionMatch) {
                    this.params.message = `ALERT: ${conditionMatch[1].trim()}`;
                    this.logAction(`Using rule condition as message: ${this.params.message}`);
                }
            }
        } catch (error) {
            this.logAction(`Error loading rule from database: ${error.message}`);
            // Continue with existing parameters, try to extract message from rule condition
            const conditionMatch = rule.ruleString.match(/if\s+(.+?)\s+then/i);
            if (conditionMatch) {
                this.params.message = `ALERT: ${conditionMatch[1].trim()}`;
                this.logAction(`Using rule condition as message after error: ${this.params.message}`);
            }
        }
        
        // Execute the action
        return await this.execute(context);
    }

    /**
     * Execute the SMS action
     * @param {Object} context - Additional context data
     * @returns {Promise<Object>} Result of the action execution
     */
    async execute(context = {}) {
        try {
            // If we don't have a message, try to generate one from context
            if (!this.params.message || this.params.message.trim().length === 0) {
                if (context.eventName) {
                    this.params.message = `ALERT: ${context.eventName}`;
                    this.logAction(`Generated message from event name: ${this.params.message}`);
                } else {
                    this.params.message = "Alert from SmartSchool system";
                    this.logAction(`Using default message: ${this.params.message}`);
                }
            }
            
            this.logAction(`Sending notification: ${this.params.message}`);
            
            // Prepare notification data from context and message
            const anomalyData = {
                name: context.eventName || 'Unknown Event',
                location: context.location || this.params.location || this.location,
                metricType: context.metricType || 'Unknown',
                anomalyType: context.anomalyType || 'anomaly',
                confidence: context.confidence,
                timestamp: Date.now(),
                customMessage: this.params.message,
                fromAction: true,
                targetPhoneNumber: this.params.phoneNumber // Add the target phone number if specified
            };
            
            // Send the notification using the notification service
            const result = await notifyAnomalyDetection(anomalyData);
            
            return {
                success: result,
                message: result 
                    ? `Notification sent successfully: ${this.params.message}${this.params.phoneNumber ? ' to ' + this.params.phoneNumber : ''}`
                    : 'Failed to send notification'
            };
        } catch (error) {
            this.logAction(`Error sending notification: ${error.message}`);
            return {
                success: false,
                message: `Failed to send notification: ${error.message}`
            };
        }
    }
}

module.exports = SMSAction; 