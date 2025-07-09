import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * This example demonstrates how to use sampling (createMessage) from within an MCP server.
 * 
 * Sampling allows MCP servers to request LLM completions from the connected client.
 * The client maintains control over model selection and user approval.
 */

const server = new McpServer(
  {
    name: "sampling-example-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      sampling: {}, // Must declare sampling capability
    },
  }
);

// Example 1: Basic text generation
server.tool(
  "generate_story",
  "Generate a short story based on a prompt",
  {
    prompt: z.string().describe("Story prompt or theme"),
    genre: z.enum(["fantasy", "scifi", "mystery", "romance"]).optional(),
  },
  async ({ prompt, genre }) => {
    const genreText = genre ? ` in the ${genre} genre` : "";
    
    try {
      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Write a short story${genreText} based on this prompt: ${prompt}`,
                },
              },
            ],
            systemPrompt: "You are a creative writer. Write engaging short stories.",
            maxTokens: 1000,
            temperature: 0.8,
            modelPreferences: {
              hints: [{ name: "claude-3-opus" }, { name: "gpt-4" }],
              intelligencePriority: 0.9, // High creativity needed
              speedPriority: 0.3,
              costPriority: 0.2,
            },
          },
        },
        z.object({
          role: z.literal("assistant"),
          content: z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
          model: z.string().optional(),
          stopReason: z.string().optional(),
        })
      );

      return {
        content: [
          {
            type: "text",
            text: response.content.text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Story generation failed: ${error}`,
          },
        ],
      };
    }
  }
);

// Example 2: Multi-turn conversation
server.tool(
  "chat_assistant",
  "Have a multi-turn conversation with an AI assistant",
  {
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).describe("Conversation history"),
    newMessage: z.string().describe("New user message"),
  },
  async ({ messages, newMessage }) => {
    try {
      // Build conversation history
      const conversationMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: {
            type: "text" as const,
            text: msg.content,
          },
        })),
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: newMessage,
          },
        },
      ];

      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: conversationMessages,
            maxTokens: 500,
            temperature: 0.7,
          },
        },
        z.object({
          role: z.literal("assistant"),
          content: z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
        })
      );

      return {
        content: [
          {
            type: "text",
            text: response.content.text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Chat failed: ${error}`,
          },
        ],
      };
    }
  }
);

// Example 3: Image analysis (if client supports it)
server.tool(
  "analyze_image",
  "Analyze an image using vision capabilities",
  {
    imageData: z.string().describe("Base64 encoded image data"),
    question: z.string().describe("What to analyze about the image"),
  },
  async ({ imageData, question }) => {
    try {
      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: question,
                },
              },
              {
                role: "user",
                content: {
                  type: "image",
                  data: imageData,
                  mimeType: "image/jpeg",
                },
              },
            ],
            maxTokens: 300,
            modelPreferences: {
              hints: [{ name: "claude-3-opus" }, { name: "gpt-4-vision" }],
              intelligencePriority: 0.9, // Need vision capabilities
            },
          },
        },
        z.object({
          role: z.literal("assistant"),
          content: z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
        })
      );

      return {
        content: [
          {
            type: "text",
            text: response.content.text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Image analysis failed: ${error}`,
          },
        ],
      };
    }
  }
);

// Example 4: Using includeContext to access MCP server resources
server.tool(
  "analyze_with_context",
  "Analyze text with access to server context",
  {
    query: z.string().describe("Analysis query"),
    includeAllServers: z.boolean().optional().describe("Include context from all connected servers"),
  },
  async ({ query, includeAllServers }) => {
    try {
      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: query,
                },
              },
            ],
            // This allows the LLM to access resources from MCP servers
            includeContext: includeAllServers ? "allServers" : "thisServer",
            maxTokens: 500,
          },
        },
        z.object({
          role: z.literal("assistant"),
          content: z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
        })
      );

      return {
        content: [
          {
            type: "text",
            text: response.content.text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Analysis failed: ${error}`,
          },
        ],
      };
    }
  }
);

// Example 5: Structured output extraction
server.tool(
  "extract_info",
  "Extract structured information from text",
  {
    text: z.string().describe("Text to extract information from"),
    schema: z.string().describe("What information to extract (e.g., 'names and dates', 'prices', etc.)"),
  },
  async ({ text, schema }) => {
    try {
      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Extract the following information from the text: ${schema}

Text: "${text}"

Return the information in a structured JSON format.`,
                },
              },
            ],
            maxTokens: 300,
            temperature: 0, // Low temperature for consistent extraction
            modelPreferences: {
              intelligencePriority: 0.8,
              speedPriority: 0.5,
              costPriority: 0.3,
            },
          },
        },
        z.object({
          role: z.literal("assistant"),
          content: z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
        })
      );

      return {
        content: [
          {
            type: "text",
            text: response.content.text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Extraction failed: ${error}`,
          },
        ],
      };
    }
  }
);

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sampling Example Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});