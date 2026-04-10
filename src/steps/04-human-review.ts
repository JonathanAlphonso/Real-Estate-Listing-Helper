import type { WorkflowContext } from '../types/workflow-state.js';
import { promptUserReview } from '../pause.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 4] Opening spreadsheet for human review...');
  await promptUserReview(ctx.spreadsheetPath);
  console.log('[Step 4] Human review complete. Continuing...');
}
