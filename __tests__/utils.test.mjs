import { setupDynamoDB, teardownDynamoDB, client, transformDynamoDBItem , DAY_0 } from './setup.mjs';
import { getHeartRateZones } from '../src/heartRateZones/getHeartRateZones.mjs';
import { getKmPerHeartRateZone } from '../src/dailyLog/getKmPerHeartRateZone.mjs';
import { writeWorkoutToDb } from '../src/dailyLog/writeWorkoutsToDb.mjs';
import { writeSubjectiveParamsToDb } from '../src/subjectiveParams/writeSubjectiveParamsToDb.mjs';
import { updateHeartRateZones } from '../src/heartRateZones/updateHeartRateZones.mjs';
import { getContinousWorkoutData } from '../src/loadTargets/getContinousWorkoutData.mjs';
import { getLoadTargetInference } from '../src/loadTargets/getLoadTargetInference.mjs';
import { insertLoadTargetsToDb } from '../src/loadTargets/insertLoadTargetsToDb.mjs';
import { insertTrainingPlansToDb } from '../src/trainingPlans/utils/insertTrainingPlansToDb.mjs';
import { getTrainingPlan } from '../src/trainingPlans/utils/getTrainingPlan.mjs';
import { buildWorkouts } from '../src/trainingPlans/workoutBuilder/workoutBuilder.mjs';
import { sendWorkouts, deleteWorkouts, pushWorkoutsToPartners, toGarminFormat } from '../src/trainingPlans/workoutSender/workoutSender.mjs';
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import moment from 'moment';
import { expect } from '@jest/globals';
import { empty } from 'statuses';

