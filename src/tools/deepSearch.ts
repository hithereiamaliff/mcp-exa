import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerDeepSearchTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "deep_search_exa",
    "Searches the web and return results in a natural language format. Deep search uses smart query expansion and provides high-quality summaries for each result. You can provide query variations for even better results.",
    {
      objective: z.string().describe("Query: Description of what the web search is looking for. Try to make the search query atomic - looking for a specific piece of information. May include guidance about preferred sources or freshness."),
      search_queries: z.array(z.string()).optional().describe("Query Variants: Optional list of keyword search queries, may include search operators. The search queries should be related to the user's objective. Limited to 5 entries of up to 5 words each (around 200 characters)."),
      numResults: z.number().optional().describe("Number of search results to return (default: 10)"),
      livecrawl: z.enum(['fallback', 'preferred']).optional().describe("Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    },
    async ({ objective, search_queries, numResults, livecrawl }) => {
      const requestId = `deep_search_exa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'deep_search_exa');
      
      logger.start(objective);
      
      try {
        // Create a fresh axios instance for each request
        const axiosInstance = axios.create({
          baseURL: API_CONFIG.BASE_URL,
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': config?.exaApiKey || process.env.EXA_API_KEY || ''
          },
          timeout: 25000
        });

        const searchRequest: ExaSearchRequest = {
          query: objective,
          type: "deep",
          numResults: numResults || 10,
          contents: {
            text: false,
            summary: true,
            livecrawl: livecrawl || 'fallback'
          }
        };
        
        // Add query variants if provided
        if (search_queries && search_queries.length > 0) {
          searchRequest.queryVariants = search_queries;
          logger.log(`Using ${search_queries.length} query variants`);
        } else {
          logger.log("Using automatic query expansion");
        }
        
        logger.log("Sending deep search request to Exa API");
        
        const response = await axiosInstance.post<ExaSearchResponse>(
          API_CONFIG.ENDPOINTS.SEARCH,
          searchRequest,
          { timeout: 25000 }
        );
        
        logger.log("Received response from Exa API");

        if (!response.data || !response.data.results || response.data.results.length === 0) {
          logger.log("Warning: Empty or invalid response from Exa API");
          return {
            content: [{
              type: "text" as const,
              text: "No search results found. Please try a different query or adjust your search parameters."
            }]
          };
        }

        logger.log(`Received ${response.data.results.length} results with summaries`);
        
        const result = {
          content: [{
            type: "text" as const,
            text: JSON.stringify(response.data, null, 2)
          }]
        };
        
        logger.complete();
        return result;
      } catch (error) {
        logger.error(error);
        
        if (axios.isAxiosError(error)) {
          // Handle Axios errors specifically
          const statusCode = error.response?.status || 'unknown';
          const errorMessage = error.response?.data?.message || error.message;
          
          logger.log(`Axios error (${statusCode}): ${errorMessage}`);
          return {
            content: [{
              type: "text" as const,
              text: `Deep search error (${statusCode}): ${errorMessage}`
            }],
            isError: true,
          };
        }
        
        // Handle generic errors
        return {
          content: [{
            type: "text" as const,
            text: `Deep search error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}

