import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { CryptoKey } from "jose";

export const TEST_SUPABASE_URL = "https://project.supabase.co";
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

const signingPair = await generateKeyPair("ES256");
const publicJwk = { ...(await exportJWK(signingPair.publicKey)), kid: "test-key", alg: "ES256", use: "sig" };

export const testKeySet = createLocalJWKSet({ keys: [publicJwk] });
export const strangerKey = (await generateKeyPair("ES256")).privateKey;

interface SignTestTokenInput {
  userId: string;
  email?: string | null;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  key?: CryptoKey;
}

export function signTestToken({
  userId,
  email = "jogador@example.com",
  issuer = TEST_ISSUER,
  audience = "authenticated",
  expiresIn = "1h",
  key = signingPair.privateKey,
}: SignTestTokenInput): Promise<string> {
  const claims = email === null ? {} : { email };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}
