const EventRegistry = require("../events/EventRegistry");
const ActionRegistry = require("../actions/ActionRegistry");
const logger = require("../../../logger");

/**
 * Class representing a rule in the system
 */
class Rule {
  /**
   * Create a new rule
   * @param {string} ruleString - The rule string in natural language format
   * @param {string} id - The unique ID for this rule
   */
  constructor(ruleString, id) {
    this.id = id;
    this.ruleString = ruleString;
    this.active = true; // Rules are active by default
    this.observingActions = []; // Actions that are observing this rule

    // New properties for multi-condition support
    this.isMultiCondition = false;
    this.logicType = "AND"; // "AND" or "OR" - default to AND for backward compatibility
    this.conditions = []; // Array of condition objects for multi-condition rules
    this.eventNames = []; // Array of event names for multi-condition rules
    this.eventStates = new Map(); // Track current state of each event

    // Parse the rule string
    const parsedRule = this.parseRule(ruleString);

    if (!parsedRule) {
      logger.error(`Failed to parse rule: ${ruleString}`);
      throw new Error(`Invalid rule format: ${ruleString}`);
    }

    // Handle async event name resolution for custom anomaly descriptions
    if (parsedRule.eventNamePromise) {
      logger.info(
        `Rule contains a custom anomaly description, resolving event name asynchronously`
      );

      // Define an async initialization function
      const initAsync = async () => {
        try {
          // Wait for the event name promise to resolve
          this.eventName = await parsedRule.eventNamePromise;
          logger.info(
            `Resolved event name from custom description: ${this.eventName}`
          );

          this.condition = parsedRule.condition;
          this.actionString = parsedRule.actionString;
          this.parsedActionParams = null;

          // Check if this is an anomaly event rule
          this.isAnomalyRule = this.checkIfAnomalyRule();

          // Register this rule with the appropriate event
          const event = EventRegistry.getEvent(this.eventName);
          if (!event) {
            logger.error(
              `Event "${this.eventName}" not found in EventRegistry`
            );
            throw new Error(`Event not found: ${this.eventName}`);
          }

          // Add this rule as an observer to the event
          event.addObserver(this);
          logger.info(`Rule added as observer to event ${this.eventName}`);

          return true;
        } catch (error) {
          logger.error(
            `Failed to initialize rule with custom anomaly description: ${error.message}`
          );
          throw error;
        }
      };

      // Start the async initialization and store the promise
      this.initPromise = initAsync();

      // We can't proceed with normal initialization here
      // The rule will be fully initialized once the initPromise resolves
      return;
    }

    // Check if this is a multi-condition rule
    if (parsedRule.isMultiCondition) {
      this.isMultiCondition = true;
      this.logicType = parsedRule.logicType; // "AND" or "OR"
      this.conditions = parsedRule.conditions;
      this.eventNames = parsedRule.eventNames;
      this.actionString = parsedRule.actionString;
      this.parsedActionParams = null;

      logger.info(`Multi-condition rule detected with ${this.conditions.length} conditions using ${this.logicType} logic`);

      // Validate that all event names are defined
      for (let i = 0; i < this.eventNames.length; i++) {
        if (!this.eventNames[i]) {
          logger.error(`Event name at index ${i} is undefined or null`);
          throw new Error(`Failed to parse condition ${i + 1} in multi-condition rule`);
        }
      }

      // Register this rule with all events
      for (let i = 0; i < this.eventNames.length; i++) {
        const eventName = this.eventNames[i];
        
        // Handle motion events specially
        let event;
        if (eventName.toLowerCase().includes("motion")) {
          event = this.findMotionEvent(eventName);
          if (event) {
            // Update the event name to match what was found
            this.eventNames[i] = event.name;
            logger.info(`Updated multi-condition rule event name to: ${event.name}`);
          }
        } else {
          event = EventRegistry.getEvent(eventName);
        }

        if (!event) {
          logger.error(`Event "${eventName}" not found in EventRegistry`);
          throw new Error(`Event not found: ${eventName}`);
        }

        // Add this rule as an observer to the event
        event.addObserver(this);
        logger.info(`Multi-condition rule added as observer to event ${event.name}`);
        
        // Initialize event state tracking
        this.eventStates.set(event.name, null);
      }

      return;
    }

    // Standard synchronous initialization for single-condition rules
    this.eventName = parsedRule.eventName;
    this.condition = parsedRule.condition;
    this.actionString = parsedRule.actionString;
    this.parsedActionParams = null; // Will store pre-parsed action parameters

    // Check if this is an anomaly event rule
    this.isAnomalyRule = this.checkIfAnomalyRule();

    // Special handling for motion sensor events
    if (this.eventName.toLowerCase().includes("motion")) {
      // Try different naming conventions for motion events
      let event = this.findMotionEvent(this.eventName);

      if (event) {
        // Add this rule as an observer to the event
        event.addObserver(this);
        logger.info(`Rule added as observer to motion event ${event.name}`);

        // Update the event name to match what was found in the registry
        this.eventName = event.name;
        logger.info(`Updated rule event name to: ${this.eventName}`);
        return;
      }
    }

    // Register this rule with the appropriate event
    const event = EventRegistry.getEvent(this.eventName);

    if (!event) {
      logger.error(`Event "${this.eventName}" not found in EventRegistry`);
      throw new Error(`Event not found: ${this.eventName}`);
    }

    // Add this rule as an observer to the event
    event.addObserver(this);
    logger.info(`Rule added as observer to event ${this.eventName}`);
  }

