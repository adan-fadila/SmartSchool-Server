/**
 * Registry for rules in the system
 */
class RuleRegistry {
    constructor() {
        this.rules = new Map();
    }

    /**
     * Register a rule in the registry
     * @param {Rule} rule - The rule to register
     * @returns {Rule} The registered rule
     */
    register(rule) {
        this.rules.set(rule.id, rule);
        return rule;
    }

    /**
     * Get a rule by its ID
     * @param {string} ruleId - The ID of the rule to get
     * @returns {Rule|null} The rule, or null if not found
     */
    getById(ruleId) {
        return this.rules.get(ruleId) || null;
    }

    /**
     * Get all rules that use a specific event
     * @param {string} eventId - The ID of the event
     * @returns {Rule[]} Array of rules that use the specified event
     */
    getRulesByEventId(eventId) {
        return Array.from(this.rules.values())
            .filter(rule => rule.event.getId() === eventId);
    }

    /**
     * Get all rules that use a specific action
     * @param {string} actionId - The ID of the action
     * @returns {Rule[]} Array of rules that use the specified action
     */
    getRulesByActionId(actionId) {
        return Array.from(this.rules.values())
            .filter(rule => rule.action.getId() === actionId);
    }

    /**
     * Get all rules for a specific location
     * @param {string} location - The location to get rules for
     * @returns {Rule[]} Array of rules for the specified location
     */
    getRulesByLocation(location) {
        return Array.from(this.rules.values())
            .filter(rule => 
                rule.event.location === location || 
                rule.action.location === location
            );
    }

    /**
     * Get all registered rules
     * @returns {Rule[]} Array of all registered rules
     */
    getAll() {
        return Array.from(this.rules.values());
    }

    /**
     * Remove a rule from the registry
     * @param {string} ruleId - The ID of the rule to remove
     * @returns {boolean} Whether the rule was removed
     */
    remove(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            // Disconnect the event and action
            rule.deactivate();
            return this.rules.delete(ruleId);
        }
        return false;
    }

    /**
     * Clear the registry
     */
    clear() {
        // Deactivate all rules before clearing
        for (const rule of this.rules.values()) {
            rule.deactivate();
        }
        this.rules.clear();
    }
}

// Singleton instance
const instance = new RuleRegistry();

module.exports = instance; 