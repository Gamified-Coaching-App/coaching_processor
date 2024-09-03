import jwt from 'jsonwebtoken';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import https from 'https';

async function getUserId(user_id_garmin) {
    console.log("Getting user ID for Garmin user ID:", user_id_garmin);
    const url = `https://f53aet9v26.execute-api.eu-west-2.amazonaws.com/dev_1/get-user-id?partner=garmin&partner_user_ids=${user_id_garmin}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed_data = JSON.parse(data);
                    const user_ids = parsed_data.user_ids;
                    if (user_ids) {
                        const user_id_array = user_ids.split(',');
                        const user_id = user_id_array[0];
                        resolve(user_id);
                    } else {
                        console.error("User ID not found in the response.");
                        reject(new Error("User ID not found in the response."));
                    }
                } catch (error) {
                    console.error("Parsing error:", error);
                    reject(error);
                }
            });
        }).on('error', (e) => {
            console.error("HTTP request error:", e);
            reject(e);
        });
    });
}

function getUserIdFromJwt(token) {
    const decoded = jwt.decode(token);
    return decoded.sub;
}

async function getAllUsers(dynamoDbClient) {
    const params = {
        TableName: "coaching_user_data"
    };

    try {
        const data = await dynamoDbClient.send(new ScanCommand(params));
        
        if (!data.Items || data.Items.length === 0) {
            return { active: [], nonActive: [] };
        }

        const items = data.Items.map(item => unmarshall(item));

        const activeUserIds = [];
        const nonActiveUserIds = [];

        items.forEach(item => {
            if (item.coachingActive === true) {
                activeUserIds.push(item.userId);
            } else {
                nonActiveUserIds.push(item.userId);
            }
        });
        console.log("All active and non-active users fetched successfully.");
        return { active: activeUserIds, nonActive: nonActiveUserIds };
    } catch (err) {
        console.error("Error scanning DynamoDB table:", err);
        throw new Error("Error scanning DynamoDB table");
    }
}

export { getUserId, getUserIdFromJwt, getAllUsers };