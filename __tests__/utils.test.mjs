import { setupDynamoDB, teardownDynamoDB, client, transformDynamoDBItem , DAY_0 } from './setup.mjs';
import { getHeartRateZones, getKmPerHeartRateZone, writeWorkoutToDb, writeSubjectiveParamsToDb , updateHeartRateZones, getContinousWorkoutData, getLoadTargetInference , insertLoadTargetsToDb, insertTrainingPlansToDb, getTrainingPlan} from '../src/utils.mjs';
import { buildWorkouts } from '../src/workoutBuilder/workoutBuilder.mjs';
import { sendWorkouts, deleteWorkouts, pushWorkoutsToPartners } from '../src/workoutSender/workoutSender.mjs';
import { getMeanStdv, insertMeanStdvToDb } from '../src/inferencePipeline/utils.mjs';
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import moment from 'moment';
import { expect } from '@jest/globals';
import { load } from 'mime';

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
        const heartRatesJson = JSON.stringify(heartRates);
        const distancesJson = JSON.stringify(distances);
        const result = getKmPerHeartRateZone(zones, heartRatesJson, distancesJson);
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
        const response = await writeWorkoutToDb(client, {userId : "1", timestampLocal: DAY_0, activityType : "RUNNING", sessionId: "2", duration : "01:00:00", kmPerHeartRateZone : {
            zone1: 1, zone2: 1, zone3: 1, zone4: 1, zone5: 1 }});

        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        // Define expected data structure for all items in the database
        const expectedItems = [{
            userId: "1",
            timestampLocal: DAY_0,
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
        const response = await writeWorkoutToDb(client, {userId : "2", timestampLocal: DAY_0, activityType : "RUNNING", sessionId: "1", duration : "01:00:00", kmPerHeartRateZone : {
            zone1: 1, zone2: 1, zone3: 1, zone4: 1, zone5: 1 }});
        
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: DAY_0,
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
            timestampLocal: DAY_0,
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

    test('writeWorkoutToDb: Adding STRENGTH_CONDITIONING workout succesfull', async () => {
        const response = await writeWorkoutToDb(client, {userId : "2", timestampLocal: DAY_0, activityType : "STRENGTH_CONDITIONING", sessionId: "3"});
        
        // await writeWorkoutToDb(client, "2", "1", "STRENGTH", "3");
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: DAY_0,
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
            timestampLocal: DAY_0,
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
        const response = await writeWorkoutToDb(client, {userId : "1", timestampLocal: DAY_0, activityType : "OTHER", sessionId: "4", duration : "01:04:59"});
        
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: DAY_0,
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
            timestampLocal: DAY_0,
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
        const response = await writeSubjectiveParamsToDb(client, { userId : "1", timestampLocal : DAY_0, sessionId : "1", perceivedExertion : 0.1 , perceivedRecovery : 0.5, perceivedTrainingSuccess : 0.8 });
        const scanParams = {
            TableName: "coaching_daily_log"
        };
        const command = new ScanCommand(scanParams);
        const data = await client.send(command);
        const items = data.Items.map(item => transformDynamoDBItem(item));

        const expectedItems = [{
            userId: "1",
            timestampLocal: DAY_0,
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
            timestampLocal: DAY_0,
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

    test('getContinousWorkoutData: successful for all users', async () => {
        const day1 = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        const result = await getContinousWorkoutData(client, {userIds :["1", "2"], startDate : day1} );
    
        console.log(JSON.stringify(result, null, 2));

        // Check if the object has 2 UserIDs with 21 consecutive days
    expect(result).toHaveLength(2);
    result.forEach(user => {
        expect(Object.keys(user.data)).toHaveLength(21);
        for (let i = 1; i <= 21; i++) {
            expect(user.data).toHaveProperty(`day${i}`);
        }
    });

    // Check if day20 for both users contains the expected hardcoded data
    const expectedDay20User1 = {
        //userId: '1',
        //timestampLocal: DAY_0,
        numberSessions: 3,
        kmTotal: 7,
        kmZ3Z4: 2.5,
        kmZ5: 1.5,
        kmSprint: 1,
        hoursAlternative: 2,
        numberStrengthSessions: 1,
        perceivedTrainingSuccess: 0.8,
        perceivedRecovery: 0.5,
        perceivedExertion: 0.1,
        injured: false
    };
    const expectedDay20User2 = {
        //userId: '2',
        //timestampLocal: DAY_0,
        numberSessions: 2,
        kmTotal: 5,
        kmZ3Z4: 2,
        kmZ5: 1,
        kmSprint: 0.5,
        hoursAlternative: 0,
        numberStrengthSessions: 1,
        perceivedTrainingSuccess: -0.1,
        perceivedRecovery: -0.1,
        perceivedExertion: -0.1,
        injured: false
    };

    expect(result[0].data.day20).toEqual(expectedDay20User1);
    expect(result[1].data.day20).toEqual(expectedDay20User2);

    // Check if all other days for both users have the default values
    const defaultDay = {
        numberSessions: 0,
        kmTotal: 0,
        kmZ3Z4: 0,
        kmZ5: 0,
        kmSprint: 0,
        hoursAlternative: 0,
        numberStrengthSessions: 0,
        perceivedTrainingSuccess: -0.1,
        perceivedRecovery: -0.1,
        perceivedExertion: -0.1,
        injured: false
    };

    result.forEach(user => {
        for (let i = 1; i <= 21; i++) {
            if (i !== 20) {
                const dayData = user.data[`day${i}`];
                expect(dayData.numberSessions).toEqual(defaultDay.numberSessions);
                expect(dayData.kmTotal).toEqual(defaultDay.kmTotal);
                expect(dayData.kmZ3Z4).toEqual(defaultDay.kmZ3Z4);
                expect(dayData.kmZ5).toEqual(defaultDay.kmZ5);
                expect(dayData.kmSprint).toEqual(defaultDay.kmSprint);
                expect(dayData.hoursAlternative).toEqual(defaultDay.hoursAlternative);
                expect(dayData.numberStrengthSessions).toEqual(defaultDay.numberStrengthSessions);
                expect(dayData.perceivedTrainingSuccess).toEqual(defaultDay.perceivedTrainingSuccess);
                expect(dayData.perceivedRecovery).toEqual(defaultDay.perceivedRecovery);
                expect(dayData.perceivedExertion).toEqual(defaultDay.perceivedExertion);
                expect(dayData.injured).toEqual(defaultDay.injured);
            }
        }
    });
    });

    test('getLoadTargetInference: successful for all users', async () => {
        const users = ["1", "2"];
        const day1 = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        const data = await getContinousWorkoutData(client, {userIds : users, startDate : day1 } );
        const { loadTargets, timestamp } = await getLoadTargetInference(data);

        console.log("got load target for timestamp ,", timestamp, "\"", JSON.stringify(loadTargets, null, 2));
        await insertLoadTargetsToDb(client, { loadTargets, timestamp} );
        expect(true).toEqual(true);
    });

    test('buildWorkouts: successful for all users', async () => {
        const loadTargets = [
            {
              "userId": "1",
              "loadTargets": {
                "day1": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day2": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day3": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day4": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day5": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day6": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day7": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 }
              }
            },
            {
              "userId": "2",
              "loadTargets": {
                "day1": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day2": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day3": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day4": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day5": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day6": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
                "day7": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 }
              }
            }
          ];
        const nonActiveUsers = null;
        const trainingPlans = buildWorkouts(loadTargets, nonActiveUsers);
        const timestamp = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        console.log('trainingPlans:\n', trainingPlans);
        
        await insertTrainingPlansToDb(client, { trainingPlans, timestamp });

        const expectedDayPlan = {
            "running": {
              "session_1": {
                "warmup": { "Z2": 1.5 },
                "main": {
                  "interval_1": [
                    { "Z5": 1 },
                    { "Z2": 1 }
                  ]
                },
                "cooldown": { "Z2": 1.5 }
              }
            },
            "strength": 0,
            "alternative": 0
          };
        trainingPlans.forEach(userPlan => {
            for (let i = 1; i <= 7; i++) {
              const dayKey = `day${i}`;
              const dayPlan = userPlan.trainingPlan[dayKey];
              expect(dayPlan).toEqual(expectedDayPlan);
            }
          });
    });
    test('getTrainingPlan: successful for all users', async () => {
        const trainingPlan = await getTrainingPlan(client, [1]);
        const day1 = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        const day2 = moment(DAY_0).add(2, 'days').format('YYYY-MM-DD');
        const day3 = moment(DAY_0).add(3, 'days').format('YYYY-MM-DD');
        const day4 = moment(DAY_0).add(4, 'days').format('YYYY-MM-DD');
        const day5 = moment(DAY_0).add(5, 'days').format('YYYY-MM-DD');
        const day6 = moment(DAY_0).add(6, 'days').format('YYYY-MM-DD');
        const day7 = moment(DAY_0).add(7, 'days').format('YYYY-MM-DD');

        console.log('trainingPlan:\n', trainingPlan);

        const expectedTrainingPlan = [{
            userId: '1',
            workoutPlan: {
                [`${day1}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day2}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day3}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day4}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day5}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day6}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                [`${day7}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}}
            }
            }];
        expect(trainingPlan).toEqual(expectedTrainingPlan);
    });

    // test('sendWorkouts and deleteWorkouts: successful for all users', async () => {
    //     const workout = {
    //         "workoutName": "Bike Workout",
    //         "description": "TEST1",
    //         "sport": "CYCLING",
    //         "estimatedDurationInSecs": 3600,
    //         "estimatedDistanceInMeters": 10000,
    //         "workoutProvider": "test",
    //         "workoutSourceId": 1,
    //         "steps": [
    //             {
    //                 "type": "WorkoutStep",
    //                 "stepOrder": 1,
    //                 "intensity": "ACTIVE",
    //                 "description": "Test description",
    //                 "durationType": "TIME",
    //                 "durationValue": 120,
    //                 "durationValueType": null,
    //                 "targetType": "SPEED",
    //                 "targetValue": null,
    //                 "targetValueLow": 3.3809523,
    //                 "targetValueHigh": 2.3809523,
    //                 "targetValueType": null,
    //                 "secondaryTargetType": "POWER",
    //                 "secondaryTargetValue": null,
    //                 "secondaryTargetValueLow": 100,
    //                 "secondaryTargetValueHigh": 120,
    //                 "secondaryTargetValueType": null
    //         }]
    //     };
    //     const today = moment().format('YYYY-MM-DD');
    //     const userData = [{
    //         userId: 'a4370654-eedc-4b84-b52f-cb0450020e9c',
    //         workout: workout, 
    //         timestampLocal: today
    //     }];
    //     console.log('userData as input to sendWorkouts:\n', userData);
    //     let response = await sendWorkouts(userData);
    //     const deleteData = response.map(({ workoutId, scheduleId }) => ({ userId: "a4370654-eedc-4b84-b52f-cb0450020e9c", ids: { workout: workoutId, schedule: scheduleId } }));
    //     console.log("deleteData", deleteData);
    //     response = await deleteWorkouts(deleteData);

    //     const expectedResponse = [
    //         {
    //           userId: 'a4370654-eedc-4b84-b52f-cb0450020e9c',
    //           statusOkWorkout: true,
    //           statusOkSchedule: true
    //         }
    //       ];
    //     expect(response).toEqual(expectedResponse);
    // },15000);

    // test('pushWorkoutsToGarmin: successful for all users', async () => {
    //     const scanParams = {
    //         TableName: "coaching_partner_tracking"
    //     };
    //     const loadTargets = [
    //         {
    //           "userId": "a4370654-eedc-4b84-b52f-cb0450020e9c",
    //           "loadTargets": {
    //             "day1": { "numberSession": 1, "totalKm": 10, "kmZ34": 1, "kmZ5": 2, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day2": { "numberSession": 1, "totalKm": 10, "kmZ34": 1, "kmZ5": 2, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day3": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day4": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day5": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day6": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 },
    //             "day7": { "numberSession": 1, "totalKm": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0, "numberStrengthSessions": 0, "hoursAlternative": 0 }
    //           }
    //         }];
    //     const nonActiveUsers = [];
    //     const trainingPlans = buildWorkouts(loadTargets, nonActiveUsers);
    //     const timestamp = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
    //     await pushWorkoutsToPartners(client, trainingPlans, timestamp);
    //     let command = new ScanCommand(scanParams);
    //     let data = await client.send(command);
    //     let items = data.Items.map(item => transformDynamoDBItem(item));
    //     console.log('coaching_partner_tracking after first operation:', JSON.stringify(items, 2, null));
    //     await pushWorkoutsToPartners(client, trainingPlans, timestamp);
    //     command = new ScanCommand(scanParams);
    //     data = await client.send(command);
    //     items = data.Items.map(item => transformDynamoDBItem(item));
    //     console.log('coaching_partner_tracking after second operation:', JSON.stringify(items, 2, null));

    //     expect(true).toEqual(true);
    // }, 60000);

    test('getMeanStdv: successful for all users', async () => {
        const yesterdayTimestamp = moment().subtract(1, 'days').format('YYYY-MM-DD');
        const userIds = [1,2];
        const data = await getContinousWorkoutData(client, { userIds : userIds, startDate : yesterdayTimestamp, days : 90 });
        const meanSdtvPerUser = getMeanStdv(data);
        console.log('meanSdtvPerUser:\n', JSON.stringify(meanSdtvPerUser, null, 2));

        const expectedOutputUser1 = {
              "userId": 1,
              "values": {
                "numberSessions": {
                  "mean": 0.03333333333333333,
                  "stdv": 0.3144660377352204
                },
                "kmTotal": {
                  "mean": 0.07777777777777778,
                  "stdv": 0.7337540880488473
                },
                "kmZ3Z4": {
                  "mean": 0.027777777777777776,
                  "stdv": 0.2620550314460163
                },
                "kmZ5": {
                  "mean": 0.016666666666666666,
                  "stdv": 0.1572330188676102
                },
                "kmSprint": {
                  "mean": 0.011111111111111112,
                  "stdv": 0.10482201257840687
                },
                "hoursAlternative": {
                  "mean": 0.022222222222222223,
                  "stdv": 0.20964402515681374
                },
                "numberStrengthSessions": {
                  "mean": 0.011111111111111112,
                  "stdv": 0.10482201257840687
                },
                "perceivedTrainingSuccess": {
                  "mean": -0.08999999999999986,
                  "stdv": 0.09433981132056597
                },
                "perceivedRecovery": {
                  "mean": -0.09333333333333318,
                  "stdv": 0.06289320754704411
                },
                "perceivedExertion": {
                  "mean": -0.0977777777777776,
                  "stdv": 0.02096440251568127
                }
              }
            };
        expect(meanSdtvPerUser[0]).toEqual(expectedOutputUser1);
    }, 60000);
});
