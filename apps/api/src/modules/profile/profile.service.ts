import { randomUUID } from "node:crypto";
import { brasiliaDay } from "@pontinho/rules";
import type { PhotoUploadBody, PhotoUploadResponse, ProfileResponse, RegistrationBody, UpdateProfileBody } from "@pontinho/api-contract";
import type { UnitOfWork } from "../../common/database/database-client.ts";
import { ApiError } from "../../common/errors/api-error.ts";
import { isUniqueConstraintViolation } from "../../common/errors/error-handler.ts";
import type { MatchesRepository } from "../matches/repository/matches.repository.ts";
import type { UserRecord, UsersRepository } from "../users/repository/users.repository.ts";
import { isAdult } from "./adulthood.ts";
import type { AvatarStorage } from "./avatar-storage/avatar-storage.ts";

const PHOTO_EXTENSIONS: Record<PhotoUploadBody["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface ProfileTransaction {
  users: UsersRepository;
  matches: MatchesRepository;
}

interface ProfileServiceInput {
  usersRepository: UsersRepository;
  avatarStorage: AvatarStorage;
  unitOfWork: UnitOfWork<ProfileTransaction>;
  now: () => Date;
}

interface UserInput {
  userId: string;
}

interface RegisterInput extends RegistrationBody, UserInput {}

interface UpdateInput extends UpdateProfileBody, UserInput {}

interface RequestPhotoUploadInput extends PhotoUploadBody, UserInput {}

interface IsOwnPhotoPathInput {
  userId: string;
  photoPath: string;
}

function isOwnPhotoPath({ userId, photoPath }: IsOwnPhotoPathInput): boolean {
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(photoPath);
}

export class ProfileService {
  private readonly usersRepository: UsersRepository;
  private readonly avatarStorage: AvatarStorage;
  private readonly unitOfWork: UnitOfWork<ProfileTransaction>;
  private readonly now: () => Date;

  constructor({ usersRepository, avatarStorage, unitOfWork, now }: ProfileServiceInput) {
    this.usersRepository = usersRepository;
    this.avatarStorage = avatarStorage;
    this.unitOfWork = unitOfWork;
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

  async update({ userId, nickname, phone, photoPath }: UpdateInput): Promise<ProfileResponse> {
    if (photoPath !== undefined && !isOwnPhotoPath({ userId, photoPath })) {
      throw new ApiError({ code: "photoNotOwned" });
    }
    const user = await this.usersRepository.update({ id: userId, nickname, phone, photoPath });
    return this.toResponse({ user });
  }

  deactivate({ userId }: UserInput): Promise<void> {
    return this.unitOfWork.run(async (transaction) => {
      await transaction.users.lockByIds({ ids: [userId] });
      const openMatchId = await transaction.matches.findOpenMatchIdOf({ userId });
      if (openMatchId) {
        throw new ApiError({ code: "playerAlreadyInMatch" });
      }
      await transaction.users.deactivate({ id: userId, deactivatedAt: this.now() });
    });
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
      phone: user.phone,
      photoUrl: user.photoPath ? this.avatarStorage.publicUrl({ path: user.photoPath }) : null,
      complete: Boolean(user.fullName && user.cpf && user.birthDate && user.nickname),
    };
  }
}
