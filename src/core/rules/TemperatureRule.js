const Rule = require('./Rule');

class TemperatureRule extends Rule {
    constructor(roomName, threshold, operator, actions) {
        super(`temperature ${operator} ${threshold} in ${roomName}`, actions);
        this.threshold = threshold;
        this.operator = operator;
        this.roomName = roomName;
    }

    evaluate(sensorState) {
        const temperature = sensorState.temperature;
        
        switch (this.operator) {
            case 'above':
                return this.evaluateCondition(temperature, this.threshold);
            case 'below':
                return this.evaluateCondition(temperature, this.threshold);
            case 'equals':
                return this.evaluateCondition(temperature, this.threshold);
            default:
                throw new Error(`Unknown operator: ${this.operator}`);
        }
    }

    evaluateCondition(temperature, threshold) {
        console.log(`Evaluating temperature condition: ${temperature} vs threshold: ${threshold}`);
        
        // Convert both to numbers to ensure proper comparison
        const temp = parseFloat(temperature);
        const thresh = parseFloat(threshold);
        
        const result = temp > thresh;
        console.log(`Condition evaluation: ${temp} > ${thresh} = ${result}`);
        
        return result;
    }
}

module.exports = TemperatureRule; 