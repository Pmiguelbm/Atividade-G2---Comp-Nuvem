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
- **Lambda processarPedido**: consome SQS, gera comprovante em PDF, salva no S3 e notifica via SNS.
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

3. **Acessar comprovante PDF (S3)**
   
   **Listar PDFs salvos:**
   ```
   docker exec -it localstack awslocal s3 ls s3://pedidos-pdfs/comprovantes/
   ```
   
   **Baixar PDF para o computador:**
   ```
   docker exec -it localstack awslocal s3 cp s3://pedidos-pdfs/comprovantes/<id>.pdf /tmp/comprovante.pdf
   docker cp localstack:/tmp/comprovante.pdf ./comprovante.pdf
   ```
   
   **Visualizar conteúdo do PDF diretamente (base64):**
   ```
   docker exec -it localstack awslocal s3 cp s3://pedidos-pdfs/comprovantes/<id>.pdf - | base64
   ```
   
   **Baixar via URL (se configurado bucket público ou presigned URL):**
   ```
   # Gerar URL pré-assinada (válida por 1 hora)
   docker exec -it localstack awslocal s3 presign s3://pedidos-pdfs/comprovantes/<id>.pdf --expires-in 3600
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

Acessando Comprovantes PDF
---------------------------

Os comprovantes são gerados automaticamente quando um pedido é processado e salvos no bucket S3 `pedidos-pdfs` no caminho `comprovantes/{id}.pdf`.

### Métodos de Acesso:

**1. Listar todos os PDFs:**
```bash
docker exec -it localstack awslocal s3 ls s3://pedidos-pdfs/comprovantes/
```

**2. Baixar PDF específico para o computador:**
```bash
# Substitua <id> pelo ID do pedido
docker exec -it localstack awslocal s3 cp s3://pedidos-pdfs/comprovantes/<id>.pdf /tmp/comprovante.pdf
docker cp localstack:/tmp/comprovante.pdf ./comprovante-<id>.pdf
```

**3. Gerar URL pré-assinada (para acesso via navegador):**
```bash
# URL válida por 1 hora (3600 segundos)
docker exec -it localstack awslocal s3 presign s3://pedidos-pdfs/comprovantes/<id>.pdf --expires-in 3600
```
Copie a URL retornada e cole no navegador para visualizar ou baixar o PDF.

**4. Verificar se um PDF existe:**
```bash
docker exec -it localstack awslocal s3 ls s3://pedidos-pdfs/comprovantes/<id>.pdf
```

**5. Baixar todos os PDFs de uma vez:**
```bash
docker exec -it localstack awslocal s3 sync s3://pedidos-pdfs/comprovantes/ ./comprovantes/
```

> **Nota:** Os PDFs contêm informações formatadas do pedido: ID, cliente, mesa, itens, status e data de conclusão.

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

- Comprovantes são gerados em formato PDF real usando a biblioteca `pdfkit` e salvos no S3.
- Se for implantar na AWS real, remova/condicione o `endpoint` dos clients.
- Mensagens ficam na fila `sns-notificacoes-pedidos` até serem consumidas; use `awslocal sqs delete-message` após leitura.


