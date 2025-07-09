# Two-Step Plan MCP

I wanted to try the approach in this tweet so Claude wrote this code. https://x.com/JohnONolan/status/1942889686646521900


## How it Works

This MCP server provides a tool that:
1. Uses Claude CLI to create an initial detailed plan for a given task
2. Has a second Claude CLI instance critique the plan and provide an improved version
3. Uses a third Claude CLI instance to read both plans, choose the better one, and delete the other
4. Returns the file path to the selected plan


## Install

```json
{
  "mcpServers": {
    "two-step-plan": {
      "command": "npx",
      "args": ["-y", "two-step-plan-mcp"]
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
two-step-plan "Your task description here"
```

For example:
```bash
two-step-plan "Design a REST API for a task management system"
```

The tool will generate plans using Claude CLI, critique them, and select the best one. The final plan will be saved in your system's temp directory under `two-step-plan/plans/` and its contents will be displayed in the console.



## Using the Tool

Once configured, you can use the `two_step_plan` tool in Claude Desktop:

```
Use the two_step_plan tool to help me design a REST API for a task management system
```

The tool accepts two parameters:
- `task_description` (required): The task or project you need help planning
- `context` (optional): Additional context about existing codebase, constraints, or requirements

## Output

The tool will:
1. Generate an initial plan using Claude CLI
2. Have another Claude CLI instance critique and improve it
3. Use a third Claude CLI instance to read both plans, choose the better one, and delete the other
4. Return the file path to the selected plan in your system's temp directory under `two-step-plan/plans/`

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
