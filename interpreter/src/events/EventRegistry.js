const axios = require("axios");
const TemperatureEvent = require("./TemperatureEvent");
const HumidityEvent = require("./HumidityEvent");
const AnomalyEvent = require("./AnomalyEvent");
const MotionEvent = require("./MotionEvent");
const logger = require('../../../logger')

/**
 * Registry for managing all events in the system
 */
class EventRegistry {
  constructor() {
    this.events = new Map(); // Map of event name to event instance
    this.raspiEndpoints = new Map(); // Map of Raspberry Pi IPs to their endpoints
    this.anomalyApiEndpoint =
      "http://127.0.0.1:5000/api/v1/anomaly_detection/anomalies"; // Anomaly API endpoint

    // Map of event types to their corresponding classes
    this.eventTypes = new Map([
      ["temperature", TemperatureEvent],
      ["humidity", HumidityEvent],
      ["anomaly", AnomalyEvent],
      ["motion",MotionEvent]
      // Add more event types here as they are implemented
    ]);
  }

  /**
   * Load Raspberry Pi endpoints from configuration
   * @param {Object} config - Configuration object with Raspberry Pi IP to endpoint mapping
   */
  loadRaspiEndpoints(config) {
    Object.entries(config).forEach(([ip, endpoint]) => {
      this.raspiEndpoints.set(ip, endpoint);
      console.log(`Loaded Raspberry Pi endpoint: ${ip} -> ${endpoint}`);
    });
  }

  /**
   * Initialize events by fetching them from all connected Raspberry Pis and anomaly API
   */
  async initializeEvents() {
    try {
      for (const [ip, endpoint] of this.raspiEndpoints.entries()) {
        console.log(`Fetching events from Raspberry Pi at ${ip} (${endpoint})`);
        await this.fetchEventsFromRaspberryPi(endpoint);
      }

      // Fetch anomaly events
      console.log("Fetching anomaly events from API");
      await this.fetchAnomalyEvents();

      console.log("All events initialized successfully");
    } catch (error) {
      console.error("Error initializing events:", error);
    }
  }

  /**
   * Fetch events from a specific Raspberry Pi
   * @param {string} endpoint - The endpoint URL of the Raspberry Pi
   */
  async fetchEventsFromRaspberryPi(endpoint) {
    logger.info(`Fetching events from Raspberry Pi at endpoint: ${endpoint}`);

    try {
      const response = await axios.get(`${endpoint}/api-sensors/get_events`, {
        headers: { "Content-Type": "application/json" },
      });

      logger.debug(
        `Response from Raspberry Pi: ${JSON.stringify(response.data)}`
      );

      if (response.data.success && Array.isArray(response.data.events)) {
        logger.info(
          `Successfully fetched ${response.data.events.length} events from ${endpoint}`
        );
        this.createEventInstances(response.data.events);
      } else {
        // Log detailed error if response does not contain expected data
        logger.error(
          "Failed to get events, response data does not contain valid events array",
          {
            endpoint,
            responseData: response.data,
          }
        );
      }
    } catch (error) {
      // Log the complete error with stack trace and additional context
      logger.error(`Error fetching events from ${endpoint}: ${error.message}`, {
        endpoint,
        error: error.stack,
      });
    }
  }

  /**
   * Create event instances based on fetched event names
   * @param {Array<string>} eventNames - List of event names from Raspberry Pi
   */
  createEventInstances(eventNames) {
    eventNames.forEach((eventName) => {
        logger.info(eventName);
      // Parse event name to extract location and type
      const parts = this.parseEventName(eventName);

      if (!parts) {
        console.warn(`Could not parse event name: ${eventName}`);
        return;
      }

      const { location, type } = parts;
      const lowerType = type.toLowerCase();

      // Create appropriate event instance based on type using the map
      const EventClass = this.eventTypes.get(lowerType);

      if (EventClass) {
        const event = new EventClass(eventName, location);
        this.registerEvent(event);
      } else {
        console.warn(`Unknown event type: ${type} for event ${eventName}`);
      }
    });
  }

  /**
   * Fetch anomaly events from the anomaly detection API
   */
  async fetchAnomalyEvents() {
    try {
      console.log(`Fetching anomalies from ${this.anomalyApiEndpoint}`);
      const response = await axios.get(this.anomalyApiEndpoint, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data && response.data.success && response.data.data) {
        const anomalyData = response.data.data;
        this.createAnomalyEventInstances(anomalyData);
      } else {
        console.error("Failed to get anomalies, response:", response.data);
      }
    } catch (error) {
      console.error(`Error fetching anomalies from API:`, error);
    }
  }

