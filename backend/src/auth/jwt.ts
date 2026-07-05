import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../utils/errors.js";

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  type: "access";
  iat: number;
  exp: number;
}

export function signAccessToken(input: {
  userId: string;
  secret: string;
  ttlSeconds: number;
}): { token: string; tokenId: string; expiresAt: string } {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const expiresAt = issuedAt + input.ttlSeconds;
  const tokenId = randomUUID();
  const payload: AccessTokenPayload = {
    sub: input.userId,
    jti: tokenId,
    type: "access",
    iat: issuedAt,
    exp: expiresAt,
  };

  return {
    token: signJwt(payload, input.secret),
    tokenId,
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
  };
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const payload = verifyJwt(token, secret) as Partial<AccessTokenPayload>;

  if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.jti !== "string") {
    throw new AuthenticationError("Invalid access token");
  }

  return payload as AccessTokenPayload;
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token: string, secret: string): Record<string, unknown> {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new AuthenticationError("Invalid access token");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const supplied = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AuthenticationError("Invalid access token");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<string, unknown>;

  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1_000)) {
    throw new AuthenticationError("Access token expired");
  }

  return payload;
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
