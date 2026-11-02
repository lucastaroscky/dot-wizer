import { ForbiddenError, UnauthorizedError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
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
      throw new UnauthorizedError(errors.auth.missingToken);
    }
    return this.authenticateToken({ token });
  }

  async authenticateToken({ token }: AuthenticateTokenInput): Promise<AuthContext> {
    const { userId, email } = await this.tokenVerifier.verify({ token });
    const user = await this.usersRepository.upsert({ id: userId, email });
    if (!user.active) {
      throw new ForbiddenError(errors.auth.inactiveUser);
    }
    return { userId: user.id, email: user.email };
  }
}
