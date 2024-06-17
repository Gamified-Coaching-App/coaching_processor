import { execSync } from 'child_process';

export default async () => {
    execSync("docker run --name dynamodb-local -p 8000:8000 -d amazon/dynamodb-local");
    console.log('DynamoDB Local started');
};