  /**
   * Find a motion sensor event that matches the given name
   * @param {string} motionEventName - Name of the motion event to find
   * @returns {Event|null} - The found event or null
   */
  findMotionEvent(motionEventName) {
    logger.info(`Searching for motion event matching: ${motionEventName}`);

    // Try to directly get the event first
    let event = EventRegistry.getEvent(motionEventName);
    if (event) {
      logger.info(`Found exact match for motion event: ${motionEventName}`);
      return event;
    }

    // Extract location from motion event name
    const motionLower = motionEventName.toLowerCase();
    let location = "";

    if (motionLower.includes("motion")) {
      // Extract location part (e.g., "Living Room" from "Living Room Motion")
      location = motionEventName.replace(/\s+motion(\s+sensor)?/i, "").trim();
      logger.info(`Extracted location from motion event: "${location}"`);
    }

    // Try different naming conventions for motion sensors
    const possibleNames = [
      `${location} Motion`,
      `${location} Motion Sensor`,
      `${location} motion-sensor`,
      `${location} motion`,
    ];

    logger.info(
      `Trying possible motion event names: ${possibleNames.join(", ")}`
    );

    // Iterate through all events in registry
    const allEvents = EventRegistry.getAllEvents();

    for (const registeredEvent of allEvents) {
      const registeredNameLower = registeredEvent.name.toLowerCase();

      // Check if this is a motion event
      if (registeredNameLower.includes("motion")) {
        logger.info(`Found motion event in registry: ${registeredEvent.name}`);

        // Check if location matches
        const registeredLocation = registeredEvent.name
          .replace(/\s+motion(\s+sensor)?/i, "")
          .trim();

        if (registeredLocation.toLowerCase() === location.toLowerCase()) {
          logger.info(
            `Location match found for motion event: ${registeredEvent.name}`
          );
          return registeredEvent;
        }
      }

      // Also check if any of our possible names match directly
      for (const possibleName of possibleNames) {
        if (registeredEvent.name.toLowerCase() === possibleName.toLowerCase()) {
          logger.info(
            `Found matching motion event by name: ${registeredEvent.name}`
          );
          return registeredEvent;
        }
      }
    }

    // If we get here, create a new standard name and try again
    const standardMotionName = `${location} Motion`;
    logger.info(`Trying standard motion name: ${standardMotionName}`);
    return EventRegistry.getEvent(standardMotionName);
  }

  /**
   * Check if this rule is related to an anomaly event
   * @returns {boolean} True if this is an anomaly rule
   */
  checkIfAnomalyRule() {
    // Check the event name or condition
    const event = EventRegistry.getEvent(this.eventName);
    if (event && event.type === "anomaly") {
      return true;
    }

    // Check if the rule string mentions anomaly
    const anomalyKeywords = ["anomaly", "anomalies", "pointwise", "collective"];
    const ruleStringLower = this.ruleString.toLowerCase();
    return anomalyKeywords.some((keyword) => ruleStringLower.includes(keyword));
  }

  /**
   * Parse rule string into components
   * @param {string} ruleString - The rule string to parse
   * @returns {Object|null} Object with eventName, condition, and actionString, or null if parsing failed
   */
  parseRule(ruleString) {
    // Example rule: "if living room temperature > 25 then living room light on"
    // Multi-condition AND example: "if living room temperature > 25 AND living room motion detected then living room light on"
    // Multi-condition OR example: "if living room temperature > 25 OR living room motion detected then living room light on"
    
    const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
    const ifThenMatch = ruleString.match(ifThenPattern);

    if (!ifThenMatch) {
      logger.error(`Rule does not match if-then pattern: ${ruleString}`);
      return null;
    }

    const conditionPart = ifThenMatch[1].trim();
    const actionString = ifThenMatch[2].trim();

    // Check for multi-condition rules with AND or OR
    const andPattern = /\s+AND\s+/i;
    const orPattern = /\s+OR\s+/i;
    const hasAndOperator = andPattern.test(conditionPart);
    const hasOrOperator = orPattern.test(conditionPart);

    // Validate that we don't have mixed operators
    if (hasAndOperator && hasOrOperator) {
      logger.error(`Rule contains both AND and OR operators, which is not supported: ${ruleString}`);
      return null;
    }

    if (hasAndOperator || hasOrOperator) {
      const logicType = hasAndOperator ? "AND" : "OR";
      const operatorPattern = hasAndOperator ? andPattern : orPattern;
      
      logger.info(`Multi-condition rule detected with ${logicType} logic: ${ruleString}`);
      
      // Split conditions by the detected operator
      const conditionStrings = conditionPart.split(operatorPattern).map(c => c.trim());
      logger.info(`Found ${conditionStrings.length} conditions: ${conditionStrings.join(' | ')}`);

      const conditions = [];
      const eventNames = [];

      // Parse each individual condition
      for (const conditionStr of conditionStrings) {
        const parsedCondition = this.parseSingleCondition(conditionStr);
        
        if (!parsedCondition) {
          logger.error(`Failed to parse condition: ${conditionStr}`);
          return null;
        }

        if (!parsedCondition.eventName) {
          logger.error(`Parsed condition has no event name: ${conditionStr}`);
          return null;
        }

        conditions.push(parsedCondition.condition);
        eventNames.push(parsedCondition.eventName);
        logger.info(`Parsed condition: ${parsedCondition.eventName} ${parsedCondition.condition.operator} ${parsedCondition.condition.value}`);
      }

      return {
        isMultiCondition: true,
        logicType,
        conditions,
        eventNames,
        actionString
      };
    }

    // Single condition rule - use existing logic
    return this.parseSingleCondition(conditionPart, actionString);
  }

