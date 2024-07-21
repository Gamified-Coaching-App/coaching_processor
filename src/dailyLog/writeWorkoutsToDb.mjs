import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

async function writeWorkoutToDb(dynamoDbclient, params) {
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

    let updateExpression = "SET #exer.#sid = :nanValue, " +
                           "#succ.#sid = :nanValue, " +
                           "#rec.#sid = :nanValue," +
                           "#ns = if_not_exists(#ns, :zero) + :one," + 
                           "#in = if_not_exists(#in, :false)";
    let expressionAttributeNames = {
        "#exer": "perceivedExertion",
        "#succ": "perceivedTrainingSuccess",
        "#rec": "perceivedRecovery",
        "#sid": sessionId,
        "#ns": "numberSessions",
        "#in": "injured"
    };
    let expressionAttributeValues = { 
        ":nanValue": { NULL: true },
        ":one": { N: "1" },
        ":false": { BOOL: false }
    };

    switch (activityType) { 
        case "RUNNING":
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
            const currentData = await getCurrentAltActivityData(dynamoDbclient, userId, timestampLocal);
            let currentDuration = "00:00:00";
            if (currentData.Item && currentData.Item.hoursAlternative) {
                currentDuration = currentData.Item.hoursAlternative.S;
            }

            const newDuration = duration ? addTimeStrings(currentDuration, duration) : currentDuration;
        
            updateExpression += ", #nss = if_not_exists(#nss, :zero), " +
                                "#alt = :totalDuration, " + 
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
        console.log("Update of daily log in DB successul for activity type: ", activityType);
        return result;
    } catch (error) {
        console.error("Error updating the daily log in DB:", error);
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

export { writeWorkoutToDb };