import { SQSClient } from "@aws-sdk/client-sqs";

const localstackHost = process.env.LOCALSTACK_HOSTNAME;
const isOffline = process.env.IS_OFFLINE === "true";
const resolvedHost = localstackHost ?? "localhost";

const endpoint =
  process.env.AWS_ENDPOINT_URL ??
  ((isOffline || localstackHost) ? `http://${resolvedHost}:4566` : undefined);

export const sqsClient = new SQSClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
  ...(endpoint ? { endpoint } : {}),
});
