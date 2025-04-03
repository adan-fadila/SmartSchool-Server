const {sensorControllers} = require('../controllers/sensorController');
const {handleControllers} = require('../controllers/handlersController');
// No longer need interpreterSensorController for this route
// const { interpreterSensorController } = require('../controllers/interpreterSensorController'); 
const {Router} = require("express");
const sensorRouter = new Router();

// GET /sensor from All configured Rassparypis
sensorRouter.get('/sensors-all-locations', sensorControllers.getSensorsByLocation);

// GET /sensor from Rassparypi
sensorRouter.get('/sensors', sensorControllers.getSensor);
sensorRouter.get('/motion-state', handleControllers.get_MotionState);
sensorRouter.get('/sensibo', sensorControllers.get_SensiboAC_State);
sensorRouter.get('/temperature', sensorControllers.get_Temperature);

// GET /sensor from Sensibo (Duplicate - removed one)
// sensorRouter.get('/sensibo', sensorControllers.get_SensiboAC_State); 
// sensorRouter.get('/temperature', sensorControllers.get_Temperature);


// POST
sensorRouter.post('/motion-detected', handleControllers.update_Motion_DetectedState);
sensorRouter.post('/action', sensorControllers.TurnON_OFF_LIGHT);
sensorRouter.post('/sensibo', sensorControllers.TurnON_OFF_AC);

module.exports = { sensorRouter };