import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateTwoStepPlan } from "./generateTwoStepPlan.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

const server = new Server(
  {
    name: "two-step-plan",
    version: "0.3.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
      notifications: {},
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

// Helper function to send progress notifications
async function sendProgressNotification(
  sendNotification: (notification: any) => Promise<void>,
  progressToken: string,
  progress: number,
  total: number,
  message?: string
) {
  console.error("PROGRESS:", message);
  await sendNotification({
    method: "notifications/progress",
    params: {
      progressToken,
      progress,
      total,
      ...(message && { message }),
    },
  });
}

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  if (request.params.name === "two_step_plan") {
    console.error("Starting two_step_plan tool execution...");
    const { task_description } = request.params.arguments as {
      task_description: string;
    };

    // Extract progress token from request metadata
    const progressToken = request.params._meta?.progressToken;

    // Create progress callback if token is provided
    const progressCallback =
      progressToken && typeof progressToken === "string"
        ? async (progress: number, total: number, message?: string) => {
            await sendProgressNotification(
              extra.sendNotification,
              progressToken,
              progress,
              total,
              message
            );
          }
        : undefined;

    console.error("progressToken", progressToken);
    await sendProgressNotification(
      extra.sendNotification,
      progressToken as string,
      0,
      3,
      "Starting initial plan generation..."
    );

    // Start periodic progress updates every 2 seconds
    let progressInterval: NodeJS.Timeout | undefined;
    let currentProgress = 0;
    if (progressToken) {
      progressInterval = setInterval(async () => {
        currentProgress = Math.min(currentProgress + 0.03, 2.9); // Gradually increase progress
        await sendProgressNotification(
          extra.sendNotification,
          progressToken as string,
          currentProgress,
          3,
          "Processing plan generation..."
        );
      }, 2000);
    }

    try {
      const selectedPlanPath = await generateTwoStepPlan(
        task_description,
        console.error,
        progressCallback
      );

      // Clear the interval when done
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      return {
        content: [
          {
            type: "text",
            text: `Selected plan saved to: ${selectedPlanPath}`,
          },
        ],
      };
    } catch (error) {
      // Clear the interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }

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
