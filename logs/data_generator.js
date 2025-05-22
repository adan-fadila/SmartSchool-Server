const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');

/**
 * Generate sensor data with the specified pattern
 * @param {number} numRows - Number of rows to generate
 * @param {string} spaceId - Space ID to use for all rows
 * @returns {Array} List of rows with timestamp, temperature, humidity, motion, and space_id
 */
function generateSensorData(numRows, spaceId = "41413915") {
  // Define the temperature and humidity pattern from the example data
  const tempHumidPattern = [
    [18.8, 68.5], [32.2, 51.0], [50.1, 28.5], [67.7, 20.8], [71.9, 20.1],
    [63.1, 20.8], [47.5, 26.4], [36.2, 35.5], [32.2, 39.9], [29.6, 43.6],
    [32.4, 44.4], [45.2, 29.7], [56.9, 22.7], [61.7, 21.2], [64.8, 20.4],
    [63.7, 20.6], [45.2, 27.0], [37.8, 32.9], [32.7, 38.7], [30.4, 41.1],
    [34.9, 39.7], [49.6, 26.0], [60.8, 21.0], [68.2, 19.5], [73.1, 19.0],
    [69.6, 19.0], [53.4, 22.3], [44.0, 27.3], [38.3, 31.3], [34.7, 34.3],
    [39.2, 33.3], [58.9, 20.7], [68.8, 18.5], [74.9, 18.3], [78.7, 18.2],
    [81.2, 18.3], [84.5, 18.5], [85.6, 18.4], [86.3, 18.3], [86.5, 18.2],
    [86.7, 18.2], [86.9, 18.2], [86.4, 18.2], [86.3, 18.2], [86.6, 18.2],
    [86.9, 18.2], [86.9, 18.2]
  ];
  
  // Ensure we have enough temperature/humidity pairs by cycling through the pattern
  let extendedPattern = [...tempHumidPattern];
  while (extendedPattern.length < numRows) {
    extendedPattern = extendedPattern.concat(tempHumidPattern);
  }
  const pattern = extendedPattern.slice(0, numRows);
  
  // Create rows with 5 true motion values followed by 5 false, repeating
  const rows = [];
  const startTime = moment();
  
  for (let i = 0; i < numRows; i++) {
    // Set timestamp (increment by ~2 minutes each row)
    const timestamp = moment(startTime).add(i * 2, 'minutes').format('YYYY-MM-DD HH:mm:ss');
    
    // Get temperature and humidity from pattern
    const [temp, humidity] = pattern[i];
    
    // Set motion value (5 true followed by 5 false, repeating)
    const motion = Math.floor(i / 5) % 2 === 0 ? "true" : "false";
    
    // Create row
    rows.push({
      timestamp: timestamp,
      'living room temperature': temp.toString(),
      'living room humidity': humidity.toString(),
      'living room motion': motion,
      spaceId: spaceId
    });
  }
  
  return rows;
}

/**
 * Add custom rows of data with specified values
 * @param {Array} data - Existing data to append to (can be empty array)
 * @param {number} numRows - Number of custom rows to add
 * @param {Object} customValues - Object where keys are column names and values are the custom values to set.
 *                               For timestamp, use "auto" to auto-generate timestamps
 * @param {number} timeIncrementMinutes - Minutes to increment between rows if auto-generating timestamps
 * @param {string} spaceId - Default space ID if not specified in customValues
 * @returns {Array} Updated list of data rows with custom rows appended
 */
function addCustomRows(data, numRows, customValues = {}, timeIncrementMinutes = 2, spaceId = "41413915") {
  // Determine start time for timestamps
  let startTime;
  
  if (data && data.length > 0) {
    // Use the last timestamp from existing data if available
    try {
      startTime = moment(data[data.length - 1].timestamp, 'YYYY-MM-DD HH:mm:ss')
        .add(timeIncrementMinutes, 'minutes');
    } catch (error) {
      startTime = moment();
    }
  } else {
    startTime = moment();
  }
  
  const newRows = [];
  
  for (let i = 0; i < numRows; i++) {
    // Initialize default row values
    const timestamp = moment(startTime).add(i * timeIncrementMinutes, 'minutes').format('YYYY-MM-DD HH:mm:ss');
    
    // Create default row
    const row = {
      timestamp: timestamp,
      'living room temperature': "22.0",  // Default temperature
      'living room humidity': "50.0",     // Default humidity
      'living room motion': "false",      // Default motion
      spaceId: spaceId                    // Default space_id
    };
    
    // Apply custom values for this row
    for (const [key, value] of Object.entries(customValues)) {
      if (key === 'timestamp' && value === "auto") {
        // Auto timestamp already set
        continue;
      } else if (key === 'living room motion' && typeof value === 'boolean') {
        // Convert boolean to string for motion
        row[key] = value ? "true" : "false";
      } else {
        row[key] = value.toString();
      }
    }
    
    newRows.push(row);
  }
  
  // Append new rows to existing data
  return [...data, ...newRows];
}

/**
 * Create a CSV file with sensor data
 * @param {string} filename - Name of the CSV file to create
 * @param {number} numRows - Number of rows to generate
 * @param {string} spaceId - Space ID to use for all rows
 * @param {Array} customRows - List of objects, each defining custom rows to add.
 * @param {boolean} appendMode - If true, append to existing file instead of creating new
 * @returns {Promise} Promise that resolves when the file is written
 */
