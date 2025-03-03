const TemperatureEvent = require('../events/TemperatureEvent');
const HumidityEvent = require('../events/HumidityEvent');
const MotionEvent = require('../events/MotionEvent');
const ACAction = require('../actions/ACAction');
const LightAction = require('../actions/LightAction');

/**
 * RuleParser class to parse rule strings into Event and Action objects
 */
class RuleParser {
  /**
   * Parse a rule string into an event and action
   * @param {string} ruleStr - Rule string e.g. "if temp > 25 in living room then AC on cool 23"
   * @returns {Object} - Object containing event and action objects
   */
  static parseRule(ruleStr) {
    // Split the rule into event and action parts
    const parts = ruleStr.toLowerCase().split(' then ');
    if (parts.length !== 2) {
      throw new Error('Invalid rule format. Expected "if [event] then [action]"');
    }

    let eventStr = parts[0].trim();
    const actionStr = parts[1].trim();

    // Remove the "if " prefix from the event string
    if (eventStr.startsWith('if ')) {
      eventStr = eventStr.substring(3).trim();
    } else {
      throw new Error('Invalid event format. Expected to start with "if"');
    }

    // Parse the event
    const event = this.parseEvent(eventStr);

    // Parse the action
    const action = this.parseAction(actionStr, event.location);

    // Connect the action to the event
    event.addAction(action);

    return { event, action };
  }

  /**
   * Parse an event string into an Event object
   * @param {string} eventStr - Event string e.g. "temp > 25 in living room"
   * @returns {BaseEvent} - Appropriate event object
   */
  static parseEvent(eventStr) {
    // Handle temperature events
    if (eventStr.startsWith('temp ')) {
      return this.parseTemperatureEvent(eventStr);
    }
    
    // Handle humidity events
    if (eventStr.startsWith('humidity ')) {
      return this.parseHumidityEvent(eventStr);
    }
    
    // Handle motion events
    if (eventStr.startsWith('motion ')) {
      return this.parseMotionEvent(eventStr);
    }

    throw new Error(`Unsupported event type in: ${eventStr}`);
  }

  /**
   * Parse a temperature event string
   * @param {string} eventStr - Event string e.g. "temp > 25 in living room"
   * @returns {TemperatureEvent} - Temperature event object
   */
  static parseTemperatureEvent(eventStr) {
    // Expected format: "temp [operator] [value] in [location]"
    const parts = eventStr.split(' ');
    
    if (parts.length < 5) {
      throw new Error(`Invalid temperature event format: ${eventStr}`);
    }

    const operator = parts[1]; // >, <, >=, <=, ==
    const threshold = parseFloat(parts[2]);
    
    if (isNaN(threshold)) {
      throw new Error(`Invalid temperature threshold: ${parts[2]}`);
    }

    // Find the 'in' keyword to locate the start of the location
    const inIndex = parts.indexOf('in');
    if (inIndex === -1 || inIndex === parts.length - 1) {
      throw new Error(`Invalid location in event: ${eventStr}`);
    }

    const location = parts.slice(inIndex + 1).join(' ');
    
    return new TemperatureEvent(location, operator, threshold);
  }

  /**
   * Parse a humidity event string
   * @param {string} eventStr - Event string e.g. "humidity < 30 in bedroom"
   * @returns {HumidityEvent} - Humidity event object
   */
  static parseHumidityEvent(eventStr) {
    // Expected format: "humidity [operator] [value] in [location]"
    const parts = eventStr.split(' ');
    
    if (parts.length < 5) {
      throw new Error(`Invalid humidity event format: ${eventStr}`);
    }

    const operator = parts[1]; // >, <, >=, <=, ==
    const threshold = parseFloat(parts[2]);
    
    if (isNaN(threshold)) {
      throw new Error(`Invalid humidity threshold: ${parts[2]}`);
    }

    // Find the 'in' keyword to locate the start of the location
    const inIndex = parts.indexOf('in');
    if (inIndex === -1 || inIndex === parts.length - 1) {
      throw new Error(`Invalid location in event: ${eventStr}`);
    }

    const location = parts.slice(inIndex + 1).join(' ');
    
    return new HumidityEvent(location, operator, threshold);
  }

