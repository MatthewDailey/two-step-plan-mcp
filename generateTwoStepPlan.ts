import { exec, spawn } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

type Logger = {
  (...data: any[]): void;
};

async function executeCommand(
  command: string,
  errorMessage: string,
  logger: Logger
): Promise<string> {
  const { stdout, stderr } = await execAsync(command, {
    // Use the user's shell instead of /bin/sh
    shell: process.env.SHELL,
    // Preserve the full environment
    env: process.env,
    // Set a timeout to prevent hanging
    timeout: 600000, // 600 seconds
    // Increase buffer size for large outputs
    maxBuffer: 10 * 1024 * 1024, // 10MB
  }).catch((err) => {
    logger("Error:", errorMessage, err);
    return { stdout: "", stderr: err.message };
  });

  if (stderr) {
    throw new Error(`${errorMessage}: ${stderr}`);
  }

  return stdout;
}

export async function execClaudePrompt(
  prompt: string,
  errorMessage: string,
  logger: Logger
): Promise<string> {
  const escapedPrompt = prompt.replace(/'/g, "'\"'\"'");
  const command = `claude -p '${escapedPrompt}' --dangerously-skip-permissions`;
  logger("\x1b[32m" + command + "\x1b[0m");

  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn(command, {
      shell: process.env.SHELL || true,
      env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      process.stdout.write(chunk); // Stream to terminal
      output += chunk;
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      process.stderr.write(chunk); // Stream errors to terminal
      errorOutput += chunk;
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${errorMessage}: ${errorOutput || `Process exited with code ${code}`}`));
      } else {
        resolve(output);
      }
    });

    child.on("error", (err) => {
      reject(new Error(`${errorMessage}: ${err.message}`));
    });
  });
}

export async function generateTwoStepPlan(taskDescription: string, logger: Logger = console.error) {
  // Step 1: Create initial plan
  logger("Step 1: Preparing initial plan prompt...");

  logger("Requesting initial plan from Claude...");
  const initialPlan = await execClaudePrompt(
    `Write a plan for the following task:

---- TASK ----
${taskDescription}
---- END TASK ----

No need for time estimates.`,
    "Failed to generate initial plan",
    logger
  );

  logger("Initial plan generated successfully, preparing to save...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const planDir = path.join(os.tmpdir(), "two-step-plan", "plans");
  await fs.mkdir(planDir, { recursive: true });

  const initialPlanPath = path.join(planDir, `initial_plan_${timestamp}.md`);
  await fs.writeFile(initialPlanPath, `# Initial Plan\n\n${initialPlan}`);

  logger(`Initial plan saved successfully to: ${initialPlanPath}`);

  // Step 2: Have another Claude critique the plan
  logger("Step 2: Requesting critique of initial plan...");
  const improvedPlan = await execClaudePrompt(
    `A previous agent created the following plan for this task:

---- TASK ----
${taskDescription}
---- END TASK ----

---- PLAN ----
${initialPlan}
---- END PLAN ----

Please review this plan in detail and call out anything that appears to be overengineering needlessly for what should be a simple, robust system.`,
    "Failed to generate improved plan",
    logger
  );

  const improvedPlanPath = path.join(planDir, `improved_plan_${timestamp}.md`);
  await fs.writeFile(improvedPlanPath, `# Improved Plan\n\n${improvedPlan}`);

  logger(`Improved plan saved successfully to: ${improvedPlanPath}`);

  // Step 3: Have Claude choose the better plan using claude -p and file operations
  logger("Step 3: Requesting final plan selection...");
  const selectedPlanPath = await execClaudePrompt(
    `You need to choose the better plan between these two files for the following task:

---- TASK ----
${taskDescription}
---- END TASK ----

The two plans are saved in these files:
------ Plan A ------
${initialPlanPath}
------ Plan B ------
${improvedPlanPath}
--------------------

Please read both plan files and determine which one is better. Move the the better plan to a markdown file named after the task including the timestamp ${timestamp} in the current directory.`,
    "Failed during plan selection",
    logger
  );

  logger("Plan selection completed successfully");
  return selectedPlanPath.trim();
}