async function createCsvFile(filename, numRows, spaceId = "41413915", customRows = null, appendMode = false) {
  // Generate the data
  let rows = generateSensorData(numRows, spaceId);
  
  // Add any custom rows if specified
  if (customRows) {
    for (const customConfig of customRows) {
      rows = addCustomRows(
        rows, 
        customConfig.numRows || 1,
        customConfig.values || {},
        customConfig.timeIncrement || 2,
        spaceId
      );
    }
  }
  
  // If in append mode and file exists, get existing data first
  if (appendMode && fs.existsSync(filename)) {
    const existingData = await readCsvFile(filename);
    rows = [...existingData, ...rows];
  }
  
  // Create CSV writer
  const csvWriter = createCsvWriter({
    path: filename,
    header: [
      { id: 'timestamp', title: 'timestamp' },
      { id: 'living room temperature', title: 'living room temperature' },
      { id: 'living room humidity', title: 'living room humidity' },
      { id: 'living room motion', title: 'living room motion' },
      { id: 'spaceId', title: 'spaceId' }
    ],
    append: appendMode && fs.existsSync(filename)
  });
  
  // Write to file
  await csvWriter.writeRecords(rows);
  
  console.log(`${appendMode ? 'Appended to' : 'Created'} CSV file '${filename}' with ${rows.length} rows of sensor data`);
}

/**
 * Read data from a CSV file
 * @param {string} filename - Name of the CSV file to read
 * @returns {Promise<Array>} Promise that resolves with an array of data rows
 */
function readCsvFile(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filename)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Append custom rows to an existing CSV file
 * @param {string} filename - Name of the CSV file to append to
 * @param {number} numRows - Number of custom rows to add
 * @param {Object} customValues - Object mapping column names to values
 * @param {number} timeIncrementMinutes - Minutes to increment between timestamps
 * @param {boolean} createIfNotExists - If true, create file if it doesn't exist
 * @returns {Promise} Promise that resolves when the operation is complete
 */
async function appendCustomDataToCsv(filename, numRows, customValues = {}, timeIncrementMinutes = 2, createIfNotExists = true) {
  try {
    // Check if file exists
    let existingData = [];
    
    if (fs.existsSync(filename)) {
      existingData = await readCsvFile(filename);
    } else if (createIfNotExists) {
      // Create a new file with headers only
      const csvWriter = createCsvWriter({
        path: filename,
        header: [
          { id: 'timestamp', title: 'timestamp' },
          { id: 'living room temperature', title: 'living room temperature' },
          { id: 'living room humidity', title: 'living room humidity' },
          { id: 'living room motion', title: 'living room motion' },
          { id: 'spaceId', title: 'spaceId' }
        ]
      });
      await csvWriter.writeRecords([]); // Write empty records to create file with header
    } else {
      console.log(`Error: File '${filename}' not found and createIfNotExists is false.`);
      return;
    }
    
    // Add custom rows
    const newData = addCustomRows(existingData, numRows, customValues, timeIncrementMinutes);
    
    // Write only the new rows back to the file
    const rowsToAdd = newData.slice(existingData.length);
    
    const csvWriter = createCsvWriter({
      path: filename,
      header: [
        { id: 'timestamp', title: 'timestamp' },
        { id: 'living room temperature', title: 'living room temperature' },
        { id: 'living room humidity', title: 'living room humidity' },
        { id: 'living room motion', title: 'living room motion' },
        { id: 'spaceId', title: 'spaceId' }
      ],
      append: true
    });
    
    await csvWriter.writeRecords(rowsToAdd);
    
    console.log(`Appended ${numRows} custom rows to '${filename}'`);
  } catch (error) {
    console.error('Error appending custom data:', error);
  }
}

// Main execution
async function main() {
  // You can modify these variables as needed
  const outputFile = "sensor_data.csv";
  const numRows = 100;  // Change this to the number of rows you want
  const spaceId = "41413915";
  
  // Example 1: Create a new file with standard data
//   await createCsvFile(outputFile, numRows, spaceId);
  
  // Example 2: Create a file with both standard and custom data
  /*
  const customRowsConfig = [
    {
      numRows: 5,
      values: {
        'living room temperature': 90.0,  // Set temperature to 90.0
        'living room humidity': 10.0,     // Set humidity to 10.0
        'living room motion': "true"      // Set motion to true
      },
      timeIncrement: 5  // 5 minutes between timestamps
    },
    {
      numRows: 3,
      values: {
        'living room temperature': 15.0,  // Cold temperature
        'living room humidity': 85.0,     // High humidity
        'living room motion': "false"     // No motion
      }
    }
  ];
  await createCsvFile("mixed_data.csv", 10, spaceId, customRowsConfig);
  */
  
  // Example 3: Append custom data to an existing file
  
  await appendCustomDataToCsv(
    outputFile, 
    100, 
    {
      'timestamp': "auto",                // Auto-generate timestamps
      'living room temperature': 35.5,    // Temperature
      'living room humidity': 45.0,       // Humidity
      'living room motion': false,         // Motion (as boolean)
      'spaceId': "41413915"        // Custom space ID
    },
    10
  );
  
}

// Run the main function
main().catch(console.error);