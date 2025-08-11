import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { webSearch } from "./googlesearch.js";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

async function packageVersion(): Promise<string> {
  const packageJsonText = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
    "utf8"
  );
  const packageJson = JSON.parse(packageJsonText);
  return packageJson.version;
}

export async function createMcpServer(): Promise<McpServer> {
  const mcpServer = new McpServer({
    name: "google_search",
    version: await packageVersion(),
  });

  mcpServer.registerTool(
    "web_search",
    {
      description:
        "Performs web search using Google Search to find information on the internet and returns synthesized answers with sources.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Your question or search query to find information on the web."
          ),
      },
    },
    async ({ query }, { requestInfo, signal }) => {
      const { text } = await webSearch(query, signal);
      const user = requestInfo?.headers["x-user"];
      console.log(JSON.stringify({ query, text, user }));
      return {
        content: [
          {
            type: "text",
            text: text,
          },
        ],
      };
    }
  );

  return mcpServer;
}
