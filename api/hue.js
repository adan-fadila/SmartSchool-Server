const { default: axios } = require("axios");
const Device = require("../models/Device");
const RoomDevice = require("../models/RoomDevice");
const { updateDeviceModeInDatabase } = require("../services/devices.service");
const fs = require('fs').promises;
const path = require('path');

// Load Raspberry Pi configuration (same as in sensibo.js)
const loadConfig = async () => {
  try {
    const filePath = path.resolve(__dirname, './endpoint/rasp_pi.json');
    console.log(filePath);
    console.log(`Loading configuration from: ${filePath}`);

    // Check if the file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      throw new Error(`Configuration file does not exist at: ${filePath}`);
    }

    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Error loading configuration: ${err.message}`);
  }
};

/**
 * Gets information about all lights connected to the Hue bridge
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @returns {Promise<Object>} Information about all lights
 */
const getAllLights = async (rasp_ip) => {
  try {
    const config = await loadConfig();

    // Search for the IP address in the cached JSON data
    const ngrokUrl = config[rasp_ip];

    if (!ngrokUrl) {
      throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
    }

    const endpoint = `${ngrokUrl}`;
    const flaskUrl = `${endpoint}/api-hue/get_all_lights`;

    // Send a GET request to the Flask app
    const response = await axios.get(flaskUrl);
    console.log("All Lights Retrieved from Flask:", response.data);

    if (response.data && response.data.success) {
      return response.data.lights; // Accessing the lights data returned by the Flask app
    } else {
      console.log("No lights data found in the response from Flask");
      return null;
    }
  } catch (err) {
    console.error("Error retrieving lights data from Flask:", err.response ? err.response.data : err.message);
    return null;
  }
};

/**
 * Retrieves the current state of a specific Hue light
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @param {string} lightId - ID of the light to query
 * @returns {Promise<Object>} Light state information
 */
const getLightState = async (rasp_ip, lightId) => {
  try {
    const config = await loadConfig();

    // Search for the IP address in the cached JSON data
    const ngrokUrl = config[rasp_ip];

    if (!ngrokUrl) {
      throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
    }

    const endpoint = `${ngrokUrl}`;

    console.log("Requesting light state for IP:", rasp_ip);
    const flaskUrl = `${endpoint}/api-hue/get_light_state?light_id=${lightId}`;

    // Send a GET request to the Flask app
    const response = await axios.get(flaskUrl);
    console.log("Light State Retrieved from Flask:", response.data);

    if (response.data && response.data.success) {
      return response.data.lightState; // Accessing the light state returned by the Flask app
    } else {
      console.log("No light state found in the response from Flask");
      return null; // Consider returning a default state or null if no state is found
    }
  } catch (err) {
    // Handle errors in the request to the Flask app
    console.error("Error retrieving light state from Flask:", err.response ? err.response.data : err.message);
    return null; // Return null or a default state object in case of an error
  }
};

/**
 * Changes the state of a specific Hue light
 * @param {string} lightId - ID of the light to control
 * @param {boolean} state - Whether to turn the light on (true) or off (false)
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @param {number} [brightness=null] - Brightness level (1-254, null for no change)
 * @param {Object} [color=null] - Color parameters (null for no change)
 * @returns {Promise<Object>} Result of the operation
 */
const switchLightState = async (lightId, state, rasp_ip, brightness = null, color = null) => {
  try {
    console.log("The state is:", state);
    const config = await loadConfig();

    // Search for the IP address in the cached JSON data
    const ngrokUrl = config[rasp_ip];

    if (!ngrokUrl) {
      throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
    }

    const endpoint = `${ngrokUrl}`;
    const apiUrl = `${endpoint}/api-hue/switch_light_state`; // Ensure this matches your Flask server URL
    console.log("Target light ID:", lightId);

    // Construct the payload
    const payload = {
      light_id: lightId, // Use the provided lightId
      state: state
    };

    // Add optional parameters if provided
    if (brightness !== null) {
      payload.brightness = brightness;
    }

    if (color !== null) {
      payload.color = color;
    }

    console.log("Sending payload to switch light state:", payload);

    const response = await axios.put(apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Check if the API call was successful
    if (response.status === 200 && response.data.statusCode === 200) {
      console.log("Light state changed successfully", response.data);

      return { 
        success: true, 
        statusCode: 200, 
        data: response.data.data 
      };
    } else {
      console.error("Failed to update light state via API.");
      return { 
        success: false, 
        statusCode: response.status || 500,
        message: response.data?.error || "Failed to update light state" 
      };
    }
  } catch (err) {
    const statusCode = err.response?.status || 500;
    let errorMessage = err.message;
    let detailedError = {};

    if (err.response && err.response.data) {
      errorMessage = `Error switching light state: ${err.response.statusText}`;
      detailedError = err.response.data;
      console.error("Detailed Hue API error:", detailedError);
    }

    console.error(errorMessage);
    return { 
      success: false,
      statusCode: statusCode, 
      message: errorMessage,
      details: detailedError 
    };
  }
};

/**
 * Changes the color of a specific Hue light
 * @param {string} lightId - ID of the light to control
 * @param {Object} colorParams - Color parameters (hue, saturation, etc.)
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @returns {Promise<Object>} Result of the operation
 */
const setLightColor = async (lightId, colorParams, rasp_ip) => {
  // Reuse the switchLightState function with state=true and color parameters
  return await switchLightState(lightId, true, rasp_ip, null, colorParams);
};

/**
 * Changes the brightness of a specific Hue light
 * @param {string} lightId - ID of the light to control
 * @param {number} brightness - Brightness level (1-254)
 * @param {string} rasp_ip - IP address of the Raspberry Pi
 * @returns {Promise<Object>} Result of the operation
 */
const setLightBrightness = async (lightId, brightness, rasp_ip) => {
  // Ensure brightness is within valid range
  const validBrightness = Math.min(254, Math.max(1, brightness));
  
  // Reuse the switchLightState function with state=true and brightness parameter
  return await switchLightState(lightId, true, rasp_ip, validBrightness, null);
};

module.exports = {
  getLightState,
  getAllLights,
  switchLightState,
  setLightColor,
  setLightBrightness
};