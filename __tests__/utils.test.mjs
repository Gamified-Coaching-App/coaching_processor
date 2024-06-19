import { setupDynamoDB, teardownDynamoDB, client, transformDynamoDBItem } from './setup.mjs';
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb, writeSubjectiveParamsToDb , updateHeartRateZones} from '../src/utils.mjs';
import { ScanCommand } from "@aws-sdk/client-dynamodb";

describe('DynamoDB Service Tests', () => {
    beforeAll(async () => {
        await setupDynamoDB();
    }, 30000);  

    afterAll(async () => {
        await teardownDynamoDB();
    });

    test('getKmPerHeartRateZone: Correctly calculates distances per heart rate zones', () => {
        // Define heart rate zones
        const zones = {
            zone1Lower: 0,
            zone1Upper: 90,
            zone2Lower: 90,
            zone2Upper: 110,
            zone3Lower: 110,
            zone3Upper: 130,
            zone4Lower: 130,
            zone4Upper: 150,
            zone5Lower: 150,
            zone5Upper: 180
        };
        const heartRates = {
            "0": 85,   // Zone 1
            "10": 95,  // Zone 2
            "5": 120,   // Zone 3
            "25": 150,   // Zone 5
            "20": 140,  // Zone 4
            "30": 85  // Zone 1
        };
        const distances = {
            "0": 0,
            "10": 3000,
            "5": 1000,
            "25": 6000, 
            "20": 5000, 
            "30": 7000 
        };
        const result = getKmPerHeartRateZone(zones, heartRates, distances);
        const expectedResults = {
            zone1: 1,    
            zone2: 2,    
            zone3: 1,    
            zone4: 2,
            zone5: 1
        };
        expect(result).toEqual(expectedResults);
    });

    test('writeWorkoutToDb: Running day increment succesfull', async () => {
        const response = await writeWorkoutToDb(client, "1", "1", "RUNNING", "2", "01:00:00", {
            kmZone1: 1, kmZone2: 1, kmZone3: 1, kmZone4: 1, kmZone5: 1
        });
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        // Define expected data structure for all items in the database
        const expectedItems = [{
            userId: "1",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 7,
            kmZ3Z4: 2.5,
            kmZ5: 1.5,
            kmSprint: 1,
            hoursAlternative: "00:59:59",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "2":null },
            perceivedRecovery: { "1": null, "2": null },
            perceivedExertion: { "1": null, "2": null },
            injured: false
        }];

        expect(items).toEqual(expectedItems);

    });

    test('writeWorkoutToDb: Adding new day for RUNNING workout succesfull', async () => {
        const response = await writeWorkoutToDb(client, "2", "1", "RUNNING", "1", "01:00:00", {
            kmZone1: 1, kmZone2: 1, kmZone3: 1, kmZone4: 1, kmZone5: 1
        });
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 7,
            kmZ3Z4: 2.5,
            kmZ5: 1.5,
            kmSprint: 1,
            hoursAlternative: "00:59:59",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "2":null },
            perceivedRecovery: { "1": null, "2": null },
            perceivedExertion: { "1": null, "2": null },
            injured: false},
            {
            userId: "2",
            timestampLocal: "1",
            numberSessions: 1,
            kmTotal: 5,
            kmZ3Z4: 2,
            kmZ5: 1,
            kmSprint: 0.5,
            hoursAlternative: "00:00:00",
            numberStrengthSessions: 0,
            perceivedTrainingSuccess: { "1": null},
            perceivedRecovery: { "1": null },
            perceivedExertion: { "1": null },
            injured: false
        }
        ];

        expect(items).toEqual(expectedItems);

    });

    test('writeWorkoutToDb: Adding STRENGTH workout succesfull', async () => {
        const response = await writeWorkoutToDb(client, "2", "1", "STRENGTH", "3");
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 7,
            kmZ3Z4: 2.5,
            kmZ5: 1.5,
            kmSprint: 1,
            hoursAlternative: "00:59:59",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "2":null },
            perceivedRecovery: { "1": null, "2": null },
            perceivedExertion: { "1": null, "2": null },
            injured: false},
            {
            userId: "2",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 5,
            kmZ3Z4: 2,
            kmZ5: 1,
            kmSprint: 0.5,
            hoursAlternative: "00:00:00",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "3": null},
            perceivedRecovery: { "1": null, "3": null },
            perceivedExertion: { "1": null,  "3": null },
            injured: false
        }];

        expect(items).toEqual(expectedItems);

    });
    test('writeWorkoutToDb: Adding OTHER workout succesfull', async () => {
        const response = await writeWorkoutToDb(client, "1", "1", "OTHER", "4", "01:04:59");
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: "1",
            numberSessions: 3,
            kmTotal: 7,
            kmZ3Z4: 2.5,
            kmZ5: 1.5,
            kmSprint: 1,
            hoursAlternative: "02:04:58",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "2":null, "4":null },
            perceivedRecovery: { "1": null, "2":null, "4":null } ,
            perceivedExertion: { "1": null, "2":null, "4":null } ,
            injured: false},
            {
            userId: "2",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 5,
            kmZ3Z4: 2,
            kmZ5: 1,
            kmSprint: 0.5,
            hoursAlternative: "00:00:00",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "3": null},
            perceivedRecovery: { "1": null, "3": null },
            perceivedExertion: { "1": null,  "3": null },
            injured: false
        }];

        expect(items).toEqual(expectedItems);

    });

    test('writeSubjectiveParamsToDb: Adding params to DB succesfull', async () => {
        const response = await writeSubjectiveParamsToDb(client, { userId : 1, timestampLocal : 1, sessionId : 1, perceivedExertion : 0.1 , perceivedRecovery : 0.5, perceivedTrainingsSuccess : 0.8 });
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: "1",
            numberSessions: 3,
            kmTotal: 7,
            kmZ3Z4: 2.5,
            kmZ5: 1.5,
            kmSprint: 1,
            hoursAlternative: "02:04:58",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": 0.8, "2":null, "4":null },
            perceivedRecovery: { "1": 0.5, "2":null, "4":null } ,
            perceivedExertion: { "1": 0.1, "2":null, "4":null } ,
            injured: false},
            {
            userId: "2",
            timestampLocal: "1",
            numberSessions: 2,
            kmTotal: 5,
            kmZ3Z4: 2,
            kmZ5: 1,
            kmSprint: 0.5,
            hoursAlternative: "00:00:00",
            numberStrengthSessions: 1,
            perceivedTrainingSuccess: { "1": null, "3": null},
            perceivedRecovery: { "1": null, "3": null },
            perceivedExertion: { "1": null,  "3": null },
            injured: false
        }];

        expect(items).toEqual(expectedItems);

    });

    test('updateHeartRateZones: successful for existing user with no health data', async () => {
        const response = await updateHeartRateZones(client, ["1"]);
        const scanParams = {
            TableName: "coaching_heart_rate_zones"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            zone1Lower: 0,
            zone1Upper: 126,
            zone2Lower: 126,
            zone2Upper: 145,
            zone3Lower: 145,
            zone3Upper: 165,
            zone4Lower: 165,
            zone4Upper: 174,
            zone5Lower: 174,
            zone5Upper: 194
        }];

        expect(items).toEqual(expectedItems);

    });

    test('getHeartRateZones: successful for user without heart rate zone data', async () => {
        const item = await getHeartRateZones(client, "2");
        const scanParams = {
            TableName: "coaching_heart_rate_zones"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const dbItems = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItem = {
            zone1Lower: 0,
            zone1Upper: 127,
            zone2Lower: 127,
            zone2Upper: 146,
            zone3Lower: 146,
            zone3Upper: 166,
            zone4Lower: 166,
            zone4Upper: 176,
            zone5Lower: 176,
            zone5Upper: 195
        };

        const expectedDbItems = [{
            userId: "1",
            zone1Lower: 0,
            zone1Upper: 126,
            zone2Lower: 126,
            zone2Upper: 145,
            zone3Lower: 145,
            zone3Upper: 165,
            zone4Lower: 165,
            zone4Upper: 174,
            zone5Lower: 174,
            zone5Upper: 194},
            {
            userId: "2",
            zone1Lower: 0,
            zone1Upper: 127,
            zone2Lower: 127,
            zone2Upper: 146,
            zone3Lower: 146,
            zone3Upper: 166,
            zone4Lower: 166,
            zone4Upper: 176,
            zone5Lower: 176,
            zone5Upper: 195}];
        expect(item).toEqual(expectedItem);
        expect(dbItems).toEqual(expectedDbItems);
    });

});
