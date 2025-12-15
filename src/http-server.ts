#!/usr/bin/env node
import express, { Request, Response } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// Import tool implementations
import { registerWebSearchTool } from './tools/webSearch.js';
import { registerDeepSearchTool } from './tools/deepSearch.js';
import { registerCompanyResearchTool } from './tools/companyResearch.js';
import { registerCrawlingTool } from './tools/crawling.js';
import { registerLinkedInSearchTool } from './tools/linkedInSearch.js';
import { registerDeepResearchStartTool } from './tools/deepResearchStart.js';
import { registerDeepResearchCheckTool } from './tools/deepResearchCheck.js';
import { registerExaCodeTool } from './tools/exaCode.js';
import { log } from './utils/logger.js';

// Server configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Tool registry for managing available tools
const availableTools = {
  'web_search_exa': { name: 'Web Search (Exa)', description: 'Real-time web search using Exa AI', enabled: true },
  'get_code_context_exa': { name: 'Code Context Search', description: 'Search for code snippets, examples, and documentation from open source repositories', enabled: true },
  'deep_search_exa': { name: 'Deep Search (Exa)', description: 'Advanced web search with query expansion and high-quality summaries', enabled: false },
  'crawling_exa': { name: 'Web Crawling', description: 'Extract content from specific URLs', enabled: false },
  'deep_researcher_start': { name: 'Deep Researcher Start', description: 'Start a comprehensive AI research task', enabled: false },
  'deep_researcher_check': { name: 'Deep Researcher Check', description: 'Check status and retrieve results of research task', enabled: false },
  'linkedin_search_exa': { name: 'LinkedIn Search', description: 'Search LinkedIn profiles and companies', enabled: false },
  'company_research_exa': { name: 'Company Research', description: 'Research companies and organizations', enabled: false },
};

// Analytics tracking
interface AnalyticsData {
  totalRequests: number;
  toolCalls: Record<string, number>;
  errors: number;
  lastRequest: string | null;
  startTime: string;
}

const analytics: AnalyticsData = {
  totalRequests: 0,
  toolCalls: {},
  errors: 0,
  lastRequest: null,
  startTime: new Date().toISOString()
};

// Get API key from various sources
function getApiKey(req: Request): string {
  // Check query parameter
  if (req.query.apiKey && typeof req.query.apiKey === 'string') {
    return req.query.apiKey;
  }
  // Check header
  const headerKey = req.headers['x-api-key'];
  if (headerKey && typeof headerKey === 'string') {
    return headerKey;
  }
  // Fall back to environment variable
  return process.env.EXA_API_KEY || '';
}

// Create and configure MCP server
function createMcpServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: 'exa-search-server',
    title: 'Exa',
    version: '3.1.3'
  });

  const config = {
    exaApiKey: apiKey,
    enabledTools: undefined as string[] | undefined,
    debug: process.env.DEBUG === 'true'
  };

  // Parse enabled tools from environment
  const enabledToolsEnv = process.env.ENABLED_TOOLS;
  if (enabledToolsEnv) {
    config.enabledTools = enabledToolsEnv.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  // Helper function to check if a tool should be registered
  const shouldRegisterTool = (toolId: string): boolean => {
    if (config.enabledTools && config.enabledTools.length > 0) {
      return config.enabledTools.includes(toolId);
    }
    return availableTools[toolId as keyof typeof availableTools]?.enabled ?? false;
  };

  // Register tools based on configuration
  const registeredTools: string[] = [];

  if (shouldRegisterTool('web_search_exa')) {
    registerWebSearchTool(server, config);
    registeredTools.push('web_search_exa');
  }

  if (shouldRegisterTool('deep_search_exa')) {
    registerDeepSearchTool(server, config);
    registeredTools.push('deep_search_exa');
  }

  if (shouldRegisterTool('company_research_exa')) {
    registerCompanyResearchTool(server, config);
    registeredTools.push('company_research_exa');
  }

  if (shouldRegisterTool('crawling_exa')) {
    registerCrawlingTool(server, config);
    registeredTools.push('crawling_exa');
  }

  if (shouldRegisterTool('linkedin_search_exa')) {
    registerLinkedInSearchTool(server, config);
    registeredTools.push('linkedin_search_exa');
  }

  if (shouldRegisterTool('deep_researcher_start')) {
    registerDeepResearchStartTool(server, config);
    registeredTools.push('deep_researcher_start');
  }

  if (shouldRegisterTool('deep_researcher_check')) {
    registerDeepResearchCheckTool(server, config);
    registeredTools.push('deep_researcher_check');
  }

  if (shouldRegisterTool('get_code_context_exa')) {
    registerExaCodeTool(server, config);
    registeredTools.push('get_code_context_exa');
  }

  // Register prompts
  server.prompt(
    'web_search_help',
    'Get help with web search using Exa',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'I want to search the web for current information. Can you help me search for recent news about artificial intelligence breakthroughs?'
            }
          }
        ]
      };
    }
  );

  server.prompt(
    'code_search_help',
    'Get help finding code examples and documentation',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'I need help with a programming task. Can you search for examples of how to use React hooks for state management?'
            }
          }
        ]
      };
    }
  );

  // Register resources
  server.resource(
    'tools_list',
    'exa://tools/list',
    {
      mimeType: 'application/json',
      description: 'List of available Exa tools and their descriptions'
    },
    async () => {
      const toolsList = Object.entries(availableTools).map(([id, tool]) => ({
        id,
        name: tool.name,
        description: tool.description,
        enabled: registeredTools.includes(id)
      }));

      return {
        contents: [{
          uri: 'exa://tools/list',
          text: JSON.stringify(toolsList, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  if (config.debug) {
    log(`Registered ${registeredTools.length} tools: ${registeredTools.join(', ')}`);
  }

  return server;
}

// Initialize Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'mcp-session-id'],
  exposedHeaders: ['mcp-session-id']
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'Exa MCP Server',
    version: '3.1.3',
    transport: 'streamable-http',
    timestamp: new Date().toISOString()
  });
});

// Analytics endpoint
app.get('/analytics', (_req: Request, res: Response) => {
  res.json({
    ...analytics,
    uptime: Math.floor((Date.now() - new Date(analytics.startTime).getTime()) / 1000)
  });
});

// Analytics dashboard
app.get('/analytics/dashboard', (_req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exa MCP Analytics Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: #fff; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 2rem; font-size: 2.5rem; background: linear-gradient(90deg, #00d4ff, #7b2cbf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); }
    .stat-card h3 { color: #888; font-size: 0.9rem; text-transform: uppercase; margin-bottom: 0.5rem; }
    .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #00d4ff; }
    .tools-section { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); }
    .tools-section h2 { margin-bottom: 1rem; color: #7b2cbf; }
    .tool-item { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .tool-item:last-child { border-bottom: none; }
    .loading { text-align: center; padding: 2rem; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Exa MCP Analytics</h1>
    <div class="stats-grid">
      <div class="stat-card"><h3>Total Requests</h3><div class="value" id="totalRequests">-</div></div>
      <div class="stat-card"><h3>Errors</h3><div class="value" id="errors">-</div></div>
      <div class="stat-card"><h3>Uptime</h3><div class="value" id="uptime">-</div></div>
      <div class="stat-card"><h3>Last Request</h3><div class="value" id="lastRequest" style="font-size: 1rem;">-</div></div>
    </div>
    <div class="tools-section">
      <h2>Tool Usage</h2>
      <div id="toolCalls"><div class="loading">Loading...</div></div>
    </div>
  </div>
  <script>
    async function fetchAnalytics() {
      try {
        const basePath = window.location.pathname.replace(/\\/analytics\\/dashboard\\/?$/, '');
        const response = await fetch(basePath + '/analytics');
        const data = await response.json();
        document.getElementById('totalRequests').textContent = data.totalRequests;
        document.getElementById('errors').textContent = data.errors;
        document.getElementById('uptime').textContent = formatUptime(data.uptime);
        document.getElementById('lastRequest').textContent = data.lastRequest ? new Date(data.lastRequest).toLocaleString() : 'None';
        const toolCallsHtml = Object.entries(data.toolCalls).length > 0
          ? Object.entries(data.toolCalls).map(([tool, count]) => '<div class="tool-item"><span>' + tool + '</span><span>' + count + '</span></div>').join('')
          : '<div class="tool-item">No tool calls yet</div>';
        document.getElementById('toolCalls').innerHTML = toolCallsHtml;
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    }
    function formatUptime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return hours + 'h ' + minutes + 'm ' + secs + 's';
    }
    fetchAnalytics();
    setInterval(fetchAnalytics, 5000);
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// MCP endpoint - handles all MCP protocol messages
app.all('/mcp', async (req: Request, res: Response) => {
  analytics.totalRequests++;
  analytics.lastRequest = new Date().toISOString();

  const apiKey = getApiKey(req);
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    // Handle GET request for SSE stream
    if (req.method === 'GET') {
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    // Handle DELETE request to close session
    if (req.method === 'DELETE') {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
      }
      res.status(204).end();
      return;
    }

    // Handle POST request
    if (req.method === 'POST') {
      // Check if this is an existing session
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Create new session for initialization request
      const server = createMcpServer(apiKey);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `exa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      });

      // Store transport for future requests
      transport.onclose = () => {
        const sid = (transport as unknown as { sessionId?: string }).sessionId;
        if (sid) {
          transports.delete(sid);
        }
      };

      await server.server.connect(transport);

      // Handle the request
      await transport.handleRequest(req, res, req.body);

      // Store transport if session was created
      const newSessionId = res.getHeader('mcp-session-id') as string | undefined;
      if (newSessionId) {
        transports.set(newSessionId, transport);
      }
      return;
    }

    // Method not allowed
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    analytics.errors++;
    log(`MCP endpoint error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  log(`Exa MCP Server running on http://${HOST}:${PORT}`);
  log(`Health check: http://${HOST}:${PORT}/health`);
  log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  log(`Analytics: http://${HOST}:${PORT}/analytics`);
  log(`Dashboard: http://${HOST}:${PORT}/analytics/dashboard`);
});
