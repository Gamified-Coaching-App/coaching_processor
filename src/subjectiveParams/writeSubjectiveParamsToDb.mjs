import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

/* 
function to write subjective parameters to the database by processing session id, which is workout specific and 
add this value to the corresponding training day (@timestampLocal)
*/
async function writeSubjectiveParamsToDb(dynamoDbClient, params) {
    const { userId, timestampLocal, sessionId, perceivedExertion, perceivedRecovery, perceivedTrainingSuccess } = params;

    let updateExpression = "set ";
    let expressionAttributeValues = {};
    let expressionAttributeNames = { "#sid": sessionId.toString() }; 

    if (perceivedExertion !== undefined) {
        updateExpression += "perceivedExertion.#sid = :pe, ";
        expressionAttributeValues[":pe"] = { N: perceivedExertion.toString() };
    }

    if (perceivedRecovery !== undefined) {
        updateExpression += "perceivedRecovery.#sid = :pr, ";
        expressionAttributeValues[":pr"] = { N: perceivedRecovery.toString() };
    }

    if (perceivedTrainingSuccess !== undefined) {
        updateExpression += "perceivedTrainingSuccess.#sid = :pts, ";
        expressionAttributeValues[":pts"] = { N: perceivedTrainingSuccess.toString() };
    }

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