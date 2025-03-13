const Observer = require('./Observer');

/**
 * Base class for all actions in the system
 * Actions observe events and execute when events' conditions are met
 */
class BaseAction extends Observer {
    /**
     * @param {string} type - The type of action (e.g., 'light', 'ac')
     * @param {string} location - The location this action applies to (e.g., 'living room')
     * @param {string} command - The command to execute (e.g., 'on', 'off')
     */
    constructor(type, location, command) {
        super();
        this.type = type;
        this.location = location;
        this.command = command;
        this.lastExecuted = null;
    }

    /**
     * Get a unique identifier for this action
     * @returns {string} A unique identifier
     */
    getId() {
        return `${this.type}_${this.location}_${this.command}`;
    }

    /**
     * Execute the action
     * Must be implemented by subclasses
     */
    execute() {
        throw new Error('Method execute() must be implemented by subclasses');
    }

    /**
     * Update method called when an observed event changes state
     * @param {BaseEvent} event - The event that changed state
     */
    update(event) {
        // Only execute if the event's condition is met (state is true)
        if (event.getState()) {
            this.execute();
            this.lastExecuted = new Date();
        }
    }

    /**
     * Get a string representation of the action
     * @returns {string} String representation of the action
     */
    toString() {
        return `${this.type} in ${this.location} ${this.command}`;
    }
}

module.exports = BaseAction; 