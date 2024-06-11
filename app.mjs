import express from 'express';
import { garmin_handler } from './garmin_handler.mjs';

const app = express();
app.use(express.json({ limit: '200mb' }));

// /workouts
// function to orchestrate - 1. if RUN compute HR zones for workout, 
//2. Add to DB, 
// 3. prepare data for inference - get data 4. call inference function submitting data and user id
// 5. call workout builder on received data
// 6. store workouts in DB
// 7. convert data to garmin format and send to garmin

// /user-data
// 1. aggregate subjective parameters
// 2. call inference function submitting data and user id
// 3. call workout builder on received data
// 4. return data to frontend
// 5. store workouts in DB
// 6. convert data to garmin format and send to garmin

// /frontend
// 1. get user data
// 2. get workouts
// 3. return data to frontend

// 1 function for training plan computation
// /health/garmin
// 1 function for heart rate zone update - triggered if a new summary comes in
// 1 function to add data to the database of health metrics


// POST endpoint that uses the garmin_handler
app.post('/update/garmin', (req, res) => {
    // Immediately respond to the request
    res.status(200).send({ message: "Processing started" });

    // Process the request body asynchronously
    console.log("Starting garmin_handler with request body:", req.body);
    garmin_handler(req.body).then(response => {
        console.log("Processing completed successfully:", response);
    }).catch(error => {
        console.error("Error during processing JSON:", error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    // Respond with 200 OK and a status message
    res.status(200).send({ status: 'Healthy' });
});

// Listen on port 80
app.listen(80, () => {
    console.log('Server running on port 80');
});