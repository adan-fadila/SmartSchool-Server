/**
 * Base Action class for the interpreter
 * All specific action types will inherit from this class
 */
class Action {
    /**
     * Constructor for the Action class
     * @param {string} name - The name of the action
     * @param {string} type - The type of the action (e.g., 'ac', 'light')
     * @param {string} location - The location (room) for this action
     */
    constructor(name, type, location) {
        this.name = name;
        this.type = type;
        this.location = location;
        this.observedRules = []; // Rules that this action is observing
    }

    /**
     * Start observing a rule
     * @param {Rule} rule - The rule to observe
     */
    observeRule(rule) {
        if (!this.observedRules.includes(rule)) {
            this.observedRules.push(rule);
            // Register this action with the rule
            rule.addObservingAction(this);
            this.logAction(`Started observing rule: ${rule.id} - ${rule.ruleString}`);
        }
    }

    /**
     * Stop observing a rule
     * @param {Rule} rule - The rule to stop observing
     */
    stopObservingRule(rule) {
        const index = this.observedRules.indexOf(rule);
        if (index !== -1) {
            this.observedRules.splice(index, 1);
            // Unregister this action from the rule
            rule.removeObservingAction(this);
            this.logAction(`Stopped observing rule: ${rule.id}`);
        }
    }

    /**
     * Called when a rule this action is observing evaluates to true
     * @param {Rule} rule - The rule that was triggered
     * @param {Object} context - Additional context data (like event values)
     */
    async onRuleTriggered(rule, context = {}) {
        this.logAction(`Rule triggered: ${rule.id} - ${rule.ruleString}`);
        
        // Parse the action string from the rule
        this.parseActionString(rule.actionString);
        
        // Execute the action
        return await this.execute(context);
    }

    /**
     * Parse the action string into components
     * This should be overridden by subclasses
     * @param {string} actionString - The action string to parse
     */
    parseActionString(actionString) {
        // Base implementation does nothing
        // Subclasses should override this to parse specific formats
        this.state = '';
        this.params = {};
    }

    /**
     * Check if this action can handle the given action string
     * @param {string} actionString - The action string to check
     * @returns {boolean} True if this action can handle the string
     */
    canHandleAction(actionString) {
        // Base implementation checks if the action name is in the string
        return actionString.toLowerCase().includes(this.name.toLowerCase());
    }

    /**
     * Execute the action
     * This should be overridden by subclasses
     * @param {Object} context - Additional context for the execution
     * @returns {Promise<object>} The result of the action execution
     */
    async execute(context = {}) {
        // Base implementation just logs the action
        this.logAction(`Executing action ${this.name} (not implemented in base class)`);
        return { success: false, message: 'Action execution not implemented' };
    }

    /**
     * Log the action execution
     * @param {string} message - The message to log
     */
    logAction(message) {
        console.log(`[ACTION ${this.type.toUpperCase()}] ${message}`);
    }
}

module.exports = Action; 