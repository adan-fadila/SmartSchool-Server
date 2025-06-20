// imports
const express = require("express");
const cors    = require('cors');
const connectDB = require("./config");
const { connectToWs } = require("./ws.js");
const server = express();
const bodyParser = require('body-parser');

const port = process.env.PORT || 3000;
require("dotenv").config();
require('./statemanager/stateManager')

const testRouter = require('./routers/testRouter');  // Import the test router

// import Routers
const lightRoutes = require('./routers/light.routes');
const {devicesRouter} = require("./routers/devicesRouter");
const {loginRouter} = require("./routers/loginRouter");
const {sensorRouter} = require("./routers/sensorRouter");
const {ruleRouter} = require("./routers/ruleRouter");
const {roomRouter} = require("./routers/roomRouter");
const {spacesRouter} = require("./routers/spacesRouter");
const {suggestionsRouter} = require("./routers/suggestionsRouter");
const {mindolifeRouter} = require('./routers/gatewaysRouter');
const {activityRouter} = require('./routers/activityRouter');
const {calendarRouter} = require('./routers/calendarRouter');
const {endpointRouter} = require('./routers/endpointRouter');
const { recommendationRouter } = require('./routers/recommendationRouter.js');
const { anomalyRouter } = require('./routers/anomalyRouter');
const interpreterRouter = require('./routers/interpreter.router'); // Import the new interpreter router
const interpreterApiRouter = require('./routes/interpreter-api.routes'); // Import the interpreter API router
const actionRouter = require('./routers/action.router');
const eventRouter = require('./routers/event.router');
const anomalyEventsRouter = require('./routers/anomaly.router'); // Import the new anomaly events router
const anomalyDescriptionsRouter = require('./routes/anomaly-descriptions.routes'); // Import the new anomaly descriptions router


const testRaspiRouter = require('./routers/testRaspiRouter.js')


// Connect to MongoDB 
connectDB();
connectToWs();

// server.use(cookieParser());
/*server.use(cors({
    origin: [
      'https://smart-space-react-jj6p.vercel.app',
      'https://smartspaceshenkar.duckdns.org',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));*/
server.use(express.json());
server.use(express.urlencoded({extended: true}));  // hundel post reqs with body
server.use(bodyParser.json());


server.use('/api-test', testRouter);  // Add the test route
server.use('/api/lights', lightRoutes);

server.use('/api-login', loginRouter);
server.use('/api-device', devicesRouter);
server.use('/api-sensors', sensorRouter);
server.use('/api-rule', ruleRouter);
server.use('/api-room', roomRouter);
server.use('/api-space', spacesRouter);
server.use('/api-suggestion', suggestionsRouter);
server.use('/api-mindolife', mindolifeRouter);
server.use('/api-activities', activityRouter); 
server.use('/api-calendar', calendarRouter);
server.use('/api-endpoint', endpointRouter);
server.use(recommendationRouter);
server.use(anomalyRouter);
server.use('/api-testRaspiRouter',testRaspiRouter)

// Add explicit logging for the interpreter router
console.log('Registering interpreter router...');
server.use('/api-interpreter', interpreterRouter); // Add the interpreter router
console.log('Interpreter router registered');

// Add the interpreter API router - Fix the path to match the client endpoint
console.log('Registering interpreter API router...');
server.use('/api/interpreter', interpreterApiRouter); // Changed from '/api-interpreter-api' to '/api/interpreter'
console.log('Interpreter API router registered');

// Add the action router
console.log('Registering action router...');
server.use('/api-actions', actionRouter);
console.log('Action router registered');

// Add the event router
console.log('Registering event router...');
server.use('/api-events', eventRouter);
console.log('Event router registered');

// Add the anomaly events router
console.log('Registering anomaly events router...');
server.use('/api-anomalies', anomalyEventsRouter);
console.log('Anomaly events router registered');

// Add the anomaly descriptions router
console.log('Registering anomaly descriptions router...');
server.use('/api/anomaly-descriptions', anomalyDescriptionsRouter);
console.log('Anomaly descriptions router registered');

server.use((req, res) => {
    res.status(400).send('Something is broken!');
});
server.listen(port, () => console.log(`listening on port ${port}`));