import assert from "node:assert";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.ts";
import errors from "../messages/errors.json" with { type: "json" };
import { registerErrorHandler } from "./error-handler.ts";
import { ConflictError } from "./http-errors.ts";

function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler({ app });
  app.get("/conflict", async () => {
    throw new ConflictError("já existe");
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
  it("keeps the status and message of an http error inside the fixed envelope", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/conflict" });

    assert.strictEqual(response.statusCode, 409);
    const body = response.json();
    assert.deepStrictEqual(Object.keys(body).sort(), ["error", "message", "path", "statusCode", "timestamp"]);
    assert.strictEqual(body.statusCode, 409);
    assert.strictEqual(body.message, "já existe");
    assert.strictEqual(body.error, "Conflict");
    assert.strictEqual(body.path, "/conflict");
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });

  it("turns a Prisma unique violation into 409", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/unique" });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().message, errors.common.uniqueConflict);
  });

  it("hides the detail of an unexpected error behind a generic 500", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/boom" });

    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(response.json().message, errors.common.internalError);
    assert.ok(!response.body.includes("secret"));
  });

  it("answers 400 with the invalid fields when the body has an extra field", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/echo",
      payload: { name: "Ana", admin: true },
    });

    assert.strictEqual(response.statusCode, 400);
    assert.ok(Array.isArray(response.json().message));
  });

  it("answers an unknown route with the same envelope", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/nope" });

    assert.strictEqual(response.statusCode, 404);
    assert.strictEqual(response.json().message, errors.common.routeNotFound);
  });
});
