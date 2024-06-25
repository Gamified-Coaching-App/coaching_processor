import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb , writeSubjectiveParamsToDb, getContinousWorkoutData, getLoadTargetInference , insertLoadTargetsToDb, insertTrainingPlansToDb, getUserIdFromJwt , getTrainingPlan, getAllUsers } from './utils.mjs';
import { buildWorkouts } from './workoutBuilder/workoutBuilder.mjs';
import moment from 'moment';
import cors from 'cors';

const dynamoDbClient = new DynamoDBClient({ region: 'eu-west-2' }); 

const app = express();
app.use(express.json({ limit: '200mb' }));

const corsOptions = {
    origin: '*',
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
};


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

app.post('/gettrainingplans', async (req, res) =>{
    let activeUsers = req.body.userIds;
    let nonActiveUsers = null;

    if (activeUsers === undefined) {
        res.status(400).send({ message: "Missing userIds in request body" });
        return;
    }
    if (activeUsers === "all") {
        const allUsers = await getAllUsers(dynamoDbClient);
        activeUsers = allUsers.active;
        nonActiveUsers = allUsers.nonActive;
        console.log("Add training plans for active users: ", activeUsers);
        console.log("Add training plans for non active users: ", nonActiveUsers);
    }
    if (!Array.isArray(activeUsers)) {
        try {
            activeUsers = JSON.parse(userIds);
        } catch (e) {
            res.status(400).send({ message: "userIds must be an array" });
            return;
        }
    }
    res.status(200).send({ message: "Processing started" });
    const yesterdayTimestamp = moment().subtract(1, 'days').format('YYYY-MM-DD');
    if (activeUsers.length !== 0) {
        const data = await getContinousWorkoutData(dynamoDbClient, { userIds : activeUsers, startDate : yesterdayTimestamp });
        const { loadTargets, timestamp } = await getLoadTargetInference(data);
        console.log("Load targets: ", loadTargets);
        const trainingPlans = buildWorkouts(loadTargets, nonActiveUsers);
        await insertTrainingPlansToDb(dynamoDbClient, { trainingPlans, timestamp } );
        await insertLoadTargetsToDb(dynamoDbClient, { loadTargets, timestamp } );
    } else {
        const loadTargets = null;
        const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
        const trainingPlans = buildWorkouts(loadTargets, nonActiveUsers);
        await insertTrainingPlansToDb(dynamoDbClient, { trainingPlans, timestamp } );
    }  
});

app.options('/frontend', cors(corsOptions)); 
app.get('/frontend', cors(corsOptions), async(req, res) => {
    const jwt = req.headers.authorization?.split(' ')[1];
    if (!jwt) {
        console.error("JWT token is missing in Authorization header");
        return;
    }
    const userId = getUserIdFromJwt(jwt);
    if (!userId) {
        return res.status(400).send({ message: "Error getting userId from JWT" });
    }
    try {
        const workoutPlan = await getTrainingPlan(dynamoDbClient, userId);
        res.status(200).send({ workoutPlan });
      } catch (error) {
        console.error('Error fetching workout plan:', error);
        res.status(500).send({ message: 'Error fetching workout plan' });
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