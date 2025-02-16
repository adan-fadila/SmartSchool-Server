const express = require('express');
const router = express.Router();
const { handleControllers, systemManager } = require('../controllers/handlersController');
const RuleModel = require('../src/core/models/RuleModel');

// System initialization
router.post('/system/initialize', handleControllers.initialize);

// Motion detection endpoints
router.post('/motion/update', handleControllers.update_Motion_DetectedState);
router.get('/motion/state', handleControllers.get_MotionState);

// Manual control endpoints
router.post('/device/control', handleControllers.TurnON_OFF_LIGHT);

// Sensor data endpoints
router.post('/sensors/update', async (req, res) => {
    try {
        const { roomId, roomName, spaceId, deviceId, raspberryPiIP } = req.body;
        
        if (!roomId || !raspberryPiIP) {
            return res.status(400).json({ 
                error: 'Missing required fields: roomId and raspberryPiIP are required' 
            });
        }

        await handleControllers.updateSensorData(
            roomId, 
            roomName, 
            spaceId, 
            deviceId, 
            raspberryPiIP
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error in sensor update endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// System state
router.get('/state/:roomId', (req, res) => {
    const state = systemManager.stateManager.getRoomState(req.params.roomId);
    res.json(state || {});
});

// Rule management
router.post('/rules', handleControllers.addRule);
router.get('/rules', handleControllers.getRules);

module.exports = router; 