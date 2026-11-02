import assert from "assert";
import { verifyApiAtBoot } from "../src/gameApi/verifyApiAtBoot.js";
import { captureLogs } from "./support/harness.js";
import { FakeGameApi } from "./support/fakeGameApi.js";

describe("verifyApiAtBoot", () => {
  async function verify(api: FakeGameApi) {
    const exits: number[] = [];
    const logs = captureLogs();
    try {
      await verifyApiAtBoot(api, (code) => exits.push(code));
    } finally {
      logs.restore();
    }
    return { exits, logs: logs.calls };
  }

  it("stays quiet and keeps running when the API answers", async () => {
    const { exits, logs } = await verify(new FakeGameApi());

    assert.deepStrictEqual([exits, logs], [[], []]);
  });

  it("logs an error and stops the process when the API refuses the service token, so the deploy fails", async () => {
    const api = new FakeGameApi();
    api.failNext("ping", 1, "serviceTokenInvalid");

    const { exits, logs } = await verify(api);

    assert.deepStrictEqual(exits, [1]);
    assert.strictEqual(logs[0].level, "error");
    assert.deepStrictEqual(logs[0].args[1], { chamada: "ping", status: 401, codigo: "serviceTokenInvalid", tentativa: 1 });
  });

  for (const code of ["networkError", "timeout", "internalError"] as const) {
    it(`only warns and keeps running when the API is down (${code})`, async () => {
      const api = new FakeGameApi();
      api.failNext("ping", 1, code);

      const { exits, logs } = await verify(api);

      assert.deepStrictEqual(exits, []);
      assert.strictEqual(logs[0].level, "warn");
      assert.strictEqual((logs[0].args[1] as { codigo: string }).codigo, code);
    });
  }
});
