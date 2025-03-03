/**
 * BaseEvent class is the superclass for all events
 * Events are conditions that trigger actions
 */
class BaseEvent {
  constructor(location) {
    this.location = location;
    this.actions = []; // Array of actions to execute when the event is triggered
  }

  /**
   * Add an action to this event
   * @param {BaseAction} action - Action to add
   */
  addAction(action) {
    this.actions.push(action);
  }

  /**
   * Remove an action from this event
   * @param {BaseAction} action - Action to remove
   */
  removeAction(action) {
    const index = this.actions.findIndex(a => a === action);
    if (index !== -1) {
      this.actions.splice(index, 1);
    }
  }

  /**
   * Checks if this event should trigger based on current sensor values
   * @param {Object} sensorValues - Values from the sensors
   * @returns {boolean} - Whether the event should trigger
   */
  shouldTrigger(sensorValues) {
    // To be implemented by subclasses
    throw new Error('Method shouldTrigger() must be implemented by subclass');
  }

  /**
   * Execute all actions associated with this event
   */
  executeActions() {
    for (const action of this.actions) {
      action.execute();
    }
  }
}

module.exports = BaseEvent; 