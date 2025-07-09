import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "two-step-plan",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Define available tools
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

// Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "two_step_plan") {
    const { task_description, context } = request.params.arguments as {
      task_description: string;
      context: string;
    };

    console.error("Two-step plan tool", { task_description, context });

    try {
      // Step 1: Create initial plan
      const initialPlanPrompt = `You are helping to create a detailed implementation plan for the following task:

Task: ${task_description}

${context ? `Additional Context: ${context}` : ""}

Please create a comprehensive, well-structured plan in markdown format. Include:
- Clear objectives
- Step-by-step implementation details
- Potential challenges and solutions
- Testing considerations
- Any relevant technical decisions

Be thorough and specific.`;

      console.error("Requesting initial plan from Claude...");

      const { stdout: initialPlan, stderr: initialPlanError } = await execAsync(
        `unset ANTHROPIC_API_KEY && claude -p '${initialPlanPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
      ).catch((err) => {
        console.error("Error getting initial plan:", err);
        return { stdout: "", stderr: err.message };
      });

      if (initialPlanError) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating initial plan: ${initialPlanError}`,
            },
          ],
        };
      }

      // Save initial plan to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const planDir = path.join(os.tmpdir(), "two-step-plan", "plans");
      await fs.mkdir(planDir, { recursive: true });

      const initialPlanPath = path.join(planDir, `initial_plan_${timestamp}.md`);
      await fs.writeFile(initialPlanPath, `# Initial Plan\n\n${initialPlan}`);

      console.error(`Initial plan saved to: ${initialPlanPath}`);

      // Step 2: Have another Claude critique the plan
      const critiquePrompt = `A previous agent created the following plan for this task:

Task: ${task_description}
${context ? `Context: ${context}` : ""}

PLAN:
${initialPlan}

Please review this plan in detail and:
1. Call out anything that appears to be overengineering needlessly for what should be a simple, robust system
2. Identify any missing considerations or steps
3. Suggest improvements for clarity and practicality
4. Provide a revised, improved version of the plan that addresses these issues

Be constructive but critical. Focus on making the plan simpler, more robust, and easier to implement.`;

      console.error("Requesting critique and improved plan from Claude...");

      const { stdout: improvedPlan, stderr: improvedPlanError } = await execAsync(
        `claude -p '${critiquePrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
      ).catch((err) => {
        console.error("Error getting improved plan:", err);
        return { stdout: "", stderr: err.message };
      });

      if (improvedPlanError) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating improved plan: ${improvedPlanError}`,
            },
          ],
        };
      }

      // Save improved plan to file
      const improvedPlanPath = path.join(planDir, `improved_plan_${timestamp}.md`);
      await fs.writeFile(improvedPlanPath, `# Improved Plan\n\n${improvedPlan}`);

      console.error(`Improved plan saved to: ${improvedPlanPath}`);

      // Step 3: Have Claude choose the better plan using claude -p and file operations
      const selectionPrompt = `You need to choose the better plan between these two files for the following task:

Task: ${task_description}
${context ? `Context: ${context}` : ""}

The two plans are saved in these files:
- Plan A (Initial): ${initialPlanPath}
- Plan B (Improved): ${improvedPlanPath}

Please:
1. Read both plan files
2. Analyze which plan is better based on:
   - More practical and implementable
   - Better balanced between thoroughness and simplicity
   - More likely to succeed given the constraints
3. Delete the file containing the inferior plan
4. Respond with only the file path of the selected plan

Instructions for file operations:
- Use 'cat' to read the files
- Use 'rm' to delete the non-selected file
- Return only the path to the remaining file

Example response format: /path/to/selected/plan.md`;

      console.error("Requesting final plan selection from Claude...");

      const { stdout: selectedPlanPath, stderr: selectionError } = await execAsync(
        `claude -p '${selectionPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
      ).catch((err) => {
        console.error("Error during plan selection:", err);
        return { stdout: "", stderr: err.message };
      });

      if (selectionError) {
        return {
          content: [
            {
              type: "text",
              text: `Error during plan selection: ${selectionError}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Selected plan saved to: ${selectedPlanPath.trim()}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error in two-step plan tool:", error);

      // Get any error details from the error object
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
