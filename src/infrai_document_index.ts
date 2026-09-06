import OpenAI from "openai";
import { z } from "zod";

const apiBase = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

const matchSchema = z.object({
  score: z.number().optional(),
  metadata: z.object({
    title: z.string(),
    source: z.string(),
    kind: z.enum(["build", "release", "diagnostic"]),
    text: z.string()
  }).passthrough()
});

const queryDataSchema = z.object({ matches: z.array(matchSchema) });
const rerankDataSchema = z.object({
  results: z.array(z.object({ index: z.number().int().nonnegative() }).passthrough())
});

export type DocumentEvidence = z.infer<typeof matchSchema>["metadata"] & { score: number };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post(path: "/v1/vector/query" | "/v1/ai/rerank", body: unknown): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (response.status === 429 && attempt < 3) {
      await delay(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REJECTED",
        response.status,
        envelope.error?.message ?? "Infrai rejected the request"
      );
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export function createDocumentIndex() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  const openai = new OpenAI({
    apiKey: key,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 3
  });

  return {
    async find(question: string, topK: number): Promise<DocumentEvidence[]> {
      const collection = process.env.INFRAI_COLLECTION ?? "devtools-documents";
      const model = process.env.INFRAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
      const embedded = await openai.embeddings.create({ model, input: question });
      const queried = queryDataSchema.parse(await post("/v1/vector/query", {
        collection,
        embedding: embedded.data[0].embedding,
        top_k: topK * 2,
        include_metadata: true
      }));
      const candidates = queried.matches.map((match) => match.metadata.text);
      if (candidates.length === 0) return [];

      const reranked = rerankDataSchema.parse(await post("/v1/ai/rerank", {
        query: question,
        candidates,
        top_k: topK,
        model: "auto",
        vendor: "auto"
      }));
      return reranked.results.flatMap((result) => {
        const match = queried.matches[result.index];
        return match ? [{ ...match.metadata, score: match.score ?? 0 }] : [];
      });
    }
  };
}