  /**
   * Create anomaly event instances from API data
   * @param {Object} anomalyData - Data from anomaly API
   */
  createAnomalyEventInstances(anomalyData) {
    try {
      // Loop through each metric (e.g., living_room_temperature)
      Object.entries(anomalyData).forEach(([metricKey, anomalyTypes]) => {
        // Parse location and metric type from the key
        const metricParts = metricKey.split("_");
        const metricType = metricParts.pop(); // Last part is the metric type (temperature, humidity)
        const location = metricParts.join(" "); // Rest is the location (living room)

        console.log(`Creating anomaly events for: ${location} ${metricType}`);

        // Loop through each anomaly type (pointwise, seasonality, trend)
        Object.entries(anomalyTypes).forEach(([anomalyType, anomalyInfo]) => {
          if (!anomalyInfo || !anomalyInfo.name) {
            console.error(
              `Missing required data for anomaly event: ${metricKey}, type: ${anomalyType}`
            );
            return;
          }

          const eventName = anomalyInfo.name;

          // Check if this event already exists
          const existingEvent = this.getEvent(eventName);
          if (existingEvent) {
            console.log(`Anomaly event already exists: ${eventName}`);
            return;
          }

          // Create anomaly event
          const event = new AnomalyEvent(
            eventName,
            location,
            anomalyType,
            metricType
          );

          // Set initial state (not detected by default)
          const detected = anomalyInfo.detected === true;
          event.updateAnomalyState(detected, anomalyInfo);

          // Register event
          this.registerEvent(event);

          console.log(
            `Created anomaly event: ${eventName} (initial state: ${
              detected ? "detected" : "not detected"
            })`
          );
        });
      });

      console.log(`Created anomaly events successfully.`);
    } catch (error) {
      console.error("Error creating anomaly events:", error);
    }
  }

  /**
   * Parse event name to extract location and type
   * @param {string} eventName - Raw event name from Raspberry Pi (e.g. "Living Room Temperature")
   * @returns {Object|null} Object with location and type, or null if parsing failed
   */
  parseEventName(eventName) {
    // Check if this is an anomaly event
    if (eventName.toLowerCase().includes("anomaly")) {
      // For anomaly events, we handle them separately
      return null;
    }

    // Simple parsing that assumes format like "Living Room Temperature" or "Kitchen Humidity"
    const lastSpace = eventName.lastIndexOf(" ");
    if (lastSpace === -1) return null;

    const location = eventName.substring(0, lastSpace);
    const type = eventName.substring(lastSpace + 1);

    return { location, type };
  }

  /**
   * Register an event in the registry
   * @param {Event} event - Event instance to register
   */
  registerEvent(event) {
    if (!this.events.has(event.name)) {
      this.events.set(event.name, event);
      console.log(`Registered event: ${event.name}`);
    } else {
      console.warn(`Event ${event.name} already registered`);
    }
  }

  /**
   * Get an event by name
   * @param {string} eventName - Name of the event to retrieve
   * @returns {Event|undefined} The event instance or undefined if not found
   */
  getEvent(eventName) {
    // If the name might be an anomaly event in simplified form, try to find the full name
    if (
      eventName.toLowerCase().includes("pointwise") ||
      eventName.toLowerCase().includes("trend") ||
      eventName.toLowerCase().includes("seasonality")
    ) {
      const fullEventName = this.findAnomalyEventByPartialName(eventName);
      if (fullEventName) {
        console.log(
          `Converted partial anomaly event name "${eventName}" to "${fullEventName}"`
        );
        eventName = fullEventName;
      }
    }

    // Try exact match first
    if (this.events.has(eventName)) {
      return this.events.get(eventName);
    }

    // Try case-insensitive match if exact match fails
    const lowerCaseEventName = eventName.toLowerCase();
    for (const [key, event] of this.events.entries()) {
      if (key.toLowerCase() === lowerCaseEventName) {
        console.log(
          `Case-insensitive match found for event: ${eventName} -> ${key}`
        );
        return event;
      }
    }

    // If still not found, log available events to help debugging
    console.log(`Event "${eventName}" not found. Available events:`);
    this.events.forEach((event, key) => {
      console.log(`- ${key} (${event.type})`);
    });

    return undefined;
  }

  /**
   * Find an anomaly event by partial name
   * @param {string} partialName - Partial name of the anomaly event
   * @returns {string|null} Full event name if found, null otherwise
   */
  findAnomalyEventByPartialName(partialName) {
    const partialNameLower = partialName.toLowerCase();

    // Extract location, metric type, and anomaly type from partial name
    let location = "";
    let metricType = "";
    let anomalyType = "";

    // Check for metric type
    if (partialNameLower.includes("temperature")) {
      metricType = "temperature";
    } else if (partialNameLower.includes("humidity")) {
      metricType = "humidity";
    }

    // Check for anomaly type
    if (partialNameLower.includes("pointwise")) {
      anomalyType = "pointwise";
    } else if (partialNameLower.includes("trend")) {
      anomalyType = "trend";
    } else if (partialNameLower.includes("seasonality")) {
      anomalyType = "seasonality";
    }

    // Extract location by removing identified parts
    const parts = partialNameLower.split(" ");
    const locationParts = parts.filter(
      (part) =>
        part !== metricType && part !== anomalyType && part !== "anomaly"
    );
    location = locationParts.join(" ");

    console.log(
      `Extracted from "${partialName}": location="${location}", metricType="${metricType}", anomalyType="${anomalyType}"`
    );

    // Look for a matching event
    for (const [key, event] of this.events.entries()) {
      if (event.type === "anomaly") {
        const keyLower = key.toLowerCase();

        // Check if this event matches our extracted parts
        const matchesLocation = location === "" || keyLower.includes(location);
        const matchesMetricType =
          metricType === "" || keyLower.includes(metricType);
        const matchesAnomalyType =
          anomalyType === "" || keyLower.includes(anomalyType);

        if (matchesLocation && matchesMetricType && matchesAnomalyType) {
          console.log(
            `Found matching anomaly event: "${key}" for partial name "${partialName}"`
          );
          return key;
        }
      }
    }

    return null;
  }

  /**
   * Get all registered events
   * @returns {Array<Event>} Array of all event instances
   */
  getAllEvents() {
    return Array.from(this.events.values());
  }

  /**
   * Update anomaly states from the anomaly detection API
   * This should be called periodically to get the latest anomaly states
   */
  async updateAnomalyStates() {
    try {
      console.log("Updating anomaly states from API...");
      const response = await axios.get(this.anomalyApiEndpoint, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data && response.data.success && response.data.data) {
        // Use the same data structure as during initialization
        const anomalyData = response.data.data;
        let updatedCount = 0;
        let detectedCount = 0;

        // For each anomaly in the response
        Object.entries(anomalyData).forEach(([metricKey, anomalyTypes]) => {
          // Parse location and metric type from the key
          const metricParts = metricKey.split("_");
          const metricType = metricParts.pop(); // Last part is the metric type
          const location = metricParts.join(" "); // Rest is the location

          // Loop through each anomaly type
          Object.entries(anomalyTypes).forEach(([anomalyType, anomalyInfo]) => {
            if (!anomalyInfo || !anomalyInfo.name) {
              console.error(
                `Missing required data for anomaly state update: ${metricKey}, type: ${anomalyType}`
              );
              return;
            }

            const eventName = anomalyInfo.name;
            const event = this.getEvent(eventName);

            if (event && event.type === "anomaly") {
              // Get the detection status if available, default to false
              const detected = anomalyInfo.detected === true;

              // Check if state changed
              const previousState = event.isDetected
                ? event.isDetected()
                : false;
              const stateChanged = previousState !== detected;

              // Update the event state
              event.updateAnomalyState(detected, anomalyInfo);
              updatedCount++;

              if (detected) {
                detectedCount++;
              }

              if (stateChanged) {
                console.log(
                  `Anomaly state CHANGED for ${eventName}: ${previousState} -> ${detected}`
                );
              }
            } else {
              // Event not found - create it
              console.log(
                `Anomaly event not found, creating new one: ${eventName}`
              );

              // Create and register the new anomaly event
              const newEvent = new AnomalyEvent(
                eventName,
                location,
                anomalyType,
                metricType
              );

              // Set initial state
              const detected = anomalyInfo.detected === true;
              newEvent.updateAnomalyState(detected, anomalyInfo);

              // Register event
              this.registerEvent(newEvent);

              if (detected) {
                detectedCount++;
              }

              updatedCount++;
            }
          });
        });

        console.log(
          `Anomaly states updated: ${updatedCount} events, ${detectedCount} currently detected`
        );
      } else {
        console.error("Failed to get anomaly states, response:", response.data);
      }
    } catch (error) {
      console.error("Error updating anomaly states:", error);
    }
  }
}

module.exports = new EventRegistry(); // Export a singleton instance
