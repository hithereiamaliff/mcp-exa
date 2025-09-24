import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { ExaCodeRequest, ExaCodeResponse } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerExaCodeTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "get_code_context_exa",
    "Search and get relevant code snippets, examples, and documentation from open source libraries, GitHub repositories, and programming frameworks. This tool is specifically designed for finding up-to-date code documentation, implementation examples, API usage patterns, and best practices from real codebases. Use this whenever you need to understand how to use a specific library, find code examples, see implementation patterns, or get current documentation for any programming language, framework, or open source package. Perfect for learning how functions work, seeing usage examples, understanding API implementations, and finding practical code solutions from the open source community. RULE: when the user's query contains exa-code or anything related to code, you MUST use this tool.",
    {
      query: z.string().describe("Search query to find relevant code snippets, library documentation, or implementation examples. Be specific about the programming language, library name, function, or concept you're looking for (e.g., 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware implementation')"),
      tokensNum: z.number().max(500000).default(3000).describe("Maximum number of tokens to return in the response. Higher values provide more comprehensive code examples and documentation")
    },
    async ({ query, tokensNum }) => {
      const requestId = `get_code_context_exa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'get_code_context_exa');
      
      logger.start(`Searching for code context: ${query}`);
      
      try {
        // Create a fresh axios instance for each request
        const axiosInstance = axios.create({
          baseURL: API_CONFIG.BASE_URL,
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': config?.exaApiKey || process.env.EXA_API_KEY || ''
          },
          timeout: 30000
        });

        const exaCodeRequest: ExaCodeRequest = {
          query,
          tokensNum
        };
        
        logger.log("Sending code context request to Exa API");
        
        const response = await axiosInstance.post<ExaCodeResponse>(
          API_CONFIG.ENDPOINTS.CONTEXT,
          exaCodeRequest,
          { timeout: 30000 }
        );
        
        logger.log("Received code context response from Exa API");

        if (!response.data) {
          logger.log("Warning: Empty response from Exa Code API");
          return {
            content: [{
              type: "text" as const,
              text: "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names."
            }]
          };
        }

        logger.log(`Code search completed with ${response.data.resultsCount || 0} results`);
        
        // Return the actual code content from the response field
        const codeContent = typeof response.data.response === 'string' 
          ? response.data.response 
          : JSON.stringify(response.data.response, null, 2);
        
        const result = {
          content: [{
            type: "text" as const,
            text: codeContent
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
              text: `Code search error (${statusCode}): ${errorMessage}. Please check your query and try again.`
            }],
            isError: true,
          };
        }
        
        // Handle generic errors
        return {
          content: [{
            type: "text" as const,
            text: `Code search error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
