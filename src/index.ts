import { launchBrowser, closeBrowser, takeScreenshot } from './browser.js';
import { createWorkbook } from './spreadsheet.js';
import type { WorkflowContext } from './types/workflow-state.js';
import type { StepModule } from './types/workflow-state.js';
import { ensureDataDirectories, validateAddress, validateEnvironment } from './runtime.js';

const STEPS: { name: string; module: string }[] = [
  { name: 'Portal Login', module: './steps/01-portal-login.js' },
  { name: 'Realm Search', module: './steps/02-realm-search.js' },
  { name: 'Geowarehouse Lookup', module: './steps/03-geowarehouse.js' },
  { name: 'Human Review', module: './steps/04-human-review.js' },
  { name: 'SkySlope Login', module: './steps/05-skyslope-login.js' },
  { name: 'Add Forms', module: './steps/06-skyslope-add-forms.js' },
  { name: 'Fill Forms', module: './steps/07-skyslope-fill.js' },
  { name: 'Generate Description', module: './steps/08-generate-description.js' },
];

function printUsage(): void {
  console.error('Usage: npm run start -- "123 Main St, Toronto, ON" [--from-step N] [--debug]');
}

function parseArgs(): { address: string; fromStep: number; debug: boolean } {
  const args = process.argv.slice(2);
  let address = '';
  let fromStep = 1;
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-step' && args[i + 1]) {
      fromStep = parseInt(args[i + 1]!);
      i++;
    } else if (args[i] === '--debug') {
      debug = true;
    } else if (!args[i]!.startsWith('--')) {
      address = args[i]!;
    }
  }

  if (!address) {
    printUsage();
    process.exit(1);
  }

  if (!Number.isInteger(fromStep) || fromStep < 1 || fromStep > STEPS.length) {
    console.error(`--from-step must be an integer between 1 and ${STEPS.length}.`);
    printUsage();
    process.exit(1);
  }

  try {
    return { address: validateAddress(address), fromStep, debug };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { address, fromStep, debug } = parseArgs();
  validateEnvironment();

  console.log('===========================================');
  console.log('  Real Estate Listing Helper');
  console.log(`  Property: ${address}`);
  console.log(`  Starting from step: ${fromStep}`);
  console.log(`  Debug mode: ${debug ? 'ON' : 'OFF'}`);
  console.log('===========================================\n');

  ensureDataDirectories();

  // Launch browser
  const { context, page } = await launchBrowser({ debug });

  // Create or reuse spreadsheet
  const { filePath: spreadsheetPath } = await createWorkbook(address);
  console.log(`[INFO] Spreadsheet: ${spreadsheetPath}\n`);

  const ctx: WorkflowContext = {
    page,
    context,
    address,
    spreadsheetPath,
    data: {},
    debug,
  };

  // Run steps
  for (let i = fromStep - 1; i < STEPS.length; i++) {
    const step = STEPS[i]!;
    const stepNum = i + 1;

    console.log(`\n--- Step ${stepNum}/${STEPS.length}: ${step.name} ---`);

    try {
      const stepModule: StepModule = await import(step.module);
      await stepModule.run(ctx);
      console.log(`--- Step ${stepNum} complete ---\n`);
    } catch (error) {
      console.error(`\n[ERROR] Step ${stepNum} (${step.name}) failed:`);
      console.error(error);

      // Save debug screenshot
      await takeScreenshot(page, `error-step-${stepNum}`).catch(() => {});

      console.log(`\nTo resume from this step, run:`);
      console.log(`  npm run start -- "${address}" --from-step ${stepNum}${debug ? ' --debug' : ''}`);
      break;
    }
  }

  console.log('\n===========================================');
  console.log('  Workflow complete!');
  console.log(`  Spreadsheet: ${spreadsheetPath}`);
  console.log('===========================================');

  await closeBrowser();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
