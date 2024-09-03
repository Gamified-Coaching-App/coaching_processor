import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

/* 
function to add user's birthday to the database - this data is required for heart rate zone calculations
*/
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