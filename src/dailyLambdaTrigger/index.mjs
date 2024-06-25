import fetch from 'node-fetch';

export const handler = async (event, context) => {
    const url = "http://Coachi-Coach-bgtKlzJd2GCw-908383528.eu-west-2.elb.amazonaws.com/gettrainingplans";
    const params = { userIds: "all" };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        const responseData = await response.json();
        console.log('Success:', responseData);
        
        return {
            statusCode: response.status,
            body: JSON.stringify(responseData)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};