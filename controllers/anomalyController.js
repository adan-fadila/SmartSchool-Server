// Handle anomaly detection response
const fs = require('fs');
const path = require('path');
const { broadcastAnomalyData, clients } = require('../ws');

// Create a state object to store temporary data
let anomalyState = {
  anomalies: null,
  plot_image: null,
  collective_plot: null,
  timestamp: null
};

const handleAnomalyResponse = (req, res) => {
  try {
    const { anomalies, plot_image } = req.body;
    //console.log(req.body);

    if (!anomalies || !plot_image) {
      return res.status(400).json({ message: 'Anomalies or image data missing' });
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

module.exports = { handleAnomalyResponse ,handleCollectiveAnomalyResponse};
