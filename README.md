# Sistema de Pedidos de Restaurante (LocalStack)

Este projeto provisiona um ambiente serverless local usando LocalStack para:
- API Gateway: endpoint REST `/pedidos` (POST)
- Lambda `create-order`: valida pedido, salva no DynamoDB e envia ID para SQS
- DynamoDB: tabela `Pedidos` (id, cliente, itens, mesa, status)
- SQS: fila de pedidos
- Lambda `process-order`: consome SQS, gera comprovante simulado e salva em S3
- S3: bucket para comprovantes em PDF (simulado)

## Requisitos
- Docker Desktop integrado com WSL
- PowerShell (Windows) ou terminal equivalente

## Subir o ambiente
1. Empacotar as lambdas em ZIP (Windows/PowerShell):
   ```powershell
   New-Item -ItemType Directory -Force -Path dist
   Compress-Archive -Path "lambdas/create_order/*" -DestinationPath "dist/create_order.zip" -Force
   Compress-Archive -Path "lambdas/process_order/*" -DestinationPath "dist/process_order.zip" -Force
   ```
2. Subir o LocalStack:
   ```powershell
   docker compose up -d
   ```
   O script `localstack-init/setup.sh` é executado automaticamente dentro do container, criando todos os recursos.

## Obter o endpoint da API
Recupere o ID da API e monte o endpoint:
```powershell
$apiId = docker exec localstack sh -lc "awslocal apigateway get-rest-apis | python -c 'import sys,json; print(json.load(sys.stdin)[\"items\"][0][\"id\"])'"
$endpoint = "http://localhost:4566/restapis/$apiId/dev/_user_request_/pedidos"
Write-Output $endpoint
```

## Teste de criação de pedido
```powershell
curl -s -X POST $endpoint -H "Content-Type: application/json" -d '{
  "cliente": "João",
  "itens": ["Pizza", "Refri"],
  "mesa": 5
}'
```
Deve retornar `201` com `{ id, status: "NOVO" }`.

## Verificações
- DynamoDB (listar itens):
  ```powershell
  docker exec localstack awslocal dynamodb scan --table-name Pedidos
  ```
- S3 (listar comprovantes):
  ```powershell
  docker exec localstack awslocal s3api list-objects --bucket pedidos-comprovantes --prefix comprovantes/
  ```

## Observações
- A geração de PDF é simulada (conteúdo textual com Content-Type `application/pdf`).
- As lambdas usam `boto3` embutido no runtime Python (LocalStack/AWS), sem dependências externas.
- Caso queira limpar e recriar, pare e remova o container e suba novamente:
  ```powershell
  docker compose down
  docker compose up -d
  ```