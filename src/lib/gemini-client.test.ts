import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractGeminiText, friendlyGeminiError, sanitizeGeminiKey } from "./gemini-client.ts";

describe("gemini-client", () => {
  it("strips bearer noise from keys", () => {
    assert.equal(sanitizeGeminiKey("Bearer AIza123\n"), "AIza123");
    assert.equal(sanitizeGeminiKey("  x-goog-api-key: AIza 99 "), "AIza99");
  });

  it("prefers the last non-thought part", () => {
    const payload = {
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "I should reply in JSON {not this}" },
              { text: '{"say":"Sandy ready","actions":[]}' },
            ],
          },
        },
      ],
    };
    assert.equal(extractGeminiText(payload), '{"say":"Sandy ready","actions":[]}');
  });

  it("reads interactions output_text", () => {
    assert.equal(extractGeminiText({ output_text: "hello from sandy" }), "hello from sandy");
  });

  it("maps auth failures", () => {
    assert.match(friendlyGeminiError("ERR:403:API key not valid"), /key galat/i);
    assert.match(friendlyGeminiError("429 RESOURCE_EXHAUSTED"), /quota/i);
  });
});
