// Import the necessary AWS SDK v3 clients and commands
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import https from 'https';
import { TrainingSessionGarmin } from './training_session.mjs';

// Initialize the AWS SDK v3 clients
const event_bridge_client = new EventBridgeClient({ region: 'eu-west-2' });
const dynamodb_client = new DynamoDBClient({ region: 'eu-west-2' });
const dynamodb_doc_client = DynamoDBDocumentClient.from(dynamodb_client);

const user_id_cache = {};

async function get_user_id(user_id_garmin) {
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

// The main handler function
async function garmin_handler(request_body) {
    if (!request_body.activityDetails || !Array.isArray(request_body.activityDetails)) {
        console.error("Invalid request format: 'activityDetails' is missing or not an array");
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request format" }),
        };
    }

    for (const activity of request_body.activityDetails) {
        const user_id_garmin = activity.userId;
        if (!user_id_garmin) {
            console.error("userId is missing in the payload.");
            continue; // Skip this activity and move to the next
        }

        let user_id = user_id_cache[user_id_garmin];
        if (!user_id) {
            user_id = await get_user_id(user_id_garmin);
            user_id_cache[user_id_garmin] = user_id; // Store in cache
        } else {
            console.log("Found user_id in cache");
        }

        console.log("Blaze User ID:", user_id);

        const session = new TrainingSessionGarmin(activity, user_id);

        console.log("Blaze User ID in Session Object:", session.user_id);
        try {
            // Sending events to EventBridge
            const event_bridge_params = session.prepare_event_bridge_params();
            await event_bridge_client.send(new PutEventsCommand(event_bridge_params));
            console.log("Event published to EventBridge successfully.");

            // Putting an item into DynamoDB
            const dynamodb_params_log = session.prepare_dynamo_db_log_params('trainings_log');
            await dynamodb_doc_client.send(new PutCommand(dynamodb_params_log));
            console.log("Data inserted into DynamoDB trainings log successfully.");

            // Updating an item in DynamoDB
            const dynamodb_params_aggregate = session.prepare_dynamo_db_aggregate_params('trainings_aggregates');
            await dynamodb_doc_client.send(new UpdateCommand(dynamodb_params_aggregate));
            console.log("Data inserted into DynamoDB trainings aggregates successfully.");

        } catch (error) {
            console.error("Error processing data:", error);
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Processed successfully" }),
    };
};

export { garmin_handler };