/**
 * Represents a rule in the system
 * A rule connects an event with an action
 */
class Rule {
    /**
     * @param {string} id - Unique identifier for the rule
     * @param {BaseEvent} event - The event that triggers the rule
     * @param {BaseAction} action - The action to execute when the event is triggered
     * @param {string} description - Human-readable description of the rule
     */
    constructor(id, event, action, description) {
        this.id = id;
        this.event = event;
        this.action = action;
        this.description = description;
        this.createdAt = new Date();
        this.active = true;

        // Connect the event and action
        this.event.attach(this.action);
    }

    /**
     * Activate the rule
     */
    activate() {
        if (!this.active) {
            this.active = true;
            this.event.attach(this.action);
        }
    }

    /**
     * Deactivate the rule
     */
    deactivate() {
        if (this.active) {
            this.active = false;
            this.event.detach(this.action);
        }
    }

    /**
     * Check if the rule is active
     * @returns {boolean} Whether the rule is active
     */
    isActive() {
        return this.active;
    }

    /**
     * Get a string representation of the rule
     * @returns {string} String representation of the rule
     */
    toString() {
        return `if ${this.event.getConditionString()} then ${this.action.toString()}`;
    }
}

module.exports = Rule; 