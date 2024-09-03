import { UpdateItemCommand, BatchGetItemCommand, QueryCommand} from "@aws-sdk/client-dynamodb";
import dayjs from 'dayjs';

async function updateHeartRateZones(dynamoDbClient, userIds) {
    let userData, healthData;

    try {
        userData = await dynamoDbClient.send(new BatchGetItemCommand({
            RequestItems: {
                "coaching_user_data": {
                    Keys: userIds.map(id => ({ "userId": { S: String(id) } })),
                    ProjectionExpression: "userId, dateOfBirth"
                }
            }
        }));

        const healthDataRequests = userIds.map(userId => (
            dynamoDbClient.send(new QueryCommand({
                TableName: "coaching_health",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: { ":userId": { S: String(userId) } },
                Limit: 60,
                ScanIndexForward: false 
            }))
        ));
        healthData = await Promise.all(healthDataRequests);

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
            console.log("Heart rate zones updated succesfully for user", userId);
        }
    } catch (error) {
        console.error("Error during health zone update:", error);
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

export { updateHeartRateZones };