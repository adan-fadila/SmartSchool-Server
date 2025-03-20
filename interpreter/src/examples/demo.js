const { initialize } = require('../index');

/**
 * Demo function showing how to use the interpreter
 */
async function runDemo() {
    try {
        console.log('Starting interpreter demo...');
        
        // Initialize the interpreter
        const { EventRegistry, RuleManager } = await initialize();
        
        // Wait a bit for all events to be initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create some rules
        console.log('\nCreating sample rules...');
        
        // Get all available events
        const events = EventRegistry.getAllEvents();
        if (events.length === 0) {
            console.log('No events available. Make sure the Raspberry Pi is connected and events are properly configured.');
            return;
        }
        
        // Use the first available event for demo
        const sampleEvent = events[0];
        console.log(`Using event ${sampleEvent.name} for demo rules`);
        
        // Create a rule based on the sample event
        let ruleString;
        if (sampleEvent.type === 'temperature') {
            ruleString = `if ${sampleEvent.name} > 25 then ${sampleEvent.location} light on`;
        } else if (sampleEvent.type === 'humidity') {
            ruleString = `if ${sampleEvent.name} > 60 then ${sampleEvent.location} fan on`;
        } else {
            ruleString = `if ${sampleEvent.name} > 50 then ${sampleEvent.location} device on`;
        }
        
        console.log(`Creating rule: "${ruleString}"`);
        const ruleId = RuleManager.createRule(ruleString);
        
        // Simulate event updates
        console.log('\nSimulating event updates...');
        
        // Simulate values that don't trigger the rule
        console.log(`\nUpdating ${sampleEvent.name} with value below threshold...`);
        if (sampleEvent.type === 'temperature') {
            sampleEvent.updateTemperature(20);
        } else if (sampleEvent.type === 'humidity') {
            sampleEvent.updateHumidity(40);
        } else {
            sampleEvent.update(30);
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate values that trigger the rule
        console.log(`\nUpdating ${sampleEvent.name} with value above threshold...`);
        if (sampleEvent.type === 'temperature') {
            sampleEvent.updateTemperature(30);
        } else if (sampleEvent.type === 'humidity') {
            sampleEvent.updateHumidity(70);
        } else {
            sampleEvent.update(60);
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update again with same value - should not trigger action again
        console.log(`\nUpdating ${sampleEvent.name} with same value again...`);
        if (sampleEvent.type === 'temperature') {
            sampleEvent.updateTemperature(30);
        } else if (sampleEvent.type === 'humidity') {
            sampleEvent.updateHumidity(70);
        } else {
            sampleEvent.update(60);
        }
        
        // Display all rules
        console.log('\nCurrent rules:');
        const allRules = RuleManager.getAllRules();
        allRules.forEach(rule => {
            console.log(`- ${rule.id}: "${rule.ruleString}" (Active: ${rule.active})`);
        });
        
        // Clean up
        console.log('\nDeactivating and deleting rule...');
        RuleManager.deactivateRule(ruleId);
        RuleManager.deleteRule(ruleId);
        
        console.log('\nDemo completed!');
    } catch (error) {
        console.error('Error running demo:', error);
    }
}

// If this script is run directly (not required by another module)
if (require.main === module) {
    runDemo();
}

module.exports = { runDemo }; 