import { GetItemCommand, UpdateItemCommand, BatchGetItemCommand, QueryCommand, ScanCommand} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import dayjs from 'dayjs';
import moment from 'moment';
import jwt from 'jsonwebtoken';

async function getHeartRateZones(dynamoDbClient, userId) {
    // Define the parameters for the GetItem operation
    const params = {
        TableName: "coaching_heart_rate_zones",
        Key: {
            "userId": { S: userId }
        },
        ProjectionExpression: "zone1Lower, zone1Upper, zone2Lower, zone2Upper, zone3Lower, zone3Upper, zone4Lower, zone4Upper, zone5Lower, zone5Upper"
    };

    console.log("Fetching heart rate zones for user:", userId);
    console.log("Params:", params);

    try {
        // Attempt to get the heart rate zones from the database
        let data = await dynamoDbClient.send(new GetItemCommand(params));

        // Check if the data exists
        if (!data.Item) {
            // If not found, update the heart rate zones
            await updateHeartRateZones(dynamoDbClient, [userId]);
            // After updating, retry fetching the heart rate zones
            data = await dynamoDbClient.send(new GetItemCommand(params));
            if (!data.Item) {
                throw new Error("Failed to get heart rate zones for user " + userId);
            }
        }

        // Return the formatted heart rate zones
        return {
            zone1Lower: parseInt(data.Item.zone1Lower.N, 10),
            zone1Upper: parseInt(data.Item.zone1Upper.N, 10),
            zone2Lower: parseInt(data.Item.zone2Lower.N, 10),
            zone2Upper: parseInt(data.Item.zone2Upper.N, 10),
            zone3Lower: parseInt(data.Item.zone3Lower.N, 10),
            zone3Upper: parseInt(data.Item.zone3Upper.N, 10),
            zone4Lower: parseInt(data.Item.zone4Lower.N, 10),
            zone4Upper: parseInt(data.Item.zone4Upper.N, 10),
            zone5Lower: parseInt(data.Item.zone5Lower.N, 10),
            zone5Upper: parseInt(data.Item.zone5Upper.N, 10)
        };
    } catch (error) {
        console.error("An error occurred:", error);
        throw error; // Throw the error to be handled by the caller
    }
}

function getKmPerHeartRateZone(zones, heartRatesJson, distancesJson) {
    let kmZone1 = 0, kmZone2 = 0, kmZone3 = 0, kmZone4 = 0, kmZone5 = 0;
    const heartRates = JSON.parse(heartRatesJson);
    const distances = JSON.parse(distancesJson);  
    console.log("Calculating km per heart rate zone...");
    console.log("Parsed heart rates:", heartRates);
    console.log("Parsed distances:", distances);

    // Get all time keys from the heartRates and distances, and sort them
    const timeKeys = Object.keys(heartRates).concat(Object.keys(distances));
    const uniqueTimeKeys = [...new Set(timeKeys)]; // Remove duplicates
    uniqueTimeKeys.sort((a, b) => parseInt(a) - parseInt(b)); // Sort keys as integers
    let previousTime = uniqueTimeKeys[0];

    // Iterate through sorted time keys
    for (const time of uniqueTimeKeys) {
        const currentHeartRate = parseInt(heartRates[time], 10);
        const currentDistance = parseInt(distances[time], 10);
        const previousDistance = parseInt(distances[previousTime],10) || 0;
        const distanceCovered = (currentDistance - previousDistance) / 1000; // Convert meters to km

        if (currentHeartRate !== undefined && currentDistance !== undefined) {
            // Check which zone the current heart rate falls into and increment the corresponding km variable
            if (currentHeartRate >= zones.zone1Lower && currentHeartRate < zones.zone1Upper) {
                kmZone1 += distanceCovered;
            } else if (currentHeartRate >= zones.zone2Lower && currentHeartRate < zones.zone2Upper) {
                kmZone2 += distanceCovered;
            } else if (currentHeartRate >= zones.zone3Lower && currentHeartRate < zones.zone3Upper) {
                kmZone3 += distanceCovered;
            } else if (currentHeartRate >= zones.zone4Lower && currentHeartRate < zones.zone4Upper) {
                kmZone4 += distanceCovered;
            } else if (currentHeartRate >= zones.zone5Lower && currentHeartRate <= zones.zone5Upper) {
                kmZone5 += distanceCovered;
            }
        }
        previousTime = time;
    }
    const kmPerHeartRateZone = {
        zone1: parseFloat(kmZone1.toFixed(2)),
        zone2: parseFloat(kmZone2.toFixed(2)),
        zone3: parseFloat(kmZone3.toFixed(2)),
        zone4: parseFloat(kmZone4.toFixed(2)),
        zone5: parseFloat(kmZone5.toFixed(2))
    }
    console.log("Calculated km per heart rate zone:", kmPerHeartRateZone);
    return kmPerHeartRateZone;
}

