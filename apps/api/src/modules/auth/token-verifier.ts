import { errors as joseErrors, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { ApiError } from "../../common/errors/api-error.ts";

const SUPABASE_AUDIENCE = "authenticated";
const SUPABASE_ALGORITHMS = ["ES256", "RS256"];

const claimsSchema = z.object({ sub: z.uuid(), email: z.string().min(1) });

const INVALID_TOKEN_ERRORS = [
  joseErrors.JWTExpired,
  joseErrors.JWTClaimValidationFailed,
  joseErrors.JWTInvalid,
  joseErrors.JWSInvalid,
  joseErrors.JWSSignatureVerificationFailed,
  joseErrors.JWKSNoMatchingKey,
  joseErrors.JWKSMultipleMatchingKeys,
  joseErrors.JOSEAlgNotAllowed,
];

export interface VerifiedToken {
  userId: string;
  email: string;
}

interface TokenVerifierInput {
  keySet: JWTVerifyGetKey;
  issuer: string;
}

interface VerifyInput {
  token: string;
}

export class TokenVerifier {
  private readonly keySet: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor({ keySet, issuer }: TokenVerifierInput) {
    this.keySet = keySet;
    this.issuer = issuer;
  }

  async verify({ token }: VerifyInput): Promise<VerifiedToken> {
    const payload = await this.readPayload({ token });
    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) {
      throw new ApiError({ code: "invalidToken" });
    }
    return { userId: claims.data.sub, email: claims.data.email };
  }

  private async readPayload({ token }: VerifyInput) {
    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: this.issuer,
        audience: SUPABASE_AUDIENCE,
        algorithms: SUPABASE_ALGORITHMS,
      });
      return payload;
    } catch (error) {
      if (INVALID_TOKEN_ERRORS.some((invalidTokenError) => error instanceof invalidTokenError)) {
        throw new ApiError({ code: "invalidToken" });
      }
      throw error;
    }
  }
}
