const BaseEvent = require('./BaseEvent');

/**
 * TemperatureEvent class for temperature-based conditions
 * Example: "if temp > 25 in living room"
 */
class TemperatureEvent extends BaseEvent {
  /**
   * @param {string} location - The location where the event is monitored (e.g., "living room")
   * @param {string} operator - The comparison operator (>, <, >=, <=, ==)
   * @param {number} threshold - The temperature threshold value
   */
  constructor(location, operator, threshold) {
    super(location);
    this.operator = operator;
    this.threshold = threshold;
  }

  /**
   * Check if the temperature event should trigger
   * @param {Object} sensorValues - Values from the sensors
   * @returns {boolean} - Whether the event should trigger
   */
  shouldTrigger(sensorValues) {
    // Check if there's a temperature value for this location
    if (!sensorValues.temp || !sensorValues.temp[this.location]) {
      return false;
    }

    const currentTemp = sensorValues.temp[this.location];

    switch (this.operator) {
      case '>':
        return currentTemp > this.threshold;
      case '<':
        return currentTemp < this.threshold;
      case '>=':
        return currentTemp >= this.threshold;
      case '<=':
        return currentTemp <= this.threshold;
      case '==':
        return currentTemp === this.threshold;
      default:
        return false;
    }
  }
}

module.exports = TemperatureEvent; 