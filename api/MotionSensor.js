const { default: axios } = require("axios");
const Device = require("../models/Device.js");
const RoomDevice = require("../models/RoomDevice.js");
const { updateDeviceModeInDatabase } = require("../services/devices.service.js");
const { addingDataToCsv } = require("../utils/machineLearning.js");
const SensorValue = require("../models/SensorValue.js");
const { getSeasonNumberByMonth, discretizeHour } = require("../utils/utils.js");
const { SENSORS } = require("../consts/common.consts.js");
const { stubString } = require("lodash");
const fs = require('fs').promises;
const path = require('path');

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

const getMotionSensorData = async (raspPiIP) => {
    try {
      const config = await loadConfig();
  
      // Search for the IP address in the cached JSON data
      const ngrokUrl = config[raspPiIP];
  
      if (!ngrokUrl) {
        throw new Error(`IP address ${raspPiIP} not found in the configuration file`);
      }
  
      const endpoint = `${ngrokUrl}`;
      const flaskUrl = `${endpoint}/api-motion/motion_state`;
      console.log(flaskUrl);
  
      // Send a GET request to the motion sensor API
      const response = await axios.get(flaskUrl);
  
      // Check if the response contains the necessary data
      if (response.data && response.data.motion_detected !== undefined) {
        console.log("================");
        console.log(response.data);
        console.log("================");
  
        // Extract motion detection status
        const motionDetected = response.data.motion_detected;
  
        console.log(`Motion detected: ${motionDetected}`);
        return { motionDetected };
      } else {
        console.log('No motion sensor data found.');
        return null; // Return null to indicate no data found
      }
    } catch (err) {
      console.error("Error fetching motion sensor data:", err.message);
      return null; // Return null to indicate failure
    }
  };

  module.exports = {
    getMotionSensorData
    
  };
  