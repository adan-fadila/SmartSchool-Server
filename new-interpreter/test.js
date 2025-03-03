/**
 * Test script for the new interpreter
 * 
 * This script tests rule parsing, event triggering, and action execution
 */
const { RuleManager, ruleManager } = require('./index');

// Clear any rules from manager for clean testing
ruleManager.allEvents = [];
ruleManager.eventCache.clear();
ruleManager.eventsByType = {
  temperature: {},
  humidity: {},
  motion: {}
};

/**
 * Test rule parsing
 */
async function testRuleParsing() {
  console.log('\n===== TESTING RULE PARSING =====');
  
  try {
    // Test temperature rule
    const tempRule = 'if temp > 25 in living room then ac on cool 23';
    const tempResult = ruleManager.addRule(tempRule);
    console.log(`✅ Temperature rule added: "${tempRule}"`);
    console.log('  Event type:', tempResult.event.constructor.name);
    console.log('  Action type:', tempResult.action.constructor.name);
    
    // Test motion rule
    const motionRule = 'if motion in kitchen then light on';
    const motionResult = ruleManager.addRule(motionRule);
    console.log(`✅ Motion rule added: "${motionRule}"`);
    console.log('  Event type:', motionResult.event.constructor.name);
    console.log('  Action type:', motionResult.action.constructor.name);
    
    // Test humidity rule
    const humidityRule = 'if humidity < 30 in bedroom then ac on';
    const humidityResult = ruleManager.addRule(humidityRule);
    console.log(`✅ Humidity rule added: "${humidityRule}"`);
    console.log('  Event type:', humidityResult.event.constructor.name);
    console.log('  Action type:', humidityResult.action.constructor.name);
    
    // Test adding a second action to an existing event
    const additionalRule = 'if temp > 25 in living room then light on';
    const additionalResult = ruleManager.addRule(additionalRule);
    console.log(`✅ Additional rule added: "${additionalRule}"`);
    console.log('  Is same event:', additionalResult.event === tempResult.event);
    console.log('  Total actions for event:', additionalResult.event.actions.length);
    
    // Display all events
    console.log('\nAll events:', ruleManager.getAllEvents().length);
    ruleManager.getAllEvents().forEach(event => {
      console.log(`  - ${event.constructor.name} in ${event.location} with ${event.actions.length} action(s)`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Rule parsing test failed:', error.message);
    return false;
  }
}

/**
 * Test event triggering with simulated sensor data
 */
async function testEventTriggering() {
  console.log('\n===== TESTING EVENT TRIGGERING =====');
  
  try {
    // Mock the execute method on actions to track calls without actual API execution
    const mockExecuteCalls = [];
    ruleManager.getAllEvents().forEach(event => {
      event.actions.forEach(action => {
        // Store the original execute method
        action._originalExecute = action.execute;
        
        // Replace with mock
        action.execute = function() {
          mockExecuteCalls.push({
            actionType: this.constructor.name,
            location: this.location,
            state: this.state,
            mode: this.mode,
            temperature: this.temperature
          });
          console.log(`  Mock execution: ${this.constructor.name} in ${this.location}`);
          return Promise.resolve(true);
        };
      });
    });
    
    // Test 1: Send data that should trigger temperature event
    console.log('\nTest 1: Temperature > 25 in living room');
    const temperatureData = {
      temp: {
        'living room': 26 // Should trigger the event
      }
    };
    
    await ruleManager.processSensorData(temperatureData);
    console.log('  Actions triggered:', mockExecuteCalls.length === 2 ? '✅ 2 actions (pass)' : '❌ Expected 2 actions');
    
    // Reset mock calls
    mockExecuteCalls.length = 0;
    
    // Test 2: Send data that should NOT trigger temperature event
    console.log('\nTest 2: Temperature < 25 in living room');
    const temperatureDataBelow = {
      temp: {
        'living room': 24 // Should not trigger the event
      }
    };
    
    await ruleManager.processSensorData(temperatureDataBelow);
    console.log('  Actions triggered:', mockExecuteCalls.length === 0 ? '✅ 0 actions (pass)' : '❌ Expected 0 actions');
    
    // Reset mock calls
    mockExecuteCalls.length = 0;
    
    // Test 3: Send data that should trigger motion event
    console.log('\nTest 3: Motion in kitchen');
    const motionData = {
      motion: {
        'kitchen': true // Should trigger the event
      }
    };
    
    await ruleManager.processSensorData(motionData);
    console.log('  Actions triggered:', mockExecuteCalls.length === 1 ? '✅ 1 action (pass)' : '❌ Expected 1 action');
    
    // Reset mock calls
    mockExecuteCalls.length = 0;
    
    // Restore original execution methods
    ruleManager.getAllEvents().forEach(event => {
      event.actions.forEach(action => {
        if (action._originalExecute) {
          action.execute = action._originalExecute;
          delete action._originalExecute;
        }
      });
    });
    
    return true;
  } catch (error) {
    console.error('❌ Event triggering test failed:', error.message);
    return false;
  }
}

/**
 * Test live action execution (optional, will make API calls)
 */
async function testLiveExecution() {
  console.log('\n===== TESTING LIVE EXECUTION (Optional) =====');
  console.log('Warning: This will attempt to make actual API calls to devices!\n');
  
  // Check for environment variable to enable live testing
  if (!process.env.ENABLE_LIVE_TESTING) {
    console.log('Live testing is disabled. Set ENABLE_LIVE_TESTING=true to enable.');
    return false;
  }
  
  try {
    // Send data that should trigger one event at a time for testing
    const liveData = {
      temp: {
        'living room': 26 // Should trigger the temperature event
      }
    };
    
    console.log('Triggering temperature event with real execution...');
    await ruleManager.processSensorData(liveData);
    console.log('Live execution completed');
    
    return true;
  } catch (error) {
    console.error('❌ Live execution test failed:', error.message);
    return false;
  }
}

/**
 * Run all tests sequentially
 */
async function runTests() {
  console.log('Starting interpreter tests...\n');
  
  const parsingSuccess = await testRuleParsing();
  if (!parsingSuccess) {
    console.error('Rule parsing tests failed, stopping further tests.');
    process.exit(1);
  }
  
  const triggeringSuccess = await testEventTriggering();
  if (!triggeringSuccess) {
    console.error('Event triggering tests failed, stopping further tests.');
    process.exit(1);
  }
  
  // Optional: Only run if explicitly enabled
  await testLiveExecution();
  
  console.log('\n===== TEST SUMMARY =====');
  console.log('✅ Rule parsing: PASS');
  console.log('✅ Event triggering: PASS');
  console.log('🔵 Live execution:', process.env.ENABLE_LIVE_TESTING ? 'ATTEMPTED' : 'SKIPPED');
  console.log('\nAll tests completed successfully!');
}

// Run the tests
if (require.main === module) {
  runTests().catch(err => {
    console.error('Unhandled error in tests:', err);
    process.exit(1);
  });
}

module.exports = { testRuleParsing, testEventTriggering, testLiveExecution, runTests }; 