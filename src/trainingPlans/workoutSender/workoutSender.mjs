import { getHeartRateZones } from '../../heartRateZones/getHeartRateZones.mjs';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import moment from 'moment';
import { BatchGetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

/* 
helper function to create workout for a user in GarminConnect based on a formatted @workoutString and Garmin specific 
@userAccessToken and @userAccessTokenSecret - both are oAuth parametes
*/
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

/* 
helper function to delete workout for a user in GarminConnect based on a @workoutId and Garmin specific 
@userAccessToken and @userAccessTokenSecret - both are oAuth parametes
*/
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

/* 
helper function to create workout schedule (= schedule a defined workout for a specific date) for a user in GarminConnect 
based on a @workoutId for the previously defined workout, a @timestampLocal for when to schedule as well as Garmin specific 
@userAccessToken and @userAccessTokenSecret - both are oAuth parametes
*/
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

/* 
helper function to delete workout schedule (= schedule a defined workout for a specific date) for a user in GarminConnect 
based on a @scheduleId for the previously defined workout schedule and Garmin specific 
@userAccessToken and @userAccessTokenSecret - both are oAuth parametes
*/
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

/* 
helper function to generate oAuth signature, which is required from Garmin to authenticate requests on users' behalf
*/
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

/* 
helper function to get saved Garmin @userAccessToken and @userAccessTokenSecret from the Partner Data microservice. 
Required for generating oAuth signature for managing user's workouts on GarminConnect
*/
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

/* 
function to create workouts and workout schedules on GarminConnect
*/
async function sendWorkouts(userDataInput) {
    const userIds = userDataInput.map(userData => userData.userId);
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

/* 
function to delete existing workouts and schedules to enable subsequent insertion of new workouts
*/
async function deleteWorkouts(userIdData) {
    const userIds = userIdData.map(userData => userData.userId);
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
function to get heart rate zone thresholds for user, convert workout string to Garmin format, delete existing workouts and schedules on 
Garmin Connect and push new workouts and schedules to GarminConnect
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

    for (const { userId, trainingPlan } of trainingPlans) {
        if (nonActiveUsers.includes(userId)) continue;

        console.log("Timestamp:", timestamp.slice(0, 10));
        let currentDate = moment(new Date(timestamp.slice(0,10)).toISOString());

        for (const day of Object.keys(trainingPlan)) {
            const dayData = trainingPlan[day];

            if (dayData.running !== 0) {
                for (const sessionKey of Object.keys(dayData.running)) {
                    const session = dayData.running[sessionKey];

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

/* 
helper function users' heart rate zones, in order to convert generatic zones descriptions (e.g., Zone 2) 
to actual numerical heart rate zone thresholds in beats per minute (bpm)
*/
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
helper function convert workout string (@session) to a workout in Garmin format based on @heartRateZones
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

    if (session.warmup) {
        workout.steps.push(toGarminStep({ segment: session.warmup, heartRateZones: heartRateZones, interval: "WARMUP", stepOrder }));
        stepOrder++;
        stepOrder++;
    }

    if (session.main && Object.keys(session.main).length > 0) {
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

    if (session.cooldown && Object.keys(session.cooldown).length > 0) {
        workout.steps.push(toGarminStep({ segment: session.cooldown, heartRateZones: heartRateZones, interval: "COOLDOWN", stepOrder }));
    }

    return workout;
}


/* 
helper function to get total distance for workout, which is a required parameter for GarminConnect
*/
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

/* 
helper function to convert intervals to Garmin Steps (part of formatting to workouts to Garmin format)
*/
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

/* 
helper function to update list of workout ids and schedule ids for users, after having pushed new workouts to Garmin (required for deleting later)
*/
async function updatePartnerTracking(dynamoDbClient, items) {
        console.log("Updating partner tracking with items:", items);
        const userWorkoutsMap = {};
    
        items.forEach(item => {
            const { userId, workoutId, scheduleId } = item;
            if (!userWorkoutsMap[userId]) {
                userWorkoutsMap[userId] = [];
            }
            userWorkoutsMap[userId].push({ workoutId, scheduleId });
        });
    
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

/* 
helper function get current workouts to delete before pushing new workouts
*/
async function getWorkoutsToDelete(dynamoDbClient, userIds) {
        const keys = userIds.map(userId => ({ userId }));
    
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
    
            items.forEach(item => {
                const { userId, workouts } = item;
                let workoutArray;
    
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

export { sendWorkouts, deleteWorkouts, pushWorkoutsToPartners, toGarminFormat }