const { getSensiboSensors } = require('../api/sensibo');
const interpreterService = require('../interpreter/src/server-integration');
const sensorLoggingService = require('./sensor-logging.service');
const fsSync = require('fs');
const { handleControllers } = require('../controllers/handlersController');

/**
 * Service to handle integration between Sensibo sensors and the interpreter
 */
const interpreterSensorService = {
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
        config => config.roomName && config.roomName.toLowerCase() === roomName.toLowerCase()
      );
      
      // Return the space ID if found, otherwise return 'unknown'
      return config && config.spaceId ? config.spaceId : 'unknown';
    } catch (error) {
      console.error('Error getting space ID from room name:', error);
      return 'unknown';
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
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Fetching sensor data from Raspberry Pi at ${raspPiIP}\n`);
      
      console.log(`Fetching sensor data from Raspberry Pi at ${raspPiIP}`);
      
      // Get sensor data from Sensibo via Raspberry Pi
      const sensorData = await getSensiboSensors(raspPiIP);
      
      if (!sensorData) {
        const errorMsg = 'No sensor data received from Sensibo';
        fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: ERROR - ${errorMsg}\n`);
        console.error(errorMsg);
        return { 
          success: false, 
          error: errorMsg 
        };
      }
      
      // Debug logging
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Received sensor data: ${JSON.stringify(sensorData)}\n`);
      console.log('Received sensor data:', sensorData);
      
      // Format the data into events
      const events = this.formatSensorDataToEvents(sensorData);
      
      if (!events || events.length === 0) {
        const errorMsg = 'Failed to format sensor data to events';
        fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: ERROR - ${errorMsg}\n`);
        console.error(errorMsg);
        return { 
          success: false, 
          error: errorMsg 
        };
      }
      
      // Debug logging
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Formatted events: ${JSON.stringify(events)}\n`);
      
      // Log the sensor data to our logging service
      const loggingResult = sensorLoggingService.logSensorData(events);
      if (!loggingResult.success) {
        fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: ERROR - Failed to log sensor data: ${loggingResult.error}\n`);
        console.warn(`Failed to log sensor data: ${loggingResult.error}`);
      } else {
        fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Successfully logged sensor data\n`);
        console.log('Successfully logged sensor data');
      }
      
      // Update each event in the interpreter
      const updatedEvents = [];
      
      for (const event of events) {
        const result = interpreterService.updateEventValue(event.name, event.value);
        
        if (result.success) {
          fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Successfully updated event: ${event.name} = ${event.value}\n`);
          console.log(`Successfully updated event: ${event.name} = ${event.value}`);
          updatedEvents.push(event);
        } else {
          fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Failed to update event ${event.name}: ${result.error}\n`);
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
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: EXCEPTION - Error updating events from Sensibo: ${error.message}\n`);
      console.error('Error updating events from Sensibo:', error);
      return {
        success: false,
        error: error.message
      };
    }
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
      const roomName = 'Living Room';
      const spaceId = this.getSpaceIdFromRoomName(roomName);
      
      events.push({
        name: `${roomName.toLowerCase()} temperature`,
        value: sensorData.temperature,
        roomName,
        spaceId
      });
    }
    
    // Check if humidity is present
    if (sensorData.humidity !== undefined) {
      const roomName = 'Living Room';
      const spaceId = this.getSpaceIdFromRoomName(roomName);
      
      events.push({
        name: `${roomName.toLowerCase()} humidity`,
        value: sensorData.humidity,
        roomName,
        spaceId
      });
    }
    
    // Handle the case where sensorData is in the format from the Raspberry Pi API
    // This handles the format: { sensors: [{ room: 'Living Room', sensor: 'temperature', value: 18.3 }, ...] }
    if (sensorData.sensors && Array.isArray(sensorData.sensors)) {
      sensorData.sensors.forEach(sensor => {
        if (sensor.room && sensor.sensor && sensor.value !== undefined) {
          const roomName = sensor.room;
          const spaceId = this.getSpaceIdFromRoomName(roomName);
          
          events.push({
            name: `${roomName.toLowerCase()} ${sensor.sensor.toLowerCase()}`,
            value: sensor.value,
            roomName,
            spaceId
          });
        }
      });
    }
    
    return events;
  },
  
  /**
   * Start periodic polling for sensor data
   * @param {string} raspPiIP - Raspberry Pi IP to poll
   * @param {number} interval - Polling interval in milliseconds (default: 30000)
   * @returns {Object} Handle to the polling interval
   */
  startSensorPolling(raspPiIP, interval = 30000) {
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Starting sensor polling with interval: ${interval}ms for IP ${raspPiIP}\n`);
    console.log(`Starting sensor polling with interval: ${interval}ms`);
    
    // Clear any existing polling
    if (this.pollingInterval) {
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Clearing existing polling interval\n`);
      clearInterval(this.pollingInterval);
    }
    
    // Track poll count for debugging
    let pollCount = 0;
    
    // Start new polling
    this.pollingInterval = setInterval(async () => {
      const pollTimestamp = new Date().toISOString();
      pollCount++;
      fsSync.appendFileSync('./logs/sensor_debug.log', `${pollTimestamp}: Polling for sensor data... (poll #${pollCount})\n`);
      console.log(`Polling for sensor data... (poll #${pollCount})`);
      
      const result = await this.updateEventsFromSensibo(raspPiIP);
      fsSync.appendFileSync('./logs/sensor_debug.log', `${new Date().toISOString()}: Polling result: ${JSON.stringify(result)}\n`);
      
      // Check if interval is active - defensive check
      const isIntervalActive = this.pollingInterval !== null;
      fsSync.appendFileSync('./logs/sensor_debug.log', `${new Date().toISOString()}: Polling interval active: ${isIntervalActive}\n`);
    }, interval);
    
    fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Polling interval set with ID: ${this.pollingInterval}\n`);
    
    // Run immediately the first poll instead of waiting for interval
    this.updateEventsFromSensibo(raspPiIP).then(result => {
      fsSync.appendFileSync('./logs/sensor_debug.log', `${new Date().toISOString()}: Initial polling result: ${JSON.stringify(result)}\n`);
    });
    
    return {
      success: true,
      message: `Sensor polling started with interval: ${interval}ms`,
      handle: this.pollingInterval
    };
  },
  
  /**
   * Stop sensor polling
   * @returns {Object} Result of stopping the polling
   */
  stopSensorPolling() {
    const timestamp = new Date().toISOString();
    
    if (this.pollingInterval) {
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Stopping sensor polling interval: ${this.pollingInterval}\n`);
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      
      // Close the logging service when stopping polling
      fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: Closing logging service\n`);
      sensorLoggingService.close();
      
      return {
        success: true,
        message: 'Sensor polling stopped'
      };
    }
    
    fsSync.appendFileSync('./logs/sensor_debug.log', `${timestamp}: No polling was active to stop\n`);
    return {
      success: false,
      message: 'No polling was active'
    };
  }
};

module.exports = interpreterSensorService; 