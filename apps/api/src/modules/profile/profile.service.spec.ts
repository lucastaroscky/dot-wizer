import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { fake } from "../../../test/support/fake.ts";
import type { UserRecord, UsersRepository } from "../users/repository/users.repository.ts";
import type { AvatarStorage } from "./avatar-storage/avatar-storage.ts";
import { ProfileService } from "./profile.service.ts";

const userId = randomUUID();
const now = () => new Date("2026-11-02T12:00:00Z");
const registration = { fullName: "Ana Souza Lima", cpf: "11144477735", birthDate: "1990-05-20", nickname: "Ana" };

function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return { id: userId, email: "ana@example.com", nickname: null, fullName: null, cpf: null, birthDate: null, photoPath: null, active: true, ...overrides };
}

function buildService({ user = userRecord() } = {}) {
  const registrations: unknown[] = [];
  const uploadPaths: string[] = [];
  const usersRepository = fake<UsersRepository>({
    findById: async () => user,
    register: async (input) => {
      registrations.push(input);
      return userRecord(input);
    },
  });
  const avatarStorage: AvatarStorage = {
    createUploadUrl: async ({ path }) => {
      uploadPaths.push(path);
      return { uploadUrl: `https://storage.example.com/upload/${path}`, token: "upload-token" };
    },
    publicUrl: ({ path }) => `https://storage.example.com/public/${path}`,
  };
  return { service: new ProfileService({ usersRepository, avatarStorage, now }), registrations, uploadPaths };
}

describe("ProfileService", () => {
  describe("get", () => {
    it("reports an incomplete profile before the registration", async () => {
      const { service } = buildService();

      const profile = await service.get({ userId });

      assert.deepStrictEqual(profile, {
        id: userId,
        email: "ana@example.com",
        nickname: null,
        fullName: null,
        cpf: null,
        birthDate: null,
        photoUrl: null,
        complete: false,
      });
    });

    it("reports a complete profile and the public photo url", async () => {
      const photoPath = `${userId}/${randomUUID()}.jpg`;
      const { service } = buildService({ user: userRecord({ ...registration, photoPath }) });

      const profile = await service.get({ userId });

      assert.strictEqual(profile.complete, true);
      assert.strictEqual(profile.photoUrl, `https://storage.example.com/public/${photoPath}`);
    });

    it("reports an incomplete profile for an old account with nickname and birth date but no CPF", async () => {
      const { service } = buildService({ user: userRecord({ nickname: "Ana", birthDate: "1990-05-20" }) });

      assert.strictEqual((await service.get({ userId })).complete, false);
    });

    it("answers 404 when the user does not exist", async () => {
      const usersRepository = fake<UsersRepository>({ findById: async () => null });
      const service = new ProfileService({ usersRepository, avatarStorage: fake<AvatarStorage>({}), now });

      await assert.rejects(service.get({ userId }), { statusCode: 404, code: "profileNotFound" });
    });
  });

  describe("register", () => {
    it("saves the registration and returns the complete profile", async () => {
      const { service, registrations } = buildService();

      const profile = await service.register({ userId, ...registration });

      assert.deepStrictEqual(registrations, [{ id: userId, ...registration }]);
      assert.strictEqual(profile.complete, true);
    });

    it("accepts someone who turns 18 today in Brasilia", async () => {
      const { service } = buildService();

      const profile = await service.register({ userId, ...registration, birthDate: "2008-11-02" });

      assert.strictEqual(profile.birthDate, "2008-11-02");
    });

    it("uses the Brasilia date, not the UTC date, to decide the age", async () => {
      const lateNightInBrasilia = () => new Date("2026-11-03T01:30:00Z");
      const usersRepository = fake<UsersRepository>({});
      const service = new ProfileService({ usersRepository, avatarStorage: fake<AvatarStorage>({}), now: lateNightInBrasilia });

      await assert.rejects(service.register({ userId, ...registration, birthDate: "2008-11-03" }), {
        statusCode: 422,
        code: "underage",
      });
    });

    it("rejects someone under 18 without saving", async () => {
      const { service, registrations } = buildService();

      await assert.rejects(service.register({ userId, ...registration, birthDate: "2008-11-03" }), {
        statusCode: 422,
        code: "underage",
      });
      assert.deepStrictEqual(registrations, []);
    });

    it("answers registrationLocked when the account already has a CPF", async () => {
      const usersRepository = fake<UsersRepository>({ register: async () => null });
      const service = new ProfileService({ usersRepository, avatarStorage: fake<AvatarStorage>({}), now });

      await assert.rejects(service.register({ userId, ...registration }), { statusCode: 409, code: "registrationLocked" });
    });
  });

  describe("requestPhotoUpload", () => {
    it("creates an upload url inside the user folder with the extension of the content type", async () => {
      const { service, uploadPaths } = buildService();

      const upload = await service.requestPhotoUpload({ userId, contentType: "image/webp" });

      assert.match(upload.path, new RegExp(`^${userId}/[0-9a-f-]{36}\\.webp$`));
      assert.deepStrictEqual(uploadPaths, [upload.path]);
      assert.strictEqual(upload.token, "upload-token");
      assert.strictEqual(upload.uploadUrl, `https://storage.example.com/upload/${upload.path}`);
    });
  });
});
