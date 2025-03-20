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
            
            // Connect the rule to matching actions
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
            // Remove the rule as an observer from its event
            const event = EventRegistry.getEvent(rule.eventName);
            if (event) {
                event.removeObserver(rule);
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