import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb , writeSubjectiveParamsToDb } from './utils.mjs';

const dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' }); 

const app = express();
app.use(express.json({ limit: '200mb' }));


app.post('/workout', async (req, res) => {   
    const { userId, timestampLocal, sessionId, activityType, duration, heartRates, distances } = req.body;
  
    if (!userId || !sessionId || !timestampLocal || !activityType || !duration || !heartRates || !distances) {
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

    let kmPerHeartRateZone = null;
    if (req.body.activityType === "RUNNING") {
        try {
            kmPerHeartRateZone = getKmPerHeartRateZone(heartRateZones, heartRates, distances);
        } catch (error) {
            console.error("Error calculating km per heart rate zone:", error);
            return;
        }
    }
    try {
        await writeWorkoutToDb(dynamoDbClient, { userId : userId, timestampLocal : timestampLocal, activityType : activityType, sessionId : sessionId, duration : duration, kmPerHeartRateZone : kmPerHeartRateZone });
        console.log("Workout processed successfully");
    } catch (error) {
        console.error("Error writing workout to database:", error);
    }
});

app.post('/subjparams', async (req, res) => {
    const { userId, sessionId, timestampLocal, perceivedExertion, perceivedRecovery, perceivedTrainingSuccess } = req.body;
    console.log("Starting insertion of subjective parameters with request body: ", 
        "userId: ", userId, 
        ", sessionId: ", sessionId, 
        ", timestampLocal: ", timestampLocal, 
        ", perceivedExertion: ", perceivedExertion, 
        ", perceivedRecovery: ", perceivedRecovery, 
        ", perceivedTrainingSuccess: ", perceivedTrainingSuccess);
    if (!userId || !timestampLocal || !sessionId || 
        perceivedExertion === undefined || perceivedRecovery === undefined || perceivedTrainingSuccess === undefined) { 
        res.status(400).send({ message: "Missing required fields in request body" });
        return;
    }
    res.status(200).send({ message: "Processing started" });
    try {
        await writeSubjectiveParamsToDb(dynamoDbClient, { userId : userId, timestampLocal : timestampLocal, sessionId: sessionId, perceivedExertion : perceivedExertion, perceivedRecovery : perceivedRecovery, perceivedTrainingSuccess : perceivedTrainingSuccess});
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