const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write to server.logs file
        new winston.transports.File({
            filename: path.join(__dirname, 'server.logs'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Also log to console in development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Handle uncaught exceptions
logger.exceptions.handle(
    new winston.transports.File({ 
        filename: path.join(__dirname, 'exceptions.logs')
    })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (ex) => {
    throw ex;
});

module.exports = logger;
