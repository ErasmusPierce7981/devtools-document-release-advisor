import type { DocumentEvidence } from "./infrai_document_index.js";

export type ReleaseDecision = "clear" | "watch" | "block";

export interface DocumentAnswer {
  answer: string;
  releaseDecision: ReleaseDecision;
  citations: Array<{ title: string; source: string; kind: DocumentEvidence["kind"] }>;
}

const blockingSignals = /\b(failed|failure|rollback|regression|blocked|error)\b/i;
const cautionSignals = /\b(warning|degraded|retry|investigating|pending)\b/i;

export function answerFromEvidence(question: string, evidence: DocumentEvidence[]): DocumentAnswer {
  if (evidence.length === 0) {
    return {
      answer: `No indexed document evidence was found for: ${question}`,
      releaseDecision: "watch",
      citations: []
    };
  }

  const strongest = evidence[0];
  const joined = evidence.map((item) => item.text).join(" ");
  const releaseDecision: ReleaseDecision = blockingSignals.test(joined)
    ? "block"
    : cautionSignals.test(joined)
      ? "watch"
      : "clear";

  return {
    answer: strongest.text,
    releaseDecision,
    citations: evidence.map(({ title, source, kind }) => ({ title, source, kind }))
  };
}
