import { v4 as uuidv4 } from "uuid";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { ddbDocClient } from "../utils/dynamoClient.js";
import { sqsClient } from "../utils/sqsClient.js";

const TABLE_NAME = "Pedidos";
const QUEUE_URL = "http://localhost:4566/000000000000/pedidos-queue"; // ajuste se mudar

export const handler = async (event) => {
  try {
    // LocalStack/APIGW está mandando body em Base64
    let rawBody = event.body;

    if (event.isBase64Encoded) {
      rawBody = Buffer.from(event.body, "base64").toString("utf-8");
    }

    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    if (!body?.cliente || !body?.itens || !Array.isArray(body.itens) || !body?.mesa) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Payload inválido. Envie cliente, itens[], mesa." }),
      };
    }

    const id = uuidv4();

    const pedido = {
      id,
      cliente: body.cliente,
      itens: body.itens,
      mesa: body.mesa,
      status: "CRIADO",
      criadoEm: new Date().toISOString(),
    };

    // 1) Salvar no DynamoDB
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: pedido,
      })
    );

    // 2) Enviar ID para fila SQS
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({ id }),
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Pedido criado com sucesso!", pedido }),
    };
  } catch (err) {
    console.error("Erro no criarPedido:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro ao criar pedido" }),
    };
  }
};
