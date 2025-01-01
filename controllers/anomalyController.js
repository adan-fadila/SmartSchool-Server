// Handle anomaly detection response
const handleAnomalyResponse = (req, res) => {
  try {
      const anomalies = req.body; // JSON payload sent by Python script
      console.log("Received anomalies:", anomalies);

      // Process the anomalies as needed
      // e.g., store in database, log them, or trigger alerts

      res.status(200).json({ message: "Anomalies received successfully!" });
  } catch (error) {
      console.error("Error handling anomalies:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { handleAnomalyResponse };
