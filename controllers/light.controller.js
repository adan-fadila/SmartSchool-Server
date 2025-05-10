const lightService = require('../services/light.service');

/**
 * Get the state of a specific light
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Light state information
 */
exports.getLightState = async (req, res) => {
  try {
    const { lightId } = req.params;
    const { rasp_ip } = req.query;

    if (!lightId || !rasp_ip) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: lightId and rasp_ip are required'
      });
    }

    const lightState = await lightService.getLightState(rasp_ip, lightId);

    if (!lightState) {
      return res.status(404).json({
        success: false,
        message: 'Failed to retrieve light state or light not found'
      });
    }

    return res.status(200).json({
      success: true,
      lightState
    });
  } catch (error) {
    console.error('Error in getLightState controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while retrieving light state'
    });
  }
};

/**
 * Switch a light on or off
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Result of the operation
 */
exports.switchLightState = async (req, res) => {
  try {
    const { id, rasp_ip, state, brightness, color } = req.body;

    if (!id || !rasp_ip || state === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: id, rasp_ip, and state are required'
      });
    }

    // Convert state to boolean if it comes as a string
    const boolState = state === 'on' || state === true || state === 'true';

    const result = await lightService.switchLightState(id, boolState, rasp_ip, brightness, color);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message || 'Failed to update light state'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Light ${boolState ? 'turned on' : 'turned off'} successfully`,
      data: result.data
    });
  } catch (error) {
    console.error('Error in switchLightState controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while updating light state'
    });
  }
};