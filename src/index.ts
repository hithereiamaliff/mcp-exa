#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { z } from "zod";

// Import tool implementations
import { registerWebSearchTool } from "./tools/webSearch.js";
import { registerResearchPaperSearchTool } from "./tools/researchPaperSearch.js";
import { registerCompanyResearchTool } from "./tools/companyResearch.js";
import { registerCrawlingTool } from "./tools/crawling.js";
import { registerCompetitorFinderTool } from "./tools/competitorFinder.js";
import { registerLinkedInSearchTool } from "./tools/linkedInSearch.js";
import { registerWikipediaSearchTool } from "./tools/wikipediaSearch.js";
import { registerGithubSearchTool } from "./tools/githubSearch.js";
import { log } from "./utils/logger.js";

dotenv.config();

// Parse command line arguments to determine which tools to enable
const argv = yargs(hideBin(process.argv))
  .option('tools', {
    type: 'string',
    description: 'Comma-separated list of tools to enable (if not specified, all enabled-by-default tools are used)',
    default: ''
  })
  .option('list-tools', {
    type: 'boolean',
    description: 'List all available tools and exit',
    default: false
  })
  .help()
  .argv;

// Convert comma-separated string to Set for easier lookups
const argvObj = argv as any;
const toolsString = argvObj['tools'] || '';
const specifiedTools = new Set<string>(
  toolsString ? toolsString.split(',').map((tool: string) => tool.trim()) : []
);

// Tool registry for listing capabilities
const availableTools = {
  'web_search_exa': { name: 'Web Search (Exa)', description: 'Real-time web search using Exa AI', enabled: true },
  'research_paper_search_exa': { name: 'Research Paper Search', description: 'Search academic papers and research', enabled: true },
  'company_research_exa': { name: 'Company Research', description: 'Research companies and organizations', enabled: true },
  'crawling_exa': { name: 'Web Crawling', description: 'Extract content from specific URLs', enabled: true },
  'competitor_finder_exa': { name: 'Competitor Finder', description: 'Find business competitors', enabled: true },
  'linkedin_search_exa': { name: 'LinkedIn Search', description: 'Search LinkedIn profiles and companies', enabled: true },
  'wikipedia_search_exa': { name: 'Wikipedia Search', description: 'Search Wikipedia articles', enabled: true },
  'github_search_exa': { name: 'GitHub Search', description: 'Search GitHub repositories and code', enabled: true }
};

// List all available tools if requested
if (argvObj['list-tools']) {
  console.log("Available tools:");
  
  Object.entries(availableTools).forEach(([id, tool]) => {
    console.log(`- ${id}: ${tool.name}`);
    console.log(`  Description: ${tool.description}`);
    console.log(`  Enabled by default: ${tool.enabled ? 'Yes' : 'No'}`);
    console.log();
  });
  
  process.exit(0);
}

// Check for API key after handling list-tools to allow listing without a key
const API_KEY = process.env.EXA_API_KEY;
if (!API_KEY) {
  throw new Error("EXA_API_KEY environment variable is required");
}

/**
 * Exa AI Web Search MCP Server
 * 
 * This MCP server integrates Exa AI's search capabilities with Claude and other MCP-compatible clients.
 * Exa is a search engine and API specifically designed for up-to-date web searching and retrieval,
 * offering more recent and comprehensive results than what might be available in an LLM's training data.
 * 
 * The server provides tools that enable:
 * - Real-time web searching with configurable parameters
 * - Research paper searches
 * - Company research and analysis
 * - Competitive intelligence
 * - And more!
 */

async function main(): Promise<void> {
  try {
    // Create MCP server
    const server = new McpServer({
      name: "exa-search-server",
      version: "1.0.0"
    });
    
    log("Server initialized with modern MCP SDK");

    // Helper function to check if a tool should be registered
    const shouldRegisterTool = (toolId: string): boolean => {
      if (specifiedTools.size > 0) {
        return specifiedTools.has(toolId);
      }
      return availableTools[toolId as keyof typeof availableTools]?.enabled ?? false;
    };

    // Register tools based on specifications
    const registeredTools: string[] = [];
    
    if (shouldRegisterTool('web_search_exa')) {
      registerWebSearchTool(server);
      registeredTools.push('web_search_exa');
    }
    
    if (shouldRegisterTool('research_paper_search_exa')) {
      registerResearchPaperSearchTool(server);
      registeredTools.push('research_paper_search_exa');
    }
    
    if (shouldRegisterTool('company_research_exa')) {
      registerCompanyResearchTool(server);
      registeredTools.push('company_research_exa');
    }
    
    if (shouldRegisterTool('crawling_exa')) {
      registerCrawlingTool(server);
      registeredTools.push('crawling_exa');
    }
    
    if (shouldRegisterTool('competitor_finder_exa')) {
      registerCompetitorFinderTool(server);
      registeredTools.push('competitor_finder_exa');
    }
    
    if (shouldRegisterTool('linkedin_search_exa')) {
      registerLinkedInSearchTool(server);
      registeredTools.push('linkedin_search_exa');
    }
    
    if (shouldRegisterTool('wikipedia_search_exa')) {
      registerWikipediaSearchTool(server);
      registeredTools.push('wikipedia_search_exa');
    }
    
    if (shouldRegisterTool('github_search_exa')) {
      registerGithubSearchTool(server);
      registeredTools.push('github_search_exa');
    }
    
    log(`Starting Exa MCP server with ${registeredTools.length} tools: ${registeredTools.join(', ')}`);
    
    // Create transport and connect
    const transport = new StdioServerTransport();
    
    // Handle connection errors
    transport.onerror = (error) => {
      log(`Transport error: ${error.message}`);
    };
    
    await server.connect(transport);
    log("Exa Search MCP server running on stdio");
    
  } catch (error) {
    log(`Server initialization error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Create and run the server with proper error handling
main().catch((error) => {
  log(`Fatal server error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});