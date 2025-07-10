# Two-Step Plan MCP

I wanted to try the approach in this tweet so Claude wrote this code. https://x.com/JohnONolan/status/1942889686646521900


## How it Works

This MCP server provides a tool that:
1. Uses Claude CLI to create an initial detailed plan for a given task
2. Has a second Claude CLI instance critique the plan and provide an improved version
3. Uses a third Claude CLI instance to read both plans, choose the better one, and delete the other
4. Returns the file path to the selected plan


## Install MCP

```json
{
  "mcpServers": {
    "two-step-plan": {
      "command": "npx",
      "args": ["-y", "two-step-plan"]
    }
  }
}
```

## Requirements

- Node.js v18 or higher
- Claude Code tool installed and configured

## Using the Standalone Plan Tool

You can use the plan tool directly without setting up the MCP server:

1. Install globally:
```bash
npm install -g two-step-plan
```

2. Run the tool:
```bash
plan "Your task description here"
```

For example:
```bash
plan "Design a REST API for a task management system"
```

## Development

### Run in development mode with auto-reload and MCP inspector:

```bash
npm run dev
```

### Build the project:

```bash
npm run build
```

### Watch for changes and rebuild:

```bash
npm run watch
```

### Inspect the MCP server:

```bash
npm run inspect
```
