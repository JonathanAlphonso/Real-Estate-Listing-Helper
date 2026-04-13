import readline from 'readline';
import { exec } from 'child_process';
import type { Page } from 'playwright';

export async function waitForManualLogin(
  page: Page,
  postLoginSelector: string,
  timeoutMs = 30_000
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
  const interactiveSession = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (interactiveSession) {
    // Open the property CSV in the default application only when a user can
    // actually review it and continue the workflow from the same terminal.
    exec(`start "" "${spreadsheetPath}"`);
  }

  console.log('\n========================================');
  console.log('  REVIEW REQUIRED');
  console.log(`  Property CSV: ${spreadsheetPath}`);
  if (interactiveSession) {
    console.log('  The CSV was opened in the default application.');
  }
  console.log('  Review and edit the data, then save.');
  console.log('  Press ENTER here when ready to continue.');
  console.log('========================================\n');

  if (!interactiveSession) {
    console.log('  Non-interactive run detected. Skipping manual review pause.');
    console.log('========================================\n');
    return;
  }

  await waitForEnter();
}

export async function waitForEnter(message?: string): Promise<void> {
  if (message) console.log(message);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('[INFO] Non-interactive session detected. Continuing without waiting for ENTER.');
    return;
  }

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
