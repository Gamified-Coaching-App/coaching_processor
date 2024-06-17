import { execSync } from 'child_process';

export default async () => {
    try {
        execSync("docker stop dynamodb-local && docker rm dynamodb-local");
        console.log('DynamoDB Local stopped and removed');
    } catch (error) {
        console.error('Failed to stop and remove DynamoDB Local:', error);
    }
};
