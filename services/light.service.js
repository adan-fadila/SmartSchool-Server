const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const actionRegistry = require('../interpreter/src/actions/ActionRegistry'); // Import the action registry

/**
 * Find a file by recursively searching up and down the directory tree
 * @param {string} filename - Filename to search for
 * @returns {Promise<string|null>} - Path to the file if found, null otherwise
 */
const findFile = async (filename) => {
  const searchPaths = [
    // 1. Try exact path you specified in the error message
    path.resolve(__dirname, '../api/endpoint', filename),
    
    // 2. Try the path that was failing before
    path.resolve(__dirname, './endpoint', filename),
    
    // 3. Try other common locations
    path.resolve(__dirname, '../endpoint', filename),
    path.resolve(__dirname, '../../endpoint', filename),
    path.resolve(__dirname, '../config', filename),
    path.resolve(__dirname, '../api/config', filename),
    path.resolve(process.cwd(), 'api/endpoint', filename),
    path.resolve(process.cwd(), 'endpoint', filename)
  ];

  // Log where we're searching
  console.log('Searching for configuration file in the following locations:');
  searchPaths.forEach(p => console.log(`- ${p}`));

  // Try each path
  for (const searchPath of searchPaths) {
    try {
      await fs.access(searchPath);
      console.log(`Found configuration file at: ${searchPath}`);
      return searchPath;
    } catch (err) {
      // File not found at this location, continue to next
    }
  }

  // If we get here, file wasn't found in any of the locations
  return null;
};

/**
 * Load Raspberry Pi configuration
 * @returns {Promise<Object>} Configuration object
 */
const loadConfig = async () => {
  try {
    // Find the rasp_pi.json file
    const configPath = await findFile('rasp_pi.json');
    
    if (!configPath) {
      throw new Error('Configuration file rasp_pi.json not found in any expected location');
    }
    
    console.log(`Loading configuration from: ${configPath}`);
    
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading configuration: ${err.message}`);
    throw new Error(`Error loading configuration: ${err.message}`);
  }
};

/**
 * Retrieves the current state of a specific light
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @param {string} lightId - ID of the light to query
 * @returns {Promise<Object>} Light state information
 */
exports.getLightState = async (rasp_ip, lightId) => {
  try {
    const config = await loadConfig();

    // Search for the IP address in the cached JSON data
    const ngrokUrl = config[rasp_ip];

    if (!ngrokUrl) {
      throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
    }

    const flaskUrl = `${ngrokUrl}/api-hue/get_light_state?light_id=${lightId}`;
    console.log(`Requesting light state from: ${flaskUrl}`);

    // Send a GET request to the Flask app
    const response = await axios.get(flaskUrl);
    console.log("Light State Retrieved:", response.data);

    if (response.data && response.data.success) {
      return response.data.lightState;
    } else {
      console.log("No light state found in the response");
      return null;
    }
  } catch (err) {
    console.error("Error retrieving light state:", err.response ? err.response.data : err.message);
    return null;
  }
};

/**
 * Changes the state of a specific light using the LightAction instances in ActionRegistry
 * @param {string} lightId - ID of the light to control
 * @param {boolean} state - Whether to turn the light on (true) or off (false)
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @returns {Promise<Object>} Result of the operation
 */
exports.switchLightState = async (lightId, state, rasp_ip) => {
  try {

    const lightId = 'e3cd3456-4cc1-4526-a56e-18f7db068616';
    console.log(`Switching light ${lightId} to state: ${state} using ActionRegistry`);
    
    // Generate an action string based on the state
    // Format: "[location] light [on/off]"
    const actionString = `light ${state ? 'on' : 'off'}`;
    
    console.log(`Using action string: "${actionString}"`);
    
    // Use the ActionRegistry's executeAction method to find and execute the appropriate action
    const result = await actionRegistry.executeAction(actionString);
    
    // Check if the action was successful
    if (result.success) {
      console.log(`Successfully executed light action: ${result.message}`);
      return { 
        success: true, 
        statusCode: 200, 
        data: result.deviceId ? { deviceId: result.deviceId } : {}
      };
    } else {
      console.error(`Failed to execute light action: ${result.message}`);
      throw new Error(result.message || "Failed to execute light action");
    }
  } catch (err) {
    console.error("Error in switchLightState:", err.message);
    
    // If ActionRegistry fails, fall back to the original implementation
    try {
      console.log("Falling back to direct API call");
      const config = await loadConfig();
      const ngrokUrl = config[rasp_ip];
      
      if (!ngrokUrl) {
        throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
      }
      
      const apiUrl = `${ngrokUrl}/api-hue/switch_light_state`;
      const payload = {
        light_id: lightId,
        state: state
      };
      
      console.log("Sending payload to switch light state (fallback):", payload);
      
      const response = await axios.put(apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.status === 200 && response.data.statusCode === 200) {
        console.log("Light state changed successfully (fallback):", response.data);
        
        return { 
          success: true, 
          statusCode: 200, 
          data: response.data.data 
        };
      } else {
        console.error("Failed to update light state via API (fallback):", response.data);
        return { 
          success: false, 
          statusCode: response.status || 500,
          message: response.data?.error || "Failed to update light state" 
        };
      }
    } catch (fallbackErr) {
      const statusCode = fallbackErr.response?.status || 500;
      const errorMessage = fallbackErr.message;
      
      console.error("Fallback also failed:", errorMessage);
      return { 
        success: false,
        statusCode: statusCode, 
        message: `Original error: ${err.message}. Fallback error: ${errorMessage}`
      };
    }
  }
};

// Export the loadConfig function for testing purposes
exports.loadConfig = loadConfig;