import { randomUUID } from "node:crypto";
import { brasiliaDay } from "@pontinho/rules";
import type { PhotoUploadBody, PhotoUploadResponse, ProfileResponse, RegistrationBody } from "@pontinho/api-contract";
import { ApiError } from "../../common/errors/api-error.ts";
import { isUniqueConstraintViolation } from "../../common/errors/error-handler.ts";
import type { UserRecord, UsersRepository } from "../users/repository/users.repository.ts";
import { isAdult } from "./adulthood.ts";
import type { AvatarStorage } from "./avatar-storage/avatar-storage.ts";

const PHOTO_EXTENSIONS: Record<PhotoUploadBody["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface ProfileServiceInput {
  usersRepository: UsersRepository;
  avatarStorage: AvatarStorage;
  now: () => Date;
}

interface UserInput {
  userId: string;
}

interface RegisterInput extends RegistrationBody, UserInput {}

interface RequestPhotoUploadInput extends PhotoUploadBody, UserInput {}

export class ProfileService {
  private readonly usersRepository: UsersRepository;
  private readonly avatarStorage: AvatarStorage;
  private readonly now: () => Date;

  constructor({ usersRepository, avatarStorage, now }: ProfileServiceInput) {
    this.usersRepository = usersRepository;
    this.avatarStorage = avatarStorage;
    this.now = now;
  }

  async get({ userId }: UserInput): Promise<ProfileResponse> {
    const user = await this.usersRepository.findById({ id: userId });
    if (!user) {
      throw new ApiError({ code: "profileNotFound" });
    }
    return this.toResponse({ user });
  }

  async register({ userId, fullName, cpf, birthDate, nickname }: RegisterInput): Promise<ProfileResponse> {
    if (!isAdult({ birthDate, today: brasiliaDay(this.now()) })) {
      throw new ApiError({ code: "underage" });
    }
    const user = await this.usersRepository
      .register({ id: userId, fullName, cpf, birthDate, nickname })
      .catch((error: unknown) => {
        throw isUniqueConstraintViolation(error) ? new ApiError({ code: "cpfAlreadyRegistered" }) : error;
      });
    if (!user) {
      throw new ApiError({ code: "registrationLocked" });
    }
    return this.toResponse({ user });
  }

  async requestPhotoUpload({ userId, contentType }: RequestPhotoUploadInput): Promise<PhotoUploadResponse> {
    const path = `${userId}/${randomUUID()}.${PHOTO_EXTENSIONS[contentType]}`;
    const { uploadUrl, token } = await this.avatarStorage.createUploadUrl({ path });
    return { path, uploadUrl, token };
  }

  private toResponse({ user }: { user: UserRecord }): ProfileResponse {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      fullName: user.fullName,
      cpf: user.cpf,
      birthDate: user.birthDate,
      photoUrl: user.photoPath ? this.avatarStorage.publicUrl({ path: user.photoPath }) : null,
      complete: Boolean(user.fullName && user.cpf && user.birthDate && user.nickname),
    };
  }
}
