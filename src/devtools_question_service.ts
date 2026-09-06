import express from "express";
import { z } from "zod";
import { createDocumentIndex, InfraiError } from "./infrai_document_index.js";
import { answerFromEvidence } from "./release_answer.js";

const questionSchema = z.object({
  question: z.string().trim().min(8).max(500),
  topK: z.number().int().min(1).max(8).default(4)
});

const app = express();
const index = createDocumentIndex();
app.use(express.json({ limit: "16kb" }));

app.post("/questions", async (request, response) => {
  const parsed = questionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid question", details: parsed.error.issues });
    return;
  }

  try {
    const evidence = await index.find(parsed.data.question, parsed.data.topK);
    response.json(answerFromEvidence(parsed.data.question, evidence));
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.status(status).json({ error: error.code, message: error.message });
      return;
    }
    response.status(502).json({ error: "DOCUMENT_QUERY_FAILED" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Developer document Q&A listening on http://localhost:${port}`));
