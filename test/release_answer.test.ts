import assert from "node:assert/strict";
import test from "node:test";
import { answerFromEvidence } from "../src/release_answer.js";

test("a failed build blocks the release and preserves its citation", () => {
  const result = answerFromEvidence("Can release 2.8 proceed?", [{
    title: "Build 1842 summary",
    source: "builds/1842.md",
    kind: "build",
    text: "Build 1842 failed in the TypeScript packaging stage.",
    score: 0.97
  }]);

  assert.equal(result.releaseDecision, "block");
  assert.equal(result.answer, "Build 1842 failed in the TypeScript packaging stage.");
  assert.deepEqual(result.citations, [{
    title: "Build 1842 summary",
    source: "builds/1842.md",
    kind: "build"
  }]);
});
