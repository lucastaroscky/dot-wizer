import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { fake } from "../../../test/support/fake.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UserRecord, UsersRepository } from "../users/repository/users.repository.ts";
import type { AvatarStorage } from "./avatar-storage/avatar-storage.ts";
import { ProfileService } from "./profile.service.ts";

const userId = randomUUID();
const now = () => new Date("2026-11-02T12:00:00Z");

function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return { id: userId, email: "ana@example.com", name: null, birthDate: null, photoPath: null, active: true, ...overrides };
}

function buildService({ user = userRecord() } = {}) {
  const updates: unknown[] = [];
  const uploadPaths: string[] = [];
  const usersRepository = fake<UsersRepository>({
    findById: async () => user,
    updateProfile: async (input) => {
      updates.push(input);
      return userRecord({ name: input.name, birthDate: input.birthDate, photoPath: input.photoPath ?? user.photoPath });
    },
  });
  const avatarStorage: AvatarStorage = {
    createUploadUrl: async ({ path }) => {
      uploadPaths.push(path);
      return { uploadUrl: `https://storage.example.com/upload/${path}`, token: "upload-token" };
    },
    publicUrl: ({ path }) => `https://storage.example.com/public/${path}`,
  };
  return { service: new ProfileService({ usersRepository, avatarStorage, now }), updates, uploadPaths };
}

describe("ProfileService", () => {
  describe("get", () => {
    it("reports an incomplete profile when name and birth date are missing", async () => {
      const { service } = buildService();

      const profile = await service.get({ userId });

      assert.deepStrictEqual(profile, {
        id: userId,
        email: "ana@example.com",
        name: null,
        birthDate: null,
        photoUrl: null,
        complete: false,
      });
    });

    it("reports a complete profile and the public photo url", async () => {
      const photoPath = `${userId}/${randomUUID()}.jpg`;
      const { service } = buildService({ user: userRecord({ name: "Ana", birthDate: "1990-05-20", photoPath }) });

      const profile = await service.get({ userId });

      assert.strictEqual(profile.complete, true);
      assert.strictEqual(profile.photoUrl, `https://storage.example.com/public/${photoPath}`);
    });

    it("reports an incomplete profile when only the name is filled", async () => {
      const { service } = buildService({ user: userRecord({ name: "Ana" }) });

      assert.strictEqual((await service.get({ userId })).complete, false);
    });

    it("answers 404 when the user does not exist", async () => {
      const usersRepository = fake<UsersRepository>({ findById: async () => null });
      const service = new ProfileService({ usersRepository, avatarStorage: fake<AvatarStorage>({}), now });

      await assert.rejects(service.get({ userId }), { statusCode: 404, message: errors.profile.notFound });
    });
  });

  describe("save", () => {
    it("saves name and birth date and returns the complete profile", async () => {
      const { service, updates } = buildService();

      const profile = await service.save({ userId, name: "Ana", birthDate: "1990-05-20" });

      assert.deepStrictEqual(updates, [{ id: userId, name: "Ana", birthDate: "1990-05-20", photoPath: undefined }]);
      assert.strictEqual(profile.complete, true);
    });

    it("accepts someone who turns 18 today in Brasilia", async () => {
      const { service } = buildService();

      const profile = await service.save({ userId, name: "Ana", birthDate: "2008-11-02" });

      assert.strictEqual(profile.birthDate, "2008-11-02");
    });

    it("uses the Brasilia date, not the UTC date, to decide the age", async () => {
      const lateNightInBrasilia = () => new Date("2026-11-03T01:30:00Z");
      const usersRepository = fake<UsersRepository>({});
      const service = new ProfileService({ usersRepository, avatarStorage: fake<AvatarStorage>({}), now: lateNightInBrasilia });

      await assert.rejects(service.save({ userId, name: "Ana", birthDate: "2008-11-03" }), {
        statusCode: 422,
        message: errors.profile.underage,
      });
    });

    it("rejects someone under 18 without saving", async () => {
      const { service, updates } = buildService();

      await assert.rejects(service.save({ userId, name: "Ana", birthDate: "2008-11-03" }), {
        statusCode: 422,
        message: errors.profile.underage,
      });
      assert.deepStrictEqual(updates, []);
    });

    it("saves a photo that was uploaded for this user", async () => {
      const photoPath = `${userId}/${randomUUID()}.png`;
      const { service, updates } = buildService();

      await service.save({ userId, name: "Ana", birthDate: "1990-05-20", photoPath });

      assert.deepStrictEqual(updates, [{ id: userId, name: "Ana", birthDate: "1990-05-20", photoPath }]);
    });

    it("rejects a photo path that belongs to another user", async () => {
      const { service, updates } = buildService();

      await assert.rejects(
        service.save({ userId, name: "Ana", birthDate: "1990-05-20", photoPath: `${randomUUID()}/${randomUUID()}.png` }),
        { statusCode: 422, message: errors.profile.photoNotOwned },
      );
      assert.deepStrictEqual(updates, []);
    });

    it("rejects a photo path that climbs out of the user folder", async () => {
      const { service } = buildService();

      await assert.rejects(
        service.save({ userId, name: "Ana", birthDate: "1990-05-20", photoPath: `${userId}/../${randomUUID()}/x.png` }),
        { statusCode: 422 },
      );
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
