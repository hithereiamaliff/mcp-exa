# MCP Registry Publishing Setup - Exa MCP Server

This document outlines the setup for publishing the Exa MCP Server to the official MCP Registry with **hybrid deployment** support (both NPM package and remote server options).

## Files Created/Modified

### 1. `server.json` ✅
- **Purpose**: MCP Registry configuration file
- **Namespace**: `io.github.exa-labs/exa-mcp-server`
- **Deployment Type**: **Hybrid** (Package + Remote)
- **Schema**: Uses official 2025-07-09 schema

**Package Deployment**:
- Registry: NPM (`exa-mcp-server`)
- Version: 2.0.9

**Remote Deployment**:
- Type: Server-Sent Events (SSE)
- URL: `https://mcp.exa.ai/mcp`
- Authentication: API key passed as query parameter (`?exaApiKey=your-key`)

### 2. `package.json` ✅
- **Added**: `mcpName` field for NPM validation
- **Value**: `"io.github.exa-labs/exa-mcp-server"`
- **Purpose**: Proves ownership of NPM package for registry validation

## Deployment Options for Users

Your MCP server will offer users **two ways** to connect:

### Option 1: NPM Package (Local Installation)
```bash
# Install globally
npm install -g exa-mcp-server

# Run with tools
npx exa-mcp-server --tools=web_search_exa,deep_researcher_start
```

**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Option 2: Remote Server (Hosted)
**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.exa.ai/mcp?exaApiKey=your-exa-api-key"
      ]
    }
  }
}
```

## Manual Publishing Process

### Prerequisites
1. **Install MCP Publisher CLI**:
   ```bash
   # macOS/Linux
   brew install mcp-publisher
   
   # Or download binary
   curl -L "https://github.com/modelcontextprotocol/registry/releases/download/v1.0.0/mcp-publisher_1.0.0_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
   ```

2. **Ensure NPM Package is Published**:
   - Your NPM package must be published with the `mcpName` field
   - Current package: `exa-mcp-server@2.0.9`

3. **Ensure Remote Server is Live**:
   - Your SSE endpoint must be accessible at: `https://mcp.exa.ai/mcp`
   - Must accept `exaApiKey` parameter for authentication

### Publishing Steps

1. **Authenticate with GitHub**:
   ```bash
   mcp-publisher login github
   ```
   This opens your browser for OAuth authentication.

2. **Validate Configuration**:
   ```bash
   # Optional: validate your server.json
   python3 -c "
   import json
   with open('server.json', 'r') as f:
       data = json.load(f)
   print('✓ server.json is valid')
   print(f'✓ Name: {data[\"name\"]}')
   print(f'✓ Packages: {len(data[\"packages\"])} configured')
   print(f'✓ Remotes: {len(data[\"remotes\"])} configured')
   "
   ```

3. **Publish to Registry**:
   ```bash
   mcp-publisher publish
   ```

4. **Verify Publication**:
   ```bash
   curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.exa-labs/exa-mcp-server"
   ```

## Registry Validation Process

### NPM Package Validation
- Registry fetches: `https://registry.npmjs.org/exa-mcp-server`
- Validates: `mcpName` field matches `io.github.exa-labs/exa-mcp-server`
- Status: ✅ Configured correctly

### Remote Server Validation
- Registry checks: `https://mcp.exa.ai/mcp` is accessible
- Validates: SSE endpoint responds correctly
- Authentication: API key passed via URL query parameter (`?exaApiKey=your-key`)

### GitHub Authentication
- Namespace: `io.github.exa-labs/*`
- Authentication: GitHub OAuth (no DNS setup required)
- Organization: Must have access to `exa-labs` GitHub organization

## Available Tools

When published, users will have access to these tools:

| Tool                    | Description                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deep_researcher_start` | Start a smart AI researcher for complex questions. The AI will search the web, read many sources, and think deeply about your question to create a detailed research report |
| `deep_researcher_check` | Check if your research is ready and get the results. Use this after starting a research task to see if it's done and get your comprehensive report                          |
| `web_search_exa`        | Performs real-time web searches with optimized results and content extraction                                                                                               |
| `company_research`      | Comprehensive company research tool that crawls company websites to gather detailed information about businesses                                                            |
| `crawling`              | Extracts content from specific URLs, useful for reading articles, PDFs, or any web page when you have the exact URL                                                         |
| `linkedin_search`       | Search LinkedIn for companies and people using Exa AI. Simply include company names, person names, or specific LinkedIn URLs in your query                                  |
| `get_code_context_exa`  | Search and get relevant code snippets, examples, and documentation from open source libraries, GitHub repositories, and programming frameworks                             |

## Benefits of Hybrid Deployment

1. **User Choice**: Users can choose between local (NPM) or remote (hosted) deployment
2. **Flexibility**: Local for privacy/control, remote for convenience
3. **Scalability**: Remote server handles the load
4. **Reliability**: Multiple deployment options ensure availability

## Troubleshooting

### Common Issues

1. **"Package validation failed"**
   - Ensure `exa-mcp-server` NPM package has `mcpName` field
   - Check package is published and accessible

2. **"Remote validation failed"**
   - Verify `https://mcp.exa.ai/mcp` is accessible
   - Check SSE endpoint responds correctly
   - Ensure URL accepts `?exaApiKey=your-key` query parameter

3. **"Authentication failed"**
   - Verify GitHub access to `exa-labs` organization
   - Re-run `mcp-publisher login github`

4. **"Namespace not authorized"**
   - Ensure you have access to `exa-labs` GitHub organization
   - Check authentication method matches namespace

## Next Steps

1. **Verify Prerequisites**:
   - ✅ NPM package published with `mcpName` field
   - ✅ Remote server live at `https://mcp.exa.ai/mcp`
   - ✅ GitHub access to `exa-labs` organization

2. **Publish to Registry**:
   ```bash
   mcp-publisher login github
   mcp-publisher publish
   ```

3. **Verify Publication**:
   - Check registry API response
   - Test both deployment methods
   - Update documentation as needed

## Documentation References

- [MCP Publishing Guide](https://raw.githubusercontent.com/modelcontextprotocol/registry/refs/heads/main/docs/guides/publishing/publish-server.md)
- [Server.json Schema](https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json)
- [Remote Server Configuration](https://raw.githubusercontent.com/modelcontextprotocol/registry/refs/heads/main/docs/reference/server-json/generic-server-json.md#remote-server-example)
- [Hybrid Deployment Examples](https://raw.githubusercontent.com/modelcontextprotocol/registry/refs/heads/main/docs/reference/server-json/generic-server-json.md#server-with-remote-and-package-options)