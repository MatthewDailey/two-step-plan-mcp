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
    const initialPlanPrompt = `Write a plan for the following task:

---- TASK ----
${taskDescription}
---- END TASK ----

No need for time estimates.`;

    logger("Requesting initial plan from Claude...");
    const initalPlanCommand = `unset ANTHROPIC_API_KEY && claude -p '${initialPlanPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`;
    logger("\x1b[32m" + initalPlanCommand + "\x1b[0m");
    const { stdout: initialPlan, stderr: initialPlanError } = await execAsync(
      initalPlanCommand
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

---- TASK ----
${taskDescription}
---- END TASK ----

---- PLAN ----
${initialPlan}
---- END PLAN ----

Please review this plan in detail and call out anything that appears to be overengineering needlessly for what should be a simple, robust system.`;

    logger("Requesting critique and improved plan from Claude...");

    const improvedPlanCommand = `unset ANTHROPIC_API_KEY && claude -p '${critiquePrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`;
    logger("\x1b[32m" + improvedPlanCommand + "\x1b[0m");
    const { stdout: improvedPlan, stderr: improvedPlanError } = await execAsync(
      improvedPlanCommand
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

---- TASK ----
${taskDescription}
---- END TASK ----

The two plans are saved in these files:
------ Plan A ------
${initialPlanPath}
------ Plan B ------
${improvedPlanPath}
--------------------

Please read both plan files and determine which one is better.`;

    logger("Requesting final plan selection from Claude...");

    const selectionCommand = `unset ANTHROPIC_API_KEY && claude -p '${selectionPrompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions`;
    logger("\x1b[32m" + selectionCommand + "\x1b[0m");
    const { stdout: selectedPlanPath, stderr: selectionError } = await execAsync(
      selectionCommand
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
