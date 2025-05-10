const express = require('express');
const router = express.Router();
const lightController = require('../controllers/light.controller');

/**
 * @route GET /api/lights/state/:lightId
 * @desc Get the current state of a specific light
 * @access Public
 */
router.get('/state/:lightId', lightController.getLightState);

/**
 * @route PUT /api/lights/switch
 * @desc Switch a light on or off
 * @access Public
 */
router.put('/switch', lightController.switchLightState);

module.exports = router;