describe('DynamoDB Service Tests', () => {
    beforeAll(async () => {
        await setupDynamoDB();
    }, 30000);  

    afterAll(async () => {
        await teardownDynamoDB();
    });

    test('getKmPerHeartRateZone: Correctly calculates distances per heart rate zones', () => {
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
    
    expect(result).toHaveLength(2);
    result.forEach(user => {
        expect(Object.keys(user.data)).toHaveLength(21);
        for (let i = 1; i <= 21; i++) {
            expect(user.data).toHaveProperty(`day${i}`);
        }
    });

    const expectedDay20User1 = {
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
        const users = ["1"];
        const day1 = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        let data = await getContinousWorkoutData(client, {userIds : users, startDate : day1 , days : 56} );
        data[0].userId = 'a4370654-eedc-4b84-b52f-cb0450020e9c'
        const { loadTargets, timestamp } = await getLoadTargetInference(data);
 
        console.log("got load target for timestamp ,", timestamp, "\"", loadTargets);
        await insertLoadTargetsToDb(client, { loadTargets, timestamp} );
        expect(true).toEqual(true);
    });

    test('buildWorkouts: successful for all users', async () => {
        const loadTargets = 
            {
                "1": {
                    "day1": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day2": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day3": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day4": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day5": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day6": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day7": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 }
              },
                "2": {
                    "day1": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day2": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day3": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day4": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day5": { "numberSession": 0, "kmTotal": 0, "kmZ34": 0, "kmZ5": 0, "kmSprint": 0 },
                    "day6": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 },
                    "day7": { "numberSession": 1, "kmTotal": 5, "kmZ34": 1, "kmZ5": 1, "kmSprint": 0 }
              }
            };
        const nonActiveUsers = null;
        const trainingPlans = buildWorkouts(loadTargets, nonActiveUsers);
        const timestamp = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        
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
            }
          };
        const expectedEmptyDayPlan = {
            "running": 0
        }
        trainingPlans.forEach(userPlan => {
            for (let i = 1; i <= 7; i++) {
              const dayKey = `day${i}`;
              const dayPlan = userPlan.trainingPlan[dayKey];
              if (userPlan.userId === '2' && i === 5) {
                expect(dayPlan).toEqual(expectedEmptyDayPlan);
              } else {
                expect(dayPlan).toEqual(expectedDayPlan);
              }
            }
          });
    });

    test('buildWorkouts test 2: successful for all users', async () => {
        const loadTargets1 = {
            'a4370654-eedc-4b84-b52f-cb0450020e9c': {
            day1: { numberSessions: 0, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0},
            day2: { numberSessions: 1, kmTotal: 5.38, kmZ3Z4: 2.58, kmZ5: 0, kmSprint: 0 },
            day3: { numberSessions: 1, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0 },
            day4: { numberSessions: 1, kmTotal: 8, kmZ3Z4: 1.1, kmZ5: 0, kmSprint: 0 },
            day5: { numberSessions: 2, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0},
            day6: { numberSessions: 1, kmTotal: 7.990000000000001, kmZ3Z4: 4.180000000000001, kmZ5: 0, kmSprint: 0 },
            day7: { numberSessions: 0, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0}
            }
        };
        const loadTargets2 = {
            'a4370654-eedc-4b84-b52f-cb0450020e9c': {
            day1: { numberSessions: 0, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0 },
            day2: { numberSessions: 1, kmTotal: 10, kmZ3Z4: 2.58, kmZ5: 0, kmSprint: 0 },
            day3: { numberSessions: 1, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0 },
            day4: { numberSessions: 1, kmTotal: 10, kmZ3Z4: 1.1, kmZ5: 0, kmSprint: 0 },
            day5: { numberSessions: 2, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0 },
            day6: { numberSessions: 1, kmTotal: 10, kmZ3Z4: 4.180000000000001, kmZ5: 0, kmSprint: 0 },
            day7: { numberSessions: 0, kmTotal: 0, kmZ3Z4: 0, kmZ5: 0, kmSprint: 0 }
            }
        };
        const trainingPlan1 = buildWorkouts(loadTargets1, null);
        const trainingPlan2 = buildWorkouts(loadTargets2, null);

        const expectedTrainingPlan1 = [{"userId":"a4370654-eedc-4b84-b52f-cb0450020e9c","trainingPlan":{"day1":{"running":0},"day2":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}]}}}},"day3":{"running":0},"day4":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z2":1},{"Z2":1}]}}}},"day5":{"running":0},"day6":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}]}}}},"day7":{"running":0}}}];
        const expectedTrainingPlan2 = [{"userId":"a4370654-eedc-4b84-b52f-cb0450020e9c","trainingPlan":{"day1":{"running":0},"day2":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}],"interval_3":[{"Z2":1},{"Z2":1}]}}}},"day3":{"running":0},"day4":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z2":1},{"Z2":1}],"interval_3":[{"Z2":1},{"Z2":1}]}}}},"day5":{"running":0},"day6":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}],"interval_3":[{"Z4":1},{"Z2":1}]}}}},"day7":{"running":0}}}];

        expect(trainingPlan1).toEqual(expectedTrainingPlan1);
        expect(trainingPlan2).toEqual(expectedTrainingPlan2);
    });

    test('toGarminFormat: successful for all users', async () => {
        const trainingPlan1 = {"warmup":{"Z2":1.5},"main":{}};
        const heartRateZones = {
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
        const garminWorkout1 = toGarminFormat(trainingPlan1, heartRateZones);
        const trainingPlan2 = {"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}],"interval_3":[{"Z2":1},{"Z2":1}]}};
        const garminWorkout2 = toGarminFormat(trainingPlan2, heartRateZones);
        const expectedWorkout1 = {"workoutName":"Run","description":"This is an interval session with short and intense 1 km intervals.","sport":"RUNNING","estimatedDistanceInMeters":1500,"workoutProvider":"Blaze","steps":[{"type":"WorkoutStep","stepOrder":1,"intensity":"WARMUP","description":"WARMUP phase","durationType":"DISTANCE","durationValue":1500,"durationValueType":"METER","targetType":"HEART_RATE","targetValueLow":127,"targetValueHigh":146}]};
        const expectedWorkout2 = {
            "workoutName": "Run",
            "description": "This is an interval session with short and intense 1 km intervals.",
            "sport": "RUNNING",
            "estimatedDistanceInMeters": 9000,
            "workoutProvider": "Blaze",
            "steps": [
                {
                    "type": "WorkoutStep",
                    "stepOrder": 1,
                    "intensity": "WARMUP",
                    "description": "WARMUP phase",
                    "durationType": "DISTANCE",
                    "durationValue": 1500,
                    "durationValueType": "METER",
                    "targetType": "HEART_RATE",
                    "targetValueLow": 127,
                    "targetValueHigh": 146
                },
                {
                    "type": "WorkoutRepeatStep",
                    "repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
                    "repeatValue": 1,
                    "stepOrder": 2,
                    "steps": [
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 3,
                            "intensity": "INTERVAL",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 166,
                            "targetValueHigh": 176
                        },
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 4,
                            "intensity": "RECOVERY",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 127,
                            "targetValueHigh": 146
                        },
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 5,
                            "intensity": "INTERVAL",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 166,
                            "targetValueHigh": 176
                        },
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 6,
                            "intensity": "RECOVERY",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 127,
                            "targetValueHigh": 146
                        },
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 7,
                            "intensity": "RECOVERY",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 127,
                            "targetValueHigh": 146
                        },
                        {
                            "type": "WorkoutStep",
                            "stepOrder": 8,
                            "intensity": "RECOVERY",
                            "description": "Interval phase",
                            "durationType": "DISTANCE",
                            "durationValue": 1000,
                            "durationValueType": "METER",
                            "targetType": "HEART_RATE",
                            "targetValueLow": 127,
                            "targetValueHigh": 146
                        }
                    ]
                },
                {
                    "type": "WorkoutStep",
                    "stepOrder": 9,
                    "intensity": "COOLDOWN",
                    "description": "COOLDOWN phase",
                    "durationType": "DISTANCE",
                    "durationValue": 1500,
                    "durationValueType": "METER",
                    "targetType": "HEART_RATE",
                    "targetValueLow": 127,
                    "targetValueHigh": 146
                }
            ]
        };
        expect(garminWorkout1).toEqual(expectedWorkout1);
        expect(garminWorkout2).toEqual(expectedWorkout2);
    });
    test('getTrainingPlan: successful for all users', async () => {
        const trainingPlan1 = await getTrainingPlan(client, [1]);
        const trainingPlan2 = await getTrainingPlan(client, [2]);
        let trainingPlan3 = [{"userId":"a4370654-eedc-4b84-b52f-cb0450020e9c","trainingPlan":{"day1":{"running": 0,"strength":0,"alternative":0}, "day2":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}],"interval_3":[{"Z2":1},{"Z2":1}]}}},"strength":0,"alternative":0},"day3":{"running": 0,"strength":1,"alternative":0}, "day4":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z2":1},{"Z2":1}],"interval_3":[{"Z2":1},{"Z2":1}]}}},"strength":0,"alternative":0},"day5":{"running": 0,"strength":2,"alternative":0},"day6":{"running":{"session_1":{"warmup":{"Z2":1.5},"cooldown":{"Z2":1.5},"main":{"interval_1":[{"Z4":1},{"Z2":1}],"interval_2":[{"Z4":1},{"Z2":1}],"interval_3":[{"Z4":1},{"Z2":1}]}}},"strength":0,"alternative":0}, "day7":{"running": 0,"strength":0,"alternative":0}}}];
        await insertTrainingPlansToDb(client, { trainingPlans: trainingPlan3, timestamp: moment(DAY_0).add(1, 'days').format('YYYY-MM-DD') });
        trainingPlan3 = await getTrainingPlan(client, ["a4370654-eedc-4b84-b52f-cb0450020e9c"]);
        const day1 = moment(DAY_0).add(1, 'days').format('YYYY-MM-DD');
        const day2 = moment(DAY_0).add(2, 'days').format('YYYY-MM-DD');
        const day3 = moment(DAY_0).add(3, 'days').format('YYYY-MM-DD');
        const day4 = moment(DAY_0).add(4, 'days').format('YYYY-MM-DD');
        const day5 = moment(DAY_0).add(5, 'days').format('YYYY-MM-DD');
        const day6 = moment(DAY_0).add(6, 'days').format('YYYY-MM-DD');
        const day7 = moment(DAY_0).add(7, 'days').format('YYYY-MM-DD');

        const expectedTrainingPlan1 = [{
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
            const expectedTrainingPlan2 = [{
                userId: '2',
                workoutPlan: {
                    [`${day1}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                    [`${day2}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                    [`${day3}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                    [`${day4}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                    [`${day6}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}},
                    [`${day7}_1`]:{"type":"RUNNING","workout":{"warmup":{"Z2":1.5},"main":{"interval_1":[{"Z5":1},{"Z2":1}]},"cooldown":{"Z2":1.5}}}
                }
                }];

                const expectedTrainingPlan3 = [{
                    userId: 'a4370654-eedc-4b84-b52f-cb0450020e9c',
                    workoutPlan: {
                        [`${day2}_1`]: {
                            "type": "RUNNING",
                            "workout": {
                                "warmup": {"Z2": 1.5},
                                "cooldown": {"Z2": 1.5},
                                "main": {
                                    "interval_1": [{"Z4": 1}, {"Z2": 1}],
                                    "interval_2": [{"Z4": 1}, {"Z2": 1}],
                                    "interval_3": [{"Z2": 1}, {"Z2": 1}]
                                }
                            }
                        },
                        [`${day4}_1`]: {
                            "type": "RUNNING",
                            "workout": {
                                "warmup": {"Z2": 1.5},
                                "cooldown": {"Z2": 1.5},
                                "main": {
                                    "interval_1": [{"Z4": 1}, {"Z2": 1}],
                                    "interval_2": [{"Z2": 1}, {"Z2": 1}],
                                    "interval_3": [{"Z2": 1}, {"Z2": 1}]
                                }
                            }
                        },
                        [`${day6}_1`]: {
                            "type": "RUNNING",
                            "workout": {
                                "warmup": {"Z2": 1.5},
                                "cooldown": {"Z2": 1.5},
                                "main": {
                                    "interval_1": [{"Z4": 1}, {"Z2": 1}],
                                    "interval_2": [{"Z4": 1}, {"Z2": 1}],
                                    "interval_3": [{"Z4": 1}, {"Z2": 1}]
                                }
                            }
                        }
                    }
                }];
            
        expect(trainingPlan1).toEqual(expectedTrainingPlan1);
        expect(trainingPlan2).toEqual(expectedTrainingPlan2);
        expect(trainingPlan3).toEqual(expectedTrainingPlan3);
    });
});