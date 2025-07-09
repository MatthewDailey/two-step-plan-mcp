# MCP Server Sampling Guide

This guide explains how to use sampling (requesting LLM completions) from within an MCP server using the TypeScript SDK.

## Overview

The Model Context Protocol (MCP) allows servers to request LLM completions from connected clients through the sampling capability. This enables servers to leverage AI capabilities without needing their own API keys, while giving clients full control over model selection and user approval.

## Key Concepts

### 1. Capability Declaration

Servers must declare the `sampling` capability in their initialization:

```typescript
const server = new McpServer(
  {
    name: "my-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      sampling: {}, // Enable sampling
    },
  }
);
```

### 2. Making Sampling Requests

Use `server.request()` with the `sampling/createMessage` method:

```typescript
const response = await server.request(
  {
    method: "sampling/createMessage",
    params: {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Your prompt here",
          },
        },
      ],
      maxTokens: 500,
      temperature: 0.7,
    },
  },
  responseSchema // Zod schema for validation
);
```

### 3. Message Types

Messages can contain different content types:

#### Text Content
```typescript
{
  role: "user",
  content: {
    type: "text",
    text: "Hello, world!",
  },
}
```

#### Image Content
```typescript
{
  role: "user",
  content: {
    type: "image",
    data: "base64-encoded-image-data",
    mimeType: "image/jpeg",
  },
}
```

#### Audio Content
```typescript
{
  role: "user",
  content: {
    type: "audio",
    data: "base64-encoded-audio-data",
    mimeType: "audio/wav",
  },
}
```

### 4. Model Preferences

Guide model selection without specifying exact models:

```typescript
modelPreferences: {
  // Model hints (treated as substrings)
  hints: [
    { name: "claude-3-sonnet" }, // Prefer Sonnet-class models
    { name: "gpt-4" },           // Or GPT-4 models
  ],
  
  // Priority values (0-1)
  intelligencePriority: 0.8,  // How important are advanced capabilities?
  speedPriority: 0.5,         // How important is low latency?
  costPriority: 0.3,          // How important is minimizing cost?
}
```

### 5. Context Inclusion

Control what context the LLM can access:

```typescript
includeContext: "none"        // No additional context
includeContext: "thisServer"  // Include context from this server only
includeContext: "allServers"  // Include context from all connected servers
```

## Complete Examples

### Example 1: Text Summarization

```typescript
server.tool(
  "summarize",
  "Summarize text using LLM",
  {
    text: z.string(),
    maxWords: z.number().optional().default(100),
  },
  async ({ text, maxWords }) => {
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
                  text: `Summarize in ${maxWords} words: ${text}`,
                },
              },
            ],
            systemPrompt: "You are a helpful summarizer.",
            maxTokens: 500,
            temperature: 0.7,
            modelPreferences: {
              intelligencePriority: 0.7,
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
          model: z.string().optional(),
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
            text: `Error: ${error}`,
          },
        ],
      };
    }
  }
);
```

### Example 2: Multi-turn Conversation

```typescript
const messages = [
  { role: "user", content: { type: "text", text: "Hello" } },
  { role: "assistant", content: { type: "text", text: "Hi there!" } },
  { role: "user", content: { type: "text", text: "Tell me a joke" } },
];

const response = await server.request(
  {
    method: "sampling/createMessage",
    params: {
      messages: messages,
      maxTokens: 200,
    },
  },
  responseSchema
);
```

## Error Handling

Always wrap sampling requests in try-catch blocks:

```typescript
try {
  const response = await server.request(...);
  // Handle success
} catch (error) {
  // Common errors:
  // - User rejected the request
  // - Model not available
  // - Rate limits exceeded
  // - Invalid parameters
}
```

## Best Practices

1. **Model Preferences**: Use priorities instead of specific model names for better compatibility
2. **Token Limits**: Set appropriate `maxTokens` to control costs and response length
3. **Temperature**: Use lower values (0-0.3) for factual tasks, higher (0.7-1.0) for creative tasks
4. **Error Handling**: Always handle rejection and failure cases gracefully
5. **User Experience**: Remember that clients will show approval dialogs to users

## Security Considerations

- Clients maintain full control over model access
- Users must approve sampling requests (human in the loop)
- Servers cannot bypass client security policies
- Sensitive data handling follows client policies

## Testing

To test sampling in your MCP server:

1. Use the MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.cjs`
2. Connect a client that supports sampling (e.g., Claude Desktop)
3. Call your tools that use sampling
4. Observe the approval flow and responses

## Limitations

- Sampling is read-only for servers (cannot modify client state)
- Tool definitions cannot be passed in sampling requests
- Response format is limited to text, image, or audio content
- Actual model selection is controlled by the client

## References

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-03-26/client/sampling)
- [TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Complete Example Server](./sampling-example.ts)