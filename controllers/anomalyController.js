// Handle anomaly detection response
const fs = require('fs');
const path = require('path');
const { broadcastAnomalyData, clients } = require('../ws');
const EventRegistry = require('../interpreter/src/events/EventRegistry');
const interpreterService = require('../interpreter/src/server-integration');
// Import the configurations from handlersController
const { configurations } = require('./handlersController');

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
  timestamp: null,
  // Add fields to hold determined config details
  roomId: null,
  spaceId: null,
  roomName: null
};

// Helper function to find config based on location name
function findConfigByLocation(locationName) {
    if (!locationName || !configurations) return null;
    const lowerLocationName = locationName.toLowerCase().trim();
    return configurations.find(config => 
        config.roomName && config.roomName.toLowerCase().trim() === lowerLocationName
    );
}

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
    console.log("Full anomaly request body structure:");
    console.log(JSON.stringify(req.body, null, 2));
    
    const { anomalies, plot_image, name } = req.body;

    if (!anomalies || !plot_image) {
      return res.status(400).json({ message: 'Anomalies or image data missing' });
    }

    let determinedRoomId = null;
    let determinedSpaceId = null;
    let determinedLocationName = null; 

    // --- Determine Room/Space ID based on Anomaly Name or Metric Name ---
    let potentialLocationName = null;
    if (name) {
        const nameParts = name.split('_');
        if (nameParts.length >= 3) {
            potentialLocationName = nameParts.slice(0, -2).join(' ');
            console.log(`Parsed location from name '${name}': ${potentialLocationName}`);
        }
    } else if (req.body.metric_name) {
        const metricParts = req.body.metric_name.split(' ');
        if (metricParts.length > 1) {
            const lastPart = metricParts[metricParts.length - 1].toLowerCase();
            if (['temperature', 'humidity','motion'].includes(lastPart)) {
                potentialLocationName = metricParts.slice(0, -1).join(' ');
                console.log(`Parsed location from metric_name '${req.body.metric_name}': ${potentialLocationName}`);
            }
        }
    }

    if (potentialLocationName) {
        const matchedConfig = findConfigByLocation(potentialLocationName);
        if (matchedConfig) {
            determinedRoomId = matchedConfig.roomId;
            determinedSpaceId = matchedConfig.spaceId;
            determinedLocationName = matchedConfig.roomName; // Use the canonical name from config
            console.log(`Matched config: RoomID=${determinedRoomId}, SpaceID=${determinedSpaceId}, RoomName=${determinedLocationName}`);
        } else {
            console.log(`Could not find configuration matching location: ${potentialLocationName}`);
        }
    }

    // Fallback if still not determined (maybe from req.body if sent directly?)
    if (!determinedRoomId && req.body.roomId) determinedRoomId = req.body.roomId;
    if (!determinedSpaceId && req.body.spaceId) determinedSpaceId = req.body.spaceId;
    if (!determinedLocationName && req.body.location) determinedLocationName = req.body.location;
    // --- End Room/Space ID Determination ---

    // Log the name field if it exists and update interpreter
    if (name) {
      console.log("Anomaly name:", name);
      updateInterpreterAnomalyEvent(name, true, req.body);
    } else {
      console.log("No name field found in the anomaly data");
      
      // Try to find the name in another format
      const possibleNames = [];
      
      // Check for metric_name + anomaly_type
      if (req.body.metric_name && req.body.anomaly_type) {
        const constructedName = `${potentialLocationName || 'unknown'} ${req.body.metric_name.split(' ').pop()} ${req.body.anomaly_type} Anomaly`;
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

    // Update the temporary state object with all data, including determined IDs
    const currentStateForBroadcast = {
        anomalies: anomalies,
        plot_image: plot_image,
        collective_plot: anomalyState.collective_plot, // Include if it arrived earlier
        timestamp: new Date().toISOString(),
        name: name, 
        metric_name: req.body.metric_name, 
        anomaly_type: req.body.anomaly_type, 
        roomId: determinedRoomId, // Use determined ID
        spaceId: determinedSpaceId, // Use determined ID
        location: determinedLocationName // Use determined Name
    };

    // Save the image
    const imageBuffer = Buffer.from(plot_image, 'base64');
    const imagePath = path.join(__dirname, 'anomaly_plot.png');
    
    fs.writeFile(imagePath, imageBuffer, (err) => {
      if (err) {
        console.error('Error saving the image:', err);
      } else {
        console.log("anomaly_plot.png saved");
      }
      console.log("anomalies received");
      console.log("================================================");
      
      // Broadcast immediately using the prepared state object
      console.log('Broadcasting individual anomaly data to WebSocket clients...');
      broadcastAnomalyData(currentStateForBroadcast);
      
      // Update the shared state *only* with collective_plot if it was present
      // The individual data has been broadcast
      anomalyState.collective_plot = currentStateForBroadcast.collective_plot;

      res.status(200).json({
        message: 'Data received, image saved (if successful), and broadcast attempted.'
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

    // Save collective plot to the shared state
    anomalyState.collective_plot = collective_plot;

    // Save the collective plot image
    const collective_plot_img = Buffer.from(collective_plot, 'base64');
    const collective_plot_path = path.join(__dirname, 'collective_plot.png');
    
    fs.writeFile(collective_plot_path, collective_plot_img, (err) => {
      if (err) {
        console.error('Error saving the collective image:', err);
      } else {
          console.log("collective_plot.png saved");
      }

      // Do NOT broadcast from here anymore, as individual data is sent immediately
      // The frontend can decide how to handle the arrival of collective_plot later if needed
      // (e.g., via a separate message type or polling)
      console.log('Collective plot received and saved. No immediate broadcast from here.');

      res.status(200).json({
        message: 'Collective plot data received and image saved (if successful).'
      });
    });
  } catch (error) {
    console.error("Error handling collective anomalies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { handleAnomalyResponse, handleCollectiveAnomalyResponse };
