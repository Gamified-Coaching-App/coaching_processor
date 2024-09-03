/* 
function to compute km per heart rate zone from raw heart rate and raw distance data, sent by Garmin
*/
function getKmPerHeartRateZone(zones, heartRatesJson, distancesJson) {
    let kmZone1 = 0, kmZone2 = 0, kmZone3 = 0, kmZone4 = 0, kmZone5 = 0;
    const heartRates = JSON.parse(heartRatesJson);
    const distances = JSON.parse(distancesJson);  


    const timeKeys = Object.keys(heartRates).concat(Object.keys(distances));
    const uniqueTimeKeys = [...new Set(timeKeys)]; 
    uniqueTimeKeys.sort((a, b) => parseInt(a) - parseInt(b)); 
    let previousTime = uniqueTimeKeys[0];

    for (const time of uniqueTimeKeys) {
        const currentHeartRate = parseInt(heartRates[time], 10);
        const currentDistance = parseInt(distances[time], 10);
        const previousDistance = parseInt(distances[previousTime],10) || 0;
        const distanceCovered = (currentDistance - previousDistance) / 1000;

        if (currentHeartRate !== undefined && currentDistance !== undefined) {
            if (currentHeartRate >= zones.zone1Lower && currentHeartRate < zones.zone1Upper) {
                kmZone1 += distanceCovered;
            } else if (currentHeartRate >= zones.zone2Lower && currentHeartRate < zones.zone2Upper) {
                kmZone2 += distanceCovered;
            } else if (currentHeartRate >= zones.zone3Lower && currentHeartRate < zones.zone3Upper) {
                kmZone3 += distanceCovered;
            } else if (currentHeartRate >= zones.zone4Lower && currentHeartRate < zones.zone4Upper) {
                kmZone4 += distanceCovered;
            } else if (currentHeartRate >= zones.zone5Lower && currentHeartRate <= zones.zone5Upper) {
                kmZone5 += distanceCovered;
            }
        }
        previousTime = time;
    }
    const kmPerHeartRateZone = {
        zone1: parseFloat(kmZone1.toFixed(2)),
        zone2: parseFloat(kmZone2.toFixed(2)),
        zone3: parseFloat(kmZone3.toFixed(2)),
        zone4: parseFloat(kmZone4.toFixed(2)),
        zone5: parseFloat(kmZone5.toFixed(2))
    }
    console.log("Calculation of km per heart rate zone successful");
    return kmPerHeartRateZone;
}

export { getKmPerHeartRateZone };