  /**
   * Parse a single condition string
   * @param {string} conditionStr - The condition string to parse
   * @param {string} actionString - The action string (optional, for single-condition rules)
   * @returns {Object|null} Parsed condition object or null if parsing fails
   */
  parseSingleCondition(conditionStr, actionString = null) {
    // Check for simple motion detected pattern FIRST (e.g., "living room motion detected")
    const motionDetectedPattern = /(.+?)\s+motion\s+detected$/i;
    const motionDetectedMatch = conditionStr.match(motionDetectedPattern);

    // Enhanced check for motion sensor rules (e.g., "Living Room motion true")
    const motionPattern = /(.+?)\s+motion\s+(true|false)$/i;
    const motionMatch = conditionStr.match(motionPattern);

    // Check if this is an anomaly rule with "detected" pattern
    const anomalyDetectedPattern = /(.+?)\s+anomaly\s+detected$/i;
    const anomalyDetectedMatch = conditionStr.match(anomalyDetectedPattern);

    // Check if this is an anomaly rule with "not detected" pattern
    const anomalyNotDetectedPattern = /(.+?)\s+anomaly\s+not\s+detected$/i;
    const anomalyNotDetectedMatch = conditionStr.match(
      anomalyNotDetectedPattern
    );

    // Check if this is a rule with custom description using "detected" pattern
    // BUT exclude motion patterns that we already handled above
    const customDescriptionDetectedPattern = /(.+?)\s+detected$/i;
    const customDescriptionDetectedMatch = conditionStr.match(customDescriptionDetectedPattern);
    const isMotionDetected = motionDetectedMatch !== null;

    // More general boolean pattern for other sensors
    const booleanPattern = /(.+?)\s+(true|false)$/i;
    const booleanMatch = conditionStr.match(booleanPattern);

    if (motionDetectedMatch) {
      // This is a motion detected rule (e.g., "living room motion detected")
      const location = motionDetectedMatch[1].trim();
      
      // Construct proper motion event name
      const eventName = `${location} Motion`;

      logger.info(
        `Parsed motion detected rule for location: "${location}", eventName: "${eventName}"`
      );

      const result = {
        eventName,
        condition: { operator: "==", value: "true" }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    } else if (motionMatch) {
      // This is a motion rule (e.g., "Living Room motion true")
      const location = motionMatch[1].trim();
      const booleanValue = motionMatch[2].toLowerCase();

      // Construct proper motion event name
      const eventName = `${location} Motion`;

      logger.info(
        `Parsed motion rule for location: "${location}", eventName: "${eventName}" with condition "${booleanValue}"`
      );

      const result = {
        eventName,
        condition: { operator: "==", value: booleanValue }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    } else if (anomalyDetectedMatch) {
      // This is an anomaly rule with "detected"
      const eventName = anomalyDetectedMatch[1].trim();
      logger.info(
        `Parsed anomaly rule for event: "${eventName}" with condition "detected"`
      );

      const result = {
        eventName,
        condition: { operator: "anomaly_detected", value: "true" }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    } else if (anomalyNotDetectedMatch) {
      // This is an anomaly rule with "not detected"
      const eventName = anomalyNotDetectedMatch[1].trim();
      logger.info(
        `Parsed anomaly rule for event: "${eventName}" with condition "not detected"`
      );

      const result = {
        eventName,
        condition: { operator: "anomaly_detected", value: "false" }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    } else if (customDescriptionDetectedMatch && !isMotionDetected) {
      // This is a rule with custom description using "detected" but NOT a motion rule
      const description = customDescriptionDetectedMatch[1].trim();
      logger.info(
        `Found possible custom anomaly description: "${description}"`
      );

      // Try to find a matching anomaly description in the database
      const AnomalyDescription = require("../../../models/AnomalyDescription");

      // Use an immediately invoked async function to handle the async database query
      const eventNamePromise = (async () => {
        try {
          // Look for a matching description in the database
          const anomalyDesc = await AnomalyDescription.findOne({
            description: { $regex: new RegExp(description, "i") },
            isActive: true,
          });

          if (anomalyDesc) {
            logger.info(
              `Found matching anomaly description in database. Raw event name: ${anomalyDesc.rawEventName}`
            );
            return anomalyDesc.rawEventName;
          }

          // If no exact match found, try to extract potential anomaly event name using EventRegistry
          const EventRegistry = require("../events/EventRegistry");
          const potentialEventName =
            EventRegistry.findAnomalyEventByPartialName(description);

          if (potentialEventName) {
            logger.info(
              `Found potential matching anomaly event: ${potentialEventName}`
            );
            return potentialEventName;
          }

          logger.error(
            `No matching anomaly description or event found for: ${description}`
          );
          throw new Error(
            `No matching anomaly event found for description: ${description}`
          );
        } catch (error) {
          logger.error(
            `Error finding matching anomaly event for description: ${description}`,
            error
          );
          throw error;
        }
      })();

      // We need to wait for the Promise to resolve
      // This is a bit of a hack since parseRule is synchronous but we need async behavior
      // The constructor calling this will need to handle the Promise rejection
      const result = {
        eventNamePromise,
        condition: { operator: "anomaly_detected", value: "true" }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    } else if (booleanMatch) {
      // This is a boolean rule (e.g., "Living Room Temperature true")
      const eventName = booleanMatch[1].trim();
      const booleanValue = booleanMatch[2].toLowerCase();
      logger.info(
        `Parsed boolean rule for event: "${eventName}" with condition "${booleanValue}"`
      );

      const result = {
        eventName,
        condition: { operator: "==", value: booleanValue }
      };
      
      if (actionString) result.actionString = actionString;
      return result;
    }

    // Not an anomaly rule or boolean rule, use standard operator-based parsing
    const conditionPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
    const conditionMatch = conditionStr.match(conditionPattern);

    if (!conditionMatch) {
      logger.error(
        `Condition part does not match expected pattern: ${conditionStr}`
      );
      return null;
    }

    const eventName = conditionMatch[1].trim();
    const operator = conditionMatch[2].trim();
    const value = conditionMatch[3].trim();

    const result = {
      eventName,
      condition: { operator, value }
    };
    
    if (actionString) result.actionString = actionString;
    return result;
  }

  /**
   * Add an action as an observer of this rule
   * @param {Action} action - The action to add as an observer
   */
  addObservingAction(action) {
    if (!this.observingActions.includes(action)) {
      this.observingActions.push(action);
      logger.info(
        `Action ${action.name} (${action.type}) now observing rule ${this.id}`
      );
    }
  }

  /**
   * Remove an action as an observer of this rule
   * @param {Action} action - The action to remove as an observer
   */
  removeObservingAction(action) {
    const index = this.observingActions.indexOf(action);
    if (index !== -1) {
      this.observingActions.splice(index, 1);
      logger.info(
        `Action ${action.name} (${action.type}) no longer observing rule ${this.id}`
      );
    }
  }

  /**
   * Evaluate the rule based on the current event value
   * Called when the observed event changes
   * @param {boolean} [forceExecute=false] - Whether to force execution of actions if condition is met
   */
  evaluate(forceExecute = false) {
    // Get component-specific logger for consistent tagging
    const ruleLogger = logger.getComponentLogger(`Rule-${this.id}`);
    
    // Log method entry
    ruleLogger.debug('Starting rule evaluation', { 
      forceExecute, 
      isMultiCondition: this.isMultiCondition,
      eventName: this.eventName,
      eventNames: this.eventNames, 
      active: this.active,
      condition: this.condition,
      conditions: this.conditions
    });
    
    // Start performance timer
    const endTimer = logger.startTimer('RuleEvaluation', { ruleId: this.id });
    
    if (!this.active) {
      ruleLogger.info('Rule is not active, skipping evaluation');
      endTimer({ skipped: true, reason: 'rule_inactive' });
      return;
    }

    // Handle multi-condition rules
    if (this.isMultiCondition) {
      return this.evaluateMultiCondition(forceExecute, ruleLogger, endTimer);
    }

    // Handle single-condition rules (existing logic)
    return this.evaluateSingleCondition(forceExecute, ruleLogger, endTimer);
  }

  /**
   * Evaluate multi-condition rules with AND logic
   * @param {boolean} forceExecute - Whether to force execution regardless of previous state
   * @param {Object} ruleLogger - Logger instance for this rule
   * @param {Function} endTimer - Timer function to end performance measurement
   */
  evaluateMultiCondition(forceExecute, ruleLogger, endTimer) {
    ruleLogger.debug(`Evaluating multi-condition rule with ${this.logicType} logic`);

    const conditionResults = [];
    const eventValues = {};
    let allConditionsMet = true;
    let anyConditionMet = false; // For OR logic

    // Evaluate each condition
    for (let i = 0; i < this.eventNames.length; i++) {
      const eventName = this.eventNames[i];
      const condition = this.conditions[i];

      // Get the current value of the event
      const event = EventRegistry.getEvent(eventName);
      
      if (!event) {
        ruleLogger.error('Event not found in registry', { eventName });
        endTimer({ failed: true, reason: 'event_not_found' });
        return;
      }

      // Get and process the event value
      let eventValue = event.currentValue;
      eventValues[eventName] = eventValue;

      // Update event state tracking
      this.eventStates.set(eventName, eventValue);

      ruleLogger.debug('Retrieved event value for multi-condition', { 
        eventName, 
        eventValue,
        valueType: typeof eventValue
      });

      // Special handling for motion events
      if (eventName.toLowerCase().includes("motion") && typeof eventValue !== 'boolean') {
        const originalValue = eventValue;
        
        // Try to extract a boolean value from motion sensor readings
        if (typeof eventValue === 'object' && eventValue !== null) {
          if ('detected' in eventValue) {
            eventValue = eventValue.detected;
          } else if ('value' in eventValue) {
            eventValue = eventValue.value;
          } else if ('status' in eventValue) {
            const statusValue = eventValue.status;
            eventValue = statusValue === 'active' || statusValue === 'true' || statusValue === true;
          }
        } else if (typeof eventValue === 'string') {
          eventValue = eventValue.toLowerCase() === 'true' || 
                      eventValue.toLowerCase() === 'detected' || 
                      eventValue.toLowerCase() === 'active' ||
                      eventValue === '1';
        } else if (typeof eventValue === 'number') {
          eventValue = eventValue !== 0;
        }
        
        ruleLogger.debug('Motion sensor value conversion for multi-condition', {
          eventName,
          before: originalValue,
          after: eventValue
        });
      }

      // Normalize values for comparison
      let normalizedEventValue = eventValue;
      let normalizedConditionValue = condition.value;
      
      if (condition.operator === '==' || condition.operator === '=') {
        // Convert string 'true'/'false' to actual boolean for condition value
        if (typeof condition.value === 'string') {
          if (condition.value.toLowerCase() === 'true') {
            normalizedConditionValue = true;
          } else if (condition.value.toLowerCase() === 'false') {
            normalizedConditionValue = false;
          }
        }
        
        // Convert event value string representations to boolean
        if (typeof eventValue === 'string') {
          if (eventValue.toLowerCase() === 'true') {
            normalizedEventValue = true;
          } else if (eventValue.toLowerCase() === 'false') {
            normalizedEventValue = false;
          }
        }
      }

      // Evaluate this condition
      const conditionMet = this.evaluateCondition(
        normalizedEventValue,
        condition.operator,
        normalizedConditionValue
      );

      conditionResults.push({
        eventName,
        eventValue: normalizedEventValue,
        operator: condition.operator,
        conditionValue: normalizedConditionValue,
        met: conditionMet
      });

      ruleLogger.debug('Individual condition result', {
        eventName,
        eventValue: normalizedEventValue,
        operator: condition.operator,
        conditionValue: normalizedConditionValue,
        met: conditionMet
      });

      // Track results for both AND and OR logic
      if (!conditionMet) {
        allConditionsMet = false;
      }
      if (conditionMet) {
        anyConditionMet = true;
      }
    }

    // Determine if rule should execute based on logic type
    let shouldExecute;
    if (this.logicType === "OR") {
      shouldExecute = anyConditionMet;
      ruleLogger.info('Multi-condition OR evaluation complete', {
        anyConditionMet,
        conditionResults: conditionResults.map(r => `${r.eventName}: ${r.met}`)
      });
    } else {
      // Default to AND logic
      shouldExecute = allConditionsMet;
      ruleLogger.info('Multi-condition AND evaluation complete', {
        allConditionsMet,
        conditionResults: conditionResults.map(r => `${r.eventName}: ${r.met}`)
      });
    }

    // If conditions are met according to logic type, notify all observing actions
    if (shouldExecute) {
      ruleLogger.debug(`${this.logicType} conditions met, preparing action context`);
      
      // Create context with all event values
      const context = {
        isMultiCondition: true,
        logicType: this.logicType,
        eventValues,
        conditionResults,
        timestamp: Date.now(),
      };
      
      ruleLogger.debug('Multi-condition action context created', { context });

      // Notify all observing actions
      this.notifyObservingActions(context, forceExecute);
      endTimer({ success: true, conditionsMet: conditionResults.length, logicType: this.logicType });
    } else {
      ruleLogger.debug(`${this.logicType} conditions not met, no action will be taken`);
      endTimer({ success: false, reason: 'conditions_not_met', logicType: this.logicType });
    }
  }

  /**
   * Evaluate single-condition rules (existing logic)
   * @param {boolean} forceExecute - Whether to force execution regardless of previous state
   * @param {Object} ruleLogger - Logger instance for this rule
   * @param {Function} endTimer - Timer function to end performance measurement
   */
  evaluateSingleCondition(forceExecute, ruleLogger, endTimer) {
    // Get the current value of the event
    const event = EventRegistry.getEvent(this.eventName);
    
    if (!event) {
      ruleLogger.error('Event not found in registry', { 
        eventName: this.eventName
      });
      endTimer({ failed: true, reason: 'event_not_found' });
      return;
    }

    ruleLogger.debug('Retrieved event from registry', { eventName: this.eventName });
    
    // Get the event value and handle motion sensor cases specifically
    let eventValue = event.currentValue;
    
    ruleLogger.debug('Retrieved raw event value', { 
      eventValue,
      valueType: typeof eventValue,
      isMotionEvent: this.eventName.toLowerCase().includes("motion")
    });
    
    // Special handling for motion events - they might return different value formats
    if (this.eventName.toLowerCase().includes("motion") && typeof eventValue !== 'boolean') {
      const originalValue = eventValue;
      
      // Try to extract a boolean value from motion sensor readings
      if (typeof eventValue === 'object' && eventValue !== null) {
        ruleLogger.debug('Processing motion object', { motionObject: eventValue });
        
        // If the event value is an object, try to get the motion detected status
        if ('detected' in eventValue) {
          eventValue = eventValue.detected;
          ruleLogger.debug('Using "detected" property from motion object', { value: eventValue });
        } else if ('value' in eventValue) {
          eventValue = eventValue.value;
          ruleLogger.debug('Using "value" property from motion object', { value: eventValue });
        } else if ('status' in eventValue) {
          const statusValue = eventValue.status;
          eventValue = statusValue === 'active' || statusValue === 'true' || statusValue === true;
          ruleLogger.debug('Converted status to boolean', { status: statusValue, result: eventValue });
        }
      } else if (typeof eventValue === 'string') {
        // If it's a string, try to convert to boolean
        const stringValue = eventValue;
        eventValue = eventValue.toLowerCase() === 'true' || 
                    eventValue.toLowerCase() === 'detected' || 
                    eventValue.toLowerCase() === 'active' ||
                    eventValue === '1';
        ruleLogger.debug('Converted string to boolean', { stringValue, result: eventValue });
      } else if (typeof eventValue === 'number') {
        // If it's a number, 0 is false, anything else is true
        const numberValue = eventValue;
        eventValue = eventValue !== 0;
        ruleLogger.debug('Converted number to boolean', { numberValue, result: eventValue });
      }
      
      // Log the state change using the utility method
      logger.logStateChange('debug', 'Motion sensor value conversion', {
        before: originalValue,
        after: eventValue,
        component: `Rule-${this.id}`
      });
    }
    
    ruleLogger.debug('Preparing for condition evaluation', {
      operator: this.condition.operator,
      conditionValue: this.condition.value,
      eventValue
    });

    // Handle true/false string values for boolean comparison
    let normalizedEventValue = eventValue;
    let normalizedConditionValue = this.condition.value;
    
    // Normalize boolean values in string form for comparison
    if (this.condition.operator === '==' || this.condition.operator === '=') {
      ruleLogger.debug('Equality comparison detected, normalizing boolean string values');
      
      // Track original values for transition logging
      const originalEventValue = normalizedEventValue;
      const originalConditionValue = normalizedConditionValue;
      
      // Convert string 'true'/'false' to actual boolean for condition value
      if (typeof this.condition.value === 'string') {
        if (this.condition.value.toLowerCase() === 'true') {
          normalizedConditionValue = true;
          ruleLogger.debug('Normalized condition string to boolean', { 
            from: this.condition.value, 
            to: true 
          });
        } else if (this.condition.value.toLowerCase() === 'false') {
          normalizedConditionValue = false;
          ruleLogger.debug('Normalized condition string to boolean', { 
            from: this.condition.value, 
            to: false 
          });
        }
      }
      
      // Convert event value string representations to boolean
      if (typeof eventValue === 'string') {
        if (eventValue.toLowerCase() === 'true') {
          normalizedEventValue = true;
          ruleLogger.debug('Normalized event string to boolean', { 
            from: eventValue, 
            to: true 
          });
        } else if (eventValue.toLowerCase() === 'false') {
          normalizedEventValue = false;
          ruleLogger.debug('Normalized event string to boolean', { 
            from: eventValue, 
            to: false 
          });
        }
      }
      
      // Log state changes if values were normalized
      if (originalEventValue !== normalizedEventValue) {
        logger.logStateChange('debug', 'Event value normalization', {
          before: originalEventValue,
          after: normalizedEventValue,
          component: `Rule-${this.id}`
        });
      }
      
      if (originalConditionValue !== normalizedConditionValue) {
        logger.logStateChange('debug', 'Condition value normalization', {
          before: originalConditionValue,
          after: normalizedConditionValue,
          component: `Rule-${this.id}`
        });
      }
    }
    
    ruleLogger.debug('Final values for comparison', {
      eventValue: normalizedEventValue,
      eventValueType: typeof normalizedEventValue,
      conditionValue: normalizedConditionValue,
      conditionValueType: typeof normalizedConditionValue,
      operator: this.condition.operator
    });

    // Evaluate the condition with normalized values
    logger.methodEntry('evaluateCondition', {
      eventValue: normalizedEventValue, 
      operator: this.condition.operator, 
      conditionValue: normalizedConditionValue
    }, { component: `Rule-${this.id}` });
    
    const conditionMet = this.evaluateCondition(
      normalizedEventValue,
      this.condition.operator,
      normalizedConditionValue
    );

    ruleLogger.info('Condition evaluation result', { 
      conditionMet,
      eventValue: normalizedEventValue,
      operator: this.condition.operator,
      conditionValue: normalizedConditionValue
    });

    // If the condition is met, notify all observing actions
    if (conditionMet) {
      ruleLogger.debug('Condition met, preparing action context');
      
      // Create context with current values (use original values, not normalized)
      const context = {
        eventName: this.eventName,
        eventValue: eventValue,
        conditionOperator: this.condition.operator,
        conditionValue: this.condition.value,
        timestamp: Date.now(),
      };
      
      ruleLogger.debug('Action context created', { context });

      // Notify all observing actions, passing the force execute flag
      this.notifyObservingActions(context, forceExecute);
      endTimer({ success: true });
    } else {
      ruleLogger.debug('Condition not met, no action will be taken');
      endTimer({ success: false, reason: 'condition_not_met' });
    }
  }

  /**
   * Notify all actions that are observing this rule
   * @param {Object} context - Context data to pass to the actions
   * @param {boolean} [force=false] - Whether to force execution (bypass state check)
   */
  notifyObservingActions(context, force = false) {
    logger.info(
      `Rule ${this.id} notifying ${
        this.observingActions.length
      } observing actions${force ? " (forced execution)" : ""}`
    );

    // Add force flag to context if specified
    const actionContext = force ? { ...context, force: true } : context;

    this.observingActions.forEach((action) => {
      try {
        action
          .onRuleTriggered(this, actionContext)
          .then((result) => {
            if (result.success) {
              logger.info(
                `Action ${action.name} executed successfully: ${result.message}`
              );
            } else {
              logger.error(
                `Action ${action.name} execution failed: ${result.message}`
              );
            }
          })
          .catch((error) => {
            logger.error(
              `Error in action execution for ${action.name}: ${error.message}`
            );
          });
      } catch (error) {
        logger.error(`Error notifying action ${action.name}: ${error.message}`);
      }
    });
  }

  /**
   * Evaluate a condition
   * @param {any} eventValue - Current value of the event
   * @param {string} operator - Condition operator (>, <, >=, <=, ==, !=, anomaly_detected)
   * @param {string|boolean} conditionValue - Value to compare against
   * @returns {boolean} True if condition is met, false otherwise
   */
  evaluateCondition(eventValue, operator, conditionValue) {
    console.log(`[Rule-${this.id}] EvaluateCondition details: eventValue=${JSON.stringify(eventValue)}, operator=${operator}, conditionValue=${conditionValue}`);
    
    // Special handling for anomaly events
    if (operator === "anomaly_detected") {
      console.log(`[Rule-${this.id}] Processing anomaly_detected operator`);
      
      // For anomaly events, check if the anomaly is detected or not detected
      if (typeof eventValue === "object" && eventValue !== null) {
        // If conditionValue is "false", we want "not detected"
        const expectedDetectionState = 
          conditionValue.toString().toLowerCase() !== "false";
        
        console.log(`[Rule-${this.id}] Object anomaly evaluation: eventValue.detected=${eventValue.detected}, expectedState=${expectedDetectionState}`);
        return eventValue.detected === expectedDetectionState;
      }
      
      // NEW CODE: Handle primitive eventValue (non-object) for anomaly_detected
      // This is the fix for your specific issue
      console.log(`[Rule-${this.id}] Primitive anomaly evaluation: eventValue=${eventValue}`);
      
      // Convert the primitive event value to boolean
      const isDetected = Boolean(eventValue);
      
      // Check if the condition expects detection or not
      const expectedDetectionState = 
        conditionValue.toString().toLowerCase() !== "false";
      
      console.log(`[Rule-${this.id}] Comparing: isDetected=${isDetected}, expectedState=${expectedDetectionState}`);
      return isDetected === expectedDetectionState;
    }

    // Special handling for boolean values - ensure proper type comparison
    if (
      (typeof eventValue === "boolean" ||
        typeof conditionValue === "boolean") &&
      (operator === "==" || operator === "=" || operator === "!=")
    ) {
      // Convert both values to boolean type if we're doing boolean comparison
      let boolEventValue = eventValue;
      let boolConditionValue = conditionValue;

      // Convert string 'true'/'false' to boolean
      if (typeof eventValue === "string") {
        boolEventValue = eventValue.toLowerCase() === "true";
        console.log(`[Rule-${this.id}] Converted event string "${eventValue}" to boolean ${boolEventValue}`);
      }

      if (typeof conditionValue === "string") {
        boolConditionValue = conditionValue.toLowerCase() === "true";
        console.log(`[Rule-${this.id}] Converted condition string "${conditionValue}" to boolean ${boolConditionValue}`);
      }

      // Log the conversion for debugging
      console.log(
        `[Rule-${this.id}] Boolean comparison: ${eventValue} (${typeof eventValue}) -> ${boolEventValue} (boolean) ` +
          `${operator} ${conditionValue} (${typeof conditionValue}) -> ${boolConditionValue} (boolean)`
      );

      // Perform boolean equality comparison
      if (operator === "==" || operator === "=") {
        const result = boolEventValue === boolConditionValue;
        console.log(`[Rule-${this.id}] Boolean equality result: ${result}`);
        return result;
      } else if (operator === "!=") {
        const result = boolEventValue !== boolConditionValue;
        console.log(`[Rule-${this.id}] Boolean inequality result: ${result}`);
        return result;
      }
    }

    // Handle motion sensor events specifically - they may have special value formats
    if (
      typeof eventValue === "object" &&
      eventValue !== null &&
      ("detected" in eventValue ||
        "motion" in eventValue ||
        "status" in eventValue)
    ) {
      console.log(`[Rule-${this.id}] Processing motion sensor object`);
      
      let actualValue = eventValue.detected;
      if (actualValue === undefined) {
        actualValue = eventValue.motion;
      }
      if (actualValue === undefined) {
        actualValue =
          eventValue.status === "active" || eventValue.status === true;
      }
      
      console.log(`[Rule-${this.id}] Extracted motion sensor value: ${actualValue}`);

      // For motion sensors with boolean condition, compare the detected state
      if (
        typeof conditionValue === "string" &&
        (conditionValue.toLowerCase() === "true" ||
          conditionValue.toLowerCase() === "false")
      ) {
        const expectedState = conditionValue.toLowerCase() === "true";
        const result = actualValue === expectedState;
        console.log(`[Rule-${this.id}] Motion sensor comparison result: ${result}`);
        return result;
      }
    }

    // Convert values to appropriate types for numeric comparison
    let parsedEventValue = eventValue;
    let parsedConditionValue = conditionValue;

    // Try to convert to numbers if possible for numeric comparisons
    if (
      !isNaN(Number(eventValue)) &&
      operator !== "==" &&
      operator !== "=" &&
      operator !== "!="
    ) {
      parsedEventValue = Number(eventValue);
      console.log(`[Rule-${this.id}] Converted event value to number: ${parsedEventValue}`);
    }

    if (
      !isNaN(Number(conditionValue)) &&
      operator !== "==" &&
      operator !== "=" &&
      operator !== "!="
    ) {
      parsedConditionValue = Number(conditionValue);
      console.log(`[Rule-${this.id}] Converted condition value to number: ${parsedConditionValue}`);
    }

    // For string comparison, ensure we're comparing strings
    if (typeof eventValue === "string" || typeof conditionValue === "string") {
      if (
        (operator === "==" || operator === "=") &&
        typeof eventValue !== typeof conditionValue
      ) {
        // Convert to strings for comparison if types don't match
        parsedEventValue = String(parsedEventValue);
        parsedConditionValue = String(parsedConditionValue);
        console.log(`[Rule-${this.id}] Converted values to strings for comparison`);
      }
    }

    // Evaluate based on operator
    console.log(`[Rule-${this.id}] Final comparison: ${parsedEventValue} ${operator} ${parsedConditionValue}`);
    
    let result;
    switch (operator) {
      case ">":
        result = parsedEventValue > parsedConditionValue;
        console.log(`[Rule-${this.id}] Greater than result: ${result}`);
        return result;
      case "<":
        result = parsedEventValue < parsedConditionValue;
        console.log(`[Rule-${this.id}] Less than result: ${result}`);
        return result;
      case ">=":
        result = parsedEventValue >= parsedConditionValue;
        console.log(`[Rule-${this.id}] Greater than or equal result: ${result}`);
        return result;
      case "<=":
        result = parsedEventValue <= parsedConditionValue;
        console.log(`[Rule-${this.id}] Less than or equal result: ${result}`);
        return result;
      case "==":
      case "=":
        result = parsedEventValue == parsedConditionValue;
        console.log(`[Rule-${this.id}] Equality result: ${result}`);
        return result;
      case "!=":
        result = parsedEventValue != parsedConditionValue;
        console.log(`[Rule-${this.id}] Inequality result: ${result}`);
        return result;
      default:
        console.log(`[Rule-${this.id}] ERROR: Unsupported operator: ${operator}`);
        return false;
    }
  }

  /**
   * Execute the action part of the rule
   */
  async executeAction() {
    logger.info(`Executing action for rule ${this.id}: ${this.actionString}`);

    try {
      // Use the ActionRegistry to execute the action
      const result = await ActionRegistry.executeAction(this.actionString);

      if (result.success) {
        logger.info(
          `Rule ${this.id} action executed successfully: ${result.message}`
        );
      } else {
        logger.error(
          `Rule ${this.id} action execution failed: ${result.message}`
        );
      }

      return result;
    } catch (error) {
      logger.error(
        `Error executing action for rule ${this.id}: ${error.message}`
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Activate the rule
   */
  activate() {
    this.active = true;

    // Add debugging to understand the rule state
    logger.info(`Activating rule ${this.id}`, {
      isMultiCondition: this.isMultiCondition,
      eventName: this.eventName,
      eventNames: this.eventNames,
      ruleString: this.ruleString
    });

    // Handle multi-condition rules
    if (this.isMultiCondition && this.eventNames && this.eventNames.length > 0) {
      logger.info(`Activating multi-condition rule ${this.id} with ${this.eventNames.length} events`);
      
      // Register this rule as an observer to all its events
      for (const eventName of this.eventNames) {
        if (!eventName) {
          logger.warn(`Multi-condition rule ${this.id} has undefined eventName in eventNames array`);
          continue;
        }

        const event = EventRegistry.getEvent(eventName);
        if (event) {
          // First remove as observer to avoid duplicates
          event.removeObserver(this);
          // Then add back as observer
          event.addObserver(this);
          logger.info(
            `Multi-condition rule ${this.id} registered as observer for event ${eventName}`
          );
        } else {
          logger.warn(
            `Multi-condition rule ${this.id} couldn't find event ${eventName}`
          );
        }
      }

      // Force an immediate evaluation of the rule with forceExecute=true
      logger.info(
        `Performing immediate evaluation of multi-condition rule ${this.id} after activation (forced execution)`
      );
      this.evaluate(true); // Pass true to force execution
    } 
    // Handle single-condition rules
    else if (this.eventName) {
      // Re-register this rule as an observer to its event
      const event = EventRegistry.getEvent(this.eventName);
      if (event) {
        // First remove as observer to avoid duplicates
        event.removeObserver(this);
        // Then add back as observer
        event.addObserver(this);
        logger.info(
          `Rule ${this.id} activated and re-registered as observer for event ${this.eventName}`
        );

        // Force an immediate evaluation of the rule with forceExecute=true
        logger.info(
          `Performing immediate evaluation of rule ${this.id} after activation (forced execution)`
        );
        this.evaluate(true); // Pass true to force execution
      } else {
        logger.warn(
          `Rule ${this.id} activated but couldn't find event ${this.eventName}`
        );
      }
    } else {
      // This is the problematic case - rule has neither eventName nor eventNames
      logger.error(
        `Rule ${this.id} activated but has no eventName or eventNames defined. Rule state:`, {
          isMultiCondition: this.isMultiCondition,
          eventName: this.eventName,
          eventNames: this.eventNames,
          ruleString: this.ruleString,
          conditions: this.conditions
        }
      );
      
      // Try to recover by re-parsing the rule string if available
      if (this.ruleString) {
        logger.info(`Attempting to recover rule ${this.id} by re-parsing rule string: ${this.ruleString}`);
        
        try {
          const parsedRule = this.parseRule(this.ruleString);
          
          if (parsedRule && parsedRule.isMultiCondition) {
            // Update the rule properties
            this.isMultiCondition = true;
            this.logicType = parsedRule.logicType;
            this.conditions = parsedRule.conditions;
            this.eventNames = parsedRule.eventNames;
            this.actionString = parsedRule.actionString;
            
            logger.info(`Successfully recovered multi-condition rule ${this.id}`);
            
            // Now try to activate again
            return this.activate();
          } else if (parsedRule && parsedRule.eventName) {
            // Update the rule properties for single condition
            this.eventName = parsedRule.eventName;
            this.condition = parsedRule.condition;
            this.actionString = parsedRule.actionString;
            
            logger.info(`Successfully recovered single-condition rule ${this.id}`);
            
            // Now try to activate again
            return this.activate();
          } else {
            logger.error(`Failed to recover rule ${this.id} - parsing returned invalid result`);
          }
        } catch (error) {
          logger.error(`Failed to recover rule ${this.id} by re-parsing: ${error.message}`);
        }
      }
      
      throw new Error(`Rule ${this.id} is in an invalid state and cannot be activated`);
    }
  }

  /**
   * Deactivate the rule
   */
  deactivate() {
    this.active = false;

    // Add debugging to understand the rule state
    logger.info(`Deactivating rule ${this.id}`, {
      isMultiCondition: this.isMultiCondition,
      eventName: this.eventName,
      eventNames: this.eventNames
    });

    // Handle multi-condition rules
    if (this.isMultiCondition && this.eventNames && this.eventNames.length > 0) {
      logger.info(`Deactivating multi-condition rule ${this.id} from ${this.eventNames.length} events`);
      
      // Remove this rule as an observer from all its events
      for (const eventName of this.eventNames) {
        if (!eventName) {
          logger.warn(`Multi-condition rule ${this.id} has undefined eventName in eventNames array during deactivation`);
          continue;
        }

        const event = EventRegistry.getEvent(eventName);
        if (event) {
          event.removeObserver(this);
          logger.info(
            `Multi-condition rule ${this.id} removed as observer from event ${eventName}`
          );
        } else {
          logger.warn(
            `Multi-condition rule ${this.id} couldn't find event ${eventName} during deactivation`
          );
        }
      }
    } 
    // Handle single-condition rules
    else if (this.eventName) {
      const event = EventRegistry.getEvent(this.eventName);
      if (event) {
        event.removeObserver(this);
        logger.info(
          `Rule ${this.id} removed as observer from event ${this.eventName}`
        );
      } else {
        logger.warn(
          `Rule ${this.id} couldn't find event ${this.eventName} during deactivation`
        );
      }
    } else {
      // Rule has neither eventName nor eventNames - this shouldn't prevent deactivation
      logger.warn(
        `Rule ${this.id} has no eventName or eventNames defined during deactivation. This may indicate the rule was in an invalid state.`
      );
    }

    logger.info(`Rule ${this.id} deactivated`);
  }

  /**
   * Store pre-parsed action parameters
   * @param {Object} params - The parsed action parameters
   */
  setParsedActionParams(params) {
    this.parsedActionParams = params;
    logger.debug(`Pre-parsed action parameters stored for rule ${this.id}`);
  }

  /**
   * Get pre-parsed action parameters
   * @returns {Object|null} The parsed action parameters or null if not yet parsed
   */
  getParsedActionParams() {
    return this.parsedActionParams;
  }
}

module.exports = Rule;
