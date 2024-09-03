import moment from 'moment';

/* 
function to get inference from load optimiser for list of users with data prepared for inference: 56 consecutive days of data for each user
*/
async function getLoadTargetInference(data) {

    const url = 'http://Coachi-Coach-YF6Q88XaHeGU-926801549.eu-west-2.elb.amazonaws.com/predict';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error prediction endpoint! Status: ${response.status}`);
        }

        const result = await response.json();

        console.log("Inference from load optimiser successfull");
        
        return {
            loadTargets: result, 
            timestamp: moment().format('YYYY-MM-DD-HH-mm-ss')
        };
    } catch (error) {
        console.error("Error getting inference from load optimiser:", error);
    }
}

export { getLoadTargetInference };
