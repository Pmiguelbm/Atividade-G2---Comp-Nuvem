import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const localstackHost = process.env.LOCALSTACK_HOSTNAME;
const isOffline = process.env.IS_OFFLINE === "true";
const resolvedHost = localstackHost ?? "localhost";

const endpoint =
  process.env.AWS_ENDPOINT_URL ??
  ((isOffline || localstackHost) ? `http://${resolvedHost}:4566` : undefined);

const clientConfig = {
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
  ...(endpoint ? { endpoint } : {}),
};

const client = new DynamoDBClient(clientConfig);

export const ddbDocClient = DynamoDBDocumentClient.from(client);
