import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

async function writeSubjectiveParamsToDb(dynamoDbClient, params) {
    const { userId, timestampLocal, sessionId, perceivedExertion, perceivedRecovery, perceivedTrainingSuccess } = params;

    let updateExpression = "set ";
    let expressionAttributeValues = {};
    let expressionAttributeNames = { "#sid": sessionId.toString() }; 

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
        console.log("Update of subjective params for userId " , userId, " successfull.");
    } catch (error) {
        console.error("Error updating subjective parameters for userId ", userId, ":", error);
        throw error;
    }
}

export { writeSubjectiveParamsToDb };