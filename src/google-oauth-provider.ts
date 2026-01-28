import { ProxyOAuthServerProvider } from "@hono/mcp";
import type { Context } from "hono";
import { env } from "./env.js";
import { storeTransaction } from "./transaction-store.js";

function extractEmailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString(),
    );
    return payload.email;
  } catch {
    return undefined;
  }
}

export class GoogleOAuthProvider extends ProxyOAuthServerProvider {
  constructor() {
    super({
      endpoints: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        registrationUrl: `${env.BASE_URL}/register`,
      },
      verifyAccessToken: async () => {
        throw new Error("verifyAccessToken should not be called");
      },
      getClient: async (_clientId: string) => {
        return {
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uris: [],
          scope: "openid email profile",
        };
      },
    });
  }

  registerClient(metadata: { redirect_uris?: string[] }) {
    return {
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uris: metadata.redirect_uris || [],
      scope: "openid email profile",
    };
  }

  async authorize(
    client: any,
    params: {
      state?: string;
      scopes?: string[];
      redirectUri: string;
      codeChallenge: string;
      resource?: URL;
    },
    c: Context,
  ): Promise<void> {
    const txnId = crypto.randomUUID();
    storeTransaction(txnId, {
      clientRedirectUri: params.redirectUri,
      clientState: params.state,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const targetUrl = new URL(this._endpoints.authorizationUrl);
    const searchParams = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      response_type: "code",
      redirect_uri: `${env.BASE_URL}/callback`,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      state: txnId,
      scope: params.scopes?.join(" ") || client.scope || "",
      access_type: "offline",
      prompt: "consent",
    });

    targetUrl.search = searchParams.toString();
    c.res = c.redirect(targetUrl.toString());
  }

  async exchangeAuthorizationCode(
    _client: any,
    authorizationCode: string,
    codeVerifier: string,
    _redirectUri: string,
    _resource?: URL,
  ): Promise<any> {
    const response = await fetch(this._endpoints.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: authorizationCode,
        code_verifier: codeVerifier,
        redirect_uri: `${env.BASE_URL}/callback`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token exchange failed:", response.status, error);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokens: any = await response.json();
    const email = extractEmailFromIdToken(tokens.id_token);
    console.log("User logged in:", email || "unknown");
    return {
      access_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: "Bearer",
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    };
  }

  async exchangeRefreshToken(
    _client: any,
    refreshToken: string,
    _scopes?: string[],
    _resource?: URL,
  ): Promise<any> {
    const response = await fetch(this._endpoints.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", response.status, error);
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokens: any = await response.json();
    const email = extractEmailFromIdToken(tokens.id_token);
    console.log("Token refreshed:", email || "unknown");
    return {
      access_token: tokens.id_token,
      refresh_token: tokens.refresh_token || refreshToken,
      token_type: "Bearer",
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    };
  }
}
