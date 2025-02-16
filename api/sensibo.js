const { default: axios } = require("axios");
const Device = require("../models/Device");
const RoomDevice = require("../models/RoomDevice");
const { updateDeviceModeInDatabase } = require("../services/devices.service");
const { addingDataToCsv } = require("../utils/machineLearning.js");
const SensorValue = require("../models/SensorValue");
const { getSeasonNumberByMonth, discretizeHour } = require("../utils/utils");
const { SENSORS } = require("../consts/common.consts");
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

const validateDegree = (temperature) => {
  return temperature >= 16 && temperature <= 30;
};

const getAcState = async (rasp_ip, device_id) => {
  const config = await loadConfig();
  const raspConfig = config[rasp_ip];

  if (!raspConfig) {
    throw new Error(`Raspberry Pi IP ${rasp_ip} not found in the configuration file`);
  }

  const endpoint = raspConfig.url;
  console.log("Requesting AC state from:", endpoint);

  try {
    const flaskUrl = `${endpoint}api-sensibo/get_ac_state`;
    const response = await axios.get(flaskUrl);
    console.log("AC State Retrieved from Flask:", response.data);

    if (response.data && response.data.success) {
      return response.data.acState;
    } else {
      console.log("No AC state found in the response from Flask");
      return null;
    }
  } catch (err) {
    console.error("Error retrieving AC state from Flask:", err.response ? err.response.data : err.message);
    return null;
  }
};

const TurnON_OFF_LIGHT = async (state, rasp_ip, device_id, Control) => {
  try {
    const config = await loadConfig();
    const raspConfig = config[rasp_ip];

    if (!raspConfig) {
      throw new Error(`Raspberry Pi IP ${rasp_ip} not found in the configuration file`);
    }

    if (!raspConfig.devices.includes(device_id)) {
      throw new Error(`Device ${device_id} is not managed by Raspberry Pi at ${rasp_ip}`);
    }

    const endpoint = raspConfig.url;
    const endpointUrl = `${endpoint}/${state}`; // Construct the endpoint URL

    // Make a POST request to the endpoint
    const response = await axios.post(endpointUrl, { Control });
    console.log(response.data); // Log the response data
    return response.data; // Return the response data if needed
  } catch (error) {
    console.error("Error in TurnON_OFF_LIGHT:", error);
    throw error;
  }
};

