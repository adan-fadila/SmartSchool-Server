import { EventEmitter } from 'events';

export const eventEmitter = new EventEmitter();

let tempws;
if (window.location.protocol === "https:") {
    tempws = new WebSocket('wss://smartspaceshenkar.duckdns.org/ws'); // Use nginx proxy path    
    // tempws = new WebSocket('ws://localhost:8002'); // for development
} else {
    tempws = new WebSocket('ws://smartspaceshenkar.duckdns.org/ws'); // Use nginx proxy path
    // tempws = new WebSocket('ws://localhost:8002'); // for development
}
export const ws = tempws;

ws.addEventListener('open', () => {
    console.log('WebSocket connected successfully');
    console.log('WebSocket readyState:', ws.readyState);
});

ws.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.addEventListener('message', (event) => {
    try {
        const message = JSON.parse(event.data);
        console.log("Message type:", message.type);

        if (message.type === 'anomaly_update') {
            // Create a clean copy of the data without any image data
            const { plot_image, collective_plot, ...cleanData } = message.data;

            console.log("=== ANOMALY UPDATE RECEIVED ===");
            console.log("Anomaly type:", cleanData.anomalyType);
            console.log("Location:", cleanData.location);
            console.log("Sensor type:", cleanData.sensorType);
            console.log("Space ID:", cleanData.spaceId);
            console.log("Room ID:", cleanData.roomId);
            console.log("Timestamp:", cleanData.timestamp);
            console.log("Number of anomalies:", cleanData.anomalies?.length || 0);
            console.log("Anomalies data:", cleanData.anomalies);
            console.log("Has plot image:", !!plot_image);
            console.log("Has collective plot:", !!collective_plot);
            console.log("Complete anomaly name:", cleanData.completeAnomalyName);
            console.log("Raw event name:", cleanData.rawEventName);
            console.log("=== END ANOMALY UPDATE ===");
            
            const spaceId = String(message.data.spaceId);
            const roomId = String(message.data.roomId);
            
            eventEmitter.emit('anomalyUpdate', {
                ...message.data,
                plotImage: message.data.plot_image,
                collectivePlot: message.data.collective_plot,
                deviceType: message.data.sensorType,
                roomId: roomId,
                spaceId: spaceId,
                timestamp: message.data.timestamp,
                anomalies: message.data.anomalies,
                rawEventName: message.data.rawEventName,
                completeAnomalyName: message.data.completeAnomalyName,
                anomalyType: message.data.anomalyType
            });
        } 
        else if (message.type === 'recommendation_update') {
            console.log("Processing recommendation update with data:", message.data);
            console.log("Recommendations structure:", message.data.recommendations);
            
            if (!message.data.recommendations) {
                console.error("No recommendations found in message data");
                return;
            }
            
            const transformedRecommendations = [];
            
            for (const [device, recommendations] of Object.entries(message.data.recommendations)) {
                if (!Array.isArray(recommendations)) {
                    console.error(`Recommendations for ${device} is not an array:`, recommendations);
                    continue;
                }
                
                console.log(`Processing device: ${device}`, recommendations);
                recommendations.forEach(rec => {
                    if (!rec.recommendation || !rec.recommended_time) {
                        console.error(`Invalid recommendation format for ${device}:`, rec);
                        return;
                    }
                    
                    const transformed = {
                        id: `${device}_${rec.recommendation}_${rec.recommended_time}`.replace(/\s+/g, '_'),
                        device: device.replace(/_/g, ' '),
                        normalized_rule: `Turn ${rec.recommendation} during ${rec.recommended_time}`,
                        is_new: true
                    };
                    console.log("Transformed recommendation:", transformed);
                    transformedRecommendations.push(transformed);
                });
            }
            
            if (transformedRecommendations.length === 0) {
                console.warn("No recommendations were transformed");
                return;
            }
            
            console.log("Final transformed recommendations:", transformedRecommendations);
            eventEmitter.emit('recommendationUpdate', transformedRecommendations);
        }
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
        console.error('Raw message that caused error:', event.data);
    }
});

ws.addEventListener('close', () => {
    console.error('WebSocket connection closed');
}); 