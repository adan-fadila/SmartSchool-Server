const lightService = require('../services/light.service');
const { getSensiboSensors } = require("../api/sensibo");
const interpreterService = require("../interpreter/src/server-integration");
const sensorLoggingService = require("./sensor-logging.service");
const fsSync = require("fs");
const { handleControllers } = require("../controllers/handlersController");
const { getMotionSensorData } = require("../api/MotionSensor");
// Import the getAcState function from your module
const { getAcState } = require('../api/sensibo');

/**
 * Service to handle integration between Sensibo sensors and the interpreter
 */
const interpreterSensorService = {
  // Store latest sensor values
  latestMotionEvent: null,
  latestTempEvent: null,
  latestHumidityEvent: null,
  
  /**
   * Get space ID from room name using the handlersController configurations
   * @param {string} roomName - The name of the room
   * @returns {string} The space ID, or 'unknown' if not found
   */
  getSpaceIdFromRoomName(roomName) {
    try {
      // Access configurations from handlersController - exported as handleControllers
      const configurationsArray = handleControllers.configurations || [];

      // Find the configuration for the given room name
      const config = configurationsArray.find(
        (config) =>
          config.roomName &&
          config.roomName.toLowerCase() === roomName.toLowerCase()
      );

      // Return the space ID if found, otherwise return 'unknown'
      return config && config.spaceId ? config.spaceId : "unknown";
    } catch (error) {
      console.error("Error getting space ID from room name:", error);
      return "unknown";
    }
  },

  /**
 * Update events from motion sensor and store for combined logging
 * @param {string} raspPiIP - Raspberry Pi IP address to fetch sensor data from
 * @returns {Promise<Object>} Result object with success status and updated events
 */
async updateEventsFromMotionSensor(raspPiIP) {
  try {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Fetching motion sensor data from Raspberry Pi at ${raspPiIP}\n`
    );

    console.log(`Fetching motion sensor data from Raspberry Pi at ${raspPiIP}`);

    // Get motion sensor data from Raspberry Pi
    const motionSensorData = await getMotionSensorData(raspPiIP);

    if (!motionSensorData) {
      const errorMsg = "No motion sensor data received";
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: ERROR - ${errorMsg}\n`
      );
      console.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Debug logging
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Received motion sensor data: ${JSON.stringify(
        motionSensorData
      )}\n`
    );
    console.log("Received motion sensor data:", motionSensorData);

    // Format the data into events
    const motionEvents = this.formatMotionSensorDataToEvents(motionSensorData);

    if (!motionEvents || motionEvents.length === 0) {
      const errorMsg = "Failed to format motion sensor data to events";
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: ERROR - ${errorMsg}\n`
      );
      console.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Debug logging
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Formatted motion sensor events: ${JSON.stringify(
        motionEvents
      )}\n`
    );

    // Store the latest motion event
    this.latestMotionEvent = motionEvents[0];

    // Update each event in the interpreter
    const updatedMotionEvents = [];

    for (const event of motionEvents) {
      console.log("Updating:", event.name, event.value, event.type);
      const result = interpreterService.updateEventValue(
        event.name,
        event.value
      );

      if (result.success) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Successfully updated motion event: ${event.name} = ${event.value}\n`
        );
        console.log(
          `Successfully updated motion event: ${event.name} = ${event.value}`
        );
        updatedMotionEvents.push(event);
      } else {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Failed to update motion event ${event.name}: ${result.error}\n`
        );
        console.warn(
          `Failed to update motion event ${event.name}: ${result.error}`
        );
      }
    }

    return {
      success: true,
      updatedEvents: updatedMotionEvents,
      totalEvents: motionEvents.length,
      successfulUpdates: updatedMotionEvents.length
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: EXCEPTION - Error updating events from motion sensor: ${error.message}\n`
    );
    console.error("Error updating events from motion sensor:", error);
    return {
      success: false,
      error: error.message,
    };
  }
},

