const BaseAction = require('./BaseAction');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

/**
 * ACAction class for AC control operations
 * Example: "AC on cool 23"
 */
class ACAction extends BaseAction {
  /**
   * @param {string} location - Location of the AC unit
   * @param {string} state - State of the AC (on/off)
   * @param {string} mode - Mode of the AC (cool/heat/fan)
   * @param {number} temperature - Temperature setting (if applicable)
   */
  constructor(location, state, mode = null, temperature = null) {
    super();
    this.location = location;
    this.state = state.toLowerCase();
    this.mode = mode ? mode.toLowerCase() : null;
    this.temperature = temperature;
  }

  /**
   * Load the Raspberry Pi configuration
   * @returns {Object} - Configuration object mapping IP to ngrok URL
   */
  async loadConfig() {
    try {
      const filePath = path.resolve(__dirname, '../../api/endpoint/rasp_pi.json');
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
  }

  /**
   * Validate temperature range
   * @param {number} temperature - Temperature to validate
   * @returns {boolean} - Whether the temperature is valid
   */
  validateDegree(temperature) {
    return temperature >= 16 && temperature <= 30;
  }

  /**
   * Get the device ID for the AC in the specified location
   * @param {string} location - Location to find AC for
   * @returns {string} - Device ID
   */
  async getDeviceIdForLocation(location) {
    // In a real implementation, you would query the database to find
    // the device ID for the AC in the specified location
    // For now, we'll use a default ID or retrieve from environment variables
    try {
      const Device = require('../../models/Device');
      const deviceData = await Device.findOne({ 
        type: 'AC', 
        location: { $regex: new RegExp(location, 'i') } 
      });
      
      if (deviceData) {
        return deviceData.device_id;
      }
      
      // Default to environment variable if not found
      return process.env.SENSIBO_DEVICE_ID;
    } catch (error) {
      console.error(`Error getting device ID for location ${location}:`, error.message);
      // Fallback to environment variable
      return process.env.SENSIBO_DEVICE_ID;
    }
  }

  /**
   * Get the Raspberry Pi IP for the specified location
   * @param {string} location - Location to find Raspberry Pi for
   * @returns {string} - Raspberry Pi IP
   */
  async getRaspberryPiIPForLocation(location) {
    // In a real implementation, you would query the database to find
    // the Raspberry Pi IP for the specified location
    // For now, we'll use a default IP
    try {
      const Room = require('../../models/Room');
      const roomData = await Room.findOne({ 
        name: { $regex: new RegExp(location, 'i') } 
      });
      
      if (roomData && roomData.raspberry_pi_ip) {
        return roomData.raspberry_pi_ip;
      }
      
      // Return a default IP if not found
      return '192.168.0.121'; // Default IP, replace with actual default
    } catch (error) {
      console.error(`Error getting Raspberry Pi IP for location ${location}:`, error.message);
      return '192.168.0.121'; // Default IP, replace with actual default
    }
  }

  /**
   * Execute the AC control action by calling the Sensibo API
   */
  async execute() {
    console.log(`Executing AC action: ${this.state} ${this.mode ? this.mode : ''} ${this.temperature ? this.temperature : ''} in ${this.location}`);
    
    try {
      // Get the device ID and Raspberry Pi IP for this location
      const deviceId = await this.getDeviceIdForLocation(this.location);
      const raspberryPiIP = await this.getRaspberryPiIPForLocation(this.location);
      
      // Validate temperature if provided
      if (this.temperature !== null && !this.validateDegree(this.temperature)) {
        throw new Error(`Temperature ${this.temperature} is outside valid range (16-30)`);
      }
      
      await this.switchAcState(deviceId, this.state, raspberryPiIP, this.temperature);
      
      return true;
    } catch (error) {
      console.error('Error executing AC action:', error.message);
      return false;
    }
  }

  /**
   * Switch the AC state using the Sensibo API
   * @param {string} id - Device ID
   * @param {string} state - State (on/off)
   * @param {string} rasp_ip - Raspberry Pi IP
   * @param {number} temperature - Temperature setting
   */
  async switchAcState(id, state, rasp_ip, temperature) {
    const config = await this.loadConfig();

    // Search for the IP address in the configuration
    const ngrokUrl = config[rasp_ip];

    if (!ngrokUrl) {
      throw new Error(`IP address ${rasp_ip} not found in the configuration file`);
    }

    const endpoint = `${ngrokUrl}`;
    console.log(`Using endpoint: ${endpoint}`);
    
    const apiUrl = `${endpoint}/api-sensibo/switch_ac_state`;
    
    // Get API key from environment or use a default value
    const apiKey = process.env.SENSIBO_API_KEY || "default_api_key";

    // Construct the payload
    const payload = {
      id: id,
      apiKey: apiKey,
      state: state === 'on', // Convert to boolean
      temperature: temperature,
      mode: this.mode
    };

    console.log(`Sending request to switch AC state: ${JSON.stringify(payload)}`);

    // Send the request to the API
    const response = await axios.post(apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Check if the API call was successful
    if (response.status === 200) {
      console.log("AC state changed successfully", response.data);

      // Update the device state in the database
      try {
        const Device = require('../../models/Device');
        const RoomDevice = require('../../models/RoomDevice');
        
        // Update the device state
        await Device.updateOne(
          { device_id: id },
          { $set: { 
            state: state, 
            mode: this.mode,
            temperature: temperature,
            lastUpdated: new Date() 
          }}
        );

        // Update the room device state
        await RoomDevice.updateOne(
          { device_id: id },
          { $set: { 
            state: state, 
            mode: this.mode,
            temperature: temperature,
            lastUpdated: new Date() 
          }}
        );
        
        console.log(`Database updated for device ${id}`);
      } catch (dbError) {
        console.error('Error updating database:', dbError.message);
        // Continue execution even if database update fails
      }

      return response.data;
    } else {
      throw new Error(`Failed to change AC state. Status: ${response.status}`);
    }
  }
}

module.exports = ACAction; 