import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { env } from "./env.js";

const app = new Hono();

// CORS for MCP Inspector
if (env.NODE_ENV === "development") {
  app.use("*", cors({ origin: "*" }));
}

app.all("/mcp", async (c) => {
  try {
    const mcpServer = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await mcpServer.connect(transport);
    const response = await transport.handleRequest(c.req.raw);
    await mcpServer.close();
    return response;
  } catch (error) {
    console.error("Error handling MCP request:", error);
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      },
      500,
    );
  }
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    console.log(`Server running on port ${env.PORT}`);
  },
);
