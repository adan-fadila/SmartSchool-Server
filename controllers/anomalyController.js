// Handle anomaly detection response
const fs = require('fs');
const path = require('path');

const handleAnomalyResponse = (req, res) => {
  try {
    const { anomalies, plot_image } = req.body; // JSON payload sent by Python script

    // Ensure anomalies and plot_image are received
    if (!anomalies || !plot_image) {
      return res.status(400).json({ message: 'Anomalies or image data missing' });
    }

    console.log("Received anomalies:", anomalies);

    // Step 1: Process the image data
    const imageBuffer = Buffer.from(plot_image, 'base64');
    const imagePath = path.join(__dirname, 'anomaly_plot.png');

    // Save the image to the filesystem
    fs.writeFile(imagePath, imageBuffer, (err) => {
      if (err) {
        console.error('Error saving the image:', err);
        return res.status(500).json({ message: 'Error saving the image' });
      }
      console.log('Image saved successfully at', imagePath);
      
      // Step 2: Process anomalies (e.g., store in DB, log, etc.)
      // You can store anomalies in your database, or log them to the console for debugging
      // For now, we just log them:
      console.log("Processing anomalies...");
      
      // Sending response after processing image and anomalies
      res.status(200).json({
        message: 'Data received and image saved successfully',
        anomalies: anomalies,  // Send anomalies back as part of the response if needed
      });
    });

  } catch (error) {
    console.error("Error handling anomalies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { handleAnomalyResponse };
