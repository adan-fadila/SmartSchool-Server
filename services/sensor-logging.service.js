const fs = require("fs").promises;
const path = require("path");
const { createWriteStream, existsSync, mkdirSync } = require("fs");
const fsSync = require("fs");

/**
 * Service to handle logging of sensor data to files
 */
const sensorLoggingService = {
  logFilePath: null,
  logStream: null,
  columnMap: new Map(), // Maps event names to column indices
  spaceIdColumn: null, // Index of the spaceId column
  isLoggingEnabled: true,

  /**
   * Initialize the logging service
   * @param {Array<string>} eventNames - Array of event names to use as columns
   * @returns {Promise<Object>} Result object with success status
   */
  async initialize(eventNames) {
    try {
      // Log the initialization
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Initializing sensor logging service\n`
      );

      // Create logs directory if it doesn't exist
      const logsDir = path.join(__dirname, "../logs");
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      // Use a fixed filename instead of date-based files
      this.logFilePath = path.join(logsDir, "sensor_data.csv");

      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Log file path: ${this.logFilePath}\n`
      );
      console.log(`Initializing sensor logging to file: ${this.logFilePath}`);
      console.log("eventNames is ::: ", eventNames);

      // Add light_state column to the event names if it doesn't exist
      if (!eventNames.includes("light_state")) {
        eventNames.push("light_state");
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Added light_state column to event names\n`
        );
        console.log("Added light_state column to event names");
      }

      if (!eventNames.includes("ac_state")) {
        eventNames.push("ac_state");
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Added ac_state column to event names\n`
        );
        console.log("Added ac_state column to event names");
      }

      // Check if file already exists
      const fileExists = existsSync(this.logFilePath);

      // We'll add spaceId as a column
      const headers = ["timestamp", ...eventNames, "spaceId"];

      if (!fileExists) {
        // Create header row with timestamp, event names, and spaceId
        const header = headers.join(","); // No newline at the end
        fsSync.writeFileSync(this.logFilePath, header); // Use writeFileSync instead of appendFileSync
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Created new log file with header: ${header}\n`
        );
        console.log("Created new sensor log file with headers");
      } else {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Using existing log file\n`
        );
        console.log("Existing sensor log file found, checking format");

        // Read existing file to ensure compatibility and remove any trailing newlines
        let data = await fs.readFile(this.logFilePath, "utf8");

        // Check for and remove any trailing newlines
        while (data.endsWith("\n") || data.endsWith("\r\n")) {
          data = data.slice(0, data.lastIndexOf("\n"));
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${new Date().toISOString()}: Removed trailing newline from file\n`
          );
        }

        // Write the cleaned file back
        await fs.writeFile(this.logFilePath, data);

        // Split by newline to get headers
        const lines = data.split("\n");
        const existingHeader = lines[0];
        const expectedHeader = headers.join(",");

        if (existingHeader !== expectedHeader) {
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${new Date().toISOString()}: Warning: Header mismatch\n`
          );
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${new Date().toISOString()}: Existing: ${existingHeader}\n`
          );
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${new Date().toISOString()}: Expected: ${expectedHeader}\n`
          );

          console.warn(
            "Warning: Existing log file header does not match current events"
          );
          console.warn(`Existing: ${existingHeader}`);
          console.warn(`Expected: ${expectedHeader}`);
        }
      }

      // Create column map for faster lookups
      this.columnMap.clear();
      // First column (index 0) is timestamp
      eventNames.forEach((name, index) => {
        this.columnMap.set(name, index + 1); // +1 because timestamp is at index 0
      });

      // Set the spaceId column index (last column)
      this.spaceIdColumn = eventNames.length + 1;

      // We'll close any existing stream before creating a new one
      if (this.logStream) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${new Date().toISOString()}: Closing existing log stream before creating new one\n`
        );
        this.logStream.end();
      }

      // We won't use the stream for writing, but keep it for compatibility
      this.logStream = {
        writable: true,
        end: function () {
          this.writable = false;
        },
      };
      this.isLoggingEnabled = true;

      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: Logging enabled\n`
      );

      return {
        success: true,
        message: `Sensor logging initialized to ${this.logFilePath}`,
        columns: Array.from(this.columnMap.entries()),
      };
    } catch (error) {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: ERROR initializing: ${error.message}\n`
      );
      console.error("Error initializing sensor logging:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Log sensor data to the file
   * @param {Array<Object>} sensorData - Array of sensor data objects with name and value
   * @returns {Object} Result object with success status
   */
  logSensorData(sensorData) {
    try {
      const timestamp = new Date().toISOString();
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: logSensorData called with ${sensorData.length} sensors\n`
      );

      // Check if logging is disabled
      if (!this.isLoggingEnabled) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: WARNING - Logging is disabled but logSensorData was called\n`
        );

        // Attempt to re-initialize with existing events
        if (this.columnMap.size > 0) {
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${timestamp}: Attempting to re-initialize logging with existing events\n`
          );
          const eventNames = Array.from(this.columnMap.keys());
          this.initialize(eventNames).then((result) => {
            fsSync.appendFileSync(
              "./logs/sensor_debug.log",
              `${timestamp}: Re-initialization result: ${JSON.stringify(
                result
              )}\n`
            );
          });
        } else {
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${timestamp}: Cannot re-initialize, no event names in columnMap\n`
          );
          return {
            success: false,
            error: "Logging is disabled and cannot re-initialize automatically",
          };
        }
      }

      // Check if logging is initialized
      if (!this.logFilePath) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: ERROR - Logging service not initialized (logFilePath is null)\n`
        );
        return {
          success: false,
          error: "Logging service not initialized",
        };
      }

      // Get current timestamp for the log entry
      const date = new Date();
      // Format timestamp as YYYY-MM-DD HH:MM:SS
      const formattedTimestamp = date
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d+Z$/, "");

      // Debug the column map
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Column map has ${
          this.columnMap.size
        } columns: ${JSON.stringify(Array.from(this.columnMap.entries()))}\n`
      );

      // Create an array for the row data, initialized with empty values
      // Add 2 to total columns: one for timestamp, one for spaceId
      const totalColumns = this.columnMap.size + 2;
      const rowData = new Array(totalColumns).fill("");
      rowData[0] = formattedTimestamp; // Set timestamp

      // Check if all sensors have the same spaceId
      let spaceId = null;
      let allSameSpaceId = true;

      // First, check if all sensors have the same spaceId
      sensorData.forEach((sensor) => {
        if (sensor.spaceId) {
          if (spaceId === null) {
            spaceId = sensor.spaceId;
          } else if (spaceId !== sensor.spaceId) {
            allSameSpaceId = false;
          }
        }
      });

      // If all sensors have the same spaceId, set it in the spaceId column
      if (spaceId !== null && allSameSpaceId) {
        rowData[this.spaceIdColumn] = spaceId;
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Setting spaceId column ${this.spaceIdColumn} to ${spaceId}\n`
        );
      } else {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Multiple or no spaceIds found in sensor data\n`
        );
      }

      // Fill in values for sensors we have data for
      sensorData.forEach((sensor) => {
        const columnIndex = this.columnMap.get(sensor.name);
        if (columnIndex !== undefined) {
          rowData[columnIndex] = sensor.value;
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${timestamp}: Setting column ${columnIndex} (${sensor.name}) to ${sensor.value}\n`
          );
        } else {
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${timestamp}: WARNING - Unknown sensor name: ${sensor.name}, not in column map\n`
          );
          console.warn(
            `Unknown sensor name: ${sensor.name}, not in column map`
          );
        }
      });

      // Format the row string (without newline at the end yet)
      const rowStr = rowData.join(",");
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Preparing row: ${rowStr}\n`
      );

      try {
        // Read the current file content
        let currentContent = "";
        if (fsSync.existsSync(this.logFilePath)) {
          currentContent = fsSync.readFileSync(this.logFilePath, "utf8");

          // Remove any trailing newlines to ensure clean append
          while (
            currentContent.endsWith("\n") ||
            currentContent.endsWith("\r\n")
          ) {
            currentContent = currentContent.slice(
              0,
              currentContent.lastIndexOf("\n")
            );
            fsSync.appendFileSync(
              "./logs/sensor_debug.log",
              `${timestamp}: Removed trailing newline from file for clean append\n`
            );
          }
        }

        // Determine if we need to add a newline before our row
        const needsNewline = currentContent.length > 0;

        // Write the entire file content with the new row
        const newContent = currentContent + (needsNewline ? "\n" : "") + rowStr;
        fsSync.writeFileSync(this.logFilePath, newContent);

        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Successfully wrote to log file using writeFileSync\n`
        );
      } catch (writeError) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: ERROR writing to log file: ${writeError.message}\n`
        );
        return {
          success: false,
          error: `Error writing to log file: ${writeError.message}`,
        };
      }

      return {
        success: true,
        message: "Sensor data logged successfully",
      };
    } catch (error) {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: EXCEPTION in logSensorData: ${
          error.message
        }\n`
      );
      console.error("Error logging sensor data:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Close the log stream
   * @returns {Object} Result object with success status
   */
  close() {
    try {
      const timestamp = new Date().toISOString();
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Closing sensor logging service\n`
      );

      if (this.logStream) {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: Closing log stream\n`
        );
        this.logStream.end();
        this.logStream = null;
        this.isLoggingEnabled = false;
        console.log("Sensor logging stream closed");
      } else {
        fsSync.appendFileSync(
          "./logs/sensor_debug.log",
          `${timestamp}: No log stream to close\n`
        );
      }

      // Check and remove any trailing newlines in the CSV file
      if (this.logFilePath && fsSync.existsSync(this.logFilePath)) {
        try {
          let data = fsSync.readFileSync(this.logFilePath, "utf8");

          // Remove any trailing newlines
          let modified = false;
          while (data.endsWith("\n") || data.endsWith("\r\n")) {
            data = data.slice(0, data.lastIndexOf("\n"));
            modified = true;
          }

          if (modified) {
            fsSync.writeFileSync(this.logFilePath, data);
            fsSync.appendFileSync(
              "./logs/sensor_debug.log",
              `${timestamp}: Removed trailing newlines during shutdown\n`
            );
          }
        } catch (cleanupError) {
          fsSync.appendFileSync(
            "./logs/sensor_debug.log",
            `${timestamp}: Error cleaning up file during shutdown: ${cleanupError.message}\n`
          );
        }
      }

      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${timestamp}: Logging stopped at ${timestamp}\n`
      );

      return {
        success: true,
        message: "Sensor logging closed successfully",
      };
    } catch (error) {
      fsSync.appendFileSync(
        "./logs/sensor_debug.log",
        `${new Date().toISOString()}: ERROR closing: ${error.message}\n`
      );
      console.error("Error closing sensor logging:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

module.exports = sensorLoggingService;
