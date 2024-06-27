import * as math from 'mathjs';
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

function getMeanStdv(data) {
    console.log("Calculating mean and stdv for users");
    console.log("Data: ", data[0]);

    const metrics = [
        'numberSessions',
        'kmTotal',
        'kmZ3Z4',
        'kmZ5',
        'kmSprint',
        'hoursAlternative',
        'numberStrengthSessions',
        'perceivedTrainingSuccess',
        'perceivedRecovery',
        'perceivedExertion'
    ];

    const meanStdvPerUser = data.map(user => {
        const userId = user.userId;
        const daysData = Object.values(user.data);
        const metricValues = {};
        metrics.forEach(metric => {
            metricValues[metric] = [];
        });
        daysData.forEach(day => {
            metrics.forEach(metric => {
                metricValues[metric].push(Number(day[metric]));
            });
        });
        const metricMeans = {};
        const metricStdvs = {};

        metrics.forEach(metric => {
            console.log("Metric values:", metricValues[metric])
            metricMeans[metric] = math.mean(metricValues[metric]);
            metricStdvs[metric] = math.std(metricValues[metric], 'uncorrected'); // 'uncorrected' for population std dev
        });

        return {
            userId,
            values: metrics.reduce((acc, metric) => {
                acc[metric] = {
                    mean: metricMeans[metric],
                    stdv: metricStdvs[metric]
                };
                return acc;
            }, {})
        };
    });

    return meanStdvPerUser;
}

async function insertMeanStdvToDb(dynamoDbClient, meanStdvPerUser) {
    for (const user of meanStdvPerUser) {
        const { userId, values } = user;

        // Prepare UpdateExpression and ExpressionAttributeValues
        const updateExpression = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        for (const [metric, stats] of Object.entries(values)) {
            const roundedMean = Number(stats.mean.toFixed(4));
            const roundedStdv = Number(stats.stdv.toFixed(4));
            const statsString = JSON.stringify({ mean: roundedMean, stdv: roundedStdv });
            updateExpression.push(`#${metric} = :${metric}`);
            expressionAttributeValues[`:${metric}`] = { S: statsString };
            expressionAttributeNames[`#${metric}`] = metric;
        }

        const updateExpressionString = `SET ${updateExpression.join(', ')}`;

        const params = {
            TableName: 'coaching_mean_stdv',
            Key: { userId: { S: userId.toString() } },
            UpdateExpression: updateExpressionString,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames
        };

        try {
            await dynamoDbClient.send(new UpdateItemCommand(params));
            console.log(`Successfully inserted mean and stdv values for userId: ${userId}`);
        } catch (error) {
            console.error(`Failed to insert mean and stdv values for userId: ${userId}`, error);
            return false;
        }
    }
    return true;
}

export {getMeanStdv, insertMeanStdvToDb};



