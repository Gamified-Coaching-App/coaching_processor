import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from "@aws-sdk/util-dynamodb";

async function insertTrainingPlansToDb(dynamoDbClient, { trainingPlans, timestamp }) {
    const tableName = 'coaching_training_plans';
    const dateDay1 = timestamp.slice(0, 10); // Extract the date part from the timestamp
  
    const updatePromises = trainingPlans.map(async (userPlan) => {
      const { userId, trainingPlan } = userPlan;
      const params = {
        TableName: tableName,
        Key: marshall({ userId }, { removeUndefinedValues: true }),
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
        ExpressionAttributeValues: marshall({
          ':day1': JSON.stringify(trainingPlan.day1),
          ':day2': JSON.stringify(trainingPlan.day2),
          ':day3': JSON.stringify(trainingPlan.day3),
          ':day4': JSON.stringify(trainingPlan.day4),
          ':day5': JSON.stringify(trainingPlan.day5),
          ':day6': JSON.stringify(trainingPlan.day6),
          ':day7': JSON.stringify(trainingPlan.day7),
          ':updatedTimestamp': timestamp,
          ':dateDay1': dateDay1
        }),
        ReturnValues: 'UPDATED_NEW'
      };
  
      try {
        await dynamoDbClient.send(new UpdateItemCommand(params));
        console.log('Training plan update in DB for userId:', userId, "successfull");
      } catch (error) {
        console.error('Error updating training plans in DB data for userId', userId, ":", error);
        throw error;
      }
    });
  
    try {
      await Promise.all(updatePromises);
      console.log('All training plans updated successfully');
    } catch (error) {
      console.error('Error updating training plans in DB', error);
    }
  }

  export { insertTrainingPlansToDb };