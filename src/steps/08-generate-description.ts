import type { WorkflowContext } from '../types/workflow-state.js';
import { readAllData } from '../spreadsheet.js';
import { generateListingDescription } from '../description-generator.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { takeScreenshot } from '../browser.js';
import ExcelJS from 'exceljs';
import { fieldMappings } from '../../config/field-mappings.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 8] Generating listing description...');

  const data = await readAllData(ctx.spreadsheetPath);

  const description = await generateListingDescription(data);
  console.log(`[Step 8] Generated description: "${description}"`);

  // Save to spreadsheet
  await saveDescriptionToSpreadsheet(ctx.spreadsheetPath, description);

  // Paste into SkySlope Form 290 description field
  try {
    const descSelector = skyslopeSelectors.form290.listingDescription;
    const descField = ctx.page.locator(descSelector).first();
    await descField.waitFor({ state: 'visible', timeout: 10000 });
    await descField.fill(description);
    console.log('[Step 8] Description added to Form 290.');
  } catch {
    console.warn('[Step 8] Could not paste description into SkySlope. You can copy it from the spreadsheet.');
  }

  await takeScreenshot(ctx.page, 'description-complete');
  console.log('[Step 8] Listing description complete.');
}

async function saveDescriptionToSpreadsheet(filePath: string, description: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const mainSheet = workbook.getWorksheet('PropertyData')!;
  const row = mainSheet.getRow(2);

  // Find the description column
  const colMap = new Map<string, number>();
  mainSheet.getRow(1).eachCell((cell, colNumber) => {
    colMap.set(String(cell.value), colNumber);
  });

  const colNum = colMap.get(fieldMappings.listingDescription.spreadsheetColumn);
  if (colNum) {
    row.getCell(colNum).value = description;
    row.commit();
  }

  await workbook.xlsx.writeFile(filePath);
}
