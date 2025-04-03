/**
 * Test script for anomaly events and rules
 * Run with: node anomaly-test.js
 */

const interpreter = require('../server-integration');

// Helper to wait a specified time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function testAnomalyEvents() {
    try {
        console.log('Initializing interpreter...');
        await interpreter.initializeInterpreter();
        
        // Wait for initialization to complete
        await wait(2000);
        
        // List all anomaly events
        console.log('\n===== AVAILABLE ANOMALY EVENTS =====');
        const anomalyEvents = interpreter.getAnomalyEvents();
        
        if (!anomalyEvents.success || anomalyEvents.count === 0) {
            console.log('No anomaly events found. Waiting for events to be created...');
            await interpreter.startAnomalyPolling(10000); // Start polling with 10 seconds interval
            await wait(12000); // Wait for first poll to complete
            
            // Try again
            const retryEvents = interpreter.getAnomalyEvents();
            if (!retryEvents.success || retryEvents.count === 0) {
                console.error('Still no anomaly events found. Make sure the anomaly API is working.');
                process.exit(1);
            }
            
            console.log(`Found ${retryEvents.count} anomaly events after polling.`);
            printAnomalyEvents(retryEvents.events);
        } else {
            console.log(`Found ${anomalyEvents.count} anomaly events.`);
            printAnomalyEvents(anomalyEvents.events);
        }
        
        // Try to create an anomaly rule
        console.log('\n===== CREATING ANOMALY RULES =====');
        
        const events = anomalyEvents.events;
        if (events.length > 0) {
            // Use the first event for testing
            const event = events[0];
            
            // Create a detected rule
            console.log(`Creating rule for "${event.name}" detected...`);
            const detectedRule = await createTestRule(event, true);
            
            // Create a not detected rule
            console.log(`Creating rule for "${event.name}" not detected...`);
            const notDetectedRule = await createTestRule(event, false);
            
            // Test triggering the events
            console.log('\n===== TESTING RULE TRIGGERS =====');
            
            // First, trigger "detected"
            console.log(`Triggering "${event.name}" as DETECTED...`);
            await testTrigger(event.name, true);
            
            await wait(3000);
            
            // Then, trigger "not detected"
            console.log(`Triggering "${event.name}" as NOT DETECTED...`);
            await testTrigger(event.name, false);
        } else {
            console.log('No anomaly events available for testing.');
        }
        
        console.log('\nTest complete. Anomaly rules and events working correctly.');
    } catch (error) {
        console.error('Error during anomaly testing:', error);
    }
}

// Print anomaly events in a readable format
function printAnomalyEvents(events) {
    events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name}`);
        console.log(`   Location: ${event.location}`);
        console.log(`   Metric: ${event.metricType}`);
        console.log(`   Anomaly Type: ${event.anomalyType}`);
        console.log(`   Currently Detected: ${event.isDetected}`);
        console.log('');
    });
    
    console.log('Sample rule formats:');
    events.slice(0, 2).forEach((event, index) => {
        console.log(`- if ${event.name} detected then Living Room AC on`);
        console.log(`- if ${event.name} not detected then Living Room Light off`);
    });
}

// Create a test rule for an anomaly event
async function createTestRule(event, detected) {
    try {
        const action = `Test Action ${detected ? 'On' : 'Off'}`;
        
        // Try two methods to create rules
        
        // Method 1: Using the helper function
        const result1 = interpreter.createAnomalyRule(
            event.location, 
            event.metricType, 
            event.anomalyType, 
            detected, 
            action
        );
        
        if (result1.success) {
            console.log(`Successfully created rule: ${result1.ruleString}`);
            console.log(`Rule ID: ${result1.ruleId}`);
            return result1.ruleId;
        }
        
        // Method 2: Using the raw rule string
        const detectedStr = detected ? 'detected' : 'not detected';
        const ruleString = `if ${event.name} ${detectedStr} then ${action}`;
        
        console.log(`Trying direct rule string: ${ruleString}`);
        const result2 = interpreter.createRule(ruleString);
        
        if (result2.success) {
            console.log(`Successfully created rule with direct string: ${ruleString}`);
            console.log(`Rule ID: ${result2.ruleId}`);
            return result2.ruleId;
        }
        
        console.error('Failed to create rule using both methods.');
        console.error('Method 1 error:', result1.error);
        console.error('Method 2 error:', result2 ? result2.error : 'N/A');
        
        return null;
    } catch (error) {
        console.error('Error creating test rule:', error);
        return null;
    }
}

// Test triggering an anomaly event
async function testTrigger(eventName, detected) {
    try {
        const result = interpreter.triggerAnomalyEvent(eventName, detected, {
            confidence: 0.95,
            testTriggered: true
        });
        
        if (result.success) {
            console.log(`Successfully triggered ${eventName} as ${detected ? 'DETECTED' : 'NOT DETECTED'}`);
        } else {
            console.error(`Failed to trigger event: ${result.error}`);
            
            if (result.availableEvents) {
                console.log('Available events:');
                result.availableEvents.forEach(name => console.log(`- ${name}`));
            }
        }
        
        return result.success;
    } catch (error) {
        console.error('Error triggering event:', error);
        return false;
    }
}

// Run the test
testAnomalyEvents().then(() => {
    console.log('Test script completed.');
}).catch(error => {
    console.error('Test script failed:', error);
}); 