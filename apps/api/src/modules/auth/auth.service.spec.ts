import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { fake } from "../../../test/support/fake.ts";
import { UnauthorizedError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { AuthService } from "./auth.service.ts";
import type { TokenVerifier } from "./token-verifier.ts";

const userId = randomUUID();

function buildService({ active = true, verifyFails = false } = {}) {
  const upserts: { id: string; email: string }[] = [];
  const tokenVerifier = fake<TokenVerifier>({
    verify: async ({ token }) => {
      if (verifyFails) {
        throw new UnauthorizedError(errors.auth.invalidToken);
      }
      return { userId, email: `${token}@example.com` };
    },
  });
  const usersRepository = fake<UsersRepository>({
    findOrCreate: async (input) => {
      upserts.push(input);
      return { id: input.id, email: input.email, name: null, birthDate: null, photoPath: null, active };
    },
  });
  return { service: new AuthService({ tokenVerifier, usersRepository }), upserts };
}

describe("AuthService", () => {
  it("creates the user on the first access and returns who is calling", async () => {
    const { service, upserts } = buildService();

    const context = await service.authenticate({ authorization: "Bearer ana" });

    assert.deepStrictEqual(context, { userId, email: "ana@example.com" });
    assert.deepStrictEqual(upserts, [{ id: userId, email: "ana@example.com" }]);
  });

  it("accepts the Bearer scheme in any letter case", async () => {
    const { service } = buildService();

    const context = await service.authenticate({ authorization: "bearer ana" });

    assert.strictEqual(context.userId, userId);
  });

  it("rejects a missing header", async () => {
    const { service } = buildService();

    await assert.rejects(service.authenticate({ authorization: undefined }), (error: { statusCode: number; message: string }) => {
      assert.strictEqual(error.statusCode, 401);
      assert.strictEqual(error.message, errors.auth.missingToken);
      return true;
    });
  });

  it("rejects a header that is not a Bearer token", async () => {
    const { service } = buildService();

    await assert.rejects(service.authenticate({ authorization: "Basic abc" }), { statusCode: 401 });
  });

  it("does not touch the database when the token is invalid", async () => {
    const { service, upserts } = buildService({ verifyFails: true });

    await assert.rejects(service.authenticate({ authorization: "Bearer bad" }), { statusCode: 401 });
    assert.deepStrictEqual(upserts, []);
  });

  it("blocks a deactivated user", async () => {
    const { service } = buildService({ active: false });

    await assert.rejects(service.authenticate({ authorization: "Bearer ana" }), (error: { statusCode: number; message: string }) => {
      assert.strictEqual(error.statusCode, 403);
      assert.strictEqual(error.message, errors.auth.inactiveUser);
      return true;
    });
  });
});
