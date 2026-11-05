import { ApiError } from "../../common/errors/api-error.ts";
import type { UsersRepository } from "../users/repository/users.repository.ts";
import type { TokenVerifier } from "./token-verifier.ts";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export interface AuthContext {
  userId: string;
  email: string;
}

interface AuthServiceInput {
  tokenVerifier: TokenVerifier;
  usersRepository: UsersRepository;
}

interface AuthenticateInput {
  authorization: string | undefined;
}

interface AuthenticateTokenInput {
  token: string;
}

export class AuthService {
  private readonly tokenVerifier: TokenVerifier;
  private readonly usersRepository: UsersRepository;

  constructor({ tokenVerifier, usersRepository }: AuthServiceInput) {
    this.tokenVerifier = tokenVerifier;
    this.usersRepository = usersRepository;
  }

  async authenticate({ authorization }: AuthenticateInput): Promise<AuthContext> {
    const token = authorization?.match(BEARER_PATTERN)?.[1];
    if (!token) {
      throw new ApiError({ code: "invalidToken" });
    }
    return this.authenticateToken({ token });
  }

  async authenticateToken({ token }: AuthenticateTokenInput): Promise<AuthContext> {
    const { userId, email } = await this.tokenVerifier.verify({ token });
    const user = await this.usersRepository.findOrCreate({ id: userId, email });
    if (!user.active) {
      throw new ApiError({ code: "accountDisabled" });
    }
    if (user.email !== email) {
      await this.usersRepository.updateEmail({ id: user.id, email });
    }
    return { userId: user.id, email };
  }
}