/**
 * Update events from Sensibo sensors
 * @param {string} raspPiIP - Raspberry Pi IP address to fetch sensor data from
 * @returns {Promise<Object>} Result object with success status and updated events
 */
async updateEventsFromSensibo(raspPiIP) {
  try {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Fetching sensor data from Raspberry Pi at ${raspPiIP}\n`
    );

    console.log(`Fetching sensor data from Raspberry Pi at ${raspPiIP}`);

    // Get sensor data from Sensibo via Raspberry Pi
    const sensorData = await getSensiboSensors(raspPiIP);

    if (!sensorData) {
      const errorMsg = "No sensor data received from Sensibo";
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: ERROR - ${errorMsg}\n`
      );
      console.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Debug logging
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Received sensor data: ${JSON.stringify(sensorData)}\n`
    );
    console.log("Received sensor data:", sensorData);

    // Format the data into events
    const events = this.formatSensorDataToEvents(sensorData);

    if (!events || events.length === 0) {
      const errorMsg = "Failed to format sensor data to events";
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: ERROR - ${errorMsg}\n`
      );
      console.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Debug logging
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Formatted events: ${JSON.stringify(events)}\n`
    );

    // Store temperature and humidity events
    let tempValue = null;
    let humidityValue = null;
    let roomName = "Living Room";
    
    for (const event of events) {
      if (event.name.includes('temperature')) {
        this.latestTempEvent = event;
        tempValue = event.value;
        roomName = event.roomName || roomName;
      } else if (event.name.includes('humidity')) {
        this.latestHumidityEvent = event;
        humidityValue = event.value;
        roomName = event.roomName || roomName;
      }
    }

    // Update each event in the interpreter
    const updatedEvents = [];

    for (const event of events) {
      const result = interpreterService.updateEventValue(
        event.name,
        event.value
      );

      if (result.success) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Successfully updated event: ${event.name} = ${event.value}\n`
        );
        console.log(
          `Successfully updated event: ${event.name} = ${event.value}`
        );
        updatedEvents.push(event);
      } else {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Failed to update event ${event.name}: ${result.error}\n`
        );
        console.warn(`Failed to update event ${event.name}: ${result.error}`);
      }
    }

    return {
      success: true,
      updatedEvents,
      totalEvents: events.length,
      successfulUpdates: updatedEvents.length
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: EXCEPTION - Error updating events from Sensibo: ${error.message}\n`
    );
    console.error("Error updating events from Sensibo:", error);
    return {
      success: false,
      error: error.message,
    };
  }
},

