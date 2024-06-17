import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb  } from './utils.mjs';

const dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' }); 

const app = express();
app.use(express.json({ limit: '200mb' }));


app.post('/workout', async (req, res) => {
    // Immediately acknowledge the request
    res.status(200).send({ message: "Processing started" });

    let heartRateZones;
    try {
        // Asynchronously get user's heart rate zones from the database
        heartRateZones = await getHeartRateZones(dynamoDbClient, req.body.userId);
    } catch (error) {
        console.error("Error fetching heart rate zones:", error);
        return;
        
    }

    let kmPerZone = null;
    if (req.body.activityType === "RUNNING") {
        try {
            // Calculate km per zone only if the activity type is RUNNING
            kmPerZone = getKmPerHeartRateZone(heartRateZones, req.body.heartRates, req.body.distances);
        } catch (error) {
            console.error("Error calculating km per heart rate zone:", error);
            return;
        }
    }
    try {
        await writeWorkoutToDb(dynamoDbClient, req.body.userId, req.body.sessionId, req.body.activityType, req.body.duration, kmPerZone);
        console.log("Workout processed successfully");
    } catch (error) {
        console.error("Error writing workout to database:", error);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'Healthy' });
});

// Listen on port 80
app.listen(80, () => {
    console.log('Server running on port 80');
});