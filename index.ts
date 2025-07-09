import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { generateTwoStepPlan } from "./generateTwoStepPlan.js";

const server = new Server(
  {
    name: "two-step-plan",
    version: "0.2.1",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "two_step_plan",
        description:
          "Create a plan for a task, have another Claude instance critique and improve it, then have a third Claude instance choose the better plan",
        inputSchema: {
          type: "object",
          properties: {
            task_description: {
              type: "string",
              description: "The task or project you need help planning",
            },
          },
          required: ["task_description"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "two_step_plan") {
    console.error("Starting two_step_plan tool execution...");
    const { task_description } = request.params.arguments as {
      task_description: string;
    };

    try {
      const selectedPlanPath = await generateTwoStepPlan(task_description, console.error);

      return {
        content: [
          {
            type: "text",
            text: `Selected plan saved to: ${selectedPlanPath}`,
          },
        ],
      };
    } catch (error) {
      console.error("Caught error in two-step plan tool:", error);
      const errorMessage =
        error instanceof Error ? `${error.message}\n${(error as any).stderr || ""}` : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error generating plan: ${errorMessage}`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Two-Step Plan MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
