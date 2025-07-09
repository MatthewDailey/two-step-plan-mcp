# Two-Step Plan MCP Server

A [ModelContextProtocol](https://modelcontextprotocol.io) server that implements a three-step planning process inspired by the observation that having Claude critique its own plans often leads to better, simpler solutions.

## How it Works

This MCP server provides a tool that:
1. Uses Claude CLI to create an initial detailed plan for a given task
2. Has a second Claude CLI instance critique the plan and provide an improved version
3. Uses a third Claude CLI instance to read both plans, choose the better one, and delete the other
4. Returns the file path to the selected plan

The approach is based on the principle that "NewClaude generally is of the opinion that OldClaude was overengineering" - leading to simpler, more robust plans.

## Features

- Three-step planning process using only `claude -p` commands
- Automatic file cleanup - only the selected plan remains
- Support for additional context about existing codebases
- Final plan selection with automatic deletion of inferior plan

## Requirements

- Node.js v18 or higher
- Claude CLI tool installed and configured
- An MCP client (e.g., Claude Desktop)

## Setup to build and run with Claude

1. Download and install Claude desktop app from [claude.ai/download](https://claude.ai/download)

2. Clone the repo, install dependencies and build:

```bash
npm install
npm run build
```

3. Configure Claude to use this MCP server. If this is your first MCP server, in the root of this project run:

```bash
echo '{
  "mcpServers": {
    "two-step-plan": {
      "command": "node",
      "args": ["'$PWD'/dist/index.cjs"]
    }
  }
}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

This should result in an entry in your `claude_desktop_config.json` like:

```json
"mcpServers": {
  "two-step-plan": {
    "command": "node",
    "args": ["/Users/yourname/code/two-step-plan/dist/index.cjs"]
  }
}
```

If you have existing MCP servers, add the `two-step-plan` block to your existing config. It's an important detail that the `args` is the path to `<path_to_repo_on_your_machine>/two-step-plan/dist/index.cjs`.

4. Restart Claude Desktop.

5. Look for the hammer icon with the number of available tools in Claude's interface to confirm the server is running.

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

## Publishing

To publish to npm:

1. Update the version in `package.json`
2. Run `npm publish`

Users can then install globally:
```bash
npm install -g two-step-plan
```

And configure Claude Desktop to use the globally installed version:
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

## How to create your own MCP tool

This project is built from the [mcp-starter](https://github.com/claude-ai/mcp-starter) template. To create your own MCP tool:

1. Clone the starter template
2. Update `index.ts` with your tool implementation
3. Use `server.tool()` to register new tools
4. Enable additional capabilities like `sampling` if needed
5. Follow the setup instructions above to test with Claude Desktop

## Contributing

This project demonstrates the use of MCP's sampling capability to create multi-agent workflows. Feel free to fork and extend it with your own planning strategies!