const { initialize } = require("./index");
const EventRegistry = require("./events/EventRegistry");
const RuleManager = require("./rules/RuleManager");
const fs = require("fs").promises;
const path = require("path");
const Rule = require("../../models/Rule"); // Import the MongoDB Rule model
const ActionRegistry = require("./actions/ActionRegistry");
const sensorLoggingService = require("../../services/sensor-logging.service");

let interpreterInitialized = false;
let sensorPollingInterval = null;
let anomalyPollingInterval = null;

/**
 * Initialize the interpreter when the server starts
 * @returns {Promise<boolean>} True if initialization successful, false otherwise
 */
async function initializeInterpreter() {
  try {
    if (interpreterInitialized) {
      console.log("Interpreter already initialized");
      return true;
    }

    console.log("Initializing interpreter on server start...");
    await initialize();

    // After the interpreter initializes, initialize the action registry
    console.log("Initializing actions registry...");
    await ActionRegistry.initializeActions();

    // Create default SMS actions
    console.log("Creating default SMS actions...");
    await createDefaultSmsActions();

    // Then load existing rules from MongoDB
    await loadRulesFromDatabase();

    // Initialize sensor logging service
    await initializeSensorLogging();

    interpreterInitialized = true;
    console.log("Interpreter initialized successfully");

    // Try to start sensor polling automatically
    await startSensorPolling();

    // Start anomaly polling
    await startAnomalyPolling();

    return true;
  } catch (error) {
    console.error("Failed to initialize interpreter:", error);
    return false;
  }
}