const switchAcState = async (state, rasp_ip, device_id, Control) => {
  try {
    const config = await loadConfig();
    const raspConfig = config[rasp_ip];

    if (!raspConfig) {
      throw new Error(`Raspberry Pi IP ${rasp_ip} not found in the configuration file`);
    }

    // Ensure the URL is properly formatted
    const baseUrl = raspConfig.url.endsWith('/') ? raspConfig.url : `${raspConfig.url}/`;
    const endpoint = `${baseUrl}api-sensibo/switch_ac_state`;
    
    console.log(`Sending AC command to: ${endpoint}`);
    console.log('Command details:', { state, device_id, Control });

    // Update request body to match Flask endpoint expectations
    const requestBody = {
      id: device_id,
      apiKey: process.env.SENSIBO_API_KEY, // Make sure this env var is set
      state: state === 'on', // Convert to boolean
      temperature: Control?.temperature
    };

    console.log('Request body:', requestBody);

    const response = await axios.post(endpoint, requestBody);

    if (response.data.statusCode === 200) {
      console.log('AC control successful:', response.data);
      return { success: true, data: response.data.data };
    } else {
      console.error('Failed to update AC state:', response.data);
      return { success: false, message: response.data.error || "Failed to update AC state via API" };
    }
  } catch (error) {
    console.error("Error controlling AC:", error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return { success: false, message: error.message };
  }
};

const getSensiboSensors = async (rasp_ip) => {
  try {
    console.log('Getting sensor data for Raspberry Pi:', rasp_ip);
    
    const config = await loadConfig();
    console.log('Loaded config:', config);
    
    const raspConfig = config[rasp_ip];
    if (!raspConfig) {
      throw new Error(`No configuration found for Raspberry Pi IP: ${rasp_ip}`);
    }

    if (!raspConfig.url) {
      throw new Error(`No URL configured for Raspberry Pi IP: ${rasp_ip}`);
    }

    // Ensure URL is properly formatted
    const baseUrl = raspConfig.url.endsWith('/') ? raspConfig.url : `${raspConfig.url}/`;
    const sensorUrl = `${baseUrl}api-sensibo/get_sensor_data`;
    
    console.log('Requesting sensor data from:', sensorUrl);

    const response = await axios.get(sensorUrl);
    
    if (response.data && response.data.success) {
      console.log('Received sensor data:', response.data);
      return {
        temperature: response.data.temperature,
        humidity: response.data.humidity
      };
    }
    
    throw new Error('Invalid response from sensor API');
  } catch (error) {
    console.error('Error in getSensiboSensors:', {
      message: error.message,
      config: error.config,
      response: error.response?.data
    });
    
    // Don't throw the error, return null instead
    return null;
  }
};

const parseSensorAndWriteToMongo = async () => {
  try {
    // Fetch the current temperature and humidity values
    const response = await getSensiboSensors();
    if (!response) {
      throw new Error("No sensor data available");
    }
    const { temperature, humidity } = response;

    const temperatureValue = `VAR temperature=${temperature.toFixed(1)}`;
    const humidityValue = `VAR humidity=${humidity.toFixed(1)}`;
    const temperatureDocument = new SensorValue({
      value: temperatureValue,
      sensor_type: SENSORS.TEMPERATURE,
    });
    const humidityDocument = new SensorValue({
      value: humidityValue,
      sensor_type: SENSORS.HUMIDITY,
    });

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // January is month 0, so we add 1 to get the correct month number
    const season = getSeasonNumberByMonth(currentMonth);

    const seasonValue = `VAR season=${season}`;
    const seasonDocument = new SensorValue({
      value: seasonValue,
      sensor_type: SENSORS.SEASON,
    });

    const currentHour = currentDate.getHours();
    let timeOfTheDay = discretizeHour(currentHour);
    const timeOfTheDayValue = `VAR hour=${timeOfTheDay}`;
    const timeDocument = new SensorValue({
      value: timeOfTheDayValue,
      sensor_type: SENSORS.HOUR,
    });

    await Promise.all([temperatureDocument.save(), humidityDocument.save(), seasonDocument.save(), timeDocument.save()]);

    console.log(`Temperature: ${temperature} Humidity: ${humidity} saved to database.`);
  } catch (error) {
    console.error(error);
  }
};

const updateAcMode = async (mode) => {
  try {
    const response = await axios.patch(
      `https://home.sensibo.com/api/v2/pods/${process.env.SENSIBO_DEVICE_ID}/acStates?apiKey=${process.env.SENSIBO_API_KEY}`,
      {
        acState: {
          on: true,
          mode: mode,
        },
      }
    );
    return { statusCode: 200, data: response.data.result };
  } catch (err) {
    return { statusCode: 403, data: err.message };
  }
};

const updateSensiboMode = async (deviceId, mode, rasp_ip) => {
  const config = await loadConfig();

  // Use deviceId to look up configuration
  const deviceConfig = config[deviceId];

  if (!deviceConfig) {
    throw new Error(`Device ID ${deviceId} not found in the configuration file`);
  }

  const endpoint = deviceConfig.ip;
  try {
    const response = await axios.post(`${endpoint}api-sensibo/update_mode`, {
      deviceId: deviceId,
      mode: mode
    });

    if (response.data.success) {
      const updateDB = await updateDeviceModeInDatabase(deviceId, mode);
      return { success: true, data: response.data };
    } else {
      return { success: false, message: "Failed to update mode via API" };
    }
  } catch (error) {
    console.error("Error updating Sensibo mode:", error);
    return { success: false, message: "Error updating mode" };
  }
};

module.exports = {
  switchAcState,
  getAcState,
  getSensiboSensors,
  parseSensorAndWriteToMongo,
  // analyzeFunc,
  updateAcMode,
  updateSensiboMode,
  TurnON_OFF_LIGHT,
  loadConfig
};
