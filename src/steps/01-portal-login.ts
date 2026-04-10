import type { WorkflowContext } from '../types/workflow-state.js';
import { waitForManualLogin } from '../pause.js';
import { urls } from '../../config/urls.js';
import { realmSelectors } from '../../config/selectors/realm.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 1] Opening realtor portal for login...');

  await ctx.page.goto(urls.realtorPortal, { waitUntil: 'domcontentloaded' });

  if (ctx.debug) {
    await ctx.page.pause();
  }

  await waitForManualLogin(ctx.page, realmSelectors.postLoginIndicator);

  console.log('[Step 1] Portal login complete.');
}
