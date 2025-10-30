import os
import json
import uuid
import boto3

REGION = os.getenv('AWS_REGION', 'us-east-1')
LOCALSTACK_ENDPOINT = os.getenv('LOCALSTACK_ENDPOINT', 'http://localhost:4566')
DDB_TABLE = os.getenv('DDB_TABLE', 'Pedidos')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')

# Clients/resources apontando para LocalStack
_dynamodb = boto3.resource(
    'dynamodb',
    endpoint_url=LOCALSTACK_ENDPOINT,
    region_name=REGION,
    aws_access_key_id='test',
    aws_secret_access_key='test',
)
_table = _dynamodb.Table(DDB_TABLE)
_sqs = boto3.client(
    'sqs',
    endpoint_url=LOCALSTACK_ENDPOINT,
    region_name=REGION,
    aws_access_key_id='test',
    aws_secret_access_key='test',
)

def _response(status, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False)
    }


def lambda_handler(event, context):
    try:
        body = event.get('body')
        if isinstance(body, str):
            data = json.loads(body)
        elif isinstance(body, dict):
            data = body
        else:
            data = {}

        cliente = data.get('cliente')
        itens = data.get('itens')
        mesa = data.get('mesa')

        errors = []
        if not cliente or not isinstance(cliente, str):
            errors.append('cliente inválido')
        if not isinstance(itens, list) or not all(isinstance(x, str) for x in itens):
            errors.append('itens deve ser lista de strings')
        if not isinstance(mesa, int) or mesa <= 0:
            errors.append('mesa inválida')

        if errors:
            return _response(400, {'errors': errors})

        order_id = str(uuid.uuid4())
        item = {
            'id': order_id,
            'cliente': cliente,
            'itens': itens,
            'mesa': mesa,
            'status': 'NOVO'
        }
        _table.put_item(Item=item)

        if SQS_QUEUE_URL:
            _sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps({
                    'order_id': order_id,
                    'cliente': cliente,
                    'itens': itens,
                    'mesa': mesa
                })
            )
        else:
            print('SQS_QUEUE_URL não definido; mensagem não enviada')

        return _response(201, {'id': order_id, 'status': 'NOVO'})

    except Exception as e:
        print(f'Erro interno: {e}')
        return _response(500, {'error': 'Erro interno'})