  /**
   * Parse a motion event string
   * @param {string} eventStr - Event string e.g. "motion in kitchen"
   * @returns {MotionEvent} - Motion event object
   */
  static parseMotionEvent(eventStr) {
    // Expected format: "motion in [location]" or "no motion in [location]"
    const parts = eventStr.split(' ');
    
    if (parts.length < 3) {
      throw new Error(`Invalid motion event format: ${eventStr}`);
    }

    let motionRequired = true;
    let startIndex = 0;

    if (parts[0] === 'no') {
      motionRequired = false;
      startIndex = 1;
    }

    // Find the 'in' keyword to locate the start of the location
    const inIndex = parts.indexOf('in');
    if (inIndex === -1 || inIndex === parts.length - 1) {
      throw new Error(`Invalid location in event: ${eventStr}`);
    }

    const location = parts.slice(inIndex + 1).join(' ');
    
    return new MotionEvent(location, motionRequired);
  }

  /**
   * Parse an action string into an Action object
   * @param {string} actionStr - Action string e.g. "AC on cool 23"
   * @param {string} location - Location extracted from the event
   * @returns {BaseAction} - Appropriate action object
   */
  static parseAction(actionStr, location) {
    // Handle AC actions
    if (actionStr.startsWith('ac ')) {
      return this.parseACAction(actionStr, location);
    }
    
    // Handle light actions
    if (actionStr.startsWith('light ')) {
      return this.parseLightAction(actionStr, location);
    }

    throw new Error(`Unsupported action type in: ${actionStr}`);
  }

  /**
   * Parse an AC action string
   * @param {string} actionStr - Action string e.g. "AC on cool 23"
   * @param {string} location - Location extracted from the event
   * @returns {ACAction} - AC action object
   */
  static parseACAction(actionStr, location) {
    // Expected format: "ac [state] [mode] [temperature]"
    const parts = actionStr.split(' ');
    
    if (parts.length < 2) {
      throw new Error(`Invalid AC action format: ${actionStr}`);
    }

    const state = parts[1]; // on/off
    let mode = null;
    let temperature = null;

    if (parts.length >= 3) {
      mode = parts[2]; // cool/heat/fan
    }

    if (parts.length >= 4) {
      temperature = parseFloat(parts[3]);
      if (isNaN(temperature)) {
        throw new Error(`Invalid temperature in AC action: ${parts[3]}`);
      }
    }
    
    return new ACAction(location, state, mode, temperature);
  }

  /**
   * Parse a light action string
   * @param {string} actionStr - Action string e.g. "light on" or "light on 80%"
   * @param {string} location - Location extracted from the event
   * @returns {LightAction} - Light action object
   */
  static parseLightAction(actionStr, location) {
    // Expected format: "light [state] [brightness%] [color]"
    const parts = actionStr.split(' ');
    
    if (parts.length < 2) {
      throw new Error(`Invalid light action format: ${actionStr}`);
    }

    const state = parts[1]; // on/off
    let brightness = null;
    let color = null;

    // Check for brightness (format: 80%)
    if (parts.length >= 3 && parts[2].endsWith('%')) {
      const brightnessStr = parts[2].slice(0, -1); // Remove the % symbol
      brightness = parseInt(brightnessStr);
      if (isNaN(brightness)) {
        throw new Error(`Invalid brightness in light action: ${parts[2]}`);
      }
    }

    // Check for color (any remaining parts)
    if (parts.length >= 3 && !parts[2].endsWith('%')) {
      color = parts.slice(2).join(' ');
    } else if (parts.length >= 4) {
      color = parts.slice(3).join(' ');
    }
    
    return new LightAction(location, state, brightness, color);
  }
}

module.exports = RuleParser; 