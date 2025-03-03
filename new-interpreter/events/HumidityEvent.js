const BaseEvent = require('./BaseEvent');

/**
 * HumidityEvent class for humidity-based conditions
 * Example: "if humidity < 30 in bedroom"
 */
class HumidityEvent extends BaseEvent {
  /**
   * @param {string} location - The location where the event is monitored (e.g., "bedroom")
   * @param {string} operator - The comparison operator (>, <, >=, <=, ==)
   * @param {number} threshold - The humidity threshold value
   */
  constructor(location, operator, threshold) {
    super(location);
    this.operator = operator;
    this.threshold = threshold;
  }

  /**
   * Check if the humidity event should trigger
   * @param {Object} sensorValues - Values from the sensors
   * @returns {boolean} - Whether the event should trigger
   */
  shouldTrigger(sensorValues) {
    // Check if there's a humidity value for this location
    if (!sensorValues.humidity || !sensorValues.humidity[this.location]) {
      return false;
    }

    const currentHumidity = sensorValues.humidity[this.location];

    switch (this.operator) {
      case '>':
        return currentHumidity > this.threshold;
      case '<':
        return currentHumidity < this.threshold;
      case '>=':
        return currentHumidity >= this.threshold;
      case '<=':
        return currentHumidity <= this.threshold;
      case '==':
        return currentHumidity === this.threshold;
      default:
        return false;
    }
  }
}

module.exports = HumidityEvent; 