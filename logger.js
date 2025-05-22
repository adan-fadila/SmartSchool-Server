const winston = require('winston');
const path = require('path');

// Create a utility for safe stringification of objects
const safeStringify = (obj) => {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object' && typeof obj !== 'function') return String(obj);
  
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      // Handle functions
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
      }
      return value;
    }, 2);
  } catch (err) {
    return `[Object: serialization failed (${err.message})]`;
  }
};

// Create a custom format for pretty console output
const prettyConsoleFormat = winston.format.printf(({ level, message, timestamp, component, ...rest }) => {
  const componentStr = component ? `[${component}] ` : '';
  let metaStr = '';
  
  // Remove metadata field as it's redundant with rest
  const { metadata, ...cleanRest } = rest;
  
  // Format metadata if present
  if (Object.keys(cleanRest).length > 0) {
    metaStr = `\n${safeStringify(cleanRest)}`;
  }
  
  return `${timestamp} ${level}: ${componentStr}${message}${metaStr}`;
});

// Define log format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define log format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  prettyConsoleFormat
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'app-service' },
  transports: [
    // Write to main log file
    new winston.transports.File({
      filename: path.join(__dirname, 'server.logs'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Also log errors to a separate file
    new winston.transports.File({
      filename: path.join(__dirname, 'error.logs'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Console output for development
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Add detailed debug log file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, 'debug.logs'),
    level: 'debug',
    maxsize: 10485760, // 10MB
    maxFiles: 3
  }));
}

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(__dirname, 'exceptions.logs')
  })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (ex) => {
  logger.error('Unhandled Promise Rejection', { error: ex });
  throw ex;
});

// Add helpful utility methods to the logger

/**
 * Get a component-specific logger
 * @param {string} componentName - The name of the component
 * @returns {Object} A logger instance that includes the component name
 */
logger.getComponentLogger = function(componentName) {
  return {
    error: (message, meta = {}) => logger.error(message, { ...meta, component: componentName }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, component: componentName }),
    info: (message, meta = {}) => logger.info(message, { ...meta, component: componentName }),
    http: (message, meta = {}) => logger.http(message, { ...meta, component: componentName }),
    verbose: (message, meta = {}) => logger.verbose(message, { ...meta, component: componentName }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, component: componentName }),
    silly: (message, meta = {}) => logger.silly(message, { ...meta, component: componentName })
  };
};

/**
 * Log a state transition (before/after)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} options - Options including before, after, and any additional metadata
 */
logger.logStateChange = function(level, message, { before, after, ...meta }) {
  const beforeStr = safeStringify(before);
  const afterStr = safeStringify(after);
  
  logger.log(level, message, {
    ...meta,
    stateChange: {
      before,
      after,
      changed: beforeStr !== afterStr
    }
  });
};

/**
 * Log method entry with parameters
 * @param {string} methodName - The name of the method
 * @param {Object} params - Method parameters
 * @param {Object} meta - Additional metadata
 */
logger.methodEntry = function(methodName, params = {}, meta = {}) {
  logger.debug(`Entering ${methodName}`, {
    ...meta,
    method: methodName,
    params
  });
};

/**
 * Log method exit with result
 * @param {string} methodName - The name of the method
 * @param {*} result - Method result
 * @param {number} duration - Execution duration in ms
 * @param {Object} meta - Additional metadata
 */
logger.methodExit = function(methodName, result, duration, meta = {}) {
  logger.debug(`Exiting ${methodName}`, {
    ...meta,
    method: methodName,
    duration,
    result
  });
};

/**
 * Start a timed operation for performance tracking
 * @param {string} operationName - Name of the operation
 * @param {Object} meta - Additional metadata
 * @returns {Function} A function to call when operation completes
 */
logger.startTimer = function(operationName, meta = {}) {
  const startTime = process.hrtime();
  
  return (result) => {
    const duration = process.hrtime(startTime);
    const durationMs = (duration[0] * 1000) + (duration[1] / 1000000);
    
    logger.debug(`Operation ${operationName} completed`, {
      ...meta,
      operation: operationName,
      durationMs: Math.round(durationMs),
      result
    });
    
    return durationMs;
  };
};

module.exports = logger;