async function writeWorkoutToDb(dynamoDbclient, params) {
    console.log("Writing workout to database...");
    const { userId, timestampLocal, activityType, sessionId, duration, kmPerHeartRateZone } = params

    console.log("userId:", userId, "timestampLocal:", timestampLocal, "activityType:", activityType, "sessionId:", sessionId, "duration:", duration, "kmPerHeartRateZone:", kmPerHeartRateZone)
    const initUpdateExpression = "SET #exer = if_not_exists(#exer, :emptyMap), " +
                                 "#succ = if_not_exists(#succ, :emptyMap), " +
                                 "#rec = if_not_exists(#rec, :emptyMap)";

    await dynamoDbclient.send(new UpdateItemCommand({
        TableName: "coaching_daily_log",
        Key: { "userId": { S: userId }, "timestampLocal": { S: timestampLocal } },
        UpdateExpression: initUpdateExpression,
        ExpressionAttributeNames: {
            "#exer": "perceivedExertion",
            "#succ": "perceivedTrainingSuccess",
            "#rec": "perceivedRecovery"
        },
        ExpressionAttributeValues: {
            ":emptyMap": { M: {} }
        }
    }));

    // Second update to set specific session details
    let updateExpression = "SET #exer.#sid = :nanValue, " +
                           "#succ.#sid = :nanValue, " +
                           "#rec.#sid = :nanValue," +
                           "#ns = if_not_exists(#ns, :zero) + :one," + 
                           "#in = if_not_exists(#in, :false)";
    let expressionAttributeNames = { // Changed from const to let and initialized here
        "#exer": "perceivedExertion",
        "#succ": "perceivedTrainingSuccess",
        "#rec": "perceivedRecovery",
        "#sid": sessionId,
        "#ns": "numberSessions",
        "#in": "injured"
    };
    let expressionAttributeValues = { // Changed from const to let
        ":nanValue": { NULL: true },
        ":one": { N: "1" },
        ":false": { BOOL: false }
    };

    switch (activityType) { 
        case "RUNNING":
            console.log("updating RUNNING session");
            updateExpression += ", #alt = if_not_exists(#alt, :zeroTime), #nss = if_not_exists(#nss, :zero), " +
                                "#kt = if_not_exists(#kt, :zero) + :totalKm, #kz34 = if_not_exists(#kz34, :zero) + :kmZ3Z4, " +
                                "#kz5 = if_not_exists(#kz5, :zero) + :kmZ5, #ks = if_not_exists(#ks, :zero) + :kmSprint";
            expressionAttributeNames = { ...expressionAttributeNames,
                "#alt": "hoursAlternative",
                "#nss": "numberStrengthSessions",
                "#kt": "kmTotal",
                "#kz34": "kmZ3Z4",
                "#kz5": "kmZ5",
                "#ks": "kmSprint"
            };
            expressionAttributeValues = { ...expressionAttributeValues,
                ":zeroTime": { S: "00:00:00" },
                ":zero": { N: "0" },
                ":totalKm": { N: (kmPerHeartRateZone.zone1 + kmPerHeartRateZone.zone2 + kmPerHeartRateZone.zone3 + kmPerHeartRateZone.zone4 + kmPerHeartRateZone.zone5).toString() },
                ":kmZ3Z4": { N: (kmPerHeartRateZone.zone3 + kmPerHeartRateZone.zone4).toString() },
                ":kmZ5": { N: kmPerHeartRateZone.zone5.toString() },
                ":kmSprint": { N: (kmPerHeartRateZone.zone5 * 0.5).toString() }
            };
            break;
        case "STRENGTH_CONDITIONING":
            console.log("Updating STRENGTH_CONDITIONING session...");
            updateExpression += ", #nss = if_not_exists(#nss, :zero) + :inc, " +
                                "#alt = if_not_exists(#alt, :zeroTime), " +
                                "#kt = if_not_exists(#kt, :zero), #kz34 = if_not_exists(#kz34, :zero), " +
                                "#ks = if_not_exists(#ks, :zero), #kz5 = if_not_exists(#kz5, :zero)";
            expressionAttributeNames = { ...expressionAttributeNames,
                "#nss": "numberStrengthSessions",
                "#alt": "hoursAlternative",
                "#kt": "kmTotal",
                "#kz34": "kmZ3Z4",
                "#ks": "kmSprint",
                "#kz5": "kmZ5"
            };
            expressionAttributeValues = { ...expressionAttributeValues,
                ":zeroTime": { S: "00:00:00" },
                ":zero": { N: "0" },
                ":inc": { N: "1" }
            };
            break;
        case "OTHER":
            console.log("Updating OTHER session...");
            // Fetch the current hoursAlternative value
            const currentData = await getCurrentAltActivityData(dynamoDbclient, userId, timestampLocal);
            let currentDuration = "00:00:00";
            if (currentData.Item && currentData.Item.hoursAlternative) {
                currentDuration = currentData.Item.hoursAlternative.S;
            }
            // Compute the new total duration if a duration is provided, else set to currentDuration
            const newDuration = duration ? addTimeStrings(currentDuration, duration) : currentDuration;
        
            // Prepare the update expression
            updateExpression += ", #nss = if_not_exists(#nss, :zero), " +
                                "#alt = :totalDuration, " + // Directly set to newDuration
                                "#kt = if_not_exists(#kt, :zero), #kz34 = if_not_exists(#kz34, :zero), " +
                                "#ks = if_not_exists(#ks, :zero), #kz5 = if_not_exists(#kz5, :zero)";
            expressionAttributeNames = { ...expressionAttributeNames,
                "#nss": "numberStrengthSessions",
                "#alt": "hoursAlternative",
                "#kt": "kmTotal",
                "#kz34": "kmZ3Z4",
                "#ks": "kmSprint",
                "#kz5": "kmZ5"
            };
            expressionAttributeValues = { ...expressionAttributeValues,
                ":zero": { N: "0" },
                ":totalDuration": { S: newDuration }
            };
            break;
    }
    try {
        const params = {
            TableName: "coaching_daily_log",
            Key: { "userId": { S: userId }, "timestampLocal": { S: timestampLocal } },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "UPDATED_NEW"
        };
        const result = await dynamoDbclient.send(new UpdateItemCommand(params));
        console.log("Update result:", result);
        return result;
    } catch (error) {
        console.error("Error updating the database:", error);
        throw error;
    }
}


