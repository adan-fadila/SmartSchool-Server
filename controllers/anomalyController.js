// Handle anomaly detection response
const fs = require('fs');
const path = require('path');
const { broadcastAnomalyData, clients } = require('../ws');
const EventRegistry = require('../interpreter/src/events/EventRegistry');
const interpreterService = require('../interpreter/src/server-integration');

// Initialize the interpreter if not already initialized
(async function() {
  try {
    if (!interpreterService.isInterpreterInitialized()) {
      console.log('Initializing interpreter for anomaly controller...');
      await interpreterService.initializeInterpreter();
      console.log('Interpreter initialized successfully');
    } else {
      console.log('Interpreter already initialized');
    }
  } catch (error) {
    console.error('Failed to initialize interpreter:', error);
  }
})();

// Create a state object to store temporary data
let anomalyState = {
  anomalies: null,
  plot_image: null,
  collective_plot: null,
  timestamp: null
};

/**
 * Helper function to update an anomaly event in the interpreter
 * @param {string} eventName - The name of the anomaly event
 * @param {boolean} detected - Whether the anomaly is detected or not
 * @param {Object} data - Additional data to include in the update
 * @returns {boolean} Success status
 */
function updateInterpreterAnomalyEvent(eventName, detected, data = {}) {
  try {
    if (!interpreterService.isInterpreterInitialized()) {
      console.log('Interpreter not initialized, cannot update anomaly event');
      return false;
    }
    
    console.log(`Trying to update interpreter anomaly event: ${eventName} (detected=${detected})`);
    
    // Look for the event in the EventRegistry
    const event = EventRegistry.getEvent(eventName);
    
    if (!event) {
      console.log(`Event '${eventName}' not found in EventRegistry. Available events:`);
      const allEvents = EventRegistry.getAllEvents();
      const anomalyEvents = allEvents.filter(e => e.type === 'anomaly');
      console.log(`Found ${anomalyEvents.length} anomaly events out of ${allEvents.length} total events`);
      anomalyEvents.forEach(e => console.log(`- ${e.name}`));
      return false;
    }
    
    if (event.type !== 'anomaly') {
      console.log(`Event '${eventName}' is not an anomaly event (type: ${event.type})`);
      return false;
    }
    
    // Update the event state
    console.log(`Updating anomaly event '${eventName}' to detected=${detected}`);
    event.updateAnomalyState(detected, {
      ...data,
      updatedViaFlask: true,
      timestamp: Date.now()
    });
    
    console.log(`Successfully updated anomaly event '${eventName}'`);
    return true;
  } catch (error) {
    console.error('Error updating anomaly event in interpreter:', error);
    return false;
  }
}

const handleAnomalyResponse = (req, res) => {
  try {
    // Log the entire request body structure
    console.log("Full anomaly request body structure:");
    console.log(JSON.stringify(req.body, null, 2));
    
    const { anomalies, plot_image, name } = req.body;

    if (!anomalies || !plot_image) {
      return res.status(400).json({ message: 'Anomalies or image data missing' });
    }

    // Log the name field if it exists
    if (name) {
      console.log("Anomaly name:", name);
      
      // Check if this anomaly event exists in the interpreter and update its state
      updateInterpreterAnomalyEvent(name, true, req.body);
    } else {
      console.log("No name field found in the anomaly data");
      
      // Try to find the name in another format
      const possibleNames = [];
      
      // Check for metric_name + anomaly_type
      if (req.body.metric_name && req.body.anomaly_type) {
        const constructedName = `${req.body.metric_name} ${req.body.anomaly_type} Anomaly`;
        possibleNames.push(constructedName);
        console.log("Constructed name:", constructedName);
      }
      
      // Check if the first anomaly has a date field - the data might be an array
      if (Array.isArray(anomalies) && anomalies.length > 0 && anomalies[0].date) {
        // This is likely the anomaly points array
        // Find all anomalies with is_anomaly = true
        const detectedAnomalies = anomalies.filter(a => a.is_anomaly === true);
        
        if (detectedAnomalies.length > 0) {
          console.log(`Found ${detectedAnomalies.length} detected anomalies in the array`);
          
          // If we have a name field in the req.body, use it to update the interpreter
          if (req.body.name) {
            console.log("Using name from request body:", req.body.name);
            updateInterpreterAnomalyEvent(req.body.name, true, {
              anomalies: detectedAnomalies,
              confidence: detectedAnomalies.length > 0 ? 
                Math.max(...detectedAnomalies.map(a => a.anomaly_score || 0)) / 5 : 0, // Normalize confidence
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.log("No detected anomalies found in the array");
        }
      }
      
      // Try each possible name
      for (const possibleName of possibleNames) {
        updateInterpreterAnomalyEvent(possibleName, true, req.body);
      }
    }

    // If name is in another location or format, try to extract it
    if (req.body.metric_name) {
      console.log("Metric name:", req.body.metric_name);
    }
    
    if (req.body.anomaly_type) {
      console.log("Anomaly type:", req.body.anomaly_type);
    }

    // Update state
    anomalyState.anomalies = anomalies;
    anomalyState.plot_image = plot_image;
    anomalyState.timestamp = new Date().toISOString();

    // Save the image
    const imageBuffer = Buffer.from(plot_image, 'base64');
    const imagePath = path.join(__dirname, 'anomaly_plot.png');
    
    fs.writeFile(imagePath, imageBuffer, (err) => {
      if (err) {
        console.error('Error saving the image:', err);
        return res.status(500).json({ message: 'Error saving the image' });
      }
      console.log("anomaly_plot.png saved");
      console.log("anomalies received");
      console.log("================================================");
      console.log(anomalies);
      // Check if we have all necessary data to broadcast
      if (anomalyState.collective_plot) {
        broadcastAnomalyData(anomalyState);
        // Reset state after broadcasting
        anomalyState = {
          anomalies: null,
          plot_image: null,
          collective_plot: null,
          timestamp: null
        };
      }

      res.status(200).json({
        message: 'Data received and image saved successfully'
      });
    });
  } catch (error) {
    console.error("Error handling anomalies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const handleCollectiveAnomalyResponse = (req, res) => {
  try {
    const { collective_plot } = req.body;

    if (!collective_plot) {
      return res.status(400).json({ message: 'image data missing' });
    }

    // Update state
    anomalyState.collective_plot = collective_plot;

    const collective_plot_img = Buffer.from(collective_plot, 'base64');
    const collective_plot_path = path.join(__dirname, 'collective_plot.png');
    
    fs.writeFile(collective_plot_path, collective_plot_img, (err) => {
      if (err) {
        console.error('Error saving the collective image:', err);
        return res.status(500).json({ message: 'Error saving the collective image' });
      }

      // Check if we have all necessary data to broadcast
      if (anomalyState.anomalies && anomalyState.plot_image) {
        broadcastAnomalyData(anomalyState);
        // Reset state after broadcasting
        anomalyState = {
          anomalies: null,
          plot_image: null,
          collective_plot: null,
          timestamp: null
        };
      }

      res.status(200).json({
        message: 'collective Data received and image saved successfully'
      });
    });
  } catch (error) {
    console.error("Error handling collective anomalies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { handleAnomalyResponse, handleCollectiveAnomalyResponse };
