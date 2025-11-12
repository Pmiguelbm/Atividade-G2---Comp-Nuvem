Sistema de Pedidos de Restaurante (Serverless)
==============================================

Sistema serverless que simula o fluxo completo de pedidos de um restaurante utilizando serviços AWS executados localmente via LocalStack.

______________________________________________

Visão Geral
----------

- **API Gateway**: expõe `POST /pedidos`.
- **Lambda criarPedido**: valida, grava no DynamoDB e envia o ID para SQS.
- **DynamoDB**: tabela `Pedidos` com status do pedido.
- **SQS pedidos-queue**: fila que desacopla a cozinha do front-end.
- **Lambda processarPedido**: consome SQS, gera comprovante (txt simulando PDF), salva no S3 e notifica via SNS.
- **SNS PedidosConcluidos**: envia alerta para fila `sns-notificacoes-pedidos`.
- **LocalStack + Docker**: infraestrutura local.

______________________________________________

Pré-requisitos
--------------

- Node.js 20+
- npm
- Docker + Docker Compose

______________________________________________

Instalação
----------

```
git clone <repo>
cd restaurante-serverless
npm install
```

______________________________________________

Executando LocalStack
---------------------

```
docker-compose up -d
docker ps
# deve listar o contêiner localstack
```

______________________________________________

Deploy Local
------------

```
npx serverless deploy --stage local
```

> Ao final, anote o endpoint `http://localhost:4566/restapis/<apiId>/local/_user_request_/pedidos`.

______________________________________________

Testes Manuais
--------------

1. **Criar pedido**
   ```
   chcp 65001
   curl -Method POST `
     -Uri "http://localhost:4566/restapis/<apiId>/local/_user_request_/pedidos" `
     -Headers @{ "Content-Type" = "application/json" } `
     -Body '{ "cliente": "João", "itens": ["Pizza", "Refri"], "mesa": 5 }'
   ```
   - Resultado esperado: `201 Created` com payload do pedido.

2. **Verificar DynamoDB**
   ```
   docker exec -it localstack awslocal dynamodb scan --table-name Pedidos
   ```
   - Status muda para `CONCLUIDO` após processamento.

3. **Checar comprovante (S3)**
   ```
   docker exec -it localstack awslocal s3 ls s3://pedidos-pdfs/comprovantes/
   docker exec -it localstack awslocal s3 cp s3://pedidos-pdfs/comprovantes/<id>.txt -
   ```

4. **Notificação SNS**
   ```
   docker exec -it localstack awslocal sqs receive-message `
     --queue-url http://localhost:4566/000000000000/sns-notificacoes-pedidos `
     --max-number-of-messages 1 `
     --wait-time-seconds 5
   ```
   - Corpo esperado: `Novo pedido concluído: <id>`.

______________________________________________

Estrutura Principal
-------------------

- `serverless.yml`: definição das funções, eventos e recursos (DynamoDB, SQS, S3, SNS, fila de notificações).
- `src/lambdas/createOrder.js`: criação e envio do pedido.
- `src/lambdas/processOrder.js`: processamento, geração do comprovante e notificação.
- `src/utils/*Client.js`: clients AWS configurados para LocalStack com detecção automática (`LOCALSTACK_HOSTNAME`, `IS_OFFLINE`).
- `docker-compose.yml`: sobe o LocalStack com serviços necessários.

______________________________________________

Limpeza
-------

```
npx serverless remove --stage local
docker-compose down -v
```

______________________________________________

Observações
-----------

- Comprovantes são `.txt` simulando PDF para simplificar.
- Se for implantar na AWS real, remova/condicione o `endpoint` dos clients.
- Mensagens ficam na fila `sns-notificacoes-pedidos` até serem consumidas; use `awslocal sqs delete-message` após leitura.


