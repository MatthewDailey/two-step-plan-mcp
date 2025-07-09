import * as fs from "fs/promises";
import { generateTwoStepPlan } from "./generateTwoStepPlan.js";

const taskDescription = process.argv[2];
if (!taskDescription) {
  console.error("Please provide a task description as a command line argument");
  process.exit(1);
}

generateTwoStepPlan(taskDescription, console.log)
  .then(async (selectedPlanPath) => {
    console.log(`\nSelected plan path: ${selectedPlanPath}`);
    // Read and display the selected plan
    const planContent = await fs.readFile(selectedPlanPath, "utf-8");
    console.log("\nSelected Plan Content:");
    console.log(planContent);
  })
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
