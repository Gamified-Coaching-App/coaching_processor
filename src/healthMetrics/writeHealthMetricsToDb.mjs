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
            console.log('Update of health metrics in DB successfull.');
        } catch (error) {
            console.error(`Error writing health metrics for user ${userId}:`, error);
            throw error;
        }
    }
}

export { writeHealthMetricsToDB };