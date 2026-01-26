import { OAuth2Client } from "google-auth-library";
import { env } from "./env.js";

export type AuthUser = {
  email: string;
  name?: string;
  picture?: string;
  sub: string;
};

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(token: string): Promise<AuthUser> {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new Error("Invalid token payload");
  }

  if (env.AUTH_ALLOWED_DOMAINS.length > 0) {
    const domain = payload.email.split("@")[1];
    if (!env.AUTH_ALLOWED_DOMAINS.includes(domain)) {
      throw new Error("Access denied: domain not allowed");
    }
  }

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub,
  };
}
