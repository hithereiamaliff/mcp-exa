import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface ToolRegistry {
  name: string;        // Unique name for the tool
  description: string; // Human-readable description
  schema: z.ZodRawShape;      // Zod schema for tool parameters
  handler: (
    args: { [key: string]: any }, 
    extra: any
  ) => Promise<{
    content: {
      type: "text";
      text: string;
    }[];
    isError?: boolean;
  }>;   // Function to execute when tool is called
  enabled: boolean;    // Whether the tool is enabled by default
}

// Configuration for API
export const API_CONFIG = {
  BASE_URL: 'https://api.exa.ai',
  ENDPOINTS: {
    SEARCH: '/search'
  },
  DEFAULT_NUM_RESULTS: 5,
  DEFAULT_MAX_CHARACTERS: 3000
} as const;

// Tool registry that will be populated by tool modules
export const toolRegistry: Record<string, ToolRegistry> = {};

// Function to register tools with the server
export function registerEnabledTools(
  server: McpServer, 
  enabledTools: Set<string>, 
  disabledTools: Set<string>
): string[] {
  const registeredTools: string[] = [];

  for (const [toolId, tool] of Object.entries(toolRegistry)) {
    const shouldRegister = 
      (enabledTools.has(toolId) || (enabledTools.size === 0 && tool.enabled)) &&
      !disabledTools.has(toolId);

    if (shouldRegister) {
      server.tool(
        tool.name,
        tool.description,
        tool.schema,
        tool.handler
      );
      registeredTools.push(toolId);
    }
  }

  return registeredTools;
} 