/**
* Log all sensor values in a single row
* @param {boolean} motionValue - Motion sensor value
* @param {number} temperatureValue - Temperature value
* @param {number} humidityValue - Humidity value
* @param {string} roomName - Room name
* @param {boolean} isLightOn - Whether the light is on
* @param {boolean} acOn - Whether the AC is on
* @returns {Object} Result of the logging operation
*/
logAllSensorValues(motionValue, temperatureValue, humidityValue, roomName = "Living Room", isLightOn = false, acOn = false) {
  try {
    const timestamp = new Date().toISOString();
    
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Creating a combined row with motion=${motionValue}, temp=${temperatureValue}, humidity=${humidityValue}, light=${isLightOn}, ac_on=${acOn}\n`
    );
    
    // Generate spaceId from roomName
    const spaceId = this.getSpaceIdFromRoomName(roomName);
    
    // Create events that will be logged in a single row
    const combinedEvents = [
      {
        name: `${roomName.toLowerCase()} motion`,
        value: motionValue !== null ? motionValue : false,
        roomName,
        spaceId
      },
      {
        name: `${roomName.toLowerCase()} temperature`,
        value: temperatureValue !== null ? temperatureValue : null,
        roomName,
        spaceId
      },
      {
        name: `${roomName.toLowerCase()} humidity`,
        value: humidityValue !== null ? humidityValue : null,
        roomName,
        spaceId
      },
      // Add light state as the fourth event
      {
        name: "light_state",
        value: isLightOn !== null ? isLightOn : false,
        roomName,
        spaceId
      },
      // Add just the AC on/off state
      {
        name: `ac_state`,
        value: acOn !== null ? acOn : false,
        roomName,
        spaceId
      }
    ];
    
    // Log all events in one call, which will write them to a single row
    const loggingResult = sensorLoggingService.logSensorData(combinedEvents);
    
    if (!loggingResult.success) {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: ERROR - Failed to log combined sensor data: ${loggingResult.error}\n`
      );
      console.warn(`Failed to log combined sensor data: ${loggingResult.error}`);
    } else {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Successfully logged combined sensor data in one row\n`
      );
      console.log("Successfully logged combined sensor data in one row");
    }
    
    return loggingResult;
  } catch (error) {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: EXCEPTION - Error logging all sensor values: ${error.message}\n`
    );
    console.error("Error logging all sensor values:", error);
    return {
      success: false,
      error: error.message
    };
  }
},

  /**
   * Format motion sensor data into events
   * @param {Object} motionSensorData - Raw motion sensor data
   * @returns {Array<Object>} Formatted events with name and value
   */
  formatMotionSensorDataToEvents(motionSensorData) {
    const events = [];

    // Check if motion detection status is available
    if (motionSensorData.motionDetected !== undefined) {
      // For now, we assume a generic location as "Living Room"
      // This can be updated based on real data if needed
      const roomName = "Living Room";
      const spaceId = this.getSpaceIdFromRoomName(roomName);

      events.push({
        name: `${roomName.toLowerCase()} motion`,  // Changed from 'motion' to 'motion detected'
        value: motionSensorData.motionDetected,
        roomName,
        spaceId,
      });
    }

    return events;
  },

  /**
   * Format sensor data into events
   * @param {Object} sensorData - Raw sensor data from Sensibo
   * @returns {Array<Object>} Formatted events with name and value
   */
  formatSensorDataToEvents(sensorData) {
    const events = [];

    // Check if temperature is present
    if (sensorData.temperature !== undefined) {
      // For now, we're assuming "Living Room" as the location
      // This should be fetched from the device/room relationship in a real implementation
      const roomName = "Living Room";
      const spaceId = this.getSpaceIdFromRoomName(roomName);

      events.push({
        name: `${roomName.toLowerCase()} temperature`,
        value: sensorData.temperature,
        roomName,
        spaceId,
      });
    }

    // Check if humidity is present
    if (sensorData.humidity !== undefined) {
      const roomName = "Living Room";
      const spaceId = this.getSpaceIdFromRoomName(roomName);

      events.push({
        name: `${roomName.toLowerCase()} humidity`,
        value: sensorData.humidity,
        roomName,
        spaceId,
      });
    }

    // Handle the case where sensorData is in the format from the Raspberry Pi API
    // This handles the format: { sensors: [{ room: 'Living Room', sensor: 'temperature', value: 18.3 }, ...] }
    if (sensorData.sensors && Array.isArray(sensorData.sensors)) {
      sensorData.sensors.forEach((sensor) => {
        if (sensor.room && sensor.sensor && sensor.value !== undefined) {
          const roomName = sensor.room;
          const spaceId = this.getSpaceIdFromRoomName(roomName);

          events.push({
            name: `${roomName.toLowerCase()} ${sensor.sensor.toLowerCase()}`,
            value: sensor.value,
            roomName,
            spaceId,
          });
        }
      });
    }

    return events;
  },

// Import the light service at the top of the file

/**
 * Start periodic polling for sensor data
 * @param {string} raspPiIP - Raspberry Pi IP to poll
 * @param {number} interval - Polling interval in milliseconds (default: 30000)
 * @returns {Object} Handle to the polling interval
 */
