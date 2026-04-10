import readline from 'readline';
import { exec } from 'child_process';
import type { Page } from 'playwright';

export async function waitForManualLogin(
  page: Page,
  postLoginSelector: string,
  timeoutMs = 300_000
): Promise<void> {
  console.log('\n========================================');
  console.log('  ACTION REQUIRED: Please log in');
  console.log('  in the browser window.');
  console.log('  The script will continue automatically');
  console.log('  once login is detected.');
  console.log('========================================\n');

  await page.waitForSelector(postLoginSelector, {
    state: 'visible',
    timeout: timeoutMs,
  });

  console.log('[OK] Login detected. Continuing...\n');
}

export async function promptUserReview(spreadsheetPath: string): Promise<void> {
  // Open the spreadsheet in the default application (Excel on Windows)
  exec(`start "" "${spreadsheetPath}"`);

  console.log('\n========================================');
  console.log('  REVIEW REQUIRED');
  console.log(`  Spreadsheet opened: ${spreadsheetPath}`);
  console.log('  Review and edit the data, then save.');
  console.log('  Press ENTER here when ready to continue.');
  console.log('========================================\n');

  await waitForEnter();
}

export async function waitForEnter(message?: string): Promise<void> {
  if (message) console.log(message);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}
