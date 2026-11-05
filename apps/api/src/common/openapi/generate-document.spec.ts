import assert from "node:assert";
import { generateOpenApiDocument } from "./generate-document.ts";

describe("generateOpenApiDocument", () => {
  it("builds the document of the API without secrets and without touching the database", async () => {
    const document = (await generateOpenApiDocument()) as { openapi: string; info: { title: string }; paths: object };

    assert.strictEqual(document.openapi, "3.0.3");
    assert.strictEqual(document.info.title, "Pontinho API");
    assert.strictEqual(Object.keys(document.paths).length, 15);
  });
});