startSensorPolling(raspPiIP, interval = 30000) {
  const timestamp = new Date().toISOString();
  fsSync.appendFileSync(
    "./logs/sensor_debug.log",
    `${timestamp}: Starting sensor polling with interval: ${interval}ms for IP ${raspPiIP}\n`
  );
  console.log(`Starting sensor polling with interval: ${interval}ms`);

  // Using the specific light ID from the service file
  const lightId = "e3cd3456-4cc1-4526-a56e-18f7db068616";

  // Clear any existing polling
  if (this.pollingInterval) {
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: Clearing existing polling interval\n`
    );
    clearInterval(this.pollingInterval);
  }

  // Track poll count for debugging
  let pollCount = 0;

  // Start new polling
  this.pollingInterval = setInterval(async () => {
    const pollTimestamp = new Date().toISOString();
    pollCount++;
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${pollTimestamp}: Polling for sensor data... (poll #${pollCount})\n`
    );
    console.log(`Polling for sensor data... (poll #${pollCount})`);

    // Fetch data from Sensibo
    const sensiboResult = await this.updateEventsFromSensibo(raspPiIP);
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${new Date().toISOString()}: Sensibo polling result: ${JSON.stringify(
        sensiboResult
      )}\n`
    );

    // Fetch data from Motion Sensor
    const motionSensorResult = await this.updateEventsFromMotionSensor(
      raspPiIP
    );
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${new Date().toISOString()}: Motion sensor polling result: ${JSON.stringify(
        motionSensorResult
      )}\n`
    );
    
    // Get AC state - simple approach
    let acState = false;
    
    try {
      const acResult = await getAcState(raspPiIP);
      console.log("ac state is ::::::::", JSON.stringify(acResult));
      
      // Properly log the AC state using JSON.stringify
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: AC state is: ${JSON.stringify(acResult)}\n`
      );
      
      // Extract just the 'on' field - default to false if not found
      if (acResult && acResult.acState && typeof acResult.acState.on === 'boolean') {
        acState = acResult.acState.on;
      }
      
      // Log the extracted AC on/off state for debugging
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Extracted AC on state: ${acState}\n`
      );
    } catch (error) {
      console.error("Error getting AC state:", error);
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Error getting AC state: ${error.message}\n`
      );
    }
    
    try {
      // Get light state using the imported service's exported function
      const lightState = await lightService.getLightState(raspPiIP, lightId);
      
      // Log the raw light state result for debugging
      console.log("Raw light state result:", lightState);
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Raw light state result: ${JSON.stringify(lightState)}\n`
      );
      
      // Centralized Logging - Extract values correctly based on the service response
      const motionValue = this.latestMotionEvent ? this.latestMotionEvent.value : false;
      const tempValue = this.latestTempEvent ? this.latestTempEvent.value : null;
      const humidityValue = this.latestHumidityEvent ? this.latestHumidityEvent.value : null;
      const roomName = this.latestTempEvent ? this.latestTempEvent.roomName : "Living Room";
      
      // Default to false for light state
      let isLightOn = false;
      
      // Carefully extract the light state
      if (lightState && typeof lightState === 'object') {
        if (lightState.on && typeof lightState.on === 'object' && 'on' in lightState.on) {
          isLightOn = !!lightState.on.on; // Convert to boolean
          console.log("Extracted light state from nested on.on property:", isLightOn);
        } else if (typeof lightState.on === 'boolean') {
          isLightOn = lightState.on;
          console.log("Extracted light state from direct on property:", isLightOn);
        }
        
        // Log the extracted light state
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Extracted light state: ${isLightOn}\n`
        );
      }
      
      // Update light state in events system if needed
      if (this.updateEvent) {
        const updateResult = this.updateEvent("light_state", isLightOn);
        console.log("Light state event update result:", updateResult);
      }
      
      // Log all sensor values including just the AC on/off state
      const loggingResult = this.logAllSensorValues(
        motionValue,
        tempValue,
        humidityValue,
        roomName,
        isLightOn,
        acState  // Just pass the boolean AC on state
      );
      
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Combined logging result: ${JSON.stringify(loggingResult)}\n`
      );
    } catch (error) {
      console.error("Error getting light state:", error);
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Error getting light state: ${error.message}\n`
      );
      
      // Log the sensor values without light state in case of error
      const motionValue = this.latestMotionEvent ? this.latestMotionEvent.value : false;
      const tempValue = this.latestTempEvent ? this.latestTempEvent.value : null;
      const humidityValue = this.latestHumidityEvent ? this.latestHumidityEvent.value : null;
      const roomName = this.latestTempEvent ? this.latestTempEvent.roomName : "Living Room";
      
      // Log sensor values without light state but with AC state
      const loggingResult = this.logAllSensorValues(
        motionValue,
        tempValue,
        humidityValue,
        roomName,
        false,
        acState  // Just pass the boolean AC on state
      );
      
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Combined logging result (without light state): ${JSON.stringify(loggingResult)}\n`
      );
    }

    // Check if interval is active - defensive check
    const isIntervalActive = this.pollingInterval !== null;
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${new Date().toISOString()}: Polling interval active: ${isIntervalActive}\n`
    );
  }, interval);

  fsSync.appendFileSync(
    "./logs/sensor_debug.log",
    `${timestamp}: Polling interval set with ID: ${this.pollingInterval}\n`
  );

  // Run immediate poll with Promise.all
  Promise.all([
    this.updateEventsFromSensibo(raspPiIP),
    this.updateEventsFromMotionSensor(raspPiIP),
    lightService.getLightState(raspPiIP, lightId).catch(err => {
      console.error("Initial light state error:", err.message);
      return null;
    }),
    // Get AC state for initial poll
    getAcState(raspPiIP).catch(err => {
      console.error("Initial AC state error:", err.message);
      return { success: false, acState: { on: false } };
    })
  ]).then(([sensiboResult, motionResult, lightState, acResult]) => {
    // Extract AC on state from result - default to false if not found
    const acOn = acResult && acResult.acState && typeof acResult.acState.on === 'boolean' ? 
                 acResult.acState.on : false;
    
    // Add central logging for initial poll
    const motionValue = this.latestMotionEvent ? this.latestMotionEvent.value : false;
    const tempValue = this.latestTempEvent ? this.latestTempEvent.value : null;
    const humidityValue = this.latestHumidityEvent ? this.latestHumidityEvent.value : null;
    const roomName = this.latestTempEvent ? this.latestTempEvent.roomName : "Living Room";
    
    // Default to false for light state
    let isLightOn = false;
    
    // Carefully extract the light state from the initial poll result
    if (lightState && typeof lightState === 'object') {
      if (lightState.on && typeof lightState.on === 'object' && 'on' in lightState.on) {
        isLightOn = !!lightState.on.on;
      } else if (typeof lightState.on === 'boolean') {
        isLightOn = lightState.on;
      }
    }
    
    // Log the combined initial polling results
    const loggingResult = this.logAllSensorValues(
      motionValue,
      tempValue,
      humidityValue,
      roomName,
      isLightOn,
      acOn  // Just pass the boolean AC on state
    );
    
    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${new Date().toISOString()}: Initial combined logging result: ${JSON.stringify(loggingResult)}\n`
    );
  }).catch(error => {
    console.error("Error in initial polling:", error);
  });

  return {
    success: true,
    message: `Sensor polling started with interval: ${interval}ms`,
    handle: this.pollingInterval,
  };
},

  /**
   * Stop sensor polling
   * @returns {Object} Result of stopping the polling
   */
  stopSensorPolling() {
    const timestamp = new Date().toISOString();

    if (this.pollingInterval) {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Stopping sensor polling interval: ${this.pollingInterval}\n`
      );
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;

      // Close the logging service when stopping polling
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Closing logging service\n`
      );
      sensorLoggingService.close();

      return {
        success: true,
        message: "Sensor polling stopped",
      };
    }

    fsSync.appendFileSync(
      "./logs/sensor_debug.log",
      `${timestamp}: No polling was active to stop\n`
    );
    return {
      success: false,
      message: "No polling was active",
    };
  },
};

module.exports = interpreterSensorService;