async function getCurrentAltActivityData(dynamoDbclient, userId, timestampLocal) {
    const params = {
        TableName: "coaching_daily_log",
        Key: {
            "userId": { S: userId },
            "timestampLocal": { S: timestampLocal }
        },
        ProjectionExpression: "#alt",
        ExpressionAttributeNames: {
            "#alt": "hoursAlternative" 
        }
    };
    return await dynamoDbclient.send(new GetItemCommand(params));
}

function addTimeStrings(time1, time2) {
    let [hours1, minutes1, seconds1] = time1.split(':').map(Number);
    let [hours2, minutes2, seconds2] = time2.split(':').map(Number);
    let seconds = seconds1 + seconds2;
    let minutes = minutes1 + minutes2 + Math.floor(seconds / 60);  
    let hours = hours1 + hours2 + Math.floor(minutes / 60);   
    seconds %= 60;
    minutes %= 60;
    const format = (num) => num.toString().padStart(2, '0');
    return `${format(hours)}:${format(minutes)}:${format(seconds)}`;
}

async function writeSubjectiveParamsToDb(dynamoDbClient, params) {
    const { userId, timestampLocal, sessionId, perceivedExertion, perceivedRecovery, perceivedTrainingSuccess } = params;

    console.log("Updating subjective parameters for user ", userId, " at ", timestampLocal, " for session ", sessionId, " with values: ", perceivedExertion, perceivedRecovery, perceivedTrainingSuccess)
    // Prepare the UpdateExpression and ExpressionAttributeValues
    let updateExpression = "set ";
    let expressionAttributeValues = {};
    let expressionAttributeNames = { "#sid": sessionId.toString() }; // Safe referencing for map keys

    // Append updates for perceivedExertion if provided
    if (perceivedExertion !== undefined) {
        updateExpression += "perceivedExertion.#sid = :pe, ";
        expressionAttributeValues[":pe"] = { N: perceivedExertion.toString() };
    }

    // Append updates for perceivedRecovery if provided
    if (perceivedRecovery !== undefined) {
        updateExpression += "perceivedRecovery.#sid = :pr, ";
        expressionAttributeValues[":pr"] = { N: perceivedRecovery.toString() };
    }

    // Append updates for perceivedTrainingSuccess if provided
    if (perceivedTrainingSuccess !== undefined) {
        updateExpression += "perceivedTrainingSuccess.#sid = :pts, ";
        expressionAttributeValues[":pts"] = { N: perceivedTrainingSuccess.toString() };
    }

    // Remove the trailing comma and space from the update expression
    updateExpression = updateExpression.slice(0, -2);

    const updateParams = {
        TableName: "coaching_daily_log",
        Key: { 
            "userId": { S: userId }, 
            "timestampLocal": { S: timestampLocal } 
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
    };

    try {
        await dynamoDbClient.send(new UpdateItemCommand(updateParams));
        console.log("Update successful.");
    } catch (error) {
        console.error("Error updating subjective parameters:", error);
        throw error;
    }
}

async function writeHealthMetricsToDB(dynamoDbClient, payload) {
    const dailies = payload.dailies;

    for (const daily of dailies) {
        const {
            userId: userIdGarmin,
            summaryId,
            calendarDate,
            maxHeartRateInBeatsPerMinute,
            averageHeartRateInBeatsPerMinute,
            restingHeartRateInBeatsPerMinute
        } = daily;

        // Simulate getting the actual system user ID from the Garmin user ID
        const userId = await get_user_id(userIdGarmin);

        const params = {
            TableName: "coaching_health",
            Key: {
                "userId": { S: userId },
                "timestampLocal": { S: calendarDate }
            },
            UpdateExpression: "SET summaryId = :sid, maxHeartRate = :maxhr, restingHeartRate = :rhr",
            ExpressionAttributeValues: {
                ":sid": { S: summaryId },
                ":maxhr": { N: String(maxHeartRateInBeatsPerMinute) },
                ":rhr": { N: String(restingHeartRateInBeatsPerMinute) }
            },
            ReturnValues: "UPDATED_NEW"
        };

        try {
            const result = await dynamoDbClient.send(new UpdateItemCommand(params));
            console.log('Update Result:', result);
        } catch (error) {
            console.error(`Error writing health metrics for user ${userId}:`, error);
            throw error;
        }
    }
}

async function updateHeartRateZones(dynamoDbClient, userIds) {
    let userData, healthData;

    try {
        // Retrieve user data
        userData = await dynamoDbClient.send(new BatchGetItemCommand({
            RequestItems: {
                "coaching_user_data": {
                    Keys: userIds.map(id => ({ "userId": { S: String(id) } })),
                    ProjectionExpression: "userId, dateOfBirth"
                }
            }
        }));

        // Get health data for the last 60 timestamps
        const healthDataRequests = userIds.map(userId => (
            dynamoDbClient.send(new QueryCommand({
                TableName: "coaching_health",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: { ":userId": { S: String(userId) } },
                Limit: 60,
                ScanIndexForward: false // Fetches the most recent 60 entries
            }))
        ));
        healthData = await Promise.all(healthDataRequests);

        // Process each user's data
        for (const userId of userIds) {
            const user = userData.Responses["coaching_user_data"].find(item => item.userId.S === String(userId));
            const healthIndex = userIds.indexOf(userId);
            const health = healthData[healthIndex].Items;

            let recordedMaxHR = 0;
            if (!user) {
                console.error("userId " + userId + " not in coaching_user_data");
                continue;
            } else if (health && health.length > 0) {
                recordedMaxHR = Math.max(...health.map(item => parseFloat(item.maxHeartRate.N)));
            }

            const dateOfBirth = dayjs(user.dateOfBirth.S);
            const age = dayjs().diff(dateOfBirth, 'year');
            const estimatedMaxHR = 211 - (0.64 * age);
            const maxHR = Math.max(estimatedMaxHR, recordedMaxHR);
            const zones = computeHeartRateZones(maxHR);

            await dynamoDbClient.send(new UpdateItemCommand({
                TableName: "coaching_heart_rate_zones",
                Key: { "userId": { S: String(userId) } },
                UpdateExpression: buildUpdateExpression(zones),
                ExpressionAttributeValues: buildExpressionAttributeValues(zones)
            }));
        }
    } catch (error) {
        console.error("Failed during health zone update process:", error);
        return;
    }
}
    
function computeHeartRateZones(maxHR) {
    const zone12 = 0.65;
    const zone23 = 0.75;
    const zone34 = 0.85;
    const zone45 = 0.90;
    const zones = {
        zone1Lower: 0,
        zone1Upper: Math.round(maxHR * zone12),
        zone2Lower: Math.round(maxHR * zone12),
        zone2Upper: Math.round(maxHR * zone23),
        zone3Lower: Math.round(maxHR * zone23),
        zone3Upper: Math.round(maxHR * zone34),
        zone4Lower: Math.round(maxHR * zone34),
        zone4Upper: Math.round(maxHR * zone45),
        zone5Lower: Math.round(maxHR * zone45),
        zone5Upper: Math.round(maxHR)
    }
    return zones;
}

function buildUpdateExpression(zones) {
    return `set zone1Lower = :z1l, zone1Upper = :z1u, zone2Lower = :z2l, zone2Upper = :z2u, 
            zone3Lower = :z3l, zone3Upper = :z3u, zone4Lower = :z4l, zone4Upper = :z4u, 
            zone5Lower = :z5l, zone5Upper = :z5u`;
}

function buildExpressionAttributeValues(zones) {
    return {
        ":z1l": { N: String(zones.zone1Lower) },
        ":z1u": { N: String(zones.zone1Upper) },
        ":z2l": { N: String(zones.zone2Lower) },
        ":z2u": { N: String(zones.zone2Upper) },
        ":z3l": { N: String(zones.zone3Lower) },
        ":z3u": { N: String(zones.zone3Upper) },
        ":z4l": { N: String(zones.zone4Lower) },
        ":z4u": { N: String(zones.zone4Upper) },
        ":z5l": { N: String(zones.zone5Lower) },
        ":z5u": { N: String(zones.zone5Upper) }
    };
}

async function addBirthdayToDB(dynamoDbClient, userId, dateOfBirth) {
    try {
        await dynamoDbClient.send(new UpdateItemCommand({
            TableName: "coaching_user_data",
            Key: { "userId": { S: userId } },
            UpdateExpression: "SET dateOfBirth = :dob",
            ExpressionAttributeValues: { ":dob": { S: dateOfBirth } }
        }));
        console.log("Birthday added to DB for user", userId);
    } catch (error) {
        console.error("Error adding birthday to DB:", error);
    }
}

async function get_user_id(user_id_garmin) {
    console.log("Getting user ID for Garmin user ID:", user_id_garmin);
    const url = `https://f53aet9v26.execute-api.eu-west-2.amazonaws.com/dev_1/get-user-id?partner=garmin&partner_user_ids=${user_id_garmin}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed_data = JSON.parse(data);
                    const user_ids = parsed_data.user_ids;
                    if (user_ids) {
                        const user_id_array = user_ids.split(',');
                        const user_id = user_id_array[0];
                        resolve(user_id);
                    } else {
                        console.error("User ID not found in the response.");
                        reject(new Error("User ID not found in the response."));
                    }
                } catch (error) {
                    console.error("Parsing error:", error);
                    reject(error);
                }
            });
        }).on('error', (e) => {
            console.error("HTTP request error:", e);
            reject(e);
        });
    });
}

async function prepareDataForInference(dynamoDbClient, data = { userIds : [], startDate : null} ) {
    // Calculate endDate
    const  { userIds, startDate } = data;
    const endDate = moment(startDate).subtract(21, 'days').format('YYYY-MM-DD');
    console.log("Fetching data for the last 21 days, from", startDate, "to", endDate);
    
    const results = [];

    for (const userId of userIds) {
        const params = {
            TableName: "coaching_daily_log",
            KeyConditionExpression: "userId = :userId AND timestampLocal BETWEEN :endDate AND :startDate",
            ExpressionAttributeValues: {
                ":userId": { S: userId },
                ":endDate": { S: endDate },
                ":startDate": { S: startDate }
            }
        };

        try {
            const data = await dynamoDbClient.send(new QueryCommand(params));
            const items = data.Items || [];

            const dateMap = {};

            items.forEach(item => {
                const date = item.timestampLocal.S;
                dateMap[date] = fillDefaults({
                    userId: item.userId.S,
                    timestampLocal: item.timestampLocal.S,
                    numberSessions: item.numberSessions?.N,
                    kmTotal: item.kmTotal?.N,
                    kmZ3Z4: item.kmZ3Z4?.N,
                    kmZ5: item.kmZ5?.N,
                    kmSprint: item.kmSprint?.N,
                    hoursAlternative: item.hoursAlternative?.S,
                    numberStrengthSessions: item.numberStrengthSessions?.N,
                    perceivedTrainingSuccess: item.perceivedTrainingSuccess?.M,
                    perceivedRecovery: item.perceivedRecovery?.M,
                    perceivedExertion: item.perceivedExertion?.M,
                    injured: item.injured?.BOOL
                });
            });

            const userData = { userId, data: {} };
            for (let i = 0; i < 21; i++) {
                const date = moment(startDate).subtract(i, 'days').format('YYYY-MM-DD');
                userData.data[`day${21 - i}`] = dateMap[date] || fillDefaults({ userId, timestampLocal: date });
            }

            results.push(userData);
        } catch (error) {
            console.error(`Error fetching data for user ${userId}:`, error);
        }
    }

    return results;
}

function roundToNearestHour(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours + (minutes >= 30 ? 1 : 0);
}

function averageNonNull(values, defaultValue = -0.1) {
    const validValues = values.filter(v => v !== null && v !== undefined);
    if (validValues.length === 0) return defaultValue;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
}

function parseNumber(value) {
    return value !== undefined ? parseFloat(value) : 0;
}

function parseMap(map) {
    if (!map) return {};
    return Object.keys(map).reduce((acc, key) => {
        acc[key] = map[key].N !== undefined ? parseFloat(map[key].N) : null;
        return acc;
    }, {});
}

function fillDefaults(data) {
    return {
        userId: data.userId,
        timestampLocal: data.timestampLocal,
        numberSessions: parseNumber(data.numberSessions),
        kmTotal: parseNumber(data.kmTotal),
        kmZ3Z4: parseNumber(data.kmZ3Z4),
        kmZ5: parseNumber(data.kmZ5),
        kmSprint: parseNumber(data.kmSprint),
        hoursAlternative: data.hoursAlternative ? roundToNearestHour(data.hoursAlternative) : 0,
        numberStrengthSessions: parseNumber(data.numberStrengthSessions),
        perceivedTrainingSuccess: averageNonNull(Object.values(parseMap(data.perceivedTrainingSuccess))),
        perceivedRecovery: averageNonNull(Object.values(parseMap(data.perceivedRecovery))),
        perceivedExertion: averageNonNull(Object.values(parseMap(data.perceivedExertion))),
        injured: data.injured !== undefined ? data.injured : false
    };
}

async function getLoadTargetInference(data) {
    console.log("Getting inference from load optimiser with data ...:");
    console.log("data: ", data);
    
    // Get current timestamp
    const timestampNow = moment().format('YYYY-MM-DD-HH-mm-ss');
    console.log("inference time stamp now: ", timestampNow);

    const inferenceResults = data.map(user => {
        const userResults = {
            userId: user.userId,
            loadTargets: {}
        };

        for (let i = 1; i <= 7; i++) {
            userResults.loadTargets[`day${i}`] = {
                numberSession: 1,
                totalKm: 5,
                kmZ34: 1,
                kmZ5: 1,
                kmSprint: 0,
                numberStrengthSessions: 0,
                hoursAlternative: 0
            };
        }
        return userResults;
    });
    return {
        loadTargets: inferenceResults,
        timestamp: timestampNow
    };
}

async function insertLoadTargetsToDb(dynamoDbClient, { loadTargets, timestamp} ) {
    const tableName = 'coaching_load_targets';
    const dateDay1 = timestamp.slice(0, 10); // Extract the date part from the timestamp

    const updatePromises = loadTargets.map(async (user) => {
        const params = {
            TableName: tableName,
            Key: {
                userId: { S: user.userId }
            },
            UpdateExpression: `SET 
                day1 = :day1,
                day2 = :day2,
                day3 = :day3,
                day4 = :day4,
                day5 = :day5,
                day6 = :day6,
                day7 = :day7,
                updatedTimestamp = :updatedTimestamp,
                dateDay1 = :dateDay1`,
            ExpressionAttributeValues: {
                ':day1': { M: marshall(user.loadTargets.day1) },
                ':day2': { M: marshall(user.loadTargets.day2) },
                ':day3': { M: marshall(user.loadTargets.day3) },
                ':day4': { M: marshall(user.loadTargets.day4) },
                ':day5': { M: marshall(user.loadTargets.day5) },
                ':day6': { M: marshall(user.loadTargets.day6) },
                ':day7': { M: marshall(user.loadTargets.day7) },
                ':updatedTimestamp': { S: timestamp },
                ':dateDay1': { S: dateDay1 }
            },
            ReturnValues: 'UPDATED_NEW'
        };

        try {
            await dynamoDbClient.send(new UpdateItemCommand(params));
            console.log(`Successfully updated data for userId: ${user.userId}`);
        } catch (error) {
            console.error(`Error updating data for userId: ${user.userId}`, error);
            throw error;
        }
    });

    try {
        await Promise.all(updatePromises);
        console.log('All load targets updated successfully');
    } catch (error) {
        console.error('Error updating load targets', error);
    }
}

async function insertTrainingPlansToDb(dynamoDbClient, { trainingPlans, timestamp }) {
    const tableName = 'coaching_training_plans';
    const dateDay1 = timestamp.slice(0, 10); // Extract the date part from the timestamp
  
    const updatePromises = trainingPlans.map(async (userPlan) => {
      const { userId, trainingPlan } = userPlan;
  
      const params = {
        TableName: tableName,
        Key: marshall({ userId }),
        UpdateExpression: `SET 
          day1 = :day1,
          day2 = :day2,
          day3 = :day3,
          day4 = :day4,
          day5 = :day5,
          day6 = :day6,
          day7 = :day7,
          updatedTimestamp = :updatedTimestamp,
          dateDay1 = :dateDay1`,
        ExpressionAttributeValues: marshall({
          ':day1': JSON.stringify(trainingPlan.day1),
          ':day2': JSON.stringify(trainingPlan.day2),
          ':day3': JSON.stringify(trainingPlan.day3),
          ':day4': JSON.stringify(trainingPlan.day4),
          ':day5': JSON.stringify(trainingPlan.day5),
          ':day6': JSON.stringify(trainingPlan.day6),
          ':day7': JSON.stringify(trainingPlan.day7),
          ':updatedTimestamp': timestamp,
          ':dateDay1': dateDay1
        }),
        ReturnValues: 'UPDATED_NEW'
      };
  
      try {
        await dynamoDbClient.send(new UpdateItemCommand(params));
        console.log(`Successfully updated data for userId: ${userId}`);
      } catch (error) {
        console.error(`Error updating data for userId: ${userId}`, error);
        throw error;
      }
    });
  
    try {
      await Promise.all(updatePromises);
      console.log('All training plans updated successfully');
    } catch (error) {
      console.error('Error updating training plans', error);
    }
  }

  async function getTrainingPlan(dynamoDbClient, userId) {
    const params = {
      TableName: 'coaching_training_plans',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId }
      },
      ProjectionExpression: '#userId, dateDay1, day1, day2, day3, day4, day5, day6, day7',
      ExpressionAttributeNames: {
        '#userId': 'userId'
      }
    };
    let data;
    try {
      data = await dynamoDbClient.send(new QueryCommand(params));
      } catch (error) {
      console.error('Error fetching workout plan:', error);
      throw new Error('Error fetching workout plan');
  }
    return processTrainingPlan(data.Items[0]);
  }

  function processTrainingPlan(items) {
    const baseDate = new Date(items.dateDay1.S);
    const trainingPlan = {};

    for (let i = 1; i <= 7; i++) {
        const dateKey = `day${i}`;
        if (items[dateKey]) {
            const dayPlan = JSON.parse(items[dateKey].S);

            // Check if all three parameters are 0
            if (dayPlan.running === 0 && dayPlan.strength === 0 && dayPlan.alternative === 0) {
                continue;
            }

            const currentDate = new Date(baseDate);
            currentDate.setDate(baseDate.getDate() + (i - 1));
            const formattedDate = currentDate.toISOString().split('T')[0];

            let sessionCounter = 1;

            // Process running sessions
            if (dayPlan.running !== 0 && typeof dayPlan.running === 'object') {
                Object.entries(dayPlan.running).forEach(([sessionKey, sessionValue]) => {
                    const timestampKey = `${formattedDate}_${sessionCounter}`;
                    trainingPlan[timestampKey] = {
                        type: 'RUNNING',
                        workout: sessionValue
                    };
                    sessionCounter++;
                });
            }

            // Process strength sessions
            if (dayPlan.strength !== 0) {
                const timestampKey = `${formattedDate}_${sessionCounter}`;
                trainingPlan[timestampKey] = {
                    type: 'STRENGTH',
                    workout: true
                };
                sessionCounter++;
            }

            // Process alternative sessions
            if (dayPlan.alternative !== 0) {
                const timestampKey = `${formattedDate}_${sessionCounter}`;
                trainingPlan[timestampKey] = {
                    type: 'ALTERNATIVE',
                    workout: true
                };
                sessionCounter++;
            }
        }
    }
    return trainingPlan;
}

  function getUserIdFromJwt(token) {
    const decoded = jwt.decode(token);
    return decoded.sub;
}

async function getAllUsers(dynamoDbClient) {
    const params = {
        TableName: "coaching_user_data"
    };

    try {
        // Scan the table
        const data = await dynamoDbClient.send(new ScanCommand(params));
        
        // Check if Items exist and are not empty
        if (!data.Items || data.Items.length === 0) {
            return { active: [], nonActive: [] };
        }

        const items = data.Items.map(item => unmarshall(item));

        // Separate active and non-active user IDs
        const activeUserIds = [];
        const nonActiveUserIds = [];

        items.forEach(item => {
            if (item.coachingActive === true) {
                activeUserIds.push(item.userId);
            } else {
                nonActiveUserIds.push(item.userId);
            }
        });

        return { active: activeUserIds, nonActive: nonActiveUserIds };
    } catch (err) {
        console.error("Error scanning DynamoDB table:", err);
        throw new Error("Error scanning DynamoDB table");
    }
}

export { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb, writeSubjectiveParamsToDb, writeHealthMetricsToDB, updateHeartRateZones, prepareDataForInference, getLoadTargetInference, insertLoadTargetsToDb, insertTrainingPlansToDb, getUserIdFromJwt, getTrainingPlan, getAllUsers};