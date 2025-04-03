/**
 * Test script for anomaly notifications
 * This script simulates anomaly events and rule triggers to test the notification system
 */

const { notifyAnomalyDetection, notifyRuleTriggered } = require('../utils/notificationService');
const interpreterService = require('../interpreter/src/server-integration');
const EventRegistry = require('../interpreter/src/events/EventRegistry');

// Create test data
const testAnomalyData = {
    name: 'Living Room Temperature Pointwise Anomaly',
    location: 'Living Room',
    metricType: 'temperature',
    anomalyType: 'pointwise',
    confidence: 0.85,
    timestamp: Date.now()
};

const testRuleData = {
    id: 'test_rule_1',
    ruleString: 'if Living Room Temperature Pointwise Anomaly detected then turn on AC',
    eventName: 'Living Room Temperature Pointwise Anomaly',
    actions: 'Turn on AC'
};

// Test function to run all tests
async function runTests() {
    console.log('=== Starting Anomaly Notification Tests ===');
    
    // Test 1: Direct notification service test
    console.log('\n--- Test 1: Direct Notification Service Test ---');
    try {
        console.log('Sending test anomaly notification...');
        const result1 = await notifyAnomalyDetection(testAnomalyData);
        console.log('Anomaly notification result:', result1);
        
        console.log('Sending test rule notification...');
        const result2 = await notifyRuleTriggered(testRuleData, testAnomalyData);
        console.log('Rule notification result:', result2);
    } catch (error) {
        console.error('Error in direct notification test:', error);
    }
    
    // Test 2: Initialize interpreter and trigger an anomaly event
    console.log('\n--- Test 2: Interpreter Integration Test ---');
    try {
        // Initialize the interpreter
        console.log('Initializing interpreter...');
        await interpreterService.initializeInterpreter();
        
        // Try to find an existing anomaly event or create one
        let anomalyEvent = EventRegistry.getEvent('Living Room Temperature Pointwise Anomaly');
        
        if (!anomalyEvent) {
            console.log('No suitable anomaly event found. Creating a test rule...');
            // Create a test rule for an anomaly
            const ruleId = await interpreterService.createRule(
                'if Living Room Temperature Pointwise Anomaly detected then Living Room AC on'
            );
            console.log(`Created test rule with ID: ${ruleId?.ruleId || 'unknown'}`);
        }
        
        // Try again to find the event
        anomalyEvent = EventRegistry.getEvent('Living Room Temperature Pointwise Anomaly');
        
        if (anomalyEvent) {
            console.log(`Found anomaly event: ${anomalyEvent.name}`);
            
            // Trigger the anomaly event
            console.log('Triggering anomaly event...');
            const result = await interpreterService.triggerAnomalyEvent(
                anomalyEvent.name,
                true,
                { confidence: 0.92, testTriggered: true }
            );
            
            console.log('Trigger result:', result);
        } else {
            console.log('Could not find or create an anomaly event for testing');
        }
    } catch (error) {
        console.error('Error in interpreter test:', error);
    }
    
    console.log('\n=== Anomaly Notification Tests Completed ===');
}

// Run the tests
runTests().catch(console.error); 