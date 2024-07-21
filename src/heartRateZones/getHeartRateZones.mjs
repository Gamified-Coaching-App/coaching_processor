import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { updateHeartRateZones } from "./updateHeartRateZones.mjs";

async function getHeartRateZones(dynamoDbClient, userId) {
    const params = {
        TableName: "coaching_heart_rate_zones",
        Key: {
            "userId": { S: userId }
        },
        ProjectionExpression: "zone1Lower, zone1Upper, zone2Lower, zone2Upper, zone3Lower, zone3Upper, zone4Lower, zone4Upper, zone5Lower, zone5Upper"
    };

    try {
        let data = await dynamoDbClient.send(new GetItemCommand(params));
        if (!data.Item) {
            await updateHeartRateZones(dynamoDbClient, [userId]);
            data = await dynamoDbClient.send(new GetItemCommand(params));
            if (!data.Item) {
                throw new Error("Failed to get heart rate zones for user " + userId);
            }
        }
        console.log("Heart rate zones for user ", userId , " fetched successfully.");
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
        throw error; 
    }
}

export { getHeartRateZones };