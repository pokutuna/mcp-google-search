import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpAuthRouter, bearerAuth } from "@hono/mcp";
import { createMcpServer } from "./mcp.js";
import { env } from "./env.js";
import { verifyGoogleToken } from "./auth.js";
import { GoogleOAuthProvider } from "./google-oauth-provider.js";
import { consumeTransaction } from "./transaction-store.js";

const app = new Hono();

// CORS for MCP Inspector
if (env.NODE_ENV === "development") {
  app.use("*", cors({ origin: "*" }));
}

const baseUrl = new URL(env.BASE_URL);
const provider = new GoogleOAuthProvider();

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const txnId = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.json(
      { error, error_description: c.req.query("error_description") },
      400,
    );
  }

  const transaction = consumeTransaction(txnId || "");
  if (!transaction) {
    return c.json({ error: "Invalid or expired transaction" }, 400);
  }

  const redirectUrl = new URL(transaction.clientRedirectUri);
  redirectUrl.searchParams.set("code", code || "");
  if (transaction.clientState) {
    redirectUrl.searchParams.set("state", transaction.clientState);
  }

  return c.redirect(redirectUrl.toString());
});

app.post("/register", async (c) => {
  const metadata = await c.req.json();
  const clientInfo = provider.registerClient(metadata);
  return c.json({
    ...clientInfo,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  });
});

app.route(
  "/",
  mcpAuthRouter({
    provider,
    issuerUrl: baseUrl,
    baseUrl,
    resourceServerUrl: new URL("/mcp", baseUrl),
    scopesSupported: ["openid", "email", "profile"],
  }),
);

const mcpServer = await createMcpServer();

app.all(
  "/mcp",
  bearerAuth({
    verifyToken: async (token, c) => {
      try {
        const user = await verifyGoogleToken(token);
        c.set("user", user);
        return true;
      } catch {
        return false;
      }
    },
  }),
  async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await mcpServer.connect(transport);

    const user = c.get("user");
    const headers = new Headers(c.req.raw.headers);
    headers.set("x-user-email", user.email);
    headers.set("x-user-sub", user.sub);
    if (user.name) headers.set("x-user-name", user.name);

    return transport.handleRequest(
      new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers,
        body: c.req.raw.body,
        duplex: "half",
      } as RequestInit),
    );
  },
);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    console.log(`Server running on port ${env.PORT}`);
  },
);
