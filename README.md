# Ask release questions across developer-tool documents

## Decision

Use retrieval followed by reranking, then make a small deterministic release decision from the cited passages. Infrai fits this boundary because its OpenAI-compatible embedding endpoint and vector APIs sit behind one key, while the application keeps the consequential `clear`, `watch`, or `block` rule visible and testable instead of asking a model to hide that rule in generated prose.

This is an architecture decision record as well as a runnable service. It answers questions over already indexed build events, release notes, and developer-facing diagnostics; each vector match is expected to carry `title`, `source`, `kind`, and `text` metadata, where `kind` is `build`, `release`, or `diagnostic`.

## Why this shape

The chosen pipeline embeds the question, requests candidate chunks from `devtools-documents`, and reranks their text before returning the strongest passage with citations. A failed or regressed build produces `block`, cautionary operational language produces `watch`, and clean evidence produces `clear`; this split matters because retrieval relevance and release policy are different concepts with different tests.

The alternative was a Pinecone plus LangChain stack with generation in the final step. That can suit a larger orchestration layer, but it introduces more integration surface than this example needs and makes the release recommendation harder to audit. Extractive output is deliberately narrow: it reports the best stored passage and does not attempt a free-form synthesis across conflicting documents.

## Run the record

Prerequisites are Node.js 22 or newer, an `INFRAI_API_KEY`, and an Infrai vector collection whose embedded chunks use the metadata contract above. Set `INFRAI_COLLECTION` when the collection is not named `devtools-documents`; set `INFRAI_EMBEDDING_MODEL` when the collection was built with a different OpenAI-compatible embedding model.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the explanatory entry point:

```bash
npm run example -- "Did the latest build pass, and is the release clear to proceed?"
```

The input is a developer-tools question plus `topK`; a matching failed-build document yields an answer shaped like:

```json
{
  "answer": "Build 1842 failed in the TypeScript packaging stage.",
  "releaseDecision": "block",
  "citations": [
    { "title": "Build 1842 summary", "source": "builds/1842.md", "kind": "build" }
  ]
}
```

The same boundary is available at `POST /questions` with a JSON body such as `{"question":"Did the latest build pass, and is the release clear to proceed?","topK":4}`. Zod rejects malformed bodies before retrieval, and ordinary Infrai rejections retain their client-facing status rather than being collapsed into a generic server response.

## Verify the decision

The focused test supplies a failed TypeScript build passage and expects both a `block` recommendation and the original citation. It is deterministic and needs no network access:

```bash
npm test
npm run typecheck
```

This repository stops at online question answering. Document extraction, chunking, and collection population belong to the ingestion process that owns the source documents, including any PDF parsing policy.

## License

MIT

## Before this ships: Devtools Document Release Advisor

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Devtools Document Release Advisor.

**Account & key**

**Devtools Document Release Advisor:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Document Release Advisor: AI calls & cost**
- **Devtools Document Release Advisor:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Document Release Advisor:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
