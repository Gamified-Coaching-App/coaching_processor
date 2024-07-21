import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

async function addBirthdayToDB(dynamoDbClient, userId, dateOfBirth) {
    try {
        await dynamoDbClient.send(new UpdateItemCommand({
            TableName: "coaching_user_data",
            Key: { "userId": { S: userId } },
            UpdateExpression: "SET dateOfBirth = :dob",
            ExpressionAttributeValues: { ":dob": { S: dateOfBirth } }
        }));
        console.log("Birthday added successfully to DB for user", userId);
    } catch (error) {
        console.error("Error adding birthday to DB:", error);
    }
}

export { addBirthdayToDB };