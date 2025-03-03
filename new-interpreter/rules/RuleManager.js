const RuleParser = require('./RuleParser');

/**
 * RuleManager class manages all rules and handles incoming sensor data
 */
class RuleManager {
  constructor() {
    // Store events by their type and location for efficient lookup
    this.eventsByType = {
      temperature: {}, // location -> event
      humidity: {},    // location -> event
      motion: {}       // location -> event
    };
    
    // Store all events for iteration
    this.allEvents = [];
    
    // Map for storage and retrieval of event objects by their location and condition
    this.eventCache = new Map();
  }

  /**
   * Add a rule to the system
   * @param {string} ruleStr - Rule string to add
   * @returns {Object} - The parsed rule objects
   */
  addRule(ruleStr) {
    try {
      // Parse the rule string into an event and action
      const { event, action } = RuleParser.parseRule(ruleStr);
      
      // Create a unique key for this event
      const eventKey = this.createEventKey(event);
      
      // Check if we already have this event
      let existingEvent = this.eventCache.get(eventKey);
      
      if (existingEvent) {
        // If the event already exists, just add the new action to it
        existingEvent.addAction(action);
        return { event: existingEvent, action };
      } else {
        // Otherwise, store the new event
        this.eventCache.set(eventKey, event);
        this.allEvents.push(event);
        
        // Also store it by type for efficient lookup
        this.storeEventByType(event);
        
        return { event, action };
      }
    } catch (error) {
      console.error(`Error adding rule: ${ruleStr}`, error);
      throw error;
    }
  }

  /**
   * Create a unique key for an event
   * @param {BaseEvent} event - The event to create a key for
   * @returns {string} - A unique key for this event
   */
  createEventKey(event) {
    // This function needs to be customized based on the specific event types
    if (event.constructor.name === 'TemperatureEvent') {
      return `temp_${event.location}_${event.operator}_${event.threshold}`;
    } else if (event.constructor.name === 'HumidityEvent') {
      return `humidity_${event.location}_${event.operator}_${event.threshold}`;
    } else if (event.constructor.name === 'MotionEvent') {
      return `motion_${event.location}_${event.motionRequired}`;
    }
    
    // Default case
    return `${event.constructor.name}_${event.location}`;
  }

  /**
   * Store an event by its type for efficient lookup
   * @param {BaseEvent} event - The event to store
   */
  storeEventByType(event) {
    if (event.constructor.name === 'TemperatureEvent') {
      if (!this.eventsByType.temperature[event.location]) {
        this.eventsByType.temperature[event.location] = [];
      }
      this.eventsByType.temperature[event.location].push(event);
    } else if (event.constructor.name === 'HumidityEvent') {
      if (!this.eventsByType.humidity[event.location]) {
        this.eventsByType.humidity[event.location] = [];
      }
      this.eventsByType.humidity[event.location].push(event);
    } else if (event.constructor.name === 'MotionEvent') {
      if (!this.eventsByType.motion[event.location]) {
        this.eventsByType.motion[event.location] = [];
      }
      this.eventsByType.motion[event.location].push(event);
    }
  }

  /**
   * Process incoming sensor data and trigger relevant events
   * @param {Object} sensorData - Object containing sensor readings
   */
  processSensorData(sensorData) {
    // Check which types of sensor data we received
    const hasTemperature = sensorData.temp && Object.keys(sensorData.temp).length > 0;
    const hasHumidity = sensorData.humidity && Object.keys(sensorData.humidity).length > 0;
    const hasMotion = sensorData.motion && Object.keys(sensorData.motion).length > 0;

    // Process temperature events
    if (hasTemperature) {
      this.processTemperatureData(sensorData);
    }

    // Process humidity events
    if (hasHumidity) {
      this.processHumidityData(sensorData);
    }

    // Process motion events
    if (hasMotion) {
      this.processMotionData(sensorData);
    }
  }

  /**
   * Process temperature data and trigger relevant events
   * @param {Object} sensorData - Object containing sensor readings
   */
  processTemperatureData(sensorData) {
    for (const location in sensorData.temp) {
      if (this.eventsByType.temperature[location]) {
        for (const event of this.eventsByType.temperature[location]) {
          if (event.shouldTrigger(sensorData)) {
            console.log(`Temperature event triggered for ${location}: ${event.constructor.name}`);
            event.executeActions();
          }
        }
      }
    }
  }

  /**
   * Process humidity data and trigger relevant events
   * @param {Object} sensorData - Object containing sensor readings
   */
  processHumidityData(sensorData) {
    for (const location in sensorData.humidity) {
      if (this.eventsByType.humidity[location]) {
        for (const event of this.eventsByType.humidity[location]) {
          if (event.shouldTrigger(sensorData)) {
            console.log(`Humidity event triggered for ${location}: ${event.constructor.name}`);
            event.executeActions();
          }
        }
      }
    }
  }

  /**
   * Process motion data and trigger relevant events
   * @param {Object} sensorData - Object containing sensor readings
   */
  processMotionData(sensorData) {
    for (const location in sensorData.motion) {
      if (this.eventsByType.motion[location]) {
        for (const event of this.eventsByType.motion[location]) {
          if (event.shouldTrigger(sensorData)) {
            console.log(`Motion event triggered for ${location}: ${event.constructor.name}`);
            event.executeActions();
          }
        }
      }
    }
  }

  /**
   * Get all events in the system
   * @returns {Array} - Array of all events
   */
  getAllEvents() {
    return this.allEvents;
  }

  /**
   * Get events by type and location
   * @param {string} type - Type of event (temperature, humidity, motion)
   * @param {string} location - Location for the events
   * @returns {Array} - Array of events matching the criteria
   */
  getEventsByTypeAndLocation(type, location) {
    if (this.eventsByType[type] && this.eventsByType[type][location]) {
      return this.eventsByType[type][location];
    }
    return [];
  }
}

module.exports = RuleManager; 