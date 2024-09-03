import moment from 'moment';
import { QueryCommand } from '@aws-sdk/client-dynamodb';

/* 
function to get a @days of continous data from the coaching daily log for a list of users, for a specified time period. Needed for load targets inference 
*/
async function getContinousWorkoutData(dynamoDbClient, data = { userIds : [], startDate : null, days : 21} ) {
    let { userIds, startDate, days } = data;
    if (days == undefined) {
        days = 21;
    }
    const endDate = moment(startDate).subtract(days, 'days').format('YYYY-MM-DD');
    console.log("Fetching data for the last ", days, " days, from ", startDate, " to ", endDate);
    const results = [];

    for (const userId of userIds) {
        const params = {
            TableName: "coaching_daily_log",
            KeyConditionExpression: "userId = :userId AND timestampLocal BETWEEN :endDate AND :startDate",
            ExpressionAttributeValues: {
                ":userId": { S: userId },
                ":endDate": { S: endDate },
                ":startDate": { S: startDate }
            }
        };

        try {
            const data = await dynamoDbClient.send(new QueryCommand(params));
            const items = data.Items || [];

            const dateMap = {};

            items.forEach(item => {
                const date = item.timestampLocal.S;
                dateMap[date] = fillDefaults({
                    numberSessions: item.numberSessions?.N,
                    kmTotal: item.kmTotal?.N,
                    kmZ3Z4: item.kmZ3Z4?.N,
                    kmZ5: item.kmZ5?.N,
                    kmSprint: item.kmSprint?.N,
                    hoursAlternative: item.hoursAlternative?.S,
                    numberStrengthSessions: item.numberStrengthSessions?.N,
                    perceivedTrainingSuccess: item.perceivedTrainingSuccess?.M,
                    perceivedRecovery: item.perceivedRecovery?.M,
                    perceivedExertion: item.perceivedExertion?.M,
                    injured: item.injured?.BOOL
                });
            });

            const userData = { userId, data: {} };
            for (let i = 0; i < days; i++) {
                const date = moment(startDate).subtract(i, 'days').format('YYYY-MM-DD');
                userData.data[`day${days - i}`] = dateMap[date] || fillDefaults({ userId, timestampLocal: date });
            }

            results.push(userData);
        } catch (error) {
            console.error(`Error fetching data for user ${userId}:`, error);
        }
        console.log("Continuous workout data fetched successfully for user", userId);
    }

    return results;
}

/* 
function to round time strings
*/
function roundToNearestHour(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours + (minutes >= 30 ? 1 : 0);
}

/* 
function to compute average of non-null values for subjective paramaters
*/
function averageNonNull(values, defaultValue = -0.1) {
    const validValues = values.filter(v => v !== null && v !== undefined);
    if (validValues.length === 0) return defaultValue;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
}

/* 
function to parse number
*/
function parseNumber(value) {
    return value !== undefined ? parseFloat(value) : 0;
}

/* 
function to parse map
*/
function parseMap(map) {
    if (!map) return {};
    return Object.keys(map).reduce((acc, key) => {
        acc[key] = map[key].N !== undefined ? parseFloat(map[key].N) : null;
        return acc;
    }, {});
}

/* 
function to fill in default values if data is incomplete
*/
function fillDefaults(data) {
    return {
        numberSessions: parseNumber(data.numberSessions),
        kmTotal: parseNumber(data.kmTotal),
        kmZ3Z4: parseNumber(data.kmZ3Z4),
        kmZ5: parseNumber(data.kmZ5),
        kmSprint: parseNumber(data.kmSprint),
        hoursAlternative: data.hoursAlternative ? roundToNearestHour(data.hoursAlternative) : 0,
        numberStrengthSessions: parseNumber(data.numberStrengthSessions),
        perceivedTrainingSuccess: averageNonNull(Object.values(parseMap(data.perceivedTrainingSuccess))),
        perceivedRecovery: averageNonNull(Object.values(parseMap(data.perceivedRecovery))),
        perceivedExertion: averageNonNull(Object.values(parseMap(data.perceivedExertion))),
        injured: data.injured !== undefined ? data.injured : false
    };
}

export { getContinousWorkoutData };