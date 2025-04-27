const axios = require('axios');
const https = require('https');

// Configuration
const RASPBERRY_PI_URL = 'https://033c-193-58-150-20.ngrok-free.app';
const ENDPOINT = '/api-sensors/get_events';
const TIMEOUT = 15000; // 15 seconds

// Try multiple connection methods
async function testConnection() {
  console.log('===============================================');
  console.log('Starting Raspberry Pi 5 Connection Test');
  console.log('===============================================');
  console.log(`Target: ${RASPBERRY_PI_URL}${ENDPOINT}`);
  console.log('Time:', new Date().toISOString());
  console.log('-----------------------------------------------');

  // Test 1: Basic Axios request
  console.log('\n📡 TEST 1: Basic Axios Request');
  try {
    console.log('Attempting basic axios request...');
    const response = await axios.get(`${RASPBERRY_PI_URL}${ENDPOINT}`, {
      timeout: TIMEOUT
    });
    console.log('✅ SUCCESS! Basic request worked');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ FAILED! Basic request error:', error.message);
    if (error.code) console.log('Error code:', error.code);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }

  // Test 2: Axios with Postman headers
  console.log('\n📡 TEST 2: Axios with Postman Headers');
  try {
    console.log('Attempting request with Postman headers...');
    const response = await axios.get(`${RASPBERRY_PI_URL}${ENDPOINT}`, {
      headers: {
        'User-Agent': 'PostmanRuntime/7.4.3.3',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      timeout: TIMEOUT
    });
    console.log('✅ SUCCESS! Postman headers request worked');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ FAILED! Postman headers error:', error.message);
    if (error.code) console.log('Error code:', error.code);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }

  // Test 3: Axios with disabled SSL verification
  console.log('\n📡 TEST 3: Axios with Disabled SSL Verification');
  try {
    console.log('Attempting request with SSL verification disabled...');
    const response = await axios.get(`${RASPBERRY_PI_URL}${ENDPOINT}`, {
      headers: {
        'User-Agent': 'PostmanRuntime/7.4.3.3',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: TIMEOUT
    });
    console.log('✅ SUCCESS! SSL disabled request worked');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ FAILED! SSL disabled error:', error.message);
    if (error.code) console.log('Error code:', error.code);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }

  // Test 4: Native Node.js HTTPS module
  console.log('\n📡 TEST 4: Native Node.js HTTPS Request');
  await new Promise((resolve) => {
    console.log('Attempting native HTTPS request...');
    
    // Parse URL
    const url = new URL(`${RASPBERRY_PI_URL}${ENDPOINT}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PostmanRuntime/7.4.3.3',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      rejectUnauthorized: false, // Disable SSL verification
      timeout: TIMEOUT
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ SUCCESS! Native request worked');
        console.log('Status:', res.statusCode);
        try {
          const parsedData = JSON.parse(data);
          console.log('Data:', JSON.stringify(parsedData, null, 2));
        } catch (e) {
          console.log('Raw data:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ FAILED! Native request error:', error.message);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('❌ FAILED! Native request timed out');
      req.destroy();
      resolve();
    });
    
    req.end();
  });

  // Test 5: DNS lookup test
  console.log('\n📡 TEST 5: DNS Lookup Test');
  const dns = require('dns');
  await new Promise((resolve) => {
    console.log(`Attempting DNS lookup for ${new URL(RASPBERRY_PI_URL).hostname}...`);
    dns.lookup(new URL(RASPBERRY_PI_URL).hostname, (err, address, family) => {
      if (err) {
        console.log('❌ FAILED! DNS lookup error:', err.message);
      } else {
        console.log('✅ SUCCESS! DNS resolution worked');
        console.log(`Resolved to IP: ${address} (IPv${family})`);
      }
      resolve();
    });
  });

  console.log('\n===============================================');
  console.log('Connection Test Complete');
  console.log('===============================================');
}

// Run all tests
testConnection().catch(error => {
  console.error('Unhandled error in test:', error);
});