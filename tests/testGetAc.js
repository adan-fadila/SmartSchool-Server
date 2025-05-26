/**
 * Test file for getAcState function
 * Run with: node testGetAc.js
 */

// Import the actual getAcState function from your sensibo API
const { getAcState } = require('../api/sensibo');

/**
 * Test function that mimics your extraction logic using REAL getAcState function
 */
async function testAcStateExtraction(raspPiIP) {
  console.log(`\n🧪 Testing REAL AC state extraction for IP: ${raspPiIP}`);
  console.log("=" * 50);
  
  try {
    // Get REAL AC state from sensibo API
    const acResult = await getAcState(raspPiIP);
    console.log("📋 Raw AC result from sensibo:", JSON.stringify(acResult, null, 2));
    
    // Extract AC state and target temperature (your exact logic)
    let acState = false;
    let targetTemperature = "N/A";
    
    if (acResult && acResult.acState && typeof acResult.acState.on === 'boolean') {
      acState = acResult.acState.on;
      
      // Extract target temperature only if AC is on
      if (acState && acResult.acState.targetTemperature !== undefined) {
        targetTemperature = acResult.acState.targetTemperature;
      } else {
        // AC is off or targetTemperature is not available
        targetTemperature = "N/A";
      }
    }
    
    console.log("✅ Extracted values:");
    console.log(`   - AC On: ${acState}`);
    console.log(`   - Target Temperature: ${targetTemperature}`);
    console.log(`   - Success: ${acResult?.success || false}`);
    
    return { 
      acState, 
      targetTemperature, 
      success: acResult?.success || false,
      rawResponse: acResult 
    };
    
  } catch (error) {
    console.error("❌ Error getting AC state:", error.message);
    console.error("❌ Stack trace:", error.stack);
    return { 
      acState: false, 
      targetTemperature: "N/A", 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Run tests with REAL getAcState function
 */
async function runTests() {
  console.log("🚀 Starting REAL getAcState Function Tests");
  console.log("==========================================");
  
  // Use your actual Raspberry Pi IP
  const testIP = process.argv[2] || "192.168.1.100"; // Pass IP as command line argument
  console.log(`🔌 Using Raspberry Pi IP: ${testIP}`);
  
  console.log(`\n📡 Testing Real AC State`);
  console.log("-".repeat(30));
  
  const result = await testAcStateExtraction(testIP);
  
  // Display results in a clean format
  console.log("\n📊 FINAL RESULTS:");
  console.log("=================");
  console.log(`✅ Success: ${result.success}`);
  console.log(`🔌 AC Power: ${result.acState ? 'ON' : 'OFF'}`);
  console.log(`🌡️  Target Temp: ${result.targetTemperature}`);
  
  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
  }
  
  // Show what would be logged to CSV
  console.log("\n📝 CSV Log Format:");
  console.log("==================");
  console.log(`AC State: ${result.acState}`);
  console.log(`Target Temperature: ${result.targetTemperature}`);
  
  return result;
}

/**
 * Test multiple calls to see consistency
 */
async function testMultipleCalls(raspPiIP, calls = 3) {
  console.log(`\n🔄 Testing ${calls} consecutive calls`);
  console.log("==================================");
  
  for (let i = 1; i <= calls; i++) {
    console.log(`\nCall #${i}:`);
    const result = await testAcStateExtraction(raspPiIP);
    console.log(`   Result: AC=${result.acState}, Temp=${result.targetTemperature}, Success=${result.success}`);
    
    // Wait between calls
    if (i < calls) {
      console.log("   Waiting 2 seconds...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Performance test with real API
 */
async function performanceTest(raspPiIP) {
  console.log("\n⚡ Performance Test");
  console.log("==================");
  
  const iterations = 5; // Reduced for real API calls
  const startTime = Date.now();
  let successCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const result = await testAcStateExtraction(raspPiIP);
    if (result.success) successCount++;
    
    // Add delay between API calls to be respectful
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const endTime = Date.now();
  const avgTime = (endTime - startTime) / iterations;
  
  console.log(`Completed ${iterations} calls`);
  console.log(`Successful calls: ${successCount}/${iterations}`);
  console.log(`Success rate: ${((successCount/iterations) * 100).toFixed(1)}%`);
  console.log(`Average time per call: ${avgTime.toFixed(2)}ms`);
}

// Main execution
async function main() {
  try {
    const raspPiIP = process.argv[2] || "192.168.1.100";
    
    console.log("🏠 Testing REAL Sensibo getAcState Function");
    console.log("===========================================");
    console.log(`📍 Target IP: ${raspPiIP}`);
    console.log(`⏰ Time: ${new Date().toISOString()}\n`);
    
    // Run single test
    await runTests();
    
    // Test multiple calls for consistency
    await testMultipleCalls(raspPiIP, 3);
    
    // Performance test
    await performanceTest(raspPiIP);
    
    console.log("\n🎉 All tests completed!");
    console.log("========================");
    console.log("💡 Usage: node testGetAc.js [raspberry_pi_ip]");
    console.log("💡 Example: node testGetAc.js 192.168.1.50");
    
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    console.error("❌ Stack:", error.stack);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  testAcStateExtraction,
  runTests,
  testMultipleCalls,
  performanceTest
};