async function initializeSensorLogging() {
  try {
    console.log("Initializing sensor logging service with sensor data...");

    // Import the configurations from handlersController
    const { configurations } =
      require("../../controllers/handlersController").handleControllers;

    if (!configurations || configurations.length === 0) {
      console.error("No room configurations found in handlersController");
      return { success: false, error: "No room configurations found" };
    }

    // Define the sensor types we want to log
    const sensorTypes = ["temperature", "humidity", "motion"];

    // Create column names based on room names and sensor types
    const sensorColumns = [];

    // Create simple column names for each room and sensor type
    configurations.forEach((config) => {
      const roomName = config.roomName.toLowerCase();

      sensorTypes.forEach((sensorType) => {
        // Ensure motion sensor has the correct column name
        if (sensorType === "motion") {
          sensorColumns.push(`${roomName} ${sensorType}`); // Correct column name for motion
        } else {
          sensorColumns.push(`${roomName} ${sensorType}`);
        }
      });
    });

    console.log(
      `Initializing logging for ${sensorColumns.length} sensor columns:`,
      sensorColumns
    );

    // Initialize the logging service with these column names
    const result = await sensorLoggingService.initialize(sensorColumns);

    if (result.success) {
      console.log("Sensor logging service initialized successfully");
      return {
        success: true,
        message: result.message,
        columns: sensorColumns,
      };
    } else {
      console.error(
        "Failed to initialize sensor logging service:",
        result.error
      );
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    console.error("Error initializing sensor logging service:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a single default SMS action for the entire system
 * This allows rules to use SMS notifications without having a physical device
 */
function createDefaultSmsActions() {
  try {
    console.log("Creating default SMS action...");

    // Get SMS action constructor
    const SMSAction = require("./actions/SMSAction");

    // Check if generic notification action already exists
    const actionName = "Notification Service";
    if (ActionRegistry.getAction(actionName)) {
      console.log(`SMS action '${actionName}' already exists, skipping`);
      return {
        success: true,
        created: 0,
        skipped: 1,
        message: "SMS action already exists",
      };
    }

    // Create a single SMS action for the entire system
    const smsAction = new SMSAction(actionName, "System");

    // Register the action with the ActionRegistry
    ActionRegistry.registerAction(smsAction);

    console.log(`Created single SMS action: ${actionName}`);
    return {
      success: true,
      created: 1,
      message: "SMS action created successfully",
    };
  } catch (error) {
    console.error("Error creating default SMS action:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load existing rules from MongoDB and add them to the interpreter
 */
async function loadRulesFromDatabase() {
  try {
    console.log("Loading all rules from database...");

    // Fetch all rules from the database (both active and inactive)
    const dbRules = await Rule.find({});
    console.log(`Found ${dbRules.length} total rules in database`);

    // Rules that were successfully loaded
    const loadedRules = [];
    // Rules that could not be parsed
    const failedRules = [];

    // Process each rule
    for (const dbRule of dbRules) {
      try {
        // Try to use description first, then condition if description is empty
        const ruleString = dbRule.description || dbRule.condition;

        if (!ruleString) {
          console.log(`Skipping rule ID ${dbRule.id}: No rule text found`);
          failedRules.push({ id: dbRule.id, reason: "No rule text found" });
          continue;
        }

        console.log(
          `Processing rule: ${ruleString}, isActive: ${dbRule.isActive}`
        );

        // Try to parse the rule to check if it matches our format
        if (isValidRuleFormat(ruleString)) {
          // Create rule in our interpreter (rules are active by default when created)
          const ruleId = RuleManager.createRule(ruleString);

          // If the rule should be inactive, deactivate it
          if (!dbRule.isActive) {
            console.log(
              `Deactivating rule ${ruleId} as it is inactive in the database`
            );
            RuleManager.deactivateRule(ruleId);
          }

          // Update the database record with the interpreter rule ID
          await Rule.updateOne(
            { _id: dbRule._id },
            {
              $set: {
                interpreterId: ruleId,
                ruleString: ruleString,
              },
            }
          );

          console.log(
            `Loaded rule from database: ${ruleString} (ID: ${ruleId}, active: ${dbRule.isActive})`
          );
          loadedRules.push({
            id: dbRule.id,
            ruleId,
            ruleString,
            isActive: dbRule.isActive,
          });
        } else {
          console.log(
            `Rule rejected - does not match required format: ${ruleString}`
          );
          failedRules.push({
            id: dbRule.id,
            reason: "Invalid format",
            ruleString,
          });
        }
      } catch (error) {
        console.error(`Error processing rule ${dbRule.id}:`, error);
        failedRules.push({
          id: dbRule.id,
          reason: error.message,
          ruleString: dbRule.description || dbRule.condition,
        });
      }
    }

    console.log(
      `Successfully loaded ${loadedRules.length} rules into interpreter`
    );
    if (failedRules.length > 0) {
      console.log(`Failed to load ${failedRules.length} rules:`);
      failedRules.forEach((fail) => {
        console.log(
          `- Rule ${fail.id}: ${fail.reason} (${fail.ruleString || "no text"})`
        );
      });
    }

    return { loadedRules, failedRules };
  } catch (error) {
    console.error("Error loading rules from database:", error);
    throw error;
  }
}

/**
 * Check if a rule string matches our required format: [event][condition] then [action]
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule matches our format, false otherwise
 */
function isValidRuleFormat(ruleString) {
  if (!ruleString) return false;

  // Normalize rule string to lowercase for consistent matching
  const normalizedRule = ruleString.toLowerCase();

  // Basic check for "if" and "then" keywords - case insensitive
  const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
  const ifThenMatch = normalizedRule.match(ifThenPattern);

  if (!ifThenMatch) return false;

  // Get the condition part
  const conditionPart = ifThenMatch[1].trim();

  // Check if this is an anomaly rule with standard "detected" pattern
  if (
    conditionPart.includes("anomaly detected") ||
    conditionPart.includes("anomaly not detected")
  ) {
    return true;
  }

  // Check if this is a rule with custom description using "detected" pattern
  if (conditionPart.endsWith("detected")) {
    return true;
  }

  // Check that condition part has an operator for standard rules
  const operatorPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
  const operatorMatch = conditionPart.match(operatorPattern);

  return !!operatorMatch;
}

/**
 * Start polling sensors to update events
 * @param {number} interval - Polling interval in milliseconds (default: 30000)
 * @returns {boolean} True if polling started successfully, false otherwise
 */
async function startSensorPolling(interval = 100000) {
  try {
    if (!interpreterInitialized) {
      console.warn("Cannot start sensor polling: Interpreter not initialized");
      return false;
    }

    // Stop any existing polling
    stopSensorPolling();

    // Load Raspberry Pi configuration
    const configPath = path.join(__dirname, "../../api/endpoint/rasp_pi.json");
    const configData = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(configData);

    const raspPiIPs = Object.keys(config);
    if (raspPiIPs.length === 0) {
      console.warn("No Raspberry Pi IPs found in configuration");
      return false;
    }

    // For simplicity, use the first Raspberry Pi IP
    const raspPiIP = raspPiIPs[0];

    console.log(
      `Starting sensor polling for Raspberry Pi at ${raspPiIP} with interval ${interval}ms`
    );

    // Import the service here to avoid circular dependencies
    const interpreterSensorService = require("../../services/interpreter-sensor.service");

    interpreterSensorService.startSensorPolling(raspPiIP, interval);
    return true;
  } catch (error) {
    console.error("Error starting sensor polling:", error);
    return false;
  }
}

/**
 * Stop sensor polling
 * @returns {boolean} True if polling was stopped, false otherwise
 */
function stopSensorPolling() {
  // Import the service here to avoid circular dependencies
  const interpreterSensorService = require("../../services/interpreter-sensor.service");

  const result = interpreterSensorService.stopSensorPolling();
  return result.success;
}

/**
 * Create a new rule
 * @param {string} ruleString - The rule string in natural language format
 * @returns {Object} Object with rule ID and success status
 */
function createRule(ruleString) {
  try {
    if (!interpreterInitialized) {
      return { success: false, error: "Interpreter not initialized" };
    }

    const ruleId = RuleManager.createRule(ruleString);
    return { success: true, ruleId };
  } catch (error) {
    console.error("Error creating rule:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all available events
 * @returns {Array} Array of event objects
 */
function getAvailableEvents() {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const events = EventRegistry.getAllEvents();
  const eventInfoList = events.map((event) => ({
    name: event.name,
    type: event.type,
    location: event.location,
    currentValue: event.currentValue,
  }));

  return { success: true, events: eventInfoList };
}

/**
 * Get all rules
 * @returns {Array} Array of rule objects
 */
function getAllRules() {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const rules = RuleManager.getAllRules();
  const ruleInfoList = rules.map((rule) => ({
    id: rule.id,
    ruleString: rule.ruleString,
    active: rule.active,
    eventName: rule.eventName,
    condition: rule.condition,
    actionString: rule.actionString,
  }));

  return { success: true, rules: ruleInfoList };
}

/**
 * Delete a rule
 * @param {string} ruleId - The ID of the rule to delete
 * @returns {Object} Object with success status
 */
function deleteRule(ruleId) {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const success = RuleManager.deleteRule(ruleId);
  return { success };
}

/**
 * Activate or deactivate a rule
 * @param {string} ruleId - The ID of the rule
 * @param {boolean} active - True to activate, false to deactivate
 * @returns {Object} Object with success status
 */
function setRuleActive(ruleId, active) {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const success = active
    ? RuleManager.activateRule(ruleId)
    : RuleManager.deactivateRule(ruleId);

  return { success };
}

/**
 * Update an event value (for testing or manual triggering)
 * @param {string} eventName - The name of the event to update
 * @param {any} value - The new value for the event
 * @returns {Object} Object with success status
 */
function updateEventValue(eventName, value) {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const event = EventRegistry.getEvent(eventName);
  if (!event) {
    return { success: false, error: `Event ${eventName} not found` };
  }

  if (event.type === "temperature") {
    event.updateTemperature(value);
  } else if (event.type === "humidity") {
    event.updateHumidity(value);
  } else if (event.type === "motion") {
    event.updateMotion(value);
  } else {
    event.update(value);
  }

  return {
    success: true,
    eventName,
    type: event.type,
    newValue: value,
  };
}

/**
 * Test an action string without creating a rule
 * @param {string} actionString - The action string to test
 * @returns {Promise<Object>} Result of the action execution
 */
async function testAction(actionString) {
  try {
    if (!interpreterInitialized) {
      return { success: false, error: "Interpreter not initialized" };
    }

    console.log(`Testing action: ${actionString}`);

    const result = await ActionRegistry.testExecuteAction(actionString);
    return { success: true, result };
  } catch (error) {
    console.error("Error testing action:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all available actions
 * @returns {Array} Array of action objects
 */
function getAvailableActions() {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const actions = ActionRegistry.getAllActions();
  const actionInfoList = actions.map((action) => ({
    name: action.name,
    type: action.type,
    location: action.location,
  }));

  return { success: true, actions: actionInfoList };
}

/**
 * Get the current states of all devices
 * @returns {Object} Object with device states
 */
function getDeviceStates() {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const deviceStates = {};

  // Convert Map to an object for API response
  ActionRegistry.deviceStates.forEach((state, key) => {
    deviceStates[key] = state;
  });

  return {
    success: true,
    deviceStates,
    count: ActionRegistry.deviceStates.size,
  };
}

/**
 * Check if the interpreter is initialized
 * @returns {boolean} True if initialized, false otherwise
 */
function isInterpreterInitialized() {
  return interpreterInitialized;
}

/**
 * Stop the interpreter
 * @returns {boolean} True if stopped, false otherwise
 */
function stopInterpreter() {
  if (!interpreterInitialized) {
    return false;
  }

  // Stop sensor polling
  stopSensorPolling();

  // Reset state
  interpreterInitialized = false;
  console.log("Interpreter stopped");

  return true;
}

/**
 * Start polling for anomaly updates
 * @param {number} interval - Polling interval in milliseconds (default: 60000 - 1 minute)
 * @returns {boolean} True if polling started successfully, false otherwise
 */
async function startAnomalyPolling(interval = 60000) {
  try {
    if (!interpreterInitialized) {
      console.warn("Cannot start anomaly polling: Interpreter not initialized");
      return false;
    }

    // Stop any existing polling
    stopAnomalyPolling();

    console.log(`Starting anomaly polling with interval ${interval}ms`);

    // Start polling
    anomalyPollingInterval = setInterval(async () => {
      try {
        await EventRegistry.updateAnomalyStates();
      } catch (error) {
        console.error("Error in anomaly polling:", error);
      }
    }, interval);

    // Run immediately for first update
    await EventRegistry.updateAnomalyStates();

    return true;
  } catch (error) {
    console.error("Error starting anomaly polling:", error);
    return false;
  }
}

/**
 * Stop anomaly polling
 * @returns {boolean} True if polling was stopped, false otherwise
 */
function stopAnomalyPolling() {
  if (anomalyPollingInterval) {
    clearInterval(anomalyPollingInterval);
    anomalyPollingInterval = null;
    console.log("Anomaly polling stopped");
    return true;
  }
  return false;
}

/**
 * Manually trigger an anomaly event (for testing)
 * @param {string} eventName - The name of the anomaly event to trigger
 * @param {boolean} detected - Whether the anomaly is detected or not
 * @param {Object} additionalData - Additional data to include in the anomaly state
 * @returns {Object} Object with success status
 */
function triggerAnomalyEvent(eventName, detected = true, additionalData = {}) {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const event = EventRegistry.getEvent(eventName);
  if (!event) {
    return {
      success: false,
      error: `Event ${eventName} not found`,
      availableEvents: EventRegistry.getAllEvents()
        .filter((e) => e.type === "anomaly")
        .map((e) => e.name),
    };
  }

  if (event.type !== "anomaly") {
    return {
      success: false,
      error: `Event ${eventName} is not an anomaly event (type: ${event.type})`,
    };
  }

  // Update the anomaly state
  event.updateAnomalyState(detected, {
    ...additionalData,
    manuallyTriggered: true,
    timestamp: Date.now(),
  });

  return {
    success: true,
    message: `Anomaly event ${eventName} ${detected ? "detected" : "cleared"}`,
    eventName,
    detected,
  };
}

/**
 * Get all available anomaly events
 * @returns {Object} Object with success status and list of anomaly events
 */
function getAnomalyEvents() {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  const events = EventRegistry.getAllEvents().filter(
    (event) => event.type === "anomaly"
  );
  const eventInfoList = events.map((event) => ({
    name: event.name,
    type: event.type,
    anomalyType: event.anomalyType,
    metricType: event.metricType,
    location: event.location,
    isDetected: event.isDetected ? event.isDetected() : false,
    currentValue: event.currentValue,
  }));

  return {
    success: true,
    events: eventInfoList,
    count: eventInfoList.length,
    ruleExamples: eventInfoList.map(
      (e) =>
        `if ${e.name} detected then Living Room AC on` +
        `\nif ${e.name} not detected then Living Room Light off`
    ),
  };
}

/**
 * Helper to create an anomaly rule with proper formatting
 * @param {string} location - Location (e.g., "Living Room")
 * @param {string} metricType - Metric type (e.g., "temperature", "humidity")
 * @param {string} anomalyType - Anomaly type (e.g., "pointwise", "collective")
 * @param {boolean} detected - Whether to check for detected (true) or not detected (false)
 * @param {string} actionString - The action to take when the rule triggers
 * @returns {Object} Object with success status and rule ID
 */
function createAnomalyRule(
  location,
  metricType,
  anomalyType,
  detected,
  actionString
) {
  if (!interpreterInitialized) {
    return { success: false, error: "Interpreter not initialized" };
  }

  try {
    // Find all matching anomaly events
    const events = EventRegistry.getAllEvents().filter(
      (event) =>
        event.type === "anomaly" &&
        event.location.toLowerCase() === location.toLowerCase() &&
        event.metricType.toLowerCase() === metricType.toLowerCase() &&
        event.anomalyType.toLowerCase() === anomalyType.toLowerCase()
    );

    if (events.length === 0) {
      return {
        success: false,
        error: `No matching anomaly event found for location=${location}, metricType=${metricType}, anomalyType=${anomalyType}`,
        availableEvents: getAnomalyEvents(),
      };
    }

    // Use the first matching event
    const event = events[0];
    const detectedStr = detected ? "detected" : "not detected";
    const ruleString = `if ${event.name} ${detectedStr} then ${actionString}`;

    console.log(`Creating anomaly rule: ${ruleString}`);
    const ruleId = RuleManager.createRule(ruleString);

    return { success: true, ruleId, ruleString };
  } catch (error) {
    console.error("Error creating anomaly rule:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a rule exists by ID
 * @param {string} ruleId - The ID of the rule to check
 * @returns {Object} Object with success status and rule if found
 */
function getRuleById(ruleId) {
  try {
    if (!interpreterInitialized) {
      return { success: false, error: "Interpreter not initialized" };
    }

    const rule = RuleManager.getRule(ruleId);
    if (rule) {
      return { success: true, rule };
    } else {
      return { success: false, error: `Rule ${ruleId} not found` };
    }
  } catch (error) {
    console.error("Error checking rule:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a notification rule with explicit phone number
 * @param {string} ruleString - The rule string in natural language format
 * @param {string} phoneNumber - The phone number to send the notification to (optional if already in ruleString)
 * @param {string} message - The message to send in the notification (optional, will use rule condition if not provided)
 * @param {string} spaceId - The space ID for the rule
 * @returns {Object} Object with rule ID and success status
 */
async function createNotificationRule(
  ruleString,
  phoneNumber = null,
  message = null,
  spaceId
) {
  try {
    if (!interpreterInitialized) {
      return { success: false, error: "Interpreter not initialized" };
    }

    let finalRuleString = ruleString;
    let finalPhoneNumber = phoneNumber;

    // If phone number is not provided but is in the rule string, extract it
    if (!finalPhoneNumber) {
      // Check if rule already has a phone number
      const phoneMatch = ruleString.match(/send\s+sms\s+to\s+(\+\d+)/i);
      if (phoneMatch) {
        finalPhoneNumber = phoneMatch[1];
        console.log(
          `Extracted phone number from rule string: ${finalPhoneNumber}`
        );
      }
    }

    // Format the phone number if provided
    if (finalPhoneNumber && !finalPhoneNumber.startsWith("+")) {
      console.warn(
        `Phone number ${finalPhoneNumber} does not start with '+', adding it`
      );
      finalPhoneNumber = "+" + finalPhoneNumber;
    }

    // Check if the rule already has the "then" part
    if (!finalRuleString.toLowerCase().includes(" then ")) {
      return {
        success: false,
        error: 'Invalid rule format - missing "then" part',
      };
    }

    // Check if the rule already has "send sms to" format
    const hasSendSmsFormat = /then\s+send\s+sms\s+to\s+\+\d+/.test(
      finalRuleString
    );

    // If not, and we have a phone number, append it with the send sms to format
    if (!hasSendSmsFormat && finalPhoneNumber) {
      // Split the rule at "then"
      const thenIndex = finalRuleString.toLowerCase().indexOf(" then ");
      const rulePart = finalRuleString.substring(0, thenIndex + 6); // Include " then "

      // Append the "send sms to" + phone number to create the final rule string
      finalRuleString = `${rulePart}send sms to ${finalPhoneNumber}`;
      console.log(`Updated rule string: ${finalRuleString}`);
    }

    // Create the rule in the interpreter
    const { success, ruleId } = createRule(finalRuleString);

    if (!success || !ruleId) {
      return {
        success: false,
        error: `Failed to create rule: ${finalRuleString}`,
      };
    }

    // Extract the condition part to use as default message
    let finalMessage = message;
    if (!finalMessage) {
      const conditionMatch = finalRuleString.match(/if\s+(.+?)\s+then/i);
      if (conditionMatch) {
        finalMessage = conditionMatch[1].trim();
        console.log(`Generated message from rule condition: ${finalMessage}`);
      }
    }

    // Create or update the rule in the database with notification fields
    try {
      // Check if the rule already exists in the database
      const Rule = require("../../models/Rule");

      await Rule.updateOne(
        { id: ruleId },
        {
          $set: {
            id: ruleId,
            space_id: spaceId,
            description: finalRuleString,
            ruleString: finalRuleString,
            interpreterId: ruleId,
            notificationPhoneNumber: finalPhoneNumber,
            notificationMessage: finalMessage,
            isNotificationRule: true,
          },
        },
        { upsert: true }
      );

      console.log(
        `Created notification rule in database: ${finalRuleString} (ID: ${ruleId})`
      );
      console.log(
        `Notification details: SMS to ${
          finalPhoneNumber || "default numbers"
        } with message: "${finalMessage || "derived from condition"}"`
      );

      return {
        success: true,
        ruleId,
        phoneNumber: finalPhoneNumber,
        message: finalMessage,
        ruleString: finalRuleString,
      };
    } catch (dbError) {
      console.error("Error saving notification rule to database:", dbError);

      // We still created the rule in the interpreter,
      // so we consider it a partial success
      return {
        success: true,
        ruleId,
        databaseError: dbError.message,
        warning: "Rule created in interpreter but database update failed",
      };
    }
  } catch (error) {
    console.error("Error creating notification rule:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeInterpreter,
  isInterpreterInitialized,
  stopInterpreter,
  startSensorPolling,
  stopSensorPolling,
  getEvents: getAvailableEvents,
  getActions: getAvailableActions,
  getRules: getAllRules,
  getAnomalyEvents,
  createRule,
  createAnomalyRule,
  createNotificationRule,
  deleteRule,
  setRuleActive,
  testExecuteAction: testAction,
  updateEventValue,
  getDeviceStates,
  startAnomalyPolling,
  stopAnomalyPolling,
  triggerAnomalyEvent,
  getRuleById,
};
