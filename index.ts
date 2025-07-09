import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const server = new McpServer(
  {
    name: "two-step-plan",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
      sampling: {}, // Enable sampling capability
    },
  }
);

// Response schema for sampling requests
const CreateMessageResponseSchema = z.object({
  role: z.string(),
  content: z.object({
    type: z.string(),
    text: z.string(),
  }),
  model: z.string().optional(),
  stopReason: z.string().optional(),
});

server.tool(
  "two_step_plan",
  "Create a plan for a task, then have another Claude instance critique and improve it",
  {
    task_description: z.string().describe("The task or project you need help planning"),
    context: z.string().optional().describe("Additional context about existing codebase, constraints, or requirements"),
  },
  async ({ task_description, context }) => {
    console.error("Two-step plan tool", { task_description, context });
    
    try {
      // Step 1: Create initial plan
      const initialPlanPrompt = `You are helping to create a detailed implementation plan for the following task:

Task: ${task_description}

${context ? `Additional Context: ${context}` : ''}

Please create a comprehensive, well-structured plan in markdown format. Include:
- Clear objectives
- Step-by-step implementation details
- Potential challenges and solutions
- Testing considerations
- Any relevant technical decisions

Be thorough and specific.`;

      console.error("Requesting initial plan from Claude...");
      
      const initialPlanResponse = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: initialPlanPrompt,
                },
              },
            ],
            maxTokens: 2000,
            temperature: 0.7,
            modelPreferences: {
              hints: [{ name: "claude-3-sonnet" }],
              intelligencePriority: 0.8,
              speedPriority: 0.5,
              costPriority: 0.3,
            },
          },
        },
        CreateMessageResponseSchema
      );

      const initialPlan = initialPlanResponse.content.text;
      
      // Save initial plan to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const planDir = path.join(os.tmpdir(), 'two-step-plan', 'plans');
      await fs.mkdir(planDir, { recursive: true });
      
      const initialPlanPath = path.join(planDir, `initial_plan_${timestamp}.md`);
      await fs.writeFile(initialPlanPath, `# Initial Plan\n\n${initialPlan}`);
      
      console.error(`Initial plan saved to: ${initialPlanPath}`);

      // Step 2: Have another Claude critique the plan
      const critiquePrompt = `A previous agent created the following plan for this task:

Task: ${task_description}
${context ? `Context: ${context}` : ''}

PLAN:
${initialPlan}

Please review this plan in detail and:
1. Call out anything that appears to be overengineering needlessly for what should be a simple, robust system
2. Identify any missing considerations or steps
3. Suggest improvements for clarity and practicality
4. Provide a revised, improved version of the plan that addresses these issues

Be constructive but critical. Focus on making the plan simpler, more robust, and easier to implement.`;

      console.error("Requesting critique and improved plan from Claude...");
      
      const improvedPlanResponse = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: critiquePrompt,
                },
              },
            ],
            maxTokens: 2500,
            temperature: 0.7,
            modelPreferences: {
              hints: [{ name: "claude-3-sonnet" }],
              intelligencePriority: 0.9, // Higher intelligence for critique
              speedPriority: 0.4,
              costPriority: 0.2,
            },
          },
        },
        CreateMessageResponseSchema
      );

      const improvedPlan = improvedPlanResponse.content.text;
      
      // Save improved plan to file
      const improvedPlanPath = path.join(planDir, `improved_plan_${timestamp}.md`);
      await fs.writeFile(improvedPlanPath, `# Improved Plan\n\n${improvedPlan}`);
      
      console.error(`Improved plan saved to: ${improvedPlanPath}`);

      // Create a combined output
      const combinedOutput = `# Two-Step Planning Process

## Initial Plan
${initialPlan}

---

## Critique and Improved Plan
${improvedPlan}

---

Plans saved to:
- Initial: ${initialPlanPath}
- Improved: ${improvedPlanPath}`;

      return {
        content: [
          {
            type: "text",
            text: combinedOutput,
          },
        ],
      };
    } catch (error) {
      console.error("Error in two-step plan tool:", error);
      
      // Check if it's a sampling not supported error
      if (error instanceof Error && error.message.includes("sampling")) {
        return {
          content: [
            {
              type: "text",
              text: "Error: The MCP client does not support sampling. This tool requires a client with sampling capabilities (such as Claude Desktop with the latest version).",
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Error generating plan: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

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