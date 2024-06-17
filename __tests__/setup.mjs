import { DynamoDBClient, CreateTableCommand, PutItemCommand, BatchWriteItemCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";

export const client = new DynamoDBClient({
    endpoint: "http://localhost:8000",
    region: "local-env",
    credentials: {
        accessKeyId: "fakeMyKeyId",
        secretAccessKey: "fakeSecretAccessKey"
    }
});

// Table names with descriptive variables
const dailyLogTableName = "coaching_daily_log";
const heartRateZonesTableName = "coaching_heart_rate_zones";
const healthTableName = "coaching_health";
const userDataTableName = "coaching_user_data";
const loadTargetsTableName = "coaching_load_targets";
const trainingPlansTableName = "coaching_training_plans";

export async function setupDynamoDB() {
    await sleep(5000);
    // Create tables
    const createTableCommands = [
        new CreateTableCommand({
            TableName: dailyLogTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" },
                { AttributeName: "timestampLocal", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" },
                { AttributeName: "timestampLocal", KeyType: "RANGE" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        }),
        new CreateTableCommand({
            TableName: heartRateZonesTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        }),
        new CreateTableCommand({
            TableName: healthTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" },
                { AttributeName: "timestampLocal", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" },
                { AttributeName: "timestampLocal", KeyType: "RANGE" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        }),
        new CreateTableCommand({
            TableName: userDataTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        }),
        new CreateTableCommand({
            TableName: loadTargetsTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        }),
        new CreateTableCommand({
            TableName: trainingPlansTableName,
            AttributeDefinitions: [
                { AttributeName: "userId", AttributeType: "S" }
            ],
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        })
    ];

    // Execute creation commands
    for (let command of createTableCommands) {
        await client.send(command);
    }

    // Insert initial data for heart rate zones
    await client.send(new PutItemCommand({
        TableName: heartRateZonesTableName,
        Item: {
            userId: { S: "1" },
            zone1Lower: { N: "0" },
            zone1Upper: { N: "90" },
            zone2Lower: { N: "90" },
            zone2Upper: { N: "110" },
            zone3Lower: { N: "110" },
            zone3Upper: { N: "130" },
            zone4Lower: { N: "130" },
            zone4Upper: { N: "150" },
            zone5Lower: { N: "150" },
            zone5Upper: { N: "180" }
        }
    }));

    // Insert initial health data
    const healthData = Array.from({ length: 6 }, (_, index) => ({
        PutRequest: {
            Item: {
                userId: { S: "1" },
                timestampLocal: { S: String(index + 1) },  // Different timestamps
                maxHeartRate: { N: String(190 - index) },  // Slightly deviating values
                restingHeartRate: { N: String(40 + index) }
            }
        }
    }));
    await client.send(new BatchWriteItemCommand({
        RequestItems: {
            [healthTableName]: healthData
        }
    }));

     // Insert initial user data
     const item = {
        userId: { S: "1" },
        timestampLocal: { S: "1" },
        numberSessions: { N: "1" },
        kmTotal: { N: "2" },
        kmZ3Z4: { N: "0.5" },
        kmZ5: { N: "0.5" },
        kmSprint: { N: "0.5" },
        hoursAlternative: { S: "00:59:59" },
        numberStrengthSessions: { N: "1" },
        perceivedTrainingSuccess: { M: { "1": { NULL: true }} },
        perceivedRecovery: { M: { "1": { NULL: true } } },
        perceivedExertion: { M: { "1": { NULL: true } } },
        injured: { BOOL: false }
    };

    try {
        const result = await client.send(new PutItemCommand({
            TableName: dailyLogTableName,
            Item: item
        }));
        console.log("Successfully inserted initial log item:", result);
    } catch (error) {
        console.error("Error inserting initial log item:", error);
    }

    // Insert initial user data
    await client.send(new PutItemCommand({
        TableName: userDataTableName,
        Item: {
            userId: { S: "1" },
            dateOfBirth: { S: "1997-04-03" }
        }
    }));

    await client.send(new PutItemCommand({
        TableName: userDataTableName,
        Item: {
            userId: { S: "2" },
            dateOfBirth: { S: "1998-08-10" }  // ISO format adjusted from "10. August 1998"
        }
    }));

    // Insert initial load targets data
    let updateParams = {
        TableName: loadTargetsTableName,
        Key: {
            "userId": { S: "1" }  // Assuming 'userId' is the only key
        },
        UpdateExpression: "set #day1 = :day1, #day2 = :day2, #day3 = :day3, #day4 = :day4, #day5 = :day5, #day6 = :day6, #day7 = :day7",
        ExpressionAttributeNames: {
            "#day1": "day_1",
            "#day2": "day_2",
            "#day3": "day_3",
            "#day4": "day_4",
            "#day5": "day_5",
            "#day6": "day_6",
            "#day7": "day_7"
        },
        ExpressionAttributeValues: {
            ":day1": { M: {
                kmTotal: { N: "5" },
                kmZ3Z4: { N: "3" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day2": { M: {
                kmTotal: { N: "4.9" },
                kmZ3Z4: { N: "2.95" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day3": { M: {
                kmTotal: { N: "4.8" },
                kmZ3Z4: { N: "2.9" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day4": { M: {
                kmTotal: { N: "4.7" },
                kmZ3Z4: { N: "2.85" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day5": { M: {
                kmTotal: { N: "4.6" },
                kmZ3Z4: { N: "2.8" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day6": { M: {
                kmTotal: { N: "4.5" },
                kmZ3Z4: { N: "2.75" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }},
            ":day7": { M: {
                kmTotal: { N: "4.4" },
                kmZ3Z4: { N: "2.7" },
                kmZ5: { N: "0.5" },
                kmSprint: { N: "0" },
                strength: { N: "0" },
                hoursAlternative: { N: "0" }
            }}
        }
    };

    try {
        const result = await client.send(new UpdateItemCommand(updateParams));
        console.log("Successfully updated load targets:", result);
    } catch (error) {
        console.error("Error updating load targets:", error);
    }

    // Insert initial training plans data (empty for now)
    updateParams = {
        TableName: trainingPlansTableName,
        Key: {
            "userId": { S: "1" }  // Assuming 'userId' is the only key
        },
        UpdateExpression: "set #day1 = :day1, #day2 = :day2, #day3 = :day3, #day4 = :day4, #day5 = :day5, #day6 = :day6, #day7 = :day7",
        ExpressionAttributeNames: {
            "#day1": "day_1",
            "#day2": "day_2",
            "#day3": "day_3",
            "#day4": "day_4",
            "#day5": "day_5",
            "#day6": "day_6",
            "#day7": "day_7"
        },
        ExpressionAttributeValues: {
            ":day1": { M: {} },
            ":day2": { M: {} },
            ":day3": { M: {} },
            ":day4": { M: {} },
            ":day5": { M: {} },
            ":day6": { M: {} },
            ":day7": { M: {} }
        }
    };

    try {
        const result = await client.send(new UpdateItemCommand(updateParams));
        console.log("Successfully updated training plans:", result);
    } catch (error) {
        console.error("Error updating training plans:", error);
    }
}

export async function teardownDynamoDB() {
    // Delete all tables
    const tableNames = [dailyLogTableName, heartRateZonesTableName, healthTableName, userDataTableName, loadTargetsTableName, trainingPlansTableName];
    for (let tableName of tableNames) {
        await client.send(new DeleteTableCommand({ TableName: tableName }));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function transformDynamoDBItem(item) {
    const transformed = {};

    // Iterate over each key in the item object
    for (const key in item) {
        if (!item.hasOwnProperty(key)) continue;
        const value = item[key];

        // Check the type of the DynamoDB attribute and convert accordingly
        if ('S' in value) {
            transformed[key] = value.S;
        } else if ('N' in value) {
            transformed[key] = Number(value.N);
        } else if ('BOOL' in value) {
            transformed[key] = value.BOOL;
        } else if ('M' in value) {
            transformed[key] = transformDynamoDBItem(value.M);
        } else if ('L' in value) {
            transformed[key] = value.L.map(element => transformDynamoDBItem(element));
        } else if ('NULL' in value) {
            transformed[key] = null;
        } else {
            console.warn(`Unhandled type for key ${key}:`, value);
        }
    }

    return transformed;
}