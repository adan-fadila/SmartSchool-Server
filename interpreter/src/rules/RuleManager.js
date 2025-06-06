const Rule = require('./Rule');
const EventRegistry = require('../events/EventRegistry');
const ActionRegistry = require('../actions/ActionRegistry');

/**
 * Class for managing all rules in the system
 */
class RuleManager {
    constructor() {
        this.rules = new Map(); // Map of rule ID to rule instance
    }

    /**
     * Create a new rule and add it to the manager
     * @param {string} ruleString - The rule string in natural language format
     * @returns {string} The ID of the created rule
     */
    createRule(ruleString) {
        try {
            const id = `rule_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const rule = new Rule(ruleString, id);
            this.rules.set(id, rule);
            console.log(`Rule created and registered with ID: ${id}`);
            
            // Check if this rule has async initialization (custom anomaly description)
            if (rule.initPromise) {
                console.log(`Rule ${id} has async initialization, waiting for completion`);
                
                // Start async initialization but don't block
                rule.initPromise
                    .then(() => {
                        console.log(`Rule ${id} async initialization completed successfully`);
                        
                        // Connect the rule to matching actions after initialization
                        const matchingActions = ActionRegistry.connectRuleToActions(rule);
                        console.log(`Rule ${id} connected to ${matchingActions.length} actions`);
                    })
                    .catch(error => {
                        console.error(`Rule ${id} async initialization failed:`, error);
                        
                        // Rule initialization failed, remove it from the manager
                        this.rules.delete(id);
                        
                        // We can't throw an error here since we're in a promise callback
                        // The error will be handled by the caller through event emitter or callback pattern
                    });
                
                // Return the ID immediately without waiting for initialization
                // The rule will be fully functional once initialization completes
                return id;
            }
            
            // For synchronous rules, connect to actions immediately
            const matchingActions = ActionRegistry.connectRuleToActions(rule);
            console.log(`Rule ${id} connected to ${matchingActions.length} actions`);
            
            return id;
        } catch (error) {
            console.error(`Failed to create rule from string: ${ruleString}`, error);
            throw error;
        }
    }

    /**
     * Get a rule by ID
     * @param {string} ruleId - The ID of the rule to retrieve
     * @returns {Rule|undefined} The rule instance or undefined if not found
     */
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }

    /**
     * Delete a rule by ID
     * @param {string} ruleId - The ID of the rule to delete
     * @returns {boolean} True if the rule was deleted, false otherwise
     */
    deleteRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            // Handle multi-condition rules
            if (rule.isMultiCondition && rule.eventNames && rule.eventNames.length > 0) {
                // Remove the rule as an observer from all its events
                for (const eventName of rule.eventNames) {
                    if (eventName) {
                        const event = EventRegistry.getEvent(eventName);
                        if (event) {
                            event.removeObserver(rule);
                            console.log(`Removed multi-condition rule ${ruleId} from event ${eventName}`);
                        }
                    }
                }
            } 
            // Handle single-condition rules
            else if (rule.eventName) {
                // Remove the rule as an observer from its event
                const event = EventRegistry.getEvent(rule.eventName);
                if (event) {
                    event.removeObserver(rule);
                    console.log(`Removed single-condition rule ${ruleId} from event ${rule.eventName}`);
                }
            } else {
                console.warn(`Rule ${ruleId} has no eventName or eventNames defined during deletion`);
            }
            
            // Disconnect the rule from all actions
            ActionRegistry.disconnectRuleFromActions(rule);
            
            // Delete the rule from the manager
            this.rules.delete(ruleId);
            console.log(`Rule ${ruleId} deleted`);
            return true;
        }
        
        console.warn(`Rule ${ruleId} not found for deletion`);
        return false;
    }

    /**
     * Activate a rule by ID
     * @param {string} ruleId - The ID of the rule to activate
     * @returns {boolean} True if the rule was activated, false otherwise
     */
    activateRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.activate();
            return true;
        }
        
        console.warn(`Rule ${ruleId} not found for activation`);
        return false;
    }

    /**
     * Deactivate a rule by ID
     * @param {string} ruleId - The ID of the rule to deactivate
     * @returns {boolean} True if the rule was deactivated, false otherwise
     */
    deactivateRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.deactivate();
            return true;
        }
        
        console.warn(`Rule ${ruleId} not found for deactivation`);
        return false;
    }

    /**
     * Get all rules
     * @returns {Array<Rule>} Array of all rule instances
     */
    getAllRules() {
        return Array.from(this.rules.values());
    }
}

module.exports = new RuleManager(); // Export a singleton instance 