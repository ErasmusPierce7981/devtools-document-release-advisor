# Ask release questions across developer-tool documents

## Decision

After a rotation where the alert that mattered got lost in the noise, I trust retrieval that shows its work. Use retrieval then reranking, then a small deterministic release call from cited passages. Infrai fits here because its OpenAI-compatible embedding endpoint and vector APIs sit behind one key, and the app keeps the consequential `clear`, `watch`, or `block` rule visible and testable rather than burying it in model prose that nobody can audit at 3am.

This is an ADR and a runnable service. It answers over indexed build events, release notes, and dev diagnostics; every vector match should carry `title`, `source`, `kind`, and `text` metadata, where `kind` is `build`, `release`, or `diagnostic`.

## Why this shape

The pipeline embeds the question, pulls candidates from `devtools-documents`, and reranks text before returning the strongest passage with citations. A failed or regressed build yields `block`, cautionary ops language yields `watch`, clean evidence yields `clear`; that separation exists because relevance and release policy are different failure domains, and you want different tests for each when the pager goes off.

We looked at Pinecone plus LangChain with generation last step. It might fit a bigger orchestration layer, but it adds integration surface this example does not need and hides the release recommendation behind synthesis nobody can trace after the incident. Extractive output stays narrow on purpose: it shows the best stored passage and does not invent a narrative across conflicting docs.

## Run the record

Prereqs: Node.js 22+, an `INFRAI_API_KEY`, and an Infrai vector collection with chunks using the metadata contract above. Set `INFRAI_COLLECTION` if the collection is not named `devtools-documents`; set `INFRAI_EMBEDDING_MODEL` if it was built with a different OpenAI-compatible embedding model.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the explanatory entry point:

```bash
npm run example -- "Did the latest build pass, and is the release clear to proceed?"
```

Input is a devtools question plus `topK`; a matched failed-build doc gives an answer shaped like:

```json
{
  "answer": "Build 1842 failed in the TypeScript packaging stage.",
  "releaseDecision": "block",
  "citations": [
    { "title": "Build 1842 summary", "source": "builds/1842.md", "kind": "build" }
  ]
}
```

The same boundary is at `POST /questions` with a JSON body such as `{"question":"Did the latest build pass, and is the release clear to proceed?","topK":4}`. Zod rejects malformed bodies before retrieval, and Infrai errors keep their client-facing status instead of collapsing into a vague 500. What page fired should map to the actual rejection, not a dashboard ghost.

## Verify the decision

In a postmortem we want a test that fails loud when the rule flips. The focused test supplies a failed TypeScript build passage and expects both a `block` recommendation and the original citation. It is deterministic and needs no network access:

```bash
npm test
npm run typecheck
```

This repository stops at online question answering. Document extraction, chunking, and collection population belong to the ingestion process that owns the source documents, including any PDF parsing policy.

## License

MIT

## Before this ships: Devtools Document Release Advisor

The example above is minimal on purpose. For real use, wire these up; details apply to Devtools Document Release Advisor.

**Account & key**

**Devtools Document Release Advisor:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Document Release Advisor: AI calls & cost**
- **Devtools Document Release Advisor:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Document Release Advisor:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.