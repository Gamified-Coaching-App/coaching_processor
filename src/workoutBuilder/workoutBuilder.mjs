import { INTERVALS, DEFAULT_WARMUP_KM, DEFAULT_COOL_DOWN_KM } from './config.mjs'

/**
 * Creates a 7-day training plan based on the provided load targets.
 *
 * @param {Array} loadTargets - Array of objects, each containing userId and loadTargets for the week.
 * @returns {Array} workouts - Array of objects, each containing userId and the generated training plan.
 */
export function buildWorkouts(loadTargets, nonActiveUsers) {
    // Iterate through each load target and create a training plan
    let workouts = [];
    if (loadTargets !== null) {
        workouts = Object.keys(loadTargets).map(userId => ({
            userId: userId,
            trainingPlan: createTrainingPlanForUser(loadTargets[userId])
        }));
    }
    if (nonActiveUsers !== null) {
        const emptyPlans = nonActiveUsers.map(userId => createEmptyPlan(userId));
        workouts = workouts.concat(emptyPlans);}
    return workouts;
}

/**
     * Creates a 7-day training plan based on the provided suggestion.
     *
     * @param {Object} suggestion - An object containing the suggested training load in absolute units for each day.
     * @returns {Object} trainingPlan - An object representing the 7-day training plan. Each day includes a running plan with warmup, 
     *                                  main intervals, and cooldown, as well as strength training and alternative hours.
     */
function createTrainingPlanForUser(suggestion) {
    const trainingPlan = {};

    for (let i = 0; i < 7; i++) {
        let remainingKm = suggestion[`day${i + 1}`].totalKm;

        if (remainingKm < DEFAULT_WARMUP_KM) {
            continue;
        }
        // Add warmup and cooldown to the plan
        const runningPlan = { 'session_1': { 'warmup': { 'Z2': DEFAULT_WARMUP_KM }, 'main': {} } };
        remainingKm -= runningPlan['session_1']['warmup']['Z2'];

        if (remainingKm > 0) {
            runningPlan['session_1']['cooldown'] = { 'Z2': Math.min(DEFAULT_COOL_DOWN_KM, remainingKm) };
            remainingKm -= runningPlan['session_1']['cooldown']['Z2'];
        }

        // Add Zone 5 intervals to the plan
        let intervalNumber = 1;
        let remainingKmZone5 = suggestion[`day${i + 1}`].kmZ5;
        const effortKey = Object.keys(INTERVALS['default']['effort'])[0];
        const recoveryKey = Object.keys(INTERVALS['default']['recovery'])[0];
        const kmEffort = INTERVALS['default']['effort'][effortKey];
        const kmRecovery = INTERVALS['default']['recovery'][recoveryKey];

        while (remainingKmZone5 >= kmEffort && remainingKm >= kmEffort + kmRecovery) {
            runningPlan['session_1']['main'][`interval_${intervalNumber}`] = [];
            runningPlan['session_1']['main'][`interval_${intervalNumber}`].push({ [effortKey]: kmEffort });
            runningPlan['session_1']['main'][`interval_${intervalNumber}`].push({ [recoveryKey]: kmRecovery });
            remainingKm -= (kmEffort + kmRecovery);
            remainingKmZone5 -= kmEffort;
            intervalNumber += 1;
        }

        const dayPlan = {
            'running': runningPlan,
            'strength': suggestion[`day${i + 1}`].numberStrengthSessions,
            'alternative': suggestion[`day${i + 1}`].hoursAlternative
        };
        trainingPlan[`day${i + 1}`] = dayPlan;
    }
    return trainingPlan;
}

function createEmptyPlan(userId) {
    const trainingPlan = {};

    for (let i = 1; i <= 7; i++) {
        trainingPlan[`day${i}`] = {
            running: 0,
            strength: 0,
            alternative: 0
        };
    }

    return {
        userId: userId,
        trainingPlan: trainingPlan
    };
}