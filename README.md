# MCP Google Search

A Model Context Protocol (MCP) server that provides Google Search web tools.

This is an independent implementation equivalent to the Gemini CLI WebSearch tool, deployable to Google App Engine and accessible via HTTP.

## Features

- `web_search`: Performs web search using Google Search and returns synthesized answers with sources

## Usage with Claude

```bash
$ claude mcp add --scope=user --transport=http --header='X-USER: pokutuna' google_search https://YOUR-APP-HOST/mcp
```

The `X-USER` header is used for logging purposes only.

## Deployment

Deploy to Google App Engine.

1. Create `.env` file with your Google Cloud project ID:
   ```
   PROJECT=your-project-id
   ```

2. Set the `PROJECT` variable in `Makefile`

3. Deploy:
   ```bash
   $ make deploy
   ```
