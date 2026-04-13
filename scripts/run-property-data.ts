import { launchBrowser, closeBrowser, takeScreenshot } from '../src/browser.js';
import { assertPropertyCsvComplete, createWorkbook } from '../src/spreadsheet.js';
import type { WorkflowContext } from '../src/types/workflow-state.js';
import { ensureDataDirectories, validateAddress, validateEnvironment } from '../src/runtime.js';
import { run as runPortalLogin } from '../src/steps/01-portal-login.js';
import { run as runRealmSearch } from '../src/steps/02-realm-search.js';
import { run as runGeowarehouseLookup } from '../src/steps/03-geowarehouse.js';

function printUsage(): void {
  console.error('Usage: npm run property-data -- "123 Main St, Toronto, ON"');
}

function parseArgs(): string {
  const address = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

  if (!address) {
    printUsage();
    process.exit(1);
  }

  try {
    return validateAddress(address);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const address = parseArgs();
  validateEnvironment();
  ensureDataDirectories();

  const { context, page } = await launchBrowser();
  const workbook = await createWorkbook(address);
  const spreadsheetPath = workbook.filePath;

  const ctx: WorkflowContext = {
    page,
    context,
    address,
    spreadsheetPath,
    data: {},
    debug: false,
  };

  console.log(`[INFO] ${workbook.created ? 'Created' : 'Reusing'} property CSV: ${spreadsheetPath}`);
  console.log('[INFO] Run order: PropTx login -> Geowarehouse -> Realm');

  try {
    await runPortalLogin(ctx);
    await runGeowarehouseLookup(ctx);
    await runRealmSearch(ctx);
    await assertPropertyCsvComplete(spreadsheetPath);

    console.log(`[OK] Full property data run complete: ${spreadsheetPath}`);
  } catch (error) {
    await takeScreenshot(ctx.page, 'error-full-property-data').catch(() => {});
    throw error;
  } finally {
    await closeBrowser();
  }
}

main().catch((error) => {
  console.error('Full property data run failed:', error);
  process.exit(1);
});
