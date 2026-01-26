import { ProxyOAuthServerProvider } from "@hono/mcp";
import type { Context } from "hono";
import { env } from "./env.js";
import {
  storeTransaction,
  type OAuthTransaction,
} from "./transaction-store.js";

type ClientInfo = {
  client_id: string;
  redirect_uris: string[];
  scope?: string;
};

export class GoogleOAuthProvider extends ProxyOAuthServerProvider {
  private clients = new Map<string, ClientInfo>();

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
      getClient: async (clientId: string) => this.clients.get(clientId),
    });
  }

  registerClient(metadata: {
    redirect_uris?: string[];
    scope?: string;
  }): ClientInfo {
    const clientId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const clientInfo: ClientInfo = {
      client_id: clientId,
      redirect_uris: metadata.redirect_uris || [],
      scope: metadata.scope || "openid email profile",
    };
    this.clients.set(clientId, clientInfo);
    return clientInfo;
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
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokens: any = await response.json();
    return {
      access_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: "Bearer",
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    };
  }
}
