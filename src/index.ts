import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { env } from "./env.js";

const app = express();
app.use(express.json());

// CORS for MCP Inspector
if (env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: "*",
    })
  );
}

const mcpServer = await createMcpServer();

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
