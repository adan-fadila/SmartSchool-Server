const BaseEvent = require('../core/BaseEvent');

/**
 * Event that triggers based on temperature conditions
 */
class TemperatureEvent extends BaseEvent {
    /**
     * @param {string} location - The location this event applies to
     * @param {string} operator - The comparison operator ('>', '<', '>=', '<=', '==')
     * @param {number} threshold - The temperature threshold value
     */
    constructor(location, operator, threshold) {
        super('temperature', location);
        this.operator = operator;
        this.threshold = parseFloat(threshold);
        this.currentValue = null;
    }

    /**
     * Get a string representation of the condition
     * @returns {string} String representation of the condition
     */
    getConditionString() {
        const operatorMap = {
            '>': 'is above',
            '<': 'is below',
            '>=': 'is above or equal to',
            '<=': 'is below or equal to',
            '==': 'is equal to'
        };
        
        const readableOperator = operatorMap[this.operator] || this.operator;
        return `temperature in ${this.location} ${readableOperator} ${this.threshold}`;
    }

    /**
     * Update the event with new sensor data
     * @param {Object} data - The new sensor data
     * @param {number} data.temperature - The temperature value
     * @param {string} data.location - The location the data is for
     */
    updateWithSensorData(data) {
        // Only process data for this event's location
        if (data.location !== this.location) {
            return;
        }

        // Update the current value
        this.currentValue = parseFloat(data.temperature);
        
        // Evaluate the condition and update the state
        let newState = false;
        
        console.log(`[DEBUG] Evaluating temperature condition for ${this.location}:`);
        console.log(`[DEBUG] Current temperature: ${this.currentValue}°C`);
        console.log(`[DEBUG] Operator: ${this.operator}`);
        console.log(`[DEBUG] Threshold: ${this.threshold}°C`);
        
        switch (this.operator) {
            case '>':
                newState = this.currentValue > this.threshold;
                console.log(`[DEBUG] Comparison ${this.currentValue} > ${this.threshold} = ${newState}`);
                break;
            case '<':
                newState = this.currentValue < this.threshold;
                console.log(`[DEBUG] Comparison ${this.currentValue} < ${this.threshold} = ${newState}`);
                break;
            case '>=':
                newState = this.currentValue >= this.threshold;
                console.log(`[DEBUG] Comparison ${this.currentValue} >= ${this.threshold} = ${newState}`);
                break;
            case '<=':
                newState = this.currentValue <= this.threshold;
                console.log(`[DEBUG] Comparison ${this.currentValue} <= ${this.threshold} = ${newState}`);
                break;
            case '==':
                newState = this.currentValue === this.threshold;
                console.log(`[DEBUG] Comparison ${this.currentValue} === ${this.threshold} = ${newState}`);
                break;
            default:
                console.error(`Unknown operator: ${this.operator}`);
        }
        
        console.log(`[DEBUG] Rule evaluation result: ${newState}`);
        
        // Update the state (will notify observers if changed)
        this.setState(newState);
    }

    /**
     * Get the current temperature value
     * @returns {number|null} The current temperature value, or null if not set
     */
    getCurrentValue() {
        return this.currentValue;
    }
}

module.exports = TemperatureEvent; 