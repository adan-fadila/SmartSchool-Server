const { getSensiboSensors } = require('../api/sensibo');
const interpreterService = require('../interpreter/src/server-integration');

/**
 * Service to handle integration between Sensibo sensors and the interpreter
 */
const interpreterSensorService = {
  /**
   * Update events from Sensibo sensors
   * @param {string} raspPiIP - Raspberry Pi IP address to fetch sensor data from
   * @returns {Promise<Object>} Result object with success status and updated events
   */
  async updateEventsFromSensibo(raspPiIP) {
    try {
      console.log(`Fetching sensor data from Raspberry Pi at ${raspPiIP}`);
      
      // Get sensor data from Sensibo via Raspberry Pi
      const sensorData = await getSensiboSensors(raspPiIP);
      
      if (!sensorData) {
        console.error('No sensor data received from Sensibo');
        return { 
          success: false, 
          error: 'No sensor data received from Sensibo' 
        };
      }
      
      console.log('Received sensor data:', sensorData);
      
      // Format the data into events
      const events = this.formatSensorDataToEvents(sensorData);
      
      if (!events || events.length === 0) {
        console.error('Failed to format sensor data to events');
        return { 
          success: false, 
          error: 'Failed to format sensor data to events' 
        };
      }
      
      // Update each event in the interpreter
      const updatedEvents = [];
      
      for (const event of events) {
        const result = interpreterService.updateEventValue(event.name, event.value);
        
        if (result.success) {
          console.log(`Successfully updated event: ${event.name} = ${event.value}`);
          updatedEvents.push(event);
        } else {
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
      events.push({
        name: 'Living Room Temperature',
        value: sensorData.temperature
      });
    }
    
    // Check if humidity is present
    if (sensorData.humidity !== undefined) {
      events.push({
        name: 'Living Room Humidity',
        value: sensorData.humidity
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
    console.log(`Starting sensor polling with interval: ${interval}ms`);
    
    // Clear any existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Start new polling
    this.pollingInterval = setInterval(async () => {
      console.log('Polling for sensor data...');
      await this.updateEventsFromSensibo(raspPiIP);
    }, interval);
    
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
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      
      return {
        success: true,
        message: 'Sensor polling stopped'
      };
    }
    
    return {
      success: false,
      message: 'No polling was active'
    };
  }
};

module.exports = interpreterSensorService; 