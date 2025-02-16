const MotionRule = require('../rules/MotionRule');
const TemperatureRule = require('../rules/TemperatureRule');
const LightAction = require('../actions/LightAction');
const ACAction = require('../actions/ACAction');

class RuleParser {
    static parseRule(ruleString) {
        console.log(`Parsing rule: ${ruleString}`);
        const cleanRule = ruleString.replace(/^if\s+/i, '').trim();
        console.log(`Cleaned rule: ${cleanRule}`);

        const [conditionPart, actionPart] = cleanRule.split(/\s+then\s+/i);
        console.log(`Condition: ${conditionPart}, Action: ${actionPart}`);

        // Parse condition
        const condition = this.parseCondition(conditionPart);
        
        // Parse action if it exists
        const action = actionPart ? this.parseAction(actionPart) : null;

        return {
            condition,
            action
        };
    }

    static parseCondition(conditionString) {
        // Motion condition pattern: "motion in roomX"
        const motionPattern = /^motion\s+in\s+(.+)$/i;
        
        // Temperature condition pattern: "temp = 26 in livingroom" or "temperature > 25 in roomY"
        const tempPattern = /^temp(?:erature)?\s*([=<>])\s*(\d+)\s+in\s+(.+)$/i;

        let match;

        // Check for motion condition
        if ((match = motionPattern.exec(conditionString))) {
            const roomName = match[1].trim();
            return {
                type: 'motion',
                roomName
            };
        }
        
        // Check for temperature condition
        else if ((match = tempPattern.exec(conditionString))) {
            const operator = match[1];
            const temperature = parseInt(match[2]);
            const roomName = match[3].trim();
            
            // Convert operator to word
            const operatorMap = {
                '=': 'equals',
                '>': 'above',
                '<': 'below'
            };

            return {
                type: 'temperature',
                operator: operatorMap[operator],
                threshold: temperature,
                roomName
            };
        }
        
        throw new Error(`Unable to parse condition: ${conditionString}`);
    }

    static parseAction(actionString) {
        console.log('Parsing action:', actionString);
        const parts = actionString.toLowerCase().split(' ');
        
        if (parts.includes('ac')) {
            const state = parts.includes('on') ? 'on' : 'off';
            let temperature = null;
            
            // Look for temperature value
            for (let i = 0; i < parts.length; i++) {
                const num = parseInt(parts[i]);
                if (!isNaN(num) && num >= 16 && num <= 30) {
                    temperature = num;
                    break;
                }
            }
            
            console.log('Parsed AC action:', { type: 'AC', state, temperature });
            return { type: 'AC', state, temperature };
        }
        // ... rest of the parsing logic
    }

    static createRule(parsedRule, deviceId, raspberryPiIP) {
        const { condition, action } = parsedRule;

        switch (condition.type) {
            case 'motion': {
                const lightAction = new LightAction(deviceId, action.state, raspberryPiIP);
                return new MotionRule(condition.roomName, lightAction);
            }

            case 'temperature': {
                const acAction = new ACAction(
                    deviceId, 
                    action.state,
                    action.temperature || 23, // default temperature if not specified
                    'cool' // default mode
                );
                return new TemperatureRule(
                    condition.roomName,
                    condition.threshold,
                    condition.operator,
                    acAction
                );
            }

            default:
                throw new Error(`Unknown condition type: ${condition.type}`);
        }
    }

    static parseTemperatureCondition(condition) {
        // Extract the numeric threshold from the condition
        const match = condition.match(/temp\s*>\s*(\d+)/i);
        if (!match) {
            throw new Error(`Invalid temperature condition format: ${condition}`);
        }

        const threshold = parseFloat(match[1]);
        console.log(`Parsed temperature threshold: ${threshold}`);
        
        return {
            type: 'temperature',
            operator: '>',
            threshold: threshold
        };
    }

    static evaluateTemperatureCondition(currentTemp, rule) {
        const temp = parseFloat(currentTemp);
        const threshold = parseFloat(rule.threshold);
        
        console.log(`Evaluating: ${temp} ${rule.operator} ${threshold}`);
        
        switch(rule.operator) {
            case '>':
                return temp > threshold;
            case '<':
                return temp < threshold;
            case '>=':
                return temp >= threshold;
            case '<=':
                return temp <= threshold;
            default:
                throw new Error(`Unsupported operator: ${rule.operator}`);
        }
    }
}

module.exports = RuleParser; 