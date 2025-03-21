#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import dotenv from "dotenv";
import {
  ExaSearchRequest,
  ExaSearchResponse,
  SearchArgs
} from "./types.js";

dotenv.config();

const API_KEY = process.env.EXA_API_KEY;
if (!API_KEY) {
  throw new Error("EXA_API_KEY environment variable is required");
}

/**
 * Exa AI Search MCP Server
 * 
 * This MCP server integrates Exa AI's search capabilities with Claude and other MCP-compatible clients.
 * Exa is a search engine and API specifically designed for up-to-date web searching and retrieval,
 * offering more recent and comprehensive results than what might be available in an LLM's training data.
 * 
 * The server provides a 'search' tool that enables:
 * - Real-time web searching with configurable parameters
 * - Scraping a URL and returning the content
 */

const API_CONFIG = {
  BASE_URL: 'https://api.exa.ai',
  ENDPOINTS: {
    SEARCH: '/search'
  },
  DEFAULT_NUM_RESULTS: 5,
  DEFAULT_MAX_CHARACTERS: 3000
} as const;

// For debugging
const log = (message: string) => {
  console.error(`[EXA-MCP-DEBUG] ${message}`);
};

class ExaServer {
  private server: McpServer;
  private activeRequests = new Set<string>();

  constructor() {
    this.server = new McpServer({
      name: "exa-search-server",
      version: "0.2.1"
    });
    
    log("Server initialized");
  }

  private setupTools(): void {
    // Define the search tool
    this.server.tool(
      "search",
      "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts, live crawling options, and returns the content from the most relevant websites.",
      {
        query: z.string().describe("Search query"),
        numResults: z.number().optional().describe("Number of search results to return (default: 5)"),
        livecrawl: z.enum(['always', 'fallback']).optional().describe("Livecrawl strategy: 'always' to always crawl live, 'fallback' to only crawl when index has no result")
      },
      async ({ query, numResults, livecrawl }) => {
        const requestId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        this.activeRequests.add(requestId);
        
        log(`[${requestId}] Starting search for query: "${query}"`);
        
        try {
          // Create a fresh axios instance for each request
          const axiosInstance = axios.create({
            baseURL: API_CONFIG.BASE_URL,
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'x-api-key': API_KEY
            },
            timeout: 25000
          });

          const searchRequest: ExaSearchRequest = {
            query,
            type: "auto",
            numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
            contents: {
              text: {
                maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
              },
              ...(livecrawl ? { livecrawl } : { livecrawl: 'always' })
            }
          };
          
          log(`[${requestId}] Sending request to Exa API`);
          
          const response = await axiosInstance.post<ExaSearchResponse>(
            API_CONFIG.ENDPOINTS.SEARCH,
            searchRequest,
            { timeout: 25000 }
          );
          
          log(`[${requestId}] Received response from Exa API`);

          if (!response.data || !response.data.results) {
            log(`[${requestId}] Warning: Empty or invalid response from Exa API`);
            return {
              content: [{
                type: "text" as const,
                text: "No search results found. Please try a different query."
              }]
            };
          }

          log(`[${requestId}] Found ${response.data.results.length} results`);
          
          const result = {
            content: [{
              type: "text" as const,
              text: JSON.stringify(response.data, null, 2)
            }]
          };
          
          log(`[${requestId}] Successfully completed search`);
          return result;
        } catch (error) {
          log(`[${requestId}] Error processing search: ${error instanceof Error ? error.message : String(error)}`);
          
          if (axios.isAxiosError(error)) {
            // Handle Axios errors specifically
            const statusCode = error.response?.status || 'unknown';
            const errorMessage = error.response?.data?.message || error.message;
            
            log(`[${requestId}] Axios error (${statusCode}): ${errorMessage}`);
            return {
              content: [{
                type: "text" as const,
                text: `Search error (${statusCode}): ${errorMessage}`
              }],
              isError: true,
            };
          }
          
          // Handle generic errors
          return {
            content: [{
              type: "text" as const,
              text: `Search error: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true,
          };
        } finally {
          // Always clean up
          this.activeRequests.delete(requestId);
          log(`[${requestId}] Request finalized, ${this.activeRequests.size} active requests remaining`);
        }
      }
    );
    
    log("Search tool registered");
  }

  async run(): Promise<void> {
    try {
      // Set up tools before connecting
      this.setupTools();
      
      log("Starting Exa MCP server...");
      const transport = new StdioServerTransport();
      
      // Handle connection errors
      transport.onerror = (error) => {
        log(`Transport error: ${error.message}`);
      };
      
      await this.server.connect(transport);
      log("Exa Search MCP server running on stdio");
    } catch (error) {
      log(`Server initialization error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Create and run the server with proper error handling
(async () => {
  try {
    const server = new ExaServer();
    await server.run();
  } catch (error) {
    log(`Fatal server error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})();