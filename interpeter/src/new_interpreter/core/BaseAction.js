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
        console.log(`[ACTION] Action ${this.toString()} received update from event ${event.getConditionString()}`);
        console.log(`[ACTION] Event state: ${event.getState()}`);
        console.log(`[ACTION] Action triggered by rule: ${this._triggeredByRule || 'Unknown'}`);
        
        // Temperature-specific rule checking
        if (event.type === 'temperature' && event.currentValue !== null) {
            // Get the current temperature value
            const currentTemp = event.currentValue;
            
            // Get the threshold and operator from the event
            const threshold = event.threshold;
            const operator = event.operator;
            
            // Evaluate the condition for this specific temperature
            let shouldExecute = false;
            switch (operator) {
                case '>':
                    shouldExecute = currentTemp > threshold;
                    console.log(`[ACTION] Evaluating: ${currentTemp} > ${threshold} = ${shouldExecute}`);
                    break;
                case '<':
                    shouldExecute = currentTemp < threshold;
                    console.log(`[ACTION] Evaluating: ${currentTemp} < ${threshold} = ${shouldExecute}`);
                    break;
                case '>=':
                    shouldExecute = currentTemp >= threshold;
                    console.log(`[ACTION] Evaluating: ${currentTemp} >= ${threshold} = ${shouldExecute}`);
                    break;
                case '<=':
                    shouldExecute = currentTemp <= threshold;
                    console.log(`[ACTION] Evaluating: ${currentTemp} <= ${threshold} = ${shouldExecute}`);
                    break;
                case '==':
                    shouldExecute = currentTemp === threshold;
                    console.log(`[ACTION] Evaluating: ${currentTemp} === ${threshold} = ${shouldExecute}`);
                    break;
                default:
                    console.error(`[ACTION] Unknown operator: ${operator}`);
            }
            
            // Only execute if this specific condition is met
            if (!shouldExecute) {
                console.log(`[ACTION] Not executing action because specific condition is not met: ${currentTemp} ${operator} ${threshold}`);
                return;
            }
        } else {
            // For non-temperature events, use the standard state check
            if (!event.getState()) {
                console.log(`[ACTION] Not executing action because event condition is not met`);
                return;
            }
        }
        
        // Check if this is an AC action and if it was recently executed
        if (this.type === 'ac') {
            // Get the current time
            const now = new Date();
            
            // Check if the action was executed in the last 10 seconds
            if (this.lastExecuted && (now - this.lastExecuted) < 10000) {
                console.log(`[ACTION] Skipping AC action because it was executed less than 10 seconds ago`);
                return;
            }
            
            // Check if there's a conflicting AC action in progress
            if (BaseAction.lastAcAction) {
                const lastAction = BaseAction.lastAcAction;
                const lastActionTime = BaseAction.lastAcActionTime;
                
                // If the last AC action was executed less than 10 seconds ago and it's different from this action
                if (lastActionTime && (now - lastActionTime) < 10000 && lastAction !== this.command) {
                    console.log(`[ACTION] Skipping conflicting AC action. Last action was "${lastAction}" ${Math.floor((now - lastActionTime) / 1000)} seconds ago`);
                    return;
                }
            }
            
            // Update the last AC action
            BaseAction.lastAcAction = this.command;
            BaseAction.lastAcActionTime = now;
        }
        
        console.log(`[ACTION] Executing action: ${this.toString()}`);
        this.execute();
        this.lastExecuted = new Date();
    }

    /**
     * Get a string representation of the action
     * @returns {string} String representation of the action
     */
    toString() {
        return `${this.type} in ${this.location} ${this.command}`;
    }
}

// Static properties to track the last AC action
BaseAction.lastAcAction = null;
BaseAction.lastAcActionTime = null;

module.exports = BaseAction; 