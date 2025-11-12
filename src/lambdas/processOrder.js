import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PublishCommand } from "@aws-sdk/client-sns";
import { ddbDocClient } from "../utils/dynamoClient.js";
import { s3Client } from "../utils/s3Client.js";
import { snsClient } from "../utils/snsClient.js";

const TABLE_NAME = "Pedidos";
const BUCKET_NAME = "pedidos-pdfs";
const TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:PedidosConcluidos";

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      const { id } = body;

      const { Item: pedido } = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        })
      );

      if (!pedido) {
        console.warn(`Pedido ${id} não encontrado`);
        continue;
      }

      const conteudo = `
        COMPROVANTE DE PEDIDO
        ID: ${pedido.id}
        Cliente: ${pedido.cliente}
        Mesa: ${pedido.mesa}
        Itens: ${pedido.itens.join(", ")}
        Status: CONCLUIDO
        Data: ${new Date().toISOString()}
      `;

      const objectKey = `comprovantes/${pedido.id}.txt`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
          Body: conteudo,
        })
      );

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: "SET #s = :status",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":status": "CONCLUIDO" },
        })
      );

      await snsClient.send(
        new PublishCommand({
          TopicArn: TOPIC_ARN,
          Subject: "Pedido Pronto!",
          Message: `Novo pedido concluído: ${id}`,
        })
      );

      console.log(`Pedido ${id} processado com sucesso`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Mensagens processadas" }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro ao processar pedidos" }),
    };
  }
};
