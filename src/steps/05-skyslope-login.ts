import type { WorkflowContext } from '../types/workflow-state.js';
import { waitForManualLogin } from '../pause.js';
import { urls } from '../../config/urls.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 5] Opening SkySlope Forms for login...');

  await ctx.page.goto(urls.skyslopeLogin, { waitUntil: 'domcontentloaded' });

  // Check if already logged in
  const isLoggedIn = await ctx.page
    .locator(skyslopeSelectors.postLoginIndicator)
    .first()
    .isVisible()
    .catch(() => false);

  if (!isLoggedIn) {
    if (ctx.debug) {
      await ctx.page.pause();
    }
    await waitForManualLogin(ctx.page, skyslopeSelectors.postLoginIndicator);
  } else {
    console.log('[Step 5] Already logged in to SkySlope.');
  }

  console.log('[Step 5] SkySlope login complete.');
}
