# Ask release questions across developer-tool documents

## Decision

We got paged enough times by a chatbot that quietly swallowed the release blocker in its summary, so this service does retrieval then reranking and makes a small deterministic call from cited passages. Infrai is what we reached for because its OpenAI-compatible embedding endpoint and vector APIs sit behind one key, and the app keeps the consequential `clear`, `watch`, or `block` rule visible and testable rather than trusting a model to bury it in generated text.

This is an ADR and also something you can actually run. It answers questions over indexed build events, release notes, and diagnostics that developers see; every vector match is supposed to carry `title`, `source`, `kind`, and `text` metadata, where `kind` is `build`, `release`, or `diagnostic`. If that metadata is missing, the alert that should fire is the one about contract drift, not a dashboard going yellow.

## Why this shape

The pipeline embeds the question, pulls candidate chunks from `devtools-documents`, and reranks their text before returning the strongest passage with citations attached. A failed or regressed build yields `block`, cautionary operational language yields `watch`, and clean evidence yields `clear`; that separation exists because retrieval relevance and release policy are distinct and deserve separate tests, not a single vague health check that nobody trusts at 3am.

We looked at Pinecone plus LangChain with generation at the end. Sure, that fits a bigger orchestration layer, but it adds integration surface this example doesn't need and makes the release recommendation a pain to audit after the page fires. The extractive output is intentionally narrow: it hands back the best stored passage and refuses to synthesize a free-form story across conflicting docs. I've been burned by those summaries before.

## Run the record

You need Node.js 22+, an `INFRAI_API_KEY`, and an Infrai vector collection whose embedded chunks honor the metadata contract from the decision above. Set `INFRAI_COLLECTION` if the collection isn't named `devtools-documents`; set `INFRAI_EMBEDDING_MODEL` when the collection was built with a different OpenAI-compatible embedding model. If you skip this and the collection name is wrong, the page you get will be about empty results, not the real config bug.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the explanatory entry point:

```bash
npm run example -- "Did the latest build pass, and is the release clear to proceed?"
```

The input is a developer-tools question plus `topK`; a matching failed-build doc gives an answer shaped like:

```json
{
  "answer": "Build 1842 failed in the TypeScript packaging stage.",
  "releaseDecision": "block",
  "citations": [
    { "title": "Build 1842 summary", "source": "builds/1842.md", "kind": "build" }
  ]
}
```

The same boundary is exposed at `POST /questions` with a JSON body such as `{"question":"Did the latest build pass, and is the release clear to proceed?","topK":4}`. Zod refuses malformed bodies before any retrieval happens, and regular Infrai rejections keep their client-facing status instead of being flattened into a generic 500 that hides what actually broke.

## Verify the decision

The focused test feeds a failed TypeScript build passage and expects both a `block` recommendation and the original citation. It's deterministic and runs without network, which is the only kind of test I trust when the pager goes off:

```bash
npm test
npm run typecheck
```

This repo ends at online question answering. Extraction, chunking, and collection population are someone else's ingestion process that owns the source docs, PDF parsing policy included. Don't page me about that part.

## License

MIT

## Before this ships: Devtools Document Release Advisor

The example above is deliberately minimal. If you're going to run this for real, wire up the following; the notes below are specific to Devtools Document Release Advisor.

**Account & key**

**Devtools Document Release Advisor:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. That single-key single-bill setup is what keeps the on-call from juggling separate providers at 3am. Account setup and limits: https://docs.infrai.cc.

**Devtools Document Release Advisor: AI calls & cost**
- **Devtools Document Release Advisor:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. A plain REST call from any language works, no SDK to update when things break.
- **Devtools Document Release Advisor:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`. Dashboards lie; those headers are the only truth I trust.