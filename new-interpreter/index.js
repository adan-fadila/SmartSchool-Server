const RuleManager = require('./rules/RuleManager');
const RuleParser = require('./rules/RuleParser');
const BaseEvent = require('./events/BaseEvent');
const TemperatureEvent = require('./events/TemperatureEvent');
const HumidityEvent = require('./events/HumidityEvent');
const MotionEvent = require('./events/MotionEvent');
const BaseAction = require('./actions/BaseAction');
const ACAction = require('./actions/ACAction');
const LightAction = require('./actions/LightAction');

// Create a singleton RuleManager instance
const ruleManager = new RuleManager();

/**
 * Example of how to use the new interpreter
 */
function exampleUsage() {
  // Add rules
  try {
    ruleManager.addRule('if temp > 25 in living room then ac on cool 23');
    ruleManager.addRule('if temp > 25 in living room then light on');
    ruleManager.addRule('if motion in kitchen then light on');
    ruleManager.addRule('if humidity < 30 in bedroom then ac on');
    
    console.log('Rules added successfully!');
    console.log('Total events:', ruleManager.getAllEvents().length);
    
    // Example sensor data
    const sensorData = {
      temp: {
        'living room': 26,
        'bedroom': 22
      },
      humidity: {
        'bedroom': 25,
        'bathroom': 60
      },
      motion: {
        'kitchen': true,
        'living room': false
      }
    };
    
    console.log('Processing sensor data:', JSON.stringify(sensorData, null, 2));
    
    // Process the sensor data
    ruleManager.processSensorData(sensorData);
  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Export all components
module.exports = {
  // Rule management
  RuleManager,
  RuleParser,
  ruleManager, // Singleton instance
  
  // Events
  BaseEvent,
  TemperatureEvent,
  HumidityEvent,
  MotionEvent,
  
  // Actions
  BaseAction,
  ACAction,
  LightAction,
  
  // Example
  exampleUsage
};

// If this file is run directly, run the example
if (require.main === module) {
  exampleUsage();
} 