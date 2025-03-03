const BaseAction = require('./BaseAction');

/**
 * LightAction class for lighting control operations
 * Example: "light on" or "light off"
 */
class LightAction extends BaseAction {
  /**
   * @param {string} location - Location of the light
   * @param {string} state - State of the light (on/off)
   * @param {number} brightness - Optional brightness level (0-100)
   * @param {string} color - Optional color value
   */
  constructor(location, state, brightness = null, color = null) {
    super();
    this.location = location;
    this.state = state.toLowerCase();
    this.brightness = brightness;
    this.color = color;
  }

  /**
   * Execute the light control action
   */
  execute() {
    console.log(`Executing Light action: ${this.state} ${this.brightness ? `at ${this.brightness}%` : ''} ${this.color ? `with color ${this.color}` : ''} in ${this.location}`);
    
    // Here you would implement the actual control logic
    // This could involve making API calls to a smart home system
    // or sending commands to hardware controllers
    
    // Example implementation:
    const controlParams = {
      device: 'light',
      location: this.location,
      state: this.state,
      brightness: this.brightness,
      color: this.color
    };
    
    // Call to device control service would go here
    // deviceControlService.controlDevice(controlParams);
    
    return true;
  }
}

module.exports = LightAction; 