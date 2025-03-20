const interpreterSensorService = require('../services/interpreter-sensor.service');

/**
 * Controller for handling the integration between sensors and the interpreter system
 */
const interpreterSensorController = {
  /**
   * Manually trigger an update from Sensibo sensors to update events
   */
  updateEventsFromSensibo: async (req, res) => {
    try {
      const { raspPiIP } = req.body;
      
      if (!raspPiIP) {
        return res.status(400).json({
          success: false,
          error: 'Raspberry Pi IP address is required'
        });
      }
      
      const result = await interpreterSensorService.updateEventsFromSensibo(raspPiIP);
      
      if (!result.success) {
        return res.status(500).json(result);
      }
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating events from Sensibo:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Start periodic polling of sensor data
   */
  startSensorPolling: async (req, res) => {
    try {
      const { raspPiIP, interval } = req.body;
      
      if (!raspPiIP) {
        return res.status(400).json({
          success: false,
          error: 'Raspberry Pi IP address is required'
        });
      }
      
      const pollingInterval = interval ? parseInt(interval) : 30000;
      
      const result = interpreterSensorService.startSensorPolling(raspPiIP, pollingInterval);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error starting sensor polling:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Stop periodic polling of sensor data
   */
  stopSensorPolling: async (req, res) => {
    try {
      const result = interpreterSensorService.stopSensorPolling();
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error stopping sensor polling:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = { interpreterSensorController }; 