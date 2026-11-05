import assert from "node:assert";
import Fastify from "fastify";
import { API_ERROR_CODES } from "@pontinho/api-contract";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { registerOpenApi } from "./openapi.ts";

interface Operation {
  summary?: string;
  tags?: string[];
  security?: Record<string, string[]>[];
  parameters?: { name: string; in: string; required?: boolean; schema?: Record<string, unknown> }[];
  responses: Record<string, { description?: string }>;
}

type Document = { paths: Record<string, Record<string, Operation>>; components?: { securitySchemes?: Record<string, unknown> } };

const ROUTES = [
  "GET /profile",
  "POST /profile/registration",
  "PATCH /profile",
  "DELETE /profile",
  "PUT /profile/pix-key",
  "POST /profile/photo-upload",
  "GET /wallet",
  "GET /wallet/entries",
  "POST /wallet/daily-bonus",
  "GET /store/quote",
  "POST /store/purchases",
  "GET /matches/{matchId}",
  "GET /internal/ping",
  "POST /internal/players/entry",
  "POST /internal/matches",
  "POST /internal/matches/{matchId}/rounds",
  "POST /internal/matches/{matchId}/eliminations",
  "POST /internal/matches/{matchId}/finish",
];

describe("OpenAPI document", () => {
  let testApp: TestApp;
  let document: Document;

  before(async () => {
    testApp = await createTestApp();
    document = testApp.app.swagger() as unknown as Document;
  });
  after(async () => testApp.app.close());

  function operation(route: string): Operation {
    const [method, path] = route.split(" ");
    return document.paths[path][method.toLowerCase()];
  }

  it("documents exactly the routes of the API", () => {
    const documented = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );

    assert.deepStrictEqual(documented.sort(), [...ROUTES].sort());
  });

  it("gives every route a summary and a tag", () => {
    for (const route of ROUTES) {
      assert.ok(operation(route).summary, `${route} has no summary`);
      assert.ok(operation(route).tags?.length, `${route} has no tag`);
    }
  });

  it("asks for the player's token on the app routes and for the service token on the internal ones", () => {
    for (const route of ROUTES) {
      const expected = route.includes("/internal/") ? "serviceToken" : "bearerAuth";
      assert.deepStrictEqual(operation(route).security, [{ [expected]: [] }], route);
    }
    assert.deepStrictEqual(Object.keys(document.components?.securitySchemes ?? {}).sort(), ["bearerAuth", "serviceToken"]);
  });

  it("declares the errors each route can answer with the codes that explain them", () => {
    const bonus = operation("POST /wallet/daily-bonus").responses;

    assert.match(bonus["409"].description ?? "", /dailyBonusAlreadyClaimed/);
    assert.match(bonus["401"].description ?? "", /invalidToken/);
    assert.match(bonus["403"].description ?? "", /accountDisabled/);
    assert.match(bonus["429"].description ?? "", /tooManyRequests/);
    assert.match(bonus["500"].description ?? "", /internalError/);
    assert.match(operation("POST /internal/matches/{matchId}/finish").responses["422"].description ?? "", /winnerEliminated/);
    assert.match(operation("GET /internal/ping").responses["401"].description ?? "", /serviceTokenInvalid/);
  });

  it("only names codes that exist in the code table", () => {
    for (const route of ROUTES) {
      for (const [status, response] of Object.entries(operation(route).responses)) {
        const named = response.description?.match(/Códigos: (.+)$/)?.[1];
        if (!named) {
          continue;
        }
        for (const code of named.split(", ")) {
          assert.ok((API_ERROR_CODES as string[]).includes(code), `${route} ${status} names unknown code ${code}`);
        }
      }
    }
  });

  it("shows the purchase limits of the quote", () => {
    const quantity = operation("GET /store/quote").parameters?.find((parameter) => parameter.name === "quantity");

    assert.strictEqual(quantity?.in, "query");
    assert.strictEqual(quantity?.required, true);
    assert.strictEqual(quantity?.schema?.minimum, 1000);
    assert.strictEqual(quantity?.schema?.multipleOf, 1000);
  });

  it("shows the idempotency key header of the purchase", () => {
    const header = operation("POST /store/purchases").parameters?.find((parameter) => parameter.name === "idempotency-key");

    assert.strictEqual(header?.in, "header");
    assert.strictEqual(header?.required, true);
  });

  it("is not registered in production", async () => {
    const app = Fastify();

    await registerOpenApi({ app, nodeEnv: "production" });
    await app.ready();

    assert.strictEqual(typeof (app as unknown as { swagger?: unknown }).swagger, "undefined");
  });
});
