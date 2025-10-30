#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
API_NAME="PedidosApi"
STAGE="dev"
DDB_TABLE="Pedidos"
SQS_QUEUE_NAME="pedidos-queue"
S3_BUCKET="pedidos-comprovantes"
ACCOUNT_ID="000000000000"
LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/lambda-exec"

echo "Criando IAM role..."
awslocal iam create-role --role-name lambda-exec --assume-role-policy-document file:///etc/localstack/init/ready.d/trust-policy.json >/dev/null || true

echo "Criando tabela DynamoDB..."
awslocal dynamodb create-table --table-name "${DDB_TABLE}" --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST >/dev/null || true

echo "Criando fila SQS..."
awslocal sqs create-queue --queue-name "${SQS_QUEUE_NAME}" >/dev/null || true

echo "Criando bucket S3..."
awslocal s3api create-bucket --bucket "${S3_BUCKET}" >/dev/null || true

QUEUE_URL="http://localstack:4566/${ACCOUNT_ID}/${SQS_QUEUE_NAME}"

echo "Criando Lambda create-order..."
awslocal lambda create-function \
  --function-name create-order \
  --runtime python3.11 \
  --role ${LAMBDA_ROLE_ARN} \
  --handler handler.lambda_handler \
  --zip-file fileb:///opt/code/dist/create_order.zip \
  --environment "Variables={DDB_TABLE=${DDB_TABLE},SQS_QUEUE_URL=${QUEUE_URL},LOCALSTACK_ENDPOINT=http://localstack:4566,AWS_REGION=${REGION},S3_BUCKET=${S3_BUCKET}}" >/dev/null || true

echo "Criando Lambda process-order..."
awslocal lambda create-function \
  --function-name process-order \
  --runtime python3.11 \
  --role ${LAMBDA_ROLE_ARN} \
  --handler handler.lambda_handler \
  --zip-file fileb:///opt/code/dist/process_order.zip \
  --environment "Variables={DDB_TABLE=${DDB_TABLE},LOCALSTACK_ENDPOINT=http://localstack:4566,AWS_REGION=${REGION},S3_BUCKET=${S3_BUCKET}}" >/dev/null || true

echo "Criando integração SQS -> Lambda process-order..."
awslocal lambda create-event-source-mapping \
  --event-source-arn "arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${SQS_QUEUE_NAME}" \
  --function-name process-order \
  --batch-size 1 >/dev/null || true

# API Gateway configuration
echo "Configurando API Gateway..."
API_ID=$(awslocal apigateway create-rest-api --name "${API_NAME}" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

ROOT_ID=$(awslocal apigateway get-resources --rest-api-id "${API_ID}" | python -c "import sys,json; print([r['id'] for r in json.load(sys.stdin)['items'] if r.get('path')=='/'][0])")
RES_ID=$(awslocal apigateway create-resource --rest-api-id "${API_ID}" --parent-id "${ROOT_ID}" --path-part "pedidos" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

awslocal apigateway put-method --rest-api-id "${API_ID}" --resource-id "${RES_ID}" --http-method POST --authorization-type "NONE" >/dev/null

LAMBDA_URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:create-order/invocations"

awslocal apigateway put-integration \
  --rest-api-id "${API_ID}" \
  --resource-id "${RES_ID}" \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "${LAMBDA_URI}" >/dev/null

awslocal lambda add-permission \
  --function-name create-order \
  --statement-id apigateway-permission \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/pedidos" >/dev/null || true

awslocal apigateway create-deployment --rest-api-id "${API_ID}" --stage-name "${STAGE}" >/dev/null

echo "API criada. Endpoint:"
echo "http://localhost:4566/restapis/${API_ID}/${STAGE}/_user_request_/pedidos"