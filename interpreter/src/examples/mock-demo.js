const EventRegistry = require('../events/EventRegistry');
const RuleManager = require('../rules/RuleManager');
const TemperatureEvent = require('../events/TemperatureEvent');
const HumidityEvent = require('../events/HumidityEvent');

/**
 * Mock demo function that doesn't rely on Raspberry Pi
 */
async function runMockDemo() {
    try {
        console.log('Starting mock interpreter demo...');
        
        // Create mock events manually
        console.log('\nCreating mock events...');
        const livingRoomTemp = new TemperatureEvent('Living Room Temperature', 'Living Room');
        const livingRoomHumidity = new HumidityEvent('Living Room Humidity', 'Living Room');
        const kitchenTemp = new TemperatureEvent('Kitchen Temperature', 'Kitchen');
        
        // Register events manually
        EventRegistry.registerEvent(livingRoomTemp);
        EventRegistry.registerEvent(livingRoomHumidity);
        EventRegistry.registerEvent(kitchenTemp);
        
        // Display all registered events
        const events = EventRegistry.getAllEvents();
        console.log(`\nRegistered ${events.length} mock events:`);
        events.forEach(event => {
            console.log(`- ${event.name} (${event.type}) for location: ${event.location}`);
        });
        
        // Create rules
        console.log('\nCreating sample rules...');
        const tempRuleString = `if Living Room Temperature > 25 then living room light on`;
        const humidityRuleString = `if Living Room Humidity > 60 then living room fan on`;
        
        console.log(`Creating rule: "${tempRuleString}"`);
        const tempRuleId = RuleManager.createRule(tempRuleString);
        
        console.log(`Creating rule: "${humidityRuleString}"`);
        const humidityRuleId = RuleManager.createRule(humidityRuleString);
        
        // Simulate event updates
        console.log('\nSimulating event updates...');
        
        // Temperature updates
        console.log(`\nUpdating Living Room Temperature with value below threshold (20°C)...`);
        livingRoomTemp.updateTemperature(20);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update with value that will trigger the rule
        console.log(`\nUpdating Living Room Temperature with value above threshold (30°C)...`);
        livingRoomTemp.updateTemperature(30);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Humidity updates
        console.log(`\nUpdating Living Room Humidity with value below threshold (40%)...`);
        livingRoomHumidity.updateHumidity(40);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update with value that will trigger the rule
        console.log(`\nUpdating Living Room Humidity with value above threshold (70%)...`);
        livingRoomHumidity.updateHumidity(70);
        
        // Display all rules
        console.log('\nCurrent rules:');
        const allRules = RuleManager.getAllRules();
        allRules.forEach(rule => {
            console.log(`- ${rule.id}: "${rule.ruleString}" (Active: ${rule.active})`);
        });
        
        // Clean up
        console.log('\nDeactivating and deleting rules...');
        RuleManager.deactivateRule(tempRuleId);
        RuleManager.deleteRule(tempRuleId);
        RuleManager.deactivateRule(humidityRuleId);
        RuleManager.deleteRule(humidityRuleId);
        
        console.log('\nMock demo completed!');
    } catch (error) {
        console.error('Error running mock demo:', error);
    }
}

// If this script is run directly (not required by another module)
if (require.main === module) {
    runMockDemo();
}

module.exports = { runMockDemo }; 