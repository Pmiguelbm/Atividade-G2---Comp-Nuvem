import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PublishCommand } from "@aws-sdk/client-sns";
import PDFDocument from "pdfkit";
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

      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(20).text("COMPROVANTE DE PEDIDO", { align: "center" });
        doc.moveDown(2);

        doc.fontSize(14).text(`ID: ${pedido.id}`);
        doc.text(`Cliente: ${pedido.cliente}`);
        doc.text(`Mesa: ${pedido.mesa}`);
        doc.moveDown();
        
        doc.fontSize(12).text("Itens:", { underline: true });
        pedido.itens.forEach((item, index) => {
          doc.text(`${index + 1}. ${item}`);
        });
        
        doc.moveDown();
        doc.fontSize(14).text(`Status: CONCLUIDO`, { align: "left" });
        doc.text(`Data: ${new Date().toLocaleString("pt-BR")}`);

        doc.end();
      });

      const objectKey = `comprovantes/${pedido.id}.pdf`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
          Body: pdfBuffer,
          ContentType: "application/pdf",
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
          Message: JSON.stringify({
            TopicArn: TOPIC_ARN,
            Message: `Novo pedido concluído: ${id}`,
            Subject: "Pedido Pronto!",
          }),
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
