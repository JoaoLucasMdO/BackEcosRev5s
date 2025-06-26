import express from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

const s3 = new S3Client({
  region: "us-east-1",
});

router.get("/download-apk", async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: "bucketjoao01",
      Key: "EcosRev.apk",
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 segundos
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar link de download." });
  }
});

export default router;