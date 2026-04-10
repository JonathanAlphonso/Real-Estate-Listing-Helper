import type { Page, BrowserContext } from 'playwright';
import type { PropertyData } from './property-data.js';

export interface WorkflowContext {
  page: Page;
  context: BrowserContext;
  address: string;
  spreadsheetPath: string;
  data: Partial<PropertyData>;
  debug: boolean;
}

export interface StepModule {
  run(ctx: WorkflowContext): Promise<void>;
}
