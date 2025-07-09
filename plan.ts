import { generateTwoStepPlan } from "./generateTwoStepPlan.js";

const taskDescription = process.argv[2];
if (!taskDescription) {
  console.error("Please provide a task description as a command line argument");
  process.exit(1);
}

generateTwoStepPlan(taskDescription, console.log).catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
