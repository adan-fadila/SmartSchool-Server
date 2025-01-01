// Handle recommendation response
const handleRecommendationResponse = (req, res) => {
    try {
        const recommendations = req.body; // JSON payload sent by Python script
        console.log("Received recommendations:", recommendations);

        // Process the recommendations as needed
        // e.g., store in database, log them, or trigger further actions

        res.status(200).json({ message: "Recommendations received successfully!" });
    } catch (error) {
        console.error("Error handling recommendations:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { handleRecommendationResponse };
