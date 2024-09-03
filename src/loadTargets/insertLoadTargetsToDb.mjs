import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from "@aws-sdk/util-dynamodb";

async function insertLoadTargetsToDb(dynamoDbClient, { loadTargets, timestamp }) {
    const tableName = 'coaching_load_targets';
    const dateDay1 = timestamp.slice(0, 10); 

    const updatePromises = Object.keys(loadTargets).map(async (userId) => {
        const user = loadTargets[userId];
        const params = {
            TableName: tableName,
            Key: {
                userId: { S: userId }
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
                ':day1': { M: marshall(user.day1) },
                ':day2': { M: marshall(user.day2) },
                ':day3': { M: marshall(user.day3) },
                ':day4': { M: marshall(user.day4) },
                ':day5': { M: marshall(user.day5) },
                ':day6': { M: marshall(user.day6) },
                ':day7': { M: marshall(user.day7) },
                ':updatedTimestamp': { S: timestamp },
                ':dateDay1': { S: dateDay1 }
            },
            ReturnValues: 'UPDATED_NEW'
        };

        try {
            await dynamoDbClient.send(new UpdateItemCommand(params));
            console.log(`Load target update in DB for userId: ${userId} successfull`);
        } catch (error) {
            console.error(`Error: load target DB update for userId: ${userId}`, error);
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

export { insertLoadTargetsToDb };