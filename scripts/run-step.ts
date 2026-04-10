import { launchBrowser, closeBrowser } from '../src/browser.js';
import { createWorkbook, readAddressFromSpreadsheet } from '../src/spreadsheet.js';
import type { WorkflowContext, StepModule } from '../src/types/workflow-state.js';
import fs from 'fs';
import path from 'path';
import { ensureDataDirectories, validateAddress, validateEnvironment } from '../src/runtime.js';

const STEP_MODULES: Record<string, string> = {
  '1': '../src/steps/01-portal-login.js',
  '2': '../src/steps/02-realm-search.js',
  '3': '../src/steps/03-geowarehouse.js',
  '4': '../src/steps/04-human-review.js',
  '5': '../src/steps/05-skyslope-login.js',
  '6': '../src/steps/06-skyslope-add-forms.js',
  '7': '../src/steps/07-skyslope-fill.js',
  '8': '../src/steps/08-generate-description.js',
};
const STEPS_REQUIRING_ADDRESS = new Set(['1', '2', '3']);

function printUsage(): void {
  console.error('Usage: npm run step -- <step-number> ["123 Main St, Toronto, ON"] [--spreadsheet data\\file.xlsx]');
  console.error('Steps: 1-8');
  console.error('\n  1: Portal Login');
  console.error('  2: Realm Search');
  console.error('  3: Geowarehouse Lookup');
  console.error('  4: Human Review');
  console.error('  5: SkySlope Login');
  console.error('  6: Add SkySlope Forms');
  console.error('  7: Fill SkySlope Forms');
  console.error('  8: Generate Description');
}

function parseArgs(): { stepNum: string; address: string; spreadsheetPath?: string } {
  const args = process.argv.slice(2);
  const stepNum = args[0];
  let address = '';
  let spreadsheetPath: string | undefined;

  if (!stepNum || !STEP_MODULES[stepNum]) {
    printUsage();
    process.exit(1);
  }

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--spreadsheet' && args[i + 1]) {
      spreadsheetPath = path.resolve(args[i + 1]!);
      i++;
      continue;
    }

    if (!arg.startsWith('--') && !address) {
      address = arg;
    }
  }

  const addressIsRequired = STEPS_REQUIRING_ADDRESS.has(stepNum) || !spreadsheetPath;

  if (!addressIsRequired && !address) {
    return { stepNum, address: '', spreadsheetPath };
  }

  try {
    return {
      stepNum,
      address: validateAddress(address),
      spreadsheetPath,
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { stepNum, address, spreadsheetPath: providedSpreadsheetPath } = parseArgs();
  validateEnvironment();
  ensureDataDirectories();

  if (providedSpreadsheetPath && !fs.existsSync(providedSpreadsheetPath)) {
    console.error(`Spreadsheet not found: ${providedSpreadsheetPath}`);
    process.exit(1);
  }

  const { context, page } = await launchBrowser({ debug: true });
  const spreadsheetPath = providedSpreadsheetPath ?? (await createWorkbook(address)).filePath;
  const resolvedAddress = address || (providedSpreadsheetPath
    ? await readAddressFromSpreadsheet(providedSpreadsheetPath)
    : undefined) || '';

  if (stepNum === '6' && !resolvedAddress) {
    console.error('Step 6 requires a property address. Pass it explicitly or provide a spreadsheet with Property Address populated.');
    await closeBrowser();
    process.exit(1);
  }

  if (providedSpreadsheetPath) {
    console.log(`[INFO] Reusing spreadsheet: ${spreadsheetPath}`);
  } else {
    console.log(`[INFO] Created spreadsheet: ${spreadsheetPath}`);
  }

  const ctx: WorkflowContext = {
    page,
    context,
    address: resolvedAddress,
    spreadsheetPath,
    data: {},
    debug: true,
  };

  console.log(`Running step ${stepNum} with debug mode ON...`);
  console.log(`Spreadsheet: ${spreadsheetPath}\n`);

  try {
    const stepModule: StepModule = await import(STEP_MODULES[stepNum]!);
    await stepModule.run(ctx);
    console.log('\nStep completed successfully.');
  } catch (error) {
    console.error('\nStep failed:', error);
  }

  await closeBrowser();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
