import { INTERVALS, DEFAULT_WARMUP_KM, DEFAULT_COOL_DOWN_KM } from './config.mjs'


export function buildWorkouts(loadTargets, nonActiveUsers) {
    let workouts = [];
    if (loadTargets !== null) {
        workouts = Object.keys(loadTargets).map(userId => ({
            userId: userId,
            trainingPlan: createTrainingPlanForUser(loadTargets[userId], userId)
        }));
    }
    if (nonActiveUsers !== null) {
        const emptyPlans = nonActiveUsers.map(userId => createEmptyPlan(userId));
        workouts = workouts.concat(emptyPlans);}
    return workouts;
}

function createTrainingPlanForUser(suggestion, userId) {
    const trainingPlan = {};

    for (let i = 0; i < 7; i++) {
        let runningPlan = {};
        let remainingKm = { value: suggestion[`day${i + 1}`].kmTotal };

        if (remainingKm.value > DEFAULT_WARMUP_KM) {
            runningPlan = { 'session_1': { 'warmup': { 'Z2': DEFAULT_WARMUP_KM } } };
            remainingKm.value -= runningPlan['session_1']['warmup']['Z2'];

            if (remainingKm.value > 0) {
                runningPlan['session_1']['cooldown'] = { 'Z2': Math.min(DEFAULT_COOL_DOWN_KM, remainingKm.value) };
                remainingKm.value -= runningPlan['session_1']['cooldown']['Z2'];
            }

            if (remainingKm.value > 0) {
                runningPlan['session_1']['main'] = {};
                let intervalNumber = { value : 1 };
            
                const kmZone5 = suggestion[`day${i + 1}`].kmZ5;
                addIntervalsToTrainingPlan(runningPlan, remainingKm, kmZone5, intervalNumber, 'Z5');

                const kmZone34 = suggestion[`day${i + 1}`].kmZ3Z4;
                addIntervalsToTrainingPlan(runningPlan, remainingKm, kmZone34, intervalNumber, 'Z4');

                const kmZone2 = remainingKm.value;
                addIntervalsToTrainingPlan(runningPlan, remainingKm, kmZone2, intervalNumber, 'Z2');  
            }
        } else {
            runningPlan = 0;
        }
        const dayPlan = {
            'running': runningPlan
        };
        trainingPlan[`day${i + 1}`] = dayPlan;
    }
    return trainingPlan;
}

function addIntervalsToTrainingPlan(runningPlan, totalRemainingKm, totalEffortKm, intervalNumber, intensity='Z2', interval='Default') {
    const zoneKey = intensity + interval;
    const effortKey = Object.keys(INTERVALS[zoneKey]['effort'])[0];
    const recoveryKey = Object.keys(INTERVALS[zoneKey]['recovery'])[0];
    const kmEffort = INTERVALS[zoneKey]['effort'][effortKey];
    const kmRecovery = INTERVALS[zoneKey]['recovery'][recoveryKey];

    while (totalEffortKm >= kmEffort && totalRemainingKm.value >= kmEffort + kmRecovery) {
        runningPlan['session_1']['main'][`interval_${intervalNumber.value}`] = [];
        runningPlan['session_1']['main'][`interval_${intervalNumber.value}`].push({ [effortKey]: kmEffort });
        runningPlan['session_1']['main'][`interval_${intervalNumber.value}`].push({ [recoveryKey]: kmRecovery });
        totalRemainingKm.value -= (kmEffort + kmRecovery);
        totalEffortKm -= kmEffort;
        intervalNumber.value += 1;
    }
}

function createEmptyPlan(userId) {
    const trainingPlan = {};

    for (let i = 1; i <= 7; i++) {
        trainingPlan[`day${i}`] = {
            running: 0
        };
    }

    return {
        userId: userId,
        trainingPlan: trainingPlan
    };
}