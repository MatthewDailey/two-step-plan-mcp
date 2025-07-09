import { exec } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

type Logger = {
  (...data: any[]): void;
};

export async function generateTwoStepPlan(taskDescription: string, logger: Logger = console.error) {
  logger("Starting two_step_plan execution...");
  logger("Two-step plan inputs:", { taskDescription });

  try {
    logger("Step 1: Preparing initial plan prompt...");
    // Step 1: Create initial plan
    const initialPlanPrompt = `You are helping to create a detailed implementation plan for the following task:

Task: ${taskDescription}

Please create a comprehensive, well-structured plan in markdown format. Include:
- Clear objectives
- Step-by-step implementation details
- Potential challenges and solutions
- Testing considerations
- Any relevant technical decisions

No need for time estimates.

Be thorough and specific.`;

    logger("Requesting initial plan from Claude...");

    const { stdout: initialPlan, stderr: initialPlanError } = await execAsync(
      `unset ANTHROPIC_API_KEY && claude -p '${initialPlanPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
    ).catch((err) => {
      logger("Error getting initial plan:", err);
      return { stdout: "", stderr: err.message };
    });

    if (initialPlanError) {
      throw new Error(`Failed to generate initial plan: ${initialPlanError}`);
    }

    logger("Initial plan generated successfully, preparing to save...");
    // Save initial plan to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const planDir = path.join(os.tmpdir(), "two-step-plan", "plans");
    await fs.mkdir(planDir, { recursive: true });

    const initialPlanPath = path.join(planDir, `initial_plan_${timestamp}.md`);
    await fs.writeFile(initialPlanPath, `# Initial Plan\n\n${initialPlan}`);

    logger(`Initial plan saved successfully to: ${initialPlanPath}`);

    logger("Step 2: Preparing critique prompt...");
    // Step 2: Have another Claude critique the plan
    const critiquePrompt = `A previous agent created the following plan for this task:

Task: ${taskDescription}

PLAN:
${initialPlan}

Please review this plan in detail and:
1. Call out anything that appears to be overengineering needlessly for what should be a simple, robust system
2. Identify any missing considerations or steps
3. Suggest improvements for clarity and practicality
4. Provide a revised, improved version of the plan that addresses these issues

Be constructive but critical. Focus on making the plan simpler, more robust, and easier to implement.`;

    logger("Requesting critique and improved plan from Claude...");

    const { stdout: improvedPlan, stderr: improvedPlanError } = await execAsync(
      `claude -p '${critiquePrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
    ).catch((err) => {
      logger("Error getting improved plan:", err);
      return { stdout: "", stderr: err.message };
    });

    if (improvedPlanError) {
      throw new Error(`Failed to generate improved plan: ${improvedPlanError}`);
    }

    logger("Improved plan generated successfully, preparing to save...");
    // Save improved plan to file
    const improvedPlanPath = path.join(planDir, `improved_plan_${timestamp}.md`);
    await fs.writeFile(improvedPlanPath, `# Improved Plan\n\n${improvedPlan}`);

    logger(`Improved plan saved successfully to: ${improvedPlanPath}`);

    logger("Step 3: Preparing selection prompt...");
    // Step 3: Have Claude choose the better plan using claude -p and file operations
    const selectionPrompt = `You need to choose the better plan between these two files for the following task:

Task: ${taskDescription}

The two plans are saved in these files:
------ Plan A ------
${initialPlanPath}
------ Plan B ------
${improvedPlanPath}
--------------------

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

    logger("Requesting final plan selection from Claude...");

    const { stdout: selectedPlanPath, stderr: selectionError } = await execAsync(
      `claude -p '${selectionPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`
    ).catch((err) => {
      logger("Error during plan selection:", err);
      return { stdout: "", stderr: err.message };
    });

    if (selectionError) {
      throw new Error(`Failed during plan selection: ${selectionError}`);
    }

    logger("Plan selection completed successfully");
    return selectedPlanPath.trim();
  } catch (error) {
    logger("Caught error in two-step plan:", error);
    const errorMessage =
      error instanceof Error ? `${error.message}\n${(error as any).stderr || ""}` : String(error);
    throw new Error(`Error generating plan: ${errorMessage}`);
  }
}
