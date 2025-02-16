const StateManager = require('../src/core/managers/StateManager');
const { getSensiboSensors, loadConfig } = require('../api/sensibo');
const Room = require('../models/Room');
const Device = require('../models/Device');
const RoomDevice = require('../models/RoomDevice');
const SystemManager = require('../src/core/managers/SystemManager');
const RuleModel = require('../src/core/models/RuleModel');
const { execute } = require('../interpeter/src/execute/execute');
const { processData } = require('../interpeter/src/interpreter/interpreter');
const fs = require('fs');
const path = require('path');

// Global variables
let motionState = false; // This should reflect the real motion state, possibly stored in a database
let RoomID = '';
let RoomName = '';
let SpaceID = '';
let DeviceID = '';
let clientIp = '';
let _User_Oid = '';
let Person = '';

// Create single instances of managers
const stateManager = new StateManager();
const systemManager = new SystemManager();

// List of configurations for each room and device
const configurations = [
  {
    roomId: '41413915-5245',
    roomName: 'Living Room',
    spaceId: '41413915',
    deviceId: 'JArdX73w',
    raspberryPiIP: '192.168.0.121',
    user_oid: '6648b1dd3da69ac2341e4e36',
  },
  // {
  //   roomId: '67822610-8768',
  //   roomName: 'Class246',
  //   spaceId: '67822610',
  //   deviceId: 'YNahUQcM',
  //   raspberryPiIP: '10.0.0.9',
  //   user_oid: '6648b1dd3da69ac2341e4e36',
  // },
  // Add more configurations as needed
];

// Export the systemManager instance
exports.systemManager = systemManager;

// Function to get Raspberry Pi configuration
function getRaspberryPiConfig(raspberryPiIP) {
  const configPath = path.join(__dirname, '../api/endpoint/rasp_pi.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config[raspberryPiIP];
}

// Export the handlers
exports.handleControllers = {
  async get_MotionState(req, res) {
    res.status(200).json({
      motionDetected: motionState,
      ROOM_ID: RoomID,
      Room_NAME: RoomName,
      SPACE_ID: SpaceID,
      DEVICE_ID: DeviceID,
      CLIENT_IP: clientIp,
      _User_Oid_: _User_Oid,
    });
  },

  async initialize(req, res) {
    try {
      if (!configurations || configurations.length === 0) {
        throw new Error('No configurations provided');
      }

      console.log('Starting system initialization...');
      
      // First, ensure all rules in the database are active for this room
      const roomId = '41413915-5245'; // Living Room ID
      await RuleModel.updateMany(
        { roomId: roomId },
        { $set: { isActive: true } }
      );

      // Then initialize the system
      await systemManager.initialize(configurations);
      
      // Verify rules are loaded
      const activeRules = await RuleModel.find({ 
        roomId: roomId,
        isActive: true 
      });
      console.log(`Found ${activeRules.length} rules for room ${roomId}:`, 
        activeRules.map(r => r.ruleString));
      
      res.status(200).json({ 
        message: 'System initialized successfully',
        configurations: configurations,
        activeRules: activeRules
      });
    } catch (error) {
      console.error('Initialization error:', error);
      res.status(500).json({ 
        error: error.message,
        details: 'Failed to initialize system'
      });
    }
  },

  async update_Motion_DetectedState(req, res) {
    try {
      const { state: lightState, room_id: roomId, room_name: roomName, space_id: spaceId, device_id: deviceId, raspberry_pi_ip: raspberryPiIP, control: Control, user: user_oid } = req.body;

      console.log('Received request to turn', lightState, 'for Room ID:', roomId, 'for Room Name:', roomName, 'in Space ID:', spaceId, 'using Device ID:', deviceId, 'from Raspberry Pi:', raspberryPiIP, 'control:', Control, 'user:', user_oid);

      // Validate the state before processing
      if (lightState !== 'on' && lightState !== 'off') {
        return res.status(400).json({ error: `Invalid light state: ${lightState}` });
      }

      if (Control === 'auto') {
        // Handle through new system
        systemManager.handleMotionEvent({
          lightState,
          roomId,
          roomName,
          spaceId,
          deviceId,
          raspberryPiIP,
          user_oid
        });

        res.status(200).json({ 
          message: `Motion event processed for ${roomName}`,
          state: lightState 
        });
      } else if (Control === 'manual') {
        motionState = lightState === 'on';
        // Update the room's 'motionDetected' field
        await Room.updateOne({ id: roomId }, { $set: { motionDetected: motionState } });
        console.log(`Simulated light turned ${lightState} for Room ID: ${roomId}`);

        // Update the specific device's state
        await Device.updateOne({ device_id: deviceId }, { $set: { state: lightState } });
        console.log(`Device state updated for Device ID: ${deviceId}`);

        // Additionally, update the RoomDevice state
        await RoomDevice.updateOne({ room_id: roomId, device_id: deviceId }, { $set: { state: lightState } });

        // Send final response
        res.status(200).json({ message: `Light turned ${lightState}, request received successfully`, motionState });
      }
    } catch (error) {
      console.error('Error in motion update:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Combined function to update temperature and humidity state
  async updateSensorData(roomId, roomName, spaceId, deviceId, raspberryPiIP) {
    try {
      // Get sensor data from Raspberry Pi
      const sensorData = await getSensiboSensors(raspberryPiIP);
      if (!sensorData) {
        console.error('No sensor data received from', raspberryPiIP);
        return;
      }

      // Update state through SystemManager
      await systemManager.handleTemperatureEvent({
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        roomId,
        roomName,
        spaceId
      });

      console.log(`Updated sensor data for room ${roomName}`);
    } catch (error) {
      console.error('Error updating sensor data:', error);
    }
  },

  // Function to start updating state for all configurations
  startUpdatingStateForAll(configurations) {
    configurations.forEach(config => {
      setInterval(async () => {
        await this.updateSensorData(
          config.roomId,
          config.roomName,
          config.spaceId,
          config.deviceId,
          config.raspberryPiIP
        );
      }, 5000);
    });
  },

  // Add rule management methods
  async addRule(req, res) {
    try {
      const { ruleString, deviceId, raspberryPiIP, roomId, spaceId } = req.body;
      await systemManager.saveRule(ruleString, deviceId, raspberryPiIP, roomId, spaceId);
      res.status(200).json({ message: 'Rule added successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getRules(req, res) {
    try {
      const rules = await RuleModel.find({ isActive: true });
      
      // Filter out invalid rules
      const validRules = rules.filter(rule => rule && rule.ruleString);
      
      if (validRules.length === 0) {
        return res.json({ rules: [], message: 'No active rules found' });
      }
      
      res.status(200).json({ rules: validRules });
    } catch (error) {
      console.error('Error fetching rules:', error);
      res.status(500).json({ 
        error: 'Failed to fetch rules',
        details: error.message 
      });
    }
  }
};

// Start updating state for all configurations
exports.handleControllers.startUpdatingStateForAll(configurations);
