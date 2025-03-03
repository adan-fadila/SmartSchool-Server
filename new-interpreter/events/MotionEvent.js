const BaseEvent = require('./BaseEvent');

/**
 * MotionEvent class for motion-based conditions
 * Example: "if motion in kitchen"
 */
class MotionEvent extends BaseEvent {
  /**
   * @param {string} location - The location where the event is monitored (e.g., "kitchen")
   * @param {boolean} motionRequired - Whether motion is required (true) or not required (false)
   */
  constructor(location, motionRequired = true) {
    super(location);
    this.motionRequired = motionRequired;
  }

  /**
   * Check if the motion event should trigger
   * @param {Object} sensorValues - Values from the sensors
   * @returns {boolean} - Whether the event should trigger
   */
  shouldTrigger(sensorValues) {
    // Check if there's a motion value for this location
    if (!sensorValues.motion || sensorValues.motion[this.location] === undefined) {
      return false;
    }

    const currentMotion = Boolean(sensorValues.motion[this.location]);
    
    // If motionRequired is true, we trigger when motion is detected
    // If motionRequired is false, we trigger when no motion is detected
    return currentMotion === this.motionRequired;
  }
}

module.exports = MotionEvent; 