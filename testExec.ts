import { execClaudePrompt } from "./generateTwoStepPlan.js";

async function test() {
  const result = await execClaudePrompt(`Write a helloworld.ts file`, "Failed to test", console.log);
  console.log("Result:", result);
}

test().catch(console.error);
