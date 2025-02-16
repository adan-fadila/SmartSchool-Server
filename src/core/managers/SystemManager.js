const EventManager = require('./EventManager');
const MotionSensor = require('../sensors/MotionSensor');
const TemperatureSensor = require('../sensors/TemperatureSensor');
const MotionRule = require('../rules/MotionRule');
const TemperatureRule = require('../rules/TemperatureRule');
const LightAction = require('../actions/LightAction');
const ACAction = require('../actions/ACAction');
const MotionEvent = require('../events/MotionEvent');
const TemperatureEvent = require('../events/TemperatureEvent');
const Room = require('../../../models/Room');
const RuleParser = require('../parser/RuleParser');
const RuleModel = require('../models/RuleModel');
const EventValidator = require('../validators/EventValidator');
const StateManager = require('./StateManager');
const { execute } = require('../../../interpeter/src/execute/execute');
const { processData } = require('../../../interpeter/src/interpreter/interpreter');
const { switchAcState } = require('../../../api/sensibo');
const RoomDevice = require('../../../models/RoomDevice');
const { getAcState } = require('../../../api/sensibo');

class SystemManager {
    constructor() {
        this.eventManager = new EventManager();
        this.sensors = new Map();
        this.initialized = false;
        this.stateManager = new StateManager();
        this.lastExecutedActions = new Map(); // Track last executed actions per device
    }

    async initialize(configurations) {
        try {
            console.log('Initializing SystemManager with configurations:', configurations);
            this.configurations = configurations;

            // Load and verify rules for each configuration
            for (const config of configurations) {
                const rules = await RuleModel.find({
                    roomId: config.roomId,
                    isActive: true
                });
                
                console.log(`Loaded ${rules.length} rules for room ${config.roomName}:`,
                    rules.map(r => r.ruleString));

                // If no rules exist, create a default temperature rule
                if (rules.length === 0) {
                    const defaultRule = new RuleModel({
                        ruleString: `If temp > 12 in ${config.roomName} then AC on 16`,
                        deviceId: config.deviceId,
                        raspberryPiIP: config.raspberryPiIP,
                        roomId: config.roomId,
                        spaceId: config.spaceId,
                        isActive: true
                    });
                    await defaultRule.save();
                    console.log(`Created default rule for ${config.roomName}:`, defaultRule.ruleString);
                }
            }
            
            console.log('SystemManager initialized successfully');
        } catch (error) {
            console.error('Error initializing SystemManager:', error);
            throw error;
        }
    }

    async handleMotionEvent(data) {
        try {
            EventValidator.validateMotionEvent(data);
            const { lightState, roomId, roomName, spaceId } = data;
            
            console.log(`Processing motion event for room ${roomName}: ${lightState}`);
            
            const motionEvent = new MotionEvent(
                spaceId,
                roomId,
                roomName,
                lightState === 'on'
            );
            
            await this.eventManager.emitEvent(motionEvent);
            console.log(`Motion event processed successfully for ${roomName}`);
            
            // Update state
            this.stateManager.updateRoomState(roomId, { 
                motionDetected: lightState === 'on',
                lastUpdated: new Date()
            });
            
        } catch (error) {
            console.error(`Error handling motion event: ${error.message}`);
            throw error;
        }
    }

    async handleTemperatureEvent(event) {
        try {
            console.log('Received temperature event:', event);
            EventValidator.validateTemperatureEvent(event);
            
            // Update state
            this.stateManager.updateRoomState(event.roomId, {
                temperature: event.temperature,
                humidity: event.humidity
            });

            const rules = await RuleModel.find({ 
                roomId: event.roomId,
                isActive: true 
            });
            console.log(`Found ${rules.length} active rules for room ${event.roomId}`);

            for (const rule of rules) {
                console.log('Processing rule:', rule.ruleString);
                const ruleObj = RuleParser.parseRule(rule.ruleString);
                
                if (ruleObj.condition.type === 'temperature') {
                    const threshold = parseFloat(ruleObj.condition.threshold);
                    const currentTemp = parseFloat(event.temperature);
                    
                    console.log(`Evaluating temperature condition: ${currentTemp} > ${threshold}`);
                    const conditionMet = currentTemp > threshold;

                    if (conditionMet) {
                        // Create an action signature
                        const actionSignature = JSON.stringify({
                            state: 'on',
                            temperature: ruleObj.action.temperature
                        });

                        // Get last executed action for this device
                        const lastAction = this.lastExecutedActions.get(rule.deviceId);
                        
                        // Check if this action is different from the last one
                        if (lastAction !== actionSignature) {
                            console.log('Executing new action, different from last executed');
                            try {
                                const result = await switchAcState(
                                    'on',
                                    rule.raspberryPiIP,
                                    rule.deviceId,
                                    { temperature: ruleObj.action.temperature }
                                );
                                console.log('AC control result:', result);

                                // Update database state after successful control
                                if (result.success) {
                                    await RoomDevice.updateOne(
                                        { device_id: rule.deviceId },
                                        { 
                                            $set: { 
                                                state: 'on',
                                                temperature: ruleObj.action.temperature,
                                                lastUpdated: new Date()
                                            } 
                                        }
                                    );
                                    // Store this action as the last executed
                                    this.lastExecutedActions.set(rule.deviceId, actionSignature);
                                    console.log('Action executed and stored as last action');
                                }
                            } catch (error) {
                                console.error('Error controlling AC:', error);
                            }
                        } else {
                            console.log('Skipping action execution - same as last executed action');
                        }
                    }
                }
            }

            console.log(`Temperature event processed successfully for ${event.roomName}`);
        } catch (error) {
            console.error('Error handling temperature event:', error);
            throw error;
        }
    }

    async saveRule(ruleString, deviceId, raspberryPiIP, roomId, spaceId) {
        try {
            // First add the rule to the sensor
            await this.addRule(ruleString, deviceId, raspberryPiIP);
            
            // Then save to database
            const rule = new RuleModel({
                ruleString,
                deviceId,
                raspberryPiIP,
                roomId,
                spaceId,
                isActive: true
            });
            
            await rule.save();
            return true;
        } catch (error) {
            console.error('Error saving rule:', error);
            throw error;
        }
    }

    async loadRules() {
        try {
            const rules = await RuleModel.find({ isActive: true });
            for (const rule of rules) {
                await this.addRule(
                    rule.ruleString,
                    rule.deviceId,
                    rule.raspberryPiIP
                );
            }
        } catch (error) {
            console.error('Error loading rules:', error);
            throw error;
        }
    }
}

module.exports = SystemManager; 