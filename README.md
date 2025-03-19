# Exa MCP Server 🔍
[![npm version](https://badge.fury.io/js/exa-mcp-server.svg)](https://www.npmjs.com/package/exa-mcp-server)
[![smithery badge](https://smithery.ai/badge/exa)](https://smithery.ai/server/exa)

A Model Context Protocol (MCP) server lets AI assistants like Claude use the Exa AI Search API for web searches. This setup allows AI models to get real-time web information in a safe and controlled way.

Demo video https://www.loom.com/share/ac676f29664e4c6cb33a2f0a63772038?sid=0e72619f-5bfc-415d-a705-63d326373f60

## What's New in v0.2.0 🔄

- Updated to use the latest MCP TypeScript SDK
- Improved error handling and resource management
- More robust parameter validation with Zod
- Better caching of search results
- Automatic resource updates after new searches
- Enhanced Exa API features:
  - Support for `maxCharacters` to limit text length
  - Live crawling options with `livecrawl` parameter
  - Customizable number of results with `numResults` parameter
  - Control over live crawling behavior with `livecrawl` parameter ('always' or 'fallback')

## What is MCP? 🤔

The Model Context Protocol (MCP) is a system that lets AI apps, like Claude Desktop, connect to external tools and data sources. It gives a clear and safe way for AI assistants to work with local services and APIs while keeping the user in control.

## What does this server do? 🚀

The Exa MCP server:
- Enables AI assistants to perform web searches using Exa's powerful search API
- Provides structured search results including titles, URLs, and content snippets
- Caches recent searches as resources for reference
- Handles rate limiting and error cases gracefully
- Supports real-time web crawling for fresh content


## Prerequisites 📋

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Claude Desktop](https://claude.ai/download) installed
- An [Exa API key](https://dashboard.exa.ai/api-keys)
- Git installed

You can verify your Node.js installation by running:
```bash
node --version  # Should show v18.0.0 or higher
```

## Installation 🛠️

### NPM Installation

```bash
npm install -g exa-mcp-server
```

### Using Smithery

To install the Exa MCP server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/exa):

```bash
npx -y @smithery/cli install exa --client claude
```

### Manual Installation

1. Clone the repository:

```bash
git clone https://github.com/exa-labs/exa-mcp-server.git
cd exa-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Create a global link (this makes the server executable from anywhere):

```bash
npm link
```

## Configuration ⚙️

### 1. Configure Claude Desktop to recognize the Exa MCP server

You can find claude_desktop_config.json inside the settings of Claude Desktop app:

Open the Claude Desktop app and enable Developer Mode from the top-left menu bar. 

Once enabled, open Settings (also from the top-left menu bar) and navigate to the Developer Option, where you'll find the Edit Config button. Clicking it will open the claude_desktop_config.json file, allowing you to make the necessary edits. 

OR (if you want to open claude_desktop_config.json from terminal)

#### For macOS:

1. Open your Claude Desktop configuration:

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### For Windows:

1. Open your Claude Desktop configuration:

```powershell
code %APPDATA%\Claude\claude_desktop_config.json
```

### 2. Add the Exa server configuration:

```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["/path/to/exa-mcp-server/build/index.js"],
      "env": {
        "EXA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `your-api-key-here` with your actual Exa API key from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys).

### 3. Restart Claude Desktop

For the changes to take effect:

1. Completely quit Claude Desktop (not just close the window)
2. Start Claude Desktop again
3. Look for the 🔌 icon to verify the Exa server is connected

## Usage 🎯

Once configured, you can ask Claude to perform web searches. Here are some example prompts:

```
Can you search for recent developments in quantum computing?
```

```
Search for and summarize the latest news about artificial intelligence startups in new york.
```

```
Find and analyze recent research papers about climate change solutions.
```

```
Search for today's breaking news about tech.
```

```
Search for the top 10 AI research papers from 2023, and only use live crawling as a fallback.
```

```
Search for electric vehicles and return 3 results, always using live crawling.
```

The server will:

1. Process the search request
2. Query the Exa API with optimal settings (including live crawling)
3. Return formatted results to Claude
4. Cache the search for future reference

## Features ✨

* **Simplified Web Search Tool**: Enables Claude to search the web with just a query parameter
* **Customizable Search Parameters**: Control the number of results and live crawling strategy
* **Automatic Live Crawling**: Uses real-time crawling based on specified strategy
* **Preset Optimal Parameters**: Uses best defaults for result count and character limits
* **Search Caching**: Saves recent searches as resources for reference
* **Error Handling**: Gracefully handles API errors and rate limits
* **Type Safety**: Full TypeScript implementation with Zod validation
* **MCP Compliance**: Fully implements the latest MCP protocol specification

## Testing with MCP Inspector 🔍

You can test the server directly using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node ./build/index.js
```

This opens an interactive interface where you can explore the server's capabilities, execute search queries, and view cached search results.

## Troubleshooting 🔧

### Common Issues

1. **Server Not Found**
   * Verify the npm link is correctly set up
   * Check Claude Desktop configuration syntax
   * Ensure Node.js is properly installed

2. **API Key Issues**
   * Confirm your Exa API key is valid
   * Check the API key is correctly set in the Claude Desktop config
   * Verify no spaces or quotes around the API key

3. **Connection Issues**
   * Restart Claude Desktop completely
   * Check Claude Desktop logs:
   
   ```bash
   # macOS
   tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
   
   # Windows
   type "%APPDATA%\Claude\logs\mcp*.log"
   ```

### Getting Help

If you encounter issues, review the [MCP Documentation](https://modelcontextprotocol.io) or visit the [GitHub discussions](https://github.com/orgs/modelcontextprotocol/discussions) for community support.

## Acknowledgments 🙏

* [Exa AI](https://exa.ai) for their powerful search API
* [Model Context Protocol](https://modelcontextprotocol.io) for the MCP specification
* [Anthropic](https://anthropic.com) for Claude Desktop
