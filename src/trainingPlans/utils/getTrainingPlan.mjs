import { BatchGetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/* 
function to read training plans from database for a list of users and format it for sending it back to frontend
*/
async function getTrainingPlan(dynamoDbClient, userIds) {
    const keys = userIds.map(userId => ({
      userId: { S: userId }
    }));
  
    const params = {
      RequestItems: {
        'coaching_training_plans': {
          Keys: keys,
          ProjectionExpression: '#userId, dateDay1, day1, day2, day3, day4, day5, day6, day7',
          ExpressionAttributeNames: {
            '#userId': 'userId'
          }
        }
      }
    };
  
    let data;
    try {
      data = await dynamoDbClient.send(new BatchGetItemCommand(params));
    } catch (error) {
      console.error('Error fetching workout plans:', error);
      throw new Error('Error fetching workout plans');
    }
  
    const results = data.Responses['coaching_training_plans'].map(item => {
        const unmarshalledItem = unmarshall(item);
        return {
            userId: unmarshalledItem.userId,
            workoutPlan: processTrainingPlan(unmarshalledItem)
        };
    });
    console.log("Training plan for users ", userIds, " fetched successfully.");
    return results;
  }
  
/* 
helper function to process training plan for one userId
*/
function processTrainingPlan(items) {
    const baseDate = new Date(items.dateDay1);
    const trainingPlan = {};

    for (let i = 1; i <= 7; i++) {
        const dateKey = `day${i}`;
        if (items[dateKey]) {
            const dayPlan = JSON.parse(items[dateKey]);

            if (dayPlan.running === 0) {
                continue;
            }

            const currentDate = new Date(baseDate);
            currentDate.setDate(baseDate.getDate() + (i - 1));
            const formattedDate = currentDate.toISOString().split('T')[0];

            let sessionCounter = 1;

            if (dayPlan.running !== 0 && typeof dayPlan.running === 'object') {
                Object.entries(dayPlan.running).forEach(([sessionKey, sessionValue]) => {
                    const timestampKey = `${formattedDate}_${sessionCounter}`;
                    trainingPlan[timestampKey] = {
                        type: 'RUNNING',
                        workout: sessionValue
                    };
                    sessionCounter++;
                });
            }
            }
        }
    return trainingPlan;
}

export { getTrainingPlan };