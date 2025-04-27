const Action = require("./Action");
const { switchLightState } = require("../../../api/hue");
const roomService = require("../../../services/rooms.service");
const fs = require("fs").promises;
const path = require("path");
const logger = require("../../../logger"); // Import your custom logger

/**
 * Action class for controlling Hue lights
 * Can handle actions like:
 * - living room light on
 * - living room light off
 * - living room light on 80 (brightness percentage)
 * - living room light on red (color)
 */
class LightAction extends Action {
  /**
   * Constructor for the LightAction class
   * @param {string} name - The name of the action (e.g., "Living Room Light")
   * @param {string} location - The location of this action (room name)
   * @param {string} [type='light'] - The type of this action from API
   */
  constructor(name, location, type = "light") {
    super(name, type, location);
    logger.info(
      `LightAction constructor initialized for ${name} in ${location}`
    );
  }

  /**
   * Parse the action string into components
   * @param {string} actionString - The action string to parse
   */
  parseActionString(actionString) {
    logger.debug(`Parsing Light action string: ${actionString}`);

    // Reset parameters
    this.state = false;
    this.params = {
      brightness: null,
      color: null,
    };

    // Parse the action string - find on/off state anywhere in the string
    const normalizedAction = actionString.toLowerCase().trim();
    
    // Simple arrays of keywords to search for
    const onKeywords = [" on", "on ", " on ", "on"];
    const offKeywords = [" off", "off ", " off ", "off"];
    
    // Check for on/off keywords
    const hasOnKeyword = onKeywords.some(keyword => normalizedAction.includes(keyword));
    const hasOffKeyword = offKeywords.some(keyword => normalizedAction.includes(keyword));
    
    // Set state based on found keywords
    if (hasOnKeyword && !hasOffKeyword) {
      this.state = true;
      logger.debug(`Found "on" keyword in action string: "${actionString}"`);
    } else if (hasOffKeyword && !hasOnKeyword) {
      this.state = false;
      logger.debug(`Found "off" keyword in action string: "${actionString}"`);
    } else if (hasOnKeyword && hasOffKeyword) {
      // Both keywords found - check which one appears last
      const lastOnIndex = Math.max(...onKeywords.map(keyword => 
        normalizedAction.lastIndexOf(keyword) >= 0 ? normalizedAction.lastIndexOf(keyword) : -1
      ));
      const lastOffIndex = Math.max(...offKeywords.map(keyword => 
        normalizedAction.lastIndexOf(keyword) >= 0 ? normalizedAction.lastIndexOf(keyword) : -1
      ));
      
      this.state = lastOnIndex > lastOffIndex;
      logger.debug(`Found both "on" and "off" keywords. Using last occurrence: "${this.state ? "on" : "off"}"`);
    } else {
      // No keywords found, default to on
      this.state = true;
      logger.warn(`No on/off keywords found in action: "${actionString}", defaulting to ON`);
    }

    // Parse for additional parameters (brightness, color)
    const parts = normalizedAction.split(" ");
    
    // Extract brightness and color if present
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Skip "on", "off", "light", "lamp" keywords
      if (["on", "off", "light", "lamp"].includes(part)) {
        continue;
      }
      
      // Check if it's a number (brightness)
      if (!isNaN(Number(part))) {
        const percentage = Math.min(100, Math.max(0, Number(part)));
        this.params.brightness = Math.round((percentage / 100) * 254);
        logger.debug(`Found brightness parameter: ${part} (${this.params.brightness})`);
      }
      // Check if it's a color word (not a number and not a common word)
      else if (part && !["the", "to", "in", "at", "for", "and", "a", "an"].includes(part)) {
        // Skip anything that could be part of the device name or location
        if (!this.name.toLowerCase().includes(part) && !this.location.toLowerCase().includes(part)) {
          // Only consider it a color if it's not "on" or "off"
          if (!["on", "off"].includes(part)) {
            this.params.color = part;
            logger.debug(`Found color parameter: ${part}`);
          }
        }
      }
    }

    logger.info(
      `Parsed Light action: state=${this.state}, brightness=${this.params.brightness}, color=${this.params.color}`
    );
  }

  /**
   * Pre-parse the action string and return the parsed parameters
   * @param {string} actionString - The action string to parse
   * @returns {Object} Object containing parsed parameters
   */
  preParseActionString(actionString) {
    logger.debug(`Pre-parsing Light action string: ${actionString}`);

    // Default parameters
    const result = {
      state: false,
      params: {
        brightness: null,
        color: null,
      },
    };

    // Parse the action string - find on/off state anywhere in the string
    const normalizedAction = actionString.toLowerCase().trim();
    
    // Simple arrays of keywords to search for
    const onKeywords = [" on", "on ", " on ", "on"];
    const offKeywords = [" off", "off ", " off ", "off"];
    
    // Check for on/off keywords
    const hasOnKeyword = onKeywords.some(keyword => normalizedAction.includes(keyword));
    const hasOffKeyword = offKeywords.some(keyword => normalizedAction.includes(keyword));
    
    // Set state based on found keywords
    if (hasOnKeyword && !hasOffKeyword) {
      result.state = true;
      logger.debug(`Pre-parse: Found "on" keyword in action string: "${actionString}"`);
    } else if (hasOffKeyword && !hasOnKeyword) {
      result.state = false;
      logger.debug(`Pre-parse: Found "off" keyword in action string: "${actionString}"`);
    } else if (hasOnKeyword && hasOffKeyword) {
      // Both keywords found - check which one appears last
      const lastOnIndex = Math.max(...onKeywords.map(keyword => 
        normalizedAction.lastIndexOf(keyword) >= 0 ? normalizedAction.lastIndexOf(keyword) : -1
      ));
      const lastOffIndex = Math.max(...offKeywords.map(keyword => 
        normalizedAction.lastIndexOf(keyword) >= 0 ? normalizedAction.lastIndexOf(keyword) : -1
      ));
      
      result.state = lastOnIndex > lastOffIndex;
      logger.debug(`Pre-parse: Found both "on" and "off" keywords. Using last occurrence: "${result.state ? "on" : "off"}"`);
    } else {
      // No keywords found, default to on
      result.state = true;
      logger.warn(`Pre-parse: No on/off keywords found in action: "${actionString}", defaulting to ON`);
    }

    // Parse for additional parameters (brightness, color)
    const parts = normalizedAction.split(" ");
    
    // Extract brightness and color if present
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Skip "on", "off", "light", "lamp" keywords
      if (["on", "off", "light", "lamp"].includes(part)) {
        continue;
      }
      
      // Check if it's a number (brightness)
      if (!isNaN(Number(part))) {
        const percentage = Math.min(100, Math.max(0, Number(part)));
        result.params.brightness = Math.round((percentage / 100) * 254);
        logger.debug(`Pre-parse: Found brightness parameter: ${part} (${result.params.brightness})`);
      }
      // Check if it's a color word (not a number and not a common word)
      else if (part && !["the", "to", "in", "at", "for", "and", "a", "an"].includes(part)) {
        // Skip anything that could be part of the device name or location
        if (!this.name.toLowerCase().includes(part) && !this.location.toLowerCase().includes(part)) {
          // Only consider it a color if it's not "on" or "off"
          if (!["on", "off"].includes(part)) {
            result.params.color = part;
            logger.debug(`Pre-parse: Found color parameter: ${part}`);
          }
        }
      }
    }

    logger.info(
      `Pre-parsed Light action: state=${result.state}, brightness=${result.params.brightness}, color=${result.params.color}`
    );

    return result;
  }

  /**
   * Check if this action can handle the given action string
   * @param {string} actionString - The action string to check
   * @returns {boolean} True if this action can handle the string
   */
  canHandleAction(actionString) {

    console.log(`Checking if LightAction can handle: ${actionString}`);
    const normalizedActionString = actionString.toLowerCase();
    const normalizedLocation = this.location.toLowerCase();
    const normalizedName = this.name.toLowerCase();

    // Check if this action's name/location and type appear in the action string
    const containsNameOrLocation = normalizedActionString.includes(normalizedName) || 
                                  normalizedActionString.includes(normalizedLocation);
                                  
    const containsLightOrLamp = normalizedActionString.includes("light") || 
                               normalizedActionString.includes("lamp");
    
    return  containsLightOrLamp;
  }

  /**
   * Get Raspberry Pi IP for this action's location
   * @returns {Promise<string>} The Raspberry Pi IP address
   */
  async getRoomRaspberryPi() {
    try {
      logger.info(`Getting Raspberry Pi IP for ${this.location}`);

      this.logAction(`Looking up Raspberry Pi IP for room: ${this.location}`);

      // Get room ID from name
      const roomId = await roomService.getRoomIdByRoomName(this.location);

      if (!roomId) {
        this.logAction(`Room not found in database: ${this.location}`);
        throw new Error(`Room not found: ${this.location}`);
      }

      // Get room details to find Raspberry Pi IP
      const room = await roomService.getRoomById(roomId);

      if (!room) {
        this.logAction(
          `Room found but no details available: ${this.location} (ID: ${roomId})`
        );
        throw new Error(`Room details not found: ${this.location}`);
      }

      if (!room.rasp_ip) {
        this.logAction(
          `Room found but no Raspberry Pi IP set: ${this.location} (ID: ${roomId})`
        );
        throw new Error(`Raspberry Pi IP not found for room: ${this.location}`);
      }

      this.logAction(
        `Found Raspberry Pi IP for ${this.location}: ${room.rasp_ip}`
      );
      logger.info(
        `Resolved Raspberry Pi IP: ${room.rasp_ip} for ${this.location}`
      );

      return room.rasp_ip;
    } catch (error) {
      this.logAction(`Error getting Raspberry Pi IP: ${error.message}`);

      // Fallback to configuration file
      try {
        const configPath = path.join(
          __dirname,
          "../../../api/endpoint/rasp_pi.json"
        );
        this.logAction(`Looking for fallback IP in config: ${configPath}`);

        const configData = await fs.readFile(configPath, "utf8");
        const config = JSON.parse(configData);

        // Get the first IP from the config as a fallback
        const allIps = Object.keys(config);

        if (allIps.length === 0) {
          this.logAction(`No IPs found in config file. Cannot proceed.`);
          throw new Error("No Raspberry Pi IPs available in fallback config");
        }

        const firstIp = allIps[0];
        this.logAction(
          `Using fallback Raspberry Pi IP: ${firstIp} (from config with ${allIps.length} IPs)`
        );

        // Log all available IPs for debugging
        allIps.forEach((ip, index) => {
          this.logAction(`Config IP #${index + 1}: ${ip} -> ${config[ip]}`);
        });

        return firstIp;
      } catch (fallbackError) {
        this.logAction(`Fallback failed: ${fallbackError.message}`);
        throw error; // Throw the original error
      }
    }
  }

  /**
   * Get Light ID for a room
   * @returns {Promise<string>} The Light ID
   */
  async getLightId() {
    try {
      // Use the environment variable for the light ID or room-specific mapping
      logger.debug(`Retrieving Light ID for ${this.location}`);

      return process.env.DEFAULT_LIGHT_ID || "1";
    } catch (error) {
      this.logAction(`Error getting Light ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert color name to Hue color parameters
   * @param {string} colorName - The name of the color
   * @returns {Object|null} Hue color parameters or null if not recognized
   */
  convertColorToHueParams(colorName) {
    logger.debug(`Converting color to Hue params: ${colorName}`);

    if (!colorName) return null;

    // Simple color mapping - in a real implementation, this would be more comprehensive
    const colorMap = {
      red: { hue: 0, sat: 254 },
      green: { hue: 25500, sat: 254 },
      blue: { hue: 46920, sat: 254 },
      yellow: { hue: 12750, sat: 254 },
      purple: { hue: 53000, sat: 254 },
      pink: { hue: 56100, sat: 254 },
      orange: { hue: 5000, sat: 254 },
      white: { hue: 34000, sat: 50 },
    };

    return colorMap[colorName.toLowerCase()] || null;
  }

  /**
   * Execute the Light action
   * @param {Object} context - Additional context for the execution
   * @returns {Promise<object>} The result of the action execution
   */
  async execute(context = {}) {
    try {
      logger.info(`Executing Light action: ${this.name} (${this.location})`);

      this.logAction(`Executing Light action for ${this.name}`);

      // Get Raspberry Pi IP for the room
      const raspPiIP = await this.getRoomRaspberryPi();

      // Get Light ID for the room (or use device_id if set during creation)
      const lightId = 'e3cd3456-4cc1-4526-a56e-18f7db068616';

      // Get current light state to determine if change is needed
      try {
        const { getLightState } = require("../../../api/hue");
        const currentState = await getLightState(raspPiIP, lightId);
        
        if (currentState && currentState.success && currentState.lightState) {
          const isCurrentlyOn = currentState.lightState.on === true;
          logger.debug(
            `Current light state is ${isCurrentlyOn}, desired state is ${this.state}`
          );

          // If current state already matches desired state, no action needed
          if (isCurrentlyOn === this.state) {
            this.logAction(
              `Light is already ${this.state ? "on" : "off"}, no action needed`
            );

            return {
              success: true,
              message: `Light in ${this.location} already ${
                this.state ? "on" : "off"
              }`,
              noChange: true,
            };
          }

          this.logAction(
            `State change needed: current=${isCurrentlyOn}, target=${this.state}`
          );
        }
      } catch (stateCheckError) {
        // If we can't check the state, continue with the command to be safe
        this.logAction(
          `Could not verify light state: ${stateCheckError.message}, proceeding with command`
        );
      }

      // Execute the light state change via Hue API - only changing on/off state
      const result = await switchLightState(lightId, this.state, raspPiIP);

      if (result.success) {
        // Update the device state in the registry - only tracking on/off state
        const ActionRegistry = require("./ActionRegistry");
        ActionRegistry.updateDeviceState(
          lightId,
          { state: this.state },
          "light"
        );

        this.logAction(
          `Successfully set ${this.name} to ${this.state ? "on" : "off"}`
        );
        return {
          success: true,
          message: `Light in ${this.location} set to ${
            this.state ? "on" : "off"
          }`,
          deviceId: lightId,
        };
      } else {
        const errorMessage = result.message || "Unknown error";
        this.logAction(`Failed to set ${this.name} state: ${errorMessage}`);
        return {
          success: false,
          message: `Failed to set Light in ${this.location}: ${errorMessage}`,
          deviceId: lightId,
        };
      }
    } catch (error) {
      this.logAction(`Error executing Light action: ${error.message}`);
      return {
        success: false,
        message: `Error setting Light in ${this.location}: ${error.message}`,
      };
    }
  }
}

module.exports = LightAction;