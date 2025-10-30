import os
import json
import boto3

REGION = os.getenv('AWS_REGION', 'us-east-1')
LOCALSTACK_ENDPOINT = os.getenv('LOCALSTACK_ENDPOINT', 'http://localhost:4566')
DDB_TABLE = os.getenv('DDB_TABLE', 'Pedidos')
S3_BUCKET = os.getenv('S3_BUCKET', 'pedidos-comprovantes')

_dynamodb = boto3.resource(
    'dynamodb',
    endpoint_url=LOCALSTACK_ENDPOINT,
    region_name=REGION,
    aws_access_key_id='test',
    aws_secret_access_key='test',
)
_table = _dynamodb.Table(DDB_TABLE)
_s3 = boto3.client(
    's3',
    endpoint_url=LOCALSTACK_ENDPOINT,
    region_name=REGION,
    aws_access_key_id='test',
    aws_secret_access_key='test',
)

def lambda_handler(event, context):
    records = event.get('Records', [])
    for record in records:
        try:
            payload = json.loads(record['body'])
            order_id = payload['order_id']
            cliente = payload.get('cliente')
            itens = payload.get('itens', [])

            # Simula um PDF simples (conteúdo textual) armazenado com .pdf
            content = (
                f"Comprovante do Pedido\n"
                f"ID: {order_id}\n"
                f"Cliente: {cliente}\n"
                f"Itens: {', '.join(itens)}\n"
            )

            _s3.put_object(
                Bucket=S3_BUCKET,
                Key=f"comprovantes/{order_id}.pdf",
                Body=content.encode('utf-8'),
                ContentType='application/pdf'
            )

            _table.update_item(
                Key={'id': order_id},
                UpdateExpression="SET #s = :st",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':st': 'PROCESSADO'}
            )

            print(f"Pedido {order_id} processado com comprovante.")
        except Exception as e:
            print(f"Falha ao processar mensagem: {e}")

    return {'statusCode': 200}