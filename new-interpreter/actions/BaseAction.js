/**
 * BaseAction class is the superclass for all actions
 * Actions are operations to execute when events are triggered
 */
class BaseAction {
  constructor() {
    // Base constructor - may be extended by subclasses
  }

  /**
   * Execute the action
   * To be implemented by subclasses
   */
  execute() {
    throw new Error('Method execute() must be implemented by subclass');
  }
}

module.exports = BaseAction; 