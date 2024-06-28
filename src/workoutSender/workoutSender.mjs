import { getHeartRateZones, getTrainingPlan } from '../utils.mjs';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { time } from 'console';
import moment from 'moment';
import { stat } from 'fs';
import { BatchGetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

async function createWorkout({ userAccessToken, userAccessTokenSecret, workoutString }) {
    const url = 'https://apis.garmin.com/training-api/workout';
    const method = 'POST';
    const signature = generateOAuthSignature({ url, method, userAccessToken, userAccessTokenSecret });
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': signature
            },
            body: JSON.stringify(workoutString)
        });

        if (!response.ok) {
            throw new Error(`HTTP error with Garmin! Status: ${response.status}, message: ${JSON.stringify(response)}`);
        }
        console.log("Workout created successfully");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

async function deleteWorkout({ userAccessToken, userAccessTokenSecret, workoutId }) {
    const url = 'https://apis.garmin.com/training-api/workout/' + workoutId;
    const method = 'DELETE';
    const signature = generateOAuthSignature({ url, method, userAccessToken, userAccessTokenSecret });

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': signature
            }
        });
        console.log("Deletion request for workout ", workoutId, ": Response status:", response.status);
        return response.ok;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

async function createSchedule({ userAccessToken, userAccessTokenSecret, workoutId , timestampLocal}) {
    console.log("Creating schedule with userAccessToken:", userAccessToken, "and userAccessTokenSecret:", userAccessTokenSecret, "for workoutId:", workoutId, "and timestamp:", timestampLocal);
    const url = 'https://apis.garmin.com/training-api/schedule';
    const method = 'POST';
    const signature = generateOAuthSignature({ url, method, userAccessToken, userAccessTokenSecret });

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': signature
            },
            body: JSON.stringify({
                "workoutId" : workoutId,
                "date" : timestampLocal
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error with Garmin at creating schedule ! Status: ${response.status}`);
        }
        const scheduleId = await response.json();
        return scheduleId;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

async function deleteSchedule({ userAccessToken, userAccessTokenSecret, scheduleId }) {
    const url = 'https://apis.garmin.com/training-api/schedule/' + scheduleId;
    const method = 'DELETE';
    const signature = generateOAuthSignature({ url, method, userAccessToken, userAccessTokenSecret });

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': signature
            }
        });
        console.log("Deletion request for schedule ", scheduleId, ": Response status:", response.status);
        return response.ok;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

const oauth = OAuth({
    consumer: {
        key: '72d9de28-9936-4fe8-9cd6-52f4b5e4fbdd',
        secret: 'VYSqkvdwyhMZxVJwzjb17sBOZPz6CAAnffe'
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
});

function generateOAuthSignature({ url, userAccessToken, userAccessTokenSecret, method }) {
    const requestData = {
        url: url,
        method: method,
    };
    const token = {
        key: userAccessToken,
        secret: userAccessTokenSecret
    };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    return authHeader["Authorization"];
}

async function getPartnerData(userIds) {
    const userIdsString = userIds.join(',');
    const url = `https://f53aet9v26.execute-api.eu-west-2.amazonaws.com/dev_1/get-partners-data?userIds=${userIdsString}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Partner data:", data);
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

async function sendWorkouts(userDataInput) {
    const userIds = userDataInput.map(userData => userData.userId); // Extract user IDs
    const partnerData = await getPartnerData(userIds);

    let responses = [];

    for (const userData of userDataInput) {
        const { userId, workout, timestampLocal } = userData;

        const garminData = partnerData[userId]?.garmin;
        if (!garminData) {
            console.error(`No Garmin data found for user ID: ${userId}`);
            responses.push({ userId, workoutId: null, scheduleId: null });
            continue;
        }

        const userAccessToken = garminData.partner_oauth_token;
        const userAccessTokenSecret = garminData.partner_token_secret;

        const responseWorkout = await createWorkout({
            userAccessToken,
            userAccessTokenSecret,
            workoutString: workout
        });
        const workoutId = responseWorkout.workoutId;

        const scheduleId = await createSchedule({
            userAccessToken,
            userAccessTokenSecret,
            workoutId,
            timestampLocal
        });
        responses.push({ userId, workoutId, scheduleId });
    }
    return responses;
}

async function deleteWorkouts(userIdData) {
    const userIds = userIdData.map(userData => userData.userId); // Extract user IDs
    const partnerData = await getPartnerData(userIds);
    let responses = [];

    for (const userData of userIdData) {
        const { userId, ids } = userData;
        const { workout, schedule } = ids;

        const garminData = partnerData[userId]?.garmin;
        if (!garminData) {
            console.error(`No Garmin data found for user ID: ${userId}`);
            responses.push({ userId, statusOkWorkout: false, statusOkSchedule: false });
            continue;
        }

        const userAccessToken = garminData.partner_oauth_token;
        const userAccessTokenSecret = garminData.partner_token_secret;

        const statusOkSchedule = await deleteSchedule({
            userAccessToken,
            userAccessTokenSecret,
            scheduleId: schedule
        });
        if (statusOkSchedule) {
            console.log("Schedule ", schedule, " deleted");
        } else {
            console.log("Schedule ", schedule, " not deleted");
        }
        const statusOkWorkout = await deleteWorkout({
            userAccessToken,
            userAccessTokenSecret,
            workoutId: workout
        });
        if (statusOkWorkout) {
            console.log("Workout ", workout, " deleted");
        } else {
            console.log("Workout ", workout, " not deleted");
        }
        responses.push({ userId, statusOkWorkout, statusOkSchedule });
    }
    return responses;
}

/* 
@param trainingPlans: Array of objects with the following structure:
    [
        {"userId":"1",
        "trainingPlan":{
            "day1":{"running":{"session_1":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},"strength":0,"alternative":0},
            ...
            "day7":{"running":{"session_1":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},"strength":0,"alternative":0}}},
        {"userId":"2",
            "trainingPlan": ...
    }]
@param nonActiveUsers: Array of user IDs of non-active users
@param timestamp: Timestamp for day1 of the training plans

 */
async function pushWorkoutsToPartners(dynamoDbClient, trainingPlans, nonActiveUsers, timestamp) {
    const userData = [];
    const userIds = trainingPlans.map(plan => plan.userId);
    const deleteData = await getWorkoutsToDelete(dynamoDbClient, userIds);
    if (deleteData.length !== 0) {
        console.log("Clean up tracking table before insertion:", deleteData);
        const deleteResponse = await deleteWorkouts(deleteData);
        console.log("Clean up done - delete response:", deleteResponse);
    }
    else {
        console.log("No clean up to do for tracking workouts table");
    }
    const heartRateZonesDict = await fetchHeartRateZonesForUsers(dynamoDbClient, userIds, nonActiveUsers);

    // Loop through each user in the training plans
    for (const { userId, trainingPlan } of trainingPlans) {
        if (nonActiveUsers.includes(userId)) continue;

        // Initialize the start date
        let currentDate = moment(new Date(timestamp).toISOString());

        // Loop through each day in the training plan
        for (const day of Object.keys(trainingPlan)) {
            const dayData = trainingPlan[day];

            // Check if there is a running session for the day
            if (dayData.running !== 0) {
                // Loop through each session in running
                for (const sessionKey of Object.keys(dayData.running)) {
                    const session = dayData.running[sessionKey];

                    // Push the session data to userData array
                    userData.push({
                        userId: userId,
                        workout: toGarminFormat(session, heartRateZonesDict[userId]),
                        type: 'RUNNING',
                        timestampLocal: currentDate.format('YYYY-MM-DD')
                    });
                }
            }
            currentDate.add(1, 'days');
        }
    }
    let response = await sendWorkouts(userData);
    await updatePartnerTracking(dynamoDbClient, response);
}

async function fetchHeartRateZonesForUsers(dynamoDbClient, allUsers, nonActiveUsers) {
    const heartRateZonesDict = {};

    for (const userId of allUsers) {
        if (!nonActiveUsers.includes(userId)) {
            const heartRateZones = await getHeartRateZones(dynamoDbClient, userId);
            heartRateZonesDict[userId] = heartRateZones;
        }
    }
    return heartRateZonesDict;
}

/*
@param session: Object with the following structure:
    {
        "warmup": {"Z2": 1.5},
        "main": {"interval_1": [{"Z5": 1}, {"Z2": 1}]},
        "cooldown": {"Z2": 1.5}
    }
@param heartRateZones: Object containing the heart rate zones for the user with the following structure 
    {
        zone1Lower: 0,
        zone1Upper: 127,
        zone2Lower: 127,
        zone2Upper: 146,
        zone3Lower: 146,
        zone3Upper: 166,
        zone4Lower: 166,
        zone4Upper: 176,
        zone5Lower: 176,
        zone5Upper: 195
    }
*/
function toGarminFormat(session, heartRateZones) {
    const totalKm = getTotalDistance(session);
    const workout = {
        "workoutName": "Run",
        "description": "This is an interval session with short and intense 1 km intervals.",
        "sport": "RUNNING",
        "estimatedDistanceInMeters": totalKm * 1000,
        "workoutProvider": "Blaze",
        "steps": []
    };

    let stepOrder = 1;

    // Add warmup steps
    if (session.warmup) {
        workout.steps.push(toGarminStep({ segment: session.warmup, heartRateZones: heartRateZones, interval: "WARMUP", stepOrder }));
        stepOrder++;
        stepOrder++;
    }

    // Add main interval steps wrapped in WorkoutRepeatStep
    if (session.main) {
        const repeatSteps = [];
        for (const interval in session.main) {
            for (const segment of session.main[interval]) {
                repeatSteps.push(toGarminStep({ segment, heartRateZones, interval: null, stepOrder }));
                stepOrder++;
            }
        }
        workout.steps.push({
            "type": "WorkoutRepeatStep",
            "repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
            "repeatValue": 1,
            "stepOrder": 2,
            "steps": repeatSteps
        });
    }

    // Add cooldown steps
    if (session.cooldown) {
        workout.steps.push(toGarminStep({ segment: session.cooldown, heartRateZones: heartRateZones, interval: "COOLDOWN", stepOrder }));
    }

    return workout;
}

function getTotalDistance(session) {
    let totalKm = 0;
    if (session.warmup) {
        for (const key in session.warmup) {
            totalKm += session.warmup[key];
        }
    }
    if (session.main) {
        for (const interval in session.main) {
            for (const segment of session.main[interval]) {
                for (const key in segment) {
                    totalKm += segment[key];
                }
            }
        }
    }
    if (session.cooldown) {
        for (const key in session.cooldown) {
            totalKm += session.cooldown[key];
        }
    }
    return totalKm;
}

function toGarminStep({ segment, heartRateZones, interval, stepOrder }) {
    const zone = Object.keys(segment)[0];
    const zoneLowerKey = "zone" + zone[1] + "Lower";
    const zoneUpperKey = "zone" + zone[1] + "Upper";
    const zoneLower = heartRateZones[zoneLowerKey];
    const zoneUpper = heartRateZones[zoneUpperKey];
    const km = segment[zone];

    const intensity = interval || (zone === "Z1" || zone === "Z2" ? "RECOVERY" : "INTERVAL");

    return {
        "type": "WorkoutStep",
        "stepOrder": stepOrder,
        "intensity": intensity,
        "description": interval ? `${interval} phase` : `Interval phase`,
        "durationType": "DISTANCE",
        "durationValue": km * 1000,
        "durationValueType": "METER",
        "targetType": "HEART_RATE",
        "targetValueLow": zoneLower,
        "targetValueHigh": zoneUpper
    }};

    async function updatePartnerTracking(dynamoDbClient, items) {
        console.log("Updating partner tracking with items:", items);
        const userWorkoutsMap = {};
    
        // Group workouts by userId
        items.forEach(item => {
            const { userId, workoutId, scheduleId } = item;
            if (!userWorkoutsMap[userId]) {
                userWorkoutsMap[userId] = [];
            }
            userWorkoutsMap[userId].push({ workoutId, scheduleId });
        });
    
        // Insert each userId with their workouts into the DynamoDB table
        for (const userId in userWorkoutsMap) {
            const workouts = JSON.stringify(userWorkoutsMap[userId]);
    
            const params = {
                TableName: 'coaching_partner_tracking',
                Key: { userId: userId },
                UpdateExpression: 'SET workouts = :workouts',
                ExpressionAttributeValues: {
                    ':workouts': workouts
                }
            };
    
            try {
                await dynamoDbClient.send(new UpdateCommand(params));
                console.log(`Successfully inserted workouts for userId: ${userId}`);
            } catch (error) {
                console.error(`Failed to insert workouts for userId: ${userId}`, error);
            }
        }
    }

    async function getWorkoutsToDelete(dynamoDbClient, userIds) {
        // Prepare keys for batch get operation
        const keys = userIds.map(userId => ({ userId }));
    
        // Batch get parameters
        const params = {
            RequestItems: {
                'coaching_partner_tracking': {
                    Keys: keys
                }
            }
        };
    
        try {
            const data = await dynamoDbClient.send(new BatchGetCommand(params));
            const items = data.Responses['coaching_partner_tracking'] || [];
    
            const workoutsToDelete = [];
    
            // Format the data as required
            items.forEach(item => {
                const { userId, workouts } = item;
                let workoutArray;
    
                // Check if workouts is a string or object
                if (typeof workouts === 'string') {
                    workoutArray = JSON.parse(workouts);
                } else {
                    workoutArray = workouts;
                }
    
                workoutArray.forEach(workoutEntry => {
                    workoutsToDelete.push({
                        userId,
                        ids: {
                            workout: workoutEntry.workoutId,
                            schedule: workoutEntry.scheduleId
                        }
                    });
                });
            });
    
            return workoutsToDelete;
        } catch (error) {
            console.error('Failed to get workouts to delete:', error);
            throw error;
        }
    }

export { sendWorkouts, deleteWorkouts, pushWorkoutsToPartners }