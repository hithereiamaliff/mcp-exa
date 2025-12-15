#!/usr/bin/env node
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
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

// Analytics configuration (standardized paths)
const ANALYTICS_DATA_DIR = process.env.ANALYTICS_DIR || '/app/data';
const ANALYTICS_FILE = path.join(ANALYTICS_DATA_DIR, 'analytics.json');
const SAVE_INTERVAL_MS = 60000; // Save every 60 seconds
const MAX_RECENT_CALLS = 100;

// Tool registry for managing available tools
// For self-hosted VPS deployment, ALL tools are enabled by default
const availableTools = {
  'web_search_exa': { name: 'Web Search (Exa)', description: 'Real-time web search using Exa AI', enabled: true },
  'get_code_context_exa': { name: 'Code Context Search', description: 'Search for code snippets, examples, and documentation from open source repositories', enabled: true },
  'deep_search_exa': { name: 'Deep Search (Exa)', description: 'Advanced web search with query expansion and high-quality summaries', enabled: true },
  'crawling_exa': { name: 'Web Crawling', description: 'Extract content from specific URLs', enabled: true },
  'deep_researcher_start': { name: 'Deep Researcher Start', description: 'Start a comprehensive AI research task', enabled: true },
  'deep_researcher_check': { name: 'Deep Researcher Check', description: 'Check status and retrieve results of research task', enabled: true },
  'linkedin_search_exa': { name: 'LinkedIn Search', description: 'Search LinkedIn profiles and companies', enabled: true },
  'company_research_exa': { name: 'Company Research', description: 'Research companies and organizations', enabled: true },
};

// Standardized Analytics Interface
interface Analytics {
  serverStartTime: string;
  totalRequests: number;
  totalToolCalls: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  toolCalls: Record<string, number>;
  recentToolCalls: Array<{
    tool: string;
    timestamp: string;
    clientIp: string;
    userAgent: string;
  }>;
  clientsByIp: Record<string, number>;
  clientsByUserAgent: Record<string, number>;
  hourlyRequests: Record<string, number>;
}

// Initialize analytics with default values
let analytics: Analytics = {
  serverStartTime: new Date().toISOString(),
  totalRequests: 0,
  totalToolCalls: 0,
  requestsByMethod: {},
  requestsByEndpoint: {},
  toolCalls: {},
  recentToolCalls: [],
  clientsByIp: {},
  clientsByUserAgent: {},
  hourlyRequests: {},
};

// Ensure data directory exists
function ensureDataDir(): void {
  try {
    if (!fs.existsSync(ANALYTICS_DATA_DIR)) {
      fs.mkdirSync(ANALYTICS_DATA_DIR, { recursive: true });
      log(`📁 Created analytics data directory: ${ANALYTICS_DATA_DIR}`);
    }
  } catch (error) {
    log(`⚠️ Failed to create analytics directory: ${error}`);
  }
}

// Load analytics from disk on startup
function loadAnalytics(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
      const loaded = JSON.parse(data) as Analytics;
      
      analytics = {
        ...loaded,
        serverStartTime: loaded.serverStartTime || new Date().toISOString(),
      };
      
      log(`📊 Loaded analytics from ${ANALYTICS_FILE}`);
      log(`   Total requests: ${analytics.totalRequests}, Tool calls: ${analytics.totalToolCalls}`);
    } else {
      log(`📊 No existing analytics file, starting fresh`);
      saveAnalytics();
    }
  } catch (error) {
    log(`⚠️ Failed to load analytics: ${error}`);
  }
}

// Save analytics to disk
function saveAnalytics(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
  } catch (error) {
    log(`⚠️ Failed to save analytics: ${error}`);
  }
}

// Track HTTP request
function trackRequest(req: Request, endpoint: string): void {
  analytics.totalRequests++;
  
  // Track by method
  const method = req.method;
  analytics.requestsByMethod[method] = (analytics.requestsByMethod[method] || 0) + 1;
  
  // Track by endpoint
  analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + 1;
  
  // Track by client IP
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  analytics.clientsByIp[clientIp] = (analytics.clientsByIp[clientIp] || 0) + 1;
  
  // Track by user agent (truncated)
  const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 50);
  analytics.clientsByUserAgent[userAgent] = (analytics.clientsByUserAgent[userAgent] || 0) + 1;
  
  // Track hourly
  const hour = new Date().toISOString().substring(0, 13);
  analytics.hourlyRequests[hour] = (analytics.hourlyRequests[hour] || 0) + 1;
}

// Track tool call
function trackToolCall(toolName: string, req: Request): void {
  analytics.totalToolCalls++;
  analytics.toolCalls[toolName] = (analytics.toolCalls[toolName] || 0) + 1;
  
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 50);
  
  const toolCall = {
    tool: toolName,
    timestamp: new Date().toISOString(),
    clientIp,
    userAgent,
  };
  
  analytics.recentToolCalls.unshift(toolCall);
  if (analytics.recentToolCalls.length > MAX_RECENT_CALLS) {
    analytics.recentToolCalls.pop();
  }
}

// Calculate uptime string
function getUptime(): string {
  const start = new Date(analytics.serverStartTime).getTime();
  const now = Date.now();
  const diff = now - start;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Load analytics on startup
loadAnalytics();

// Periodic save
const saveInterval = setInterval(() => {
  saveAnalytics();
}, SAVE_INTERVAL_MS);

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  log(`Received ${signal}, shutting down gracefully...`);
  clearInterval(saveInterval);
  saveAnalytics();
  log('Analytics saved. Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

// Root endpoint - server info
app.get('/', (req: Request, res: Response) => {
  trackRequest(req, '/');
  res.json({
    name: 'Exa MCP Server',
    version: '3.1.3',
    description: 'Self-hosted Exa AI search MCP server with Streamable HTTP transport',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      analytics: '/analytics',
      analyticsTools: '/analytics/tools',
      analyticsDashboard: '/analytics/dashboard',
    },
    documentation: 'https://github.com/hithereiamaliff/mcp-exa',
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  trackRequest(req, '/health');
  res.json({
    status: 'healthy',
    server: 'Exa MCP Server',
    version: '3.1.3',
    transport: 'streamable-http',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
  });
});

// Analytics summary endpoint
app.get('/analytics', (req: Request, res: Response) => {
  trackRequest(req, '/analytics');
  
  // Sort tools by usage
  const sortedTools = Object.entries(analytics.toolCalls)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  // Get last 24 hours of hourly data
  const last24Hours = Object.entries(analytics.hourlyRequests)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 24)
    .reverse()
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  res.json({
    server: 'Exa MCP Server',
    uptime: getUptime(),
    serverStartTime: analytics.serverStartTime,
    summary: {
      totalRequests: analytics.totalRequests,
      totalToolCalls: analytics.totalToolCalls,
      uniqueClients: Object.keys(analytics.clientsByIp).length,
    },
    breakdown: {
      byMethod: analytics.requestsByMethod,
      byEndpoint: analytics.requestsByEndpoint,
      byTool: sortedTools,
    },
    clients: {
      byIp: analytics.clientsByIp,
      byUserAgent: analytics.clientsByUserAgent,
    },
    hourlyRequests: last24Hours,
    recentToolCalls: analytics.recentToolCalls.slice(0, 20),
  });
});

// Analytics tools endpoint
app.get('/analytics/tools', (req: Request, res: Response) => {
  trackRequest(req, '/analytics/tools');
  
  const sortedTools = Object.entries(analytics.toolCalls)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));
  
  res.json({
    totalToolCalls: analytics.totalToolCalls,
    tools: sortedTools,
    recentCalls: analytics.recentToolCalls.slice(0, 50),
  });
});

// Analytics import endpoint (for backup restoration)
app.post('/analytics/import', (req: Request, res: Response) => {
  const importKey = req.query.key;
  
  // Security: require import key if set
  const expectedKey = process.env.ANALYTICS_IMPORT_KEY;
  if (expectedKey && importKey !== expectedKey) {
    res.status(403).json({ error: 'Invalid import key' });
    return;
  }
  
  try {
    const importData = req.body;
    
    // Merge imported data with current analytics
    if (importData.summary) {
      analytics.totalRequests += importData.summary.totalRequests || 0;
      analytics.totalToolCalls += importData.summary.totalToolCalls || 0;
    }
    
    // Merge breakdown data
    if (importData.breakdown?.byMethod) {
      for (const [method, count] of Object.entries(importData.breakdown.byMethod)) {
        analytics.requestsByMethod[method] = (analytics.requestsByMethod[method] || 0) + (count as number);
      }
    }
    
    if (importData.breakdown?.byEndpoint) {
      for (const [endpoint, count] of Object.entries(importData.breakdown.byEndpoint)) {
        analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + (count as number);
      }
    }
    
    if (importData.breakdown?.byTool) {
      for (const [tool, count] of Object.entries(importData.breakdown.byTool)) {
        analytics.toolCalls[tool] = (analytics.toolCalls[tool] || 0) + (count as number);
      }
    }
    
    // Save immediately
    saveAnalytics();
    
    res.json({
      message: 'Analytics imported successfully',
      currentStats: {
        totalRequests: analytics.totalRequests,
        totalToolCalls: analytics.totalToolCalls,
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to import analytics',
      details: String(error)
    });
  }
});

// Analytics dashboard with Chart.js
app.get('/analytics/dashboard', (req: Request, res: Response) => {
  trackRequest(req, '/analytics/dashboard');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔍 Exa MCP - Analytics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: #e4e4e7; padding: 24px; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 32px; }
    header h1 { font-size: 2rem; background: linear-gradient(90deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    header p { color: #a1a1aa; font-size: 0.95rem; }
    .uptime-badge { display: inline-block; background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 6px 16px; border-radius: 50px; font-size: 0.85rem; margin-top: 12px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); }
    .stat-card .stat-label { color: #a1a1aa; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-card .stat-value { font-size: 2rem; font-weight: 700; color: #3b82f6; }
    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .chart-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); }
    .chart-card h3 { color: #e4e4e7; font-size: 1rem; margin-bottom: 16px; }
    .chart-container { position: relative; height: 250px; }
    .recent-calls { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); }
    .recent-calls h3 { color: #e4e4e7; font-size: 1rem; margin-bottom: 16px; }
    .call-list { max-height: 300px; overflow-y: auto; }
    .call-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; }
    .call-item:last-child { border-bottom: none; }
    .call-tool { color: #8b5cf6; font-weight: 500; }
    .call-time { color: #71717a; }
    .call-ip { color: #a1a1aa; font-size: 0.75rem; }
    .refresh-btn { position: fixed; bottom: 24px; right: 24px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border: none; padding: 12px 24px; border-radius: 50px; cursor: pointer; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: transform 0.2s; }
    .refresh-btn:hover { transform: scale(1.05); }
    .no-data { color: #71717a; text-align: center; padding: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Exa MCP Analytics</h1>
      <p>Real-time usage statistics for self-hosted Exa MCP Server</p>
      <span class="uptime-badge" id="uptime">Loading...</span>
    </header>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Requests</div><div class="stat-value" id="totalRequests">-</div></div>
      <div class="stat-card"><div class="stat-label">Tool Calls</div><div class="stat-value" id="totalToolCalls">-</div></div>
      <div class="stat-card"><div class="stat-label">Unique Clients</div><div class="stat-value" id="uniqueClients">-</div></div>
      <div class="stat-card"><div class="stat-label">Most Used Tool</div><div class="stat-value" id="topTool" style="font-size:1rem;">-</div></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>📊 Tool Usage Distribution</h3><div class="chart-container"><canvas id="toolsChart"></canvas></div></div>
      <div class="chart-card"><h3>📈 Hourly Requests (Last 24h)</h3><div class="chart-container"><canvas id="hourlyChart"></canvas></div></div>
      <div class="chart-card"><h3>🔗 Requests by Endpoint</h3><div class="chart-container"><canvas id="endpointChart"></canvas></div></div>
      <div class="chart-card"><h3>👥 Top Clients by User Agent</h3><div class="chart-container"><canvas id="clientsChart"></canvas></div></div>
    </div>
    <div class="recent-calls"><h3>🕐 Recent Tool Calls</h3><div class="call-list" id="recentCalls"><div class="no-data">Loading...</div></div></div>
  </div>
  <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
  <script>
    const chartColors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f43f5e','#84cc16','#6366f1','#14b8a6'];
    let toolsChart, hourlyChart, endpointChart, clientsChart;
    
    async function loadData() {
      try {
        const basePath = window.location.pathname.replace(/\\/analytics\\/dashboard\\/?$/, '');
        const res = await fetch(basePath + '/analytics');
        const data = await res.json();
        updateStats(data);
        updateToolsChart(data);
        updateHourlyChart(data);
        updateEndpointChart(data);
        updateClientsChart(data);
        updateRecentCalls(data);
      } catch (e) { console.error('Failed to load analytics:', e); }
    }
    
    function updateStats(data) {
      document.getElementById('uptime').textContent = '⏱️ Uptime: ' + data.uptime;
      document.getElementById('totalRequests').textContent = data.summary.totalRequests.toLocaleString();
      document.getElementById('totalToolCalls').textContent = data.summary.totalToolCalls.toLocaleString();
      document.getElementById('uniqueClients').textContent = data.summary.uniqueClients.toLocaleString();
      const tools = Object.entries(data.breakdown.byTool);
      document.getElementById('topTool').textContent = tools.length > 0 ? tools[0][0] : 'None';
    }
    
    function updateToolsChart(data) {
      const ctx = document.getElementById('toolsChart').getContext('2d');
      const tools = Object.entries(data.breakdown.byTool);
      if (toolsChart) toolsChart.destroy();
      if (tools.length === 0) { ctx.font = '14px sans-serif'; ctx.fillStyle = '#71717a'; ctx.textAlign = 'center'; ctx.fillText('No tool calls yet', ctx.canvas.width/2, ctx.canvas.height/2); return; }
      toolsChart = new Chart(ctx, { type: 'doughnut', data: { labels: tools.map(t => t[0]), datasets: [{ data: tools.map(t => t[1]), backgroundColor: chartColors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 11 } } } } } });
    }
    
    function updateHourlyChart(data) {
      const ctx = document.getElementById('hourlyChart').getContext('2d');
      const hourly = Object.entries(data.hourlyRequests);
      if (hourlyChart) hourlyChart.destroy();
      if (hourly.length === 0) { ctx.font = '14px sans-serif'; ctx.fillStyle = '#71717a'; ctx.textAlign = 'center'; ctx.fillText('No data yet', ctx.canvas.width/2, ctx.canvas.height/2); return; }
      const labels = hourly.map(h => h[0].substring(11) + ':00');
      hourlyChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Requests', data: hourly.map(h => h[1]), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } } });
    }
    
    function updateEndpointChart(data) {
      const ctx = document.getElementById('endpointChart').getContext('2d');
      const endpoints = Object.entries(data.breakdown.byEndpoint).sort((a,b) => b[1] - a[1]).slice(0, 8);
      if (endpointChart) endpointChart.destroy();
      if (endpoints.length === 0) { ctx.font = '14px sans-serif'; ctx.fillStyle = '#71717a'; ctx.textAlign = 'center'; ctx.fillText('No data yet', ctx.canvas.width/2, ctx.canvas.height/2); return; }
      endpointChart = new Chart(ctx, { type: 'bar', data: { labels: endpoints.map(e => e[0]), datasets: [{ data: endpoints.map(e => e[1]), backgroundColor: chartColors, borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#71717a' }, grid: { display: false } }, y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } } });
    }
    
    function updateClientsChart(data) {
      const ctx = document.getElementById('clientsChart').getContext('2d');
      const clients = Object.entries(data.clients.byUserAgent).sort((a,b) => b[1] - a[1]).slice(0, 6);
      if (clientsChart) clientsChart.destroy();
      if (clients.length === 0) { ctx.font = '14px sans-serif'; ctx.fillStyle = '#71717a'; ctx.textAlign = 'center'; ctx.fillText('No data yet', ctx.canvas.width/2, ctx.canvas.height/2); return; }
      clientsChart = new Chart(ctx, { type: 'bar', data: { labels: clients.map(c => c[0].substring(0, 25) + (c[0].length > 25 ? '...' : '')), datasets: [{ data: clients.map(c => c[1]), backgroundColor: chartColors, borderRadius: 8 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }, y: { ticks: { color: '#71717a' }, grid: { display: false } } } } });
    }
    
    function updateRecentCalls(data) {
      const container = document.getElementById('recentCalls');
      if (!data.recentToolCalls || data.recentToolCalls.length === 0) { container.innerHTML = '<div class="no-data">No tool calls yet</div>'; return; }
      container.innerHTML = data.recentToolCalls.map(call => '<div class="call-item"><div><span class="call-tool">' + call.tool + '</span><div class="call-ip">' + call.clientIp + '</div></div><span class="call-time">' + new Date(call.timestamp).toLocaleString() + '</span></div>').join('');
    }
    
    loadData();
    setInterval(loadData, 30000);
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// MCP endpoint - handles all MCP protocol messages
app.all('/mcp', async (req: Request, res: Response) => {
  trackRequest(req, '/mcp');
  
  // Track tool calls from MCP requests
  if (req.method === 'POST' && req.body?.method === 'tools/call' && req.body?.params?.name) {
    trackToolCall(req.body.params.name, req);
  }

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
