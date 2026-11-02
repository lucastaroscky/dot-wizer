import assert from "node:assert";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.ts";
import { ApiError, ERROR_MESSAGES } from "./api-error.ts";
import { registerErrorHandler } from "./error-handler.ts";

function buildApp() {
  const app = Fastify({ bodyLimit: 64 });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler({ app });
  app.get("/conflict", async () => {
    throw new ApiError({ code: "dailyBonusAlreadyClaimed" });
  });
  app.get("/unique", async () => {
    throw new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "7",
      meta: { target: ["idempotency_key"] },
    });
  });
  app.get("/boom", async () => {
    throw new Error("connection string leaked: postgres://user:secret@host");
  });
  app.post("/echo", { schema: { body: z.strictObject({ name: z.string() }) } }, async (request) => request.body);
  return app;
}

describe("error handler", () => {
  it("answers an ApiError with its code, status and message inside the envelope", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/conflict" });

    assert.strictEqual(response.statusCode, 409);
    const body = response.json();
    assert.deepStrictEqual(Object.keys(body).sort(), ["code", "message", "statusCode"]);
    assert.strictEqual(body.statusCode, 409);
    assert.strictEqual(body.code, "dailyBonusAlreadyClaimed");
    assert.strictEqual(body.message, ERROR_MESSAGES.dailyBonusAlreadyClaimed);
  });

  it("turns a Prisma unique violation into uniqueConflict", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/unique" });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().code, "uniqueConflict");
    assert.strictEqual(response.json().message, ERROR_MESSAGES.uniqueConflict);
  });

  it("hides the detail of an unexpected error behind internalError", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/boom" });

    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(response.json().code, "internalError");
    assert.strictEqual(response.json().message, ERROR_MESSAGES.internalError);
    assert.ok(!response.body.includes("secret"));
  });

  it("answers validationFailed with the invalid fields when the body has an extra field", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/echo",
      payload: { name: "Ana", admin: true },
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.json().code, "validationFailed");
    assert.ok(Array.isArray(response.json().message));
  });

  it("answers an unknown route with routeNotFound", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/nope" });

    assert.strictEqual(response.statusCode, 404);
    assert.strictEqual(response.json().code, "routeNotFound");
    assert.strictEqual(response.json().message, ERROR_MESSAGES.routeNotFound);
  });

  it("turns the client errors of Fastify into badRequest, keeping the status and hiding its text", async () => {
    const malformed = await buildApp().inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    const tooLarge = await buildApp().inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "x".repeat(200) }),
    });

    assert.deepStrictEqual([malformed.statusCode, tooLarge.statusCode], [400, 413]);
    for (const response of [malformed, tooLarge]) {
      assert.strictEqual(response.json().code, "badRequest");
      assert.strictEqual(response.json().message, ERROR_MESSAGES.badRequest);
    }
  });
});
