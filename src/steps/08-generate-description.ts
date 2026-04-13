import type { WorkflowContext } from '../types/workflow-state.js';
import { readAllData, writeGeneratedField } from '../spreadsheet.js';
import { generateListingDescription } from '../description-generator.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { takeScreenshot } from '../browser.js';
import { fieldMappings } from '../../config/field-mappings.js';
import { leaveEditorWithoutSaving, openFormEditor, saveAndExitForm, setControlledFieldValue } from '../skyslope.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 8] Generating listing description...');

  const data = await readAllData(ctx.spreadsheetPath);
  const skyslopeFileUrl = data[fieldMappings.skyslopeFileUrl.spreadsheetColumn];

  const description = await generateListingDescription(data);
  console.log(`[Step 8] Generated description: "${description}"`);

  // Save to property CSV
  await writeGeneratedField(ctx.spreadsheetPath, fieldMappings.listingDescription.spreadsheetColumn, description);

  // Paste into SkySlope Form 290 description field
  const documentsUrl = await openFormEditor(ctx.page, '290', skyslopeFileUrl);
  const descField = await findDescriptionField(ctx.page);
  if (!descField) {
    await takeScreenshot(ctx.page, 'description-field-missing');
    await leaveEditorWithoutSaving(ctx.page, documentsUrl);
    console.warn('[Step 8] No editable description field was found in the current 290 editor. Description was saved to the property CSV only.');
    return;
  }

  await setControlledFieldValue(descField, description);
  await saveAndExitForm(ctx.page);
  console.log('[Step 8] Description added to Form 290.');

  await takeScreenshot(ctx.page, 'description-complete');
  console.log('[Step 8] Listing description complete.');
}

async function findDescriptionField(page: WorkflowContext['page']) {
  const selectors = [
    skyslopeSelectors.descriptionField,
    'textarea[id*="description" i], input[id*="description" i]',
    'textarea[id*="remarks" i], input[id*="remarks" i]',
    'textarea[name*="description" i], input[name*="description" i]',
    'textarea[name*="remarks" i], input[name*="remarks" i]',
    'textarea[aria-label*="description" i], input[aria-label*="description" i]',
    'textarea[aria-label*="remarks" i], input[aria-label*="remarks" i]',
  ];

  for (const selector of selectors) {
    const field = page.locator(selector).first();
    const isVisible = await field.isVisible().catch(() => false);
    if (isVisible) {
      return field;
    }
  }

  return null;
}
