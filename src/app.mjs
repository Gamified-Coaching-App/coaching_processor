import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb  } from './utils.mjs';

const dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' }); 

const app = express();
app.use(express.json({ limit: '200mb' }));


app.post('/workout', async (req, res) => {   
    const { userId, sessionId, activityType, duration, heartRates, distances } = req.body;
  
    if (!userId || !sessionId || !activityType || !duration || !heartRates || !distances) {
        console.log("Got this incomplete request body:", req.body);
        return res.status(400).send({ error: "Missing required fields in the request body" });
    }
    res.status(200).send({ message: "Processing started" });

    let heartRateZones;
    try {
        heartRateZones = await getHeartRateZones(dynamoDbClient, userId);
    } catch (error) {
        console.error("Error fetching heart rate zones:", error);
        return;
        
    }

    let kmPerZone = null;
    if (req.body.activityType === "RUNNING") {
        try {
            kmPerZone = getKmPerHeartRateZone(heartRateZones, heartRates, distances);
        } catch (error) {
            console.error("Error calculating km per heart rate zone:", error);
            return;
        }
    }
    try {
        await writeWorkoutToDb(dynamoDbClient, userId, sessionId, activityType, duration, kmPerZone);
        console.log("Workout processed successfully");
    } catch (error) {
        console.error("Error writing workout to database:", error);
    }
});

app.post('/subjparams', async (req, res) => {
    // Immediately acknowledge the request
    const { userId, timestampLocal, sessionId, perceivedExertion, perceivedRecovery, perceivedTrainingsSuccess } = req.body;

    if (!userId || !timestampLocal || !sessionId || perceivedExertion === undefined || perceivedRecovery === undefined || perceivedTrainingsSuccess === undefined) {
        console.error("Error: Missing required fields in the request body");
        res.status(400).send({ error: "Missing required fields in the request body" });
        return;
    }

    res.status(200).send({ message: "Processing started" });

    try {
        await writeSubjectiveParamsToDb(dynamoDbClient, { userId, timestampLocal, sessionId, perceivedExertion, perceivedRecovery, perceivedTrainingsSuccess});
        console.log("Successfully updated subjective parameters");
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