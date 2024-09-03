/* 
configuration of workoutBuilder intervals
*/
export const INTERVALS = {
    'Z5Default': {
        'effort': { 'Z5': 1.0 },
        'recovery': { 'Z2': 1.0 }
    }, 
    'Z4Default': {
        'effort': { 'Z4': 1.0 },
        'recovery': { 'Z2': 1.0 }
    },
    'Z2Default': {
        'effort': { 'Z2': 1.0 },
        'recovery': { 'Z2': 1.0 }
    }
};

export const DEFAULT_WARMUP_KM = 1.5;
export const DEFAULT_COOL_DOWN_KM = 1.5;