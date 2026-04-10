# Real Estate Listing Helper - Task List

## Phase 1: Fix Scaffolding Gaps

- [x] 1.1 - Add `data/` and `data/debug/` directory auto-creation in `src/browser.ts` (`takeScreenshot`) and `src/index.ts` before any step runs
- [x] 1.2 - Add input validation for address argument (non-empty, reasonable format)
- [x] ~~1.3 - No API keys needed (description generation is interactive)~~
- [x] 1.4 - Fix `run-step.ts` to accept an optional `--spreadsheet <path>` flag so steps 4-8 can reuse an existing spreadsheet instead of always creating a blank one
- [x] 1.5 - Add `.gitkeep` to `data/` so the directory is tracked but contents are ignored

## Phase 2: Selector Discovery - TRREB Portal & Realm

These tasks require hands-on browser interaction. Run `npm run step -- <N> "address"` with debug mode to open Playwright Inspector.

- [ ] 2.1 - Run step 1, log into the TRREB portal, and identify the correct post-login indicator selector (e.g., a dashboard element, nav bar, or logout link)
- [ ] 2.2 - Update `config/selectors/realm.ts` -> `postLoginIndicator` with the real selector
- [ ] 2.3 - Navigate to Realm manually, identify the search input and search button selectors
- [ ] 2.4 - Update `config/selectors/realm.ts` -> `searchInput`, `searchButton`
- [ ] 2.5 - Perform a property search, identify how results are displayed (table, cards, list)
- [ ] 2.6 - Update `config/selectors/realm.ts` -> `resultsTable`, `resultRow`, `resultAddress`
- [ ] 2.7 - Click into a property detail page, map every field selector (price, beds, baths, sqft, lot, year built, garage, parking, basement, heating, cooling, taxes)
- [ ] 2.8 - Update `config/selectors/realm.ts` with all property detail selectors
- [ ] 2.9 - Find the sales history section - identify how prior sales are displayed
- [ ] 2.10 - Update `config/selectors/realm.ts` -> `salesHistoryTab`, `salesHistoryTable`, `salesHistoryRow`
- [ ] 2.11 - Find the comparables section - identify table structure and cell order
- [ ] 2.12 - Update `config/selectors/realm.ts` -> `comparablesTab`, `comparablesTable`, `comparableRow`
- [ ] 2.13 - Update extraction logic in `src/steps/02-realm-search.ts` if the DOM structure differs from assumptions (e.g., data in divs instead of tables, different cell ordering)
- [ ] 2.14 - Test step 2 end-to-end with a real property address and verify spreadsheet output

## Phase 3: Selector Discovery - Geowarehouse

- [ ] 3.1 - Navigate to Geowarehouse, determine if login is separate from TRREB or uses SSO
- [ ] 3.2 - Identify post-login indicator selector
- [ ] 3.3 - Update `config/selectors/geowarehouse.ts` -> `postLoginIndicator`
- [ ] 3.4 - If login is separate, update `src/steps/03-geowarehouse.ts` to handle the login flow properly (may need its own login URL in `config/urls.ts`)
- [ ] 3.5 - Identify the property search input and button selectors
- [ ] 3.6 - Update `config/selectors/geowarehouse.ts` -> `searchInput`, `searchButton`
- [ ] 3.7 - Perform a search, identify results list structure
- [ ] 3.8 - Update `config/selectors/geowarehouse.ts` -> `resultsList`, `resultItem`
- [ ] 3.9 - Click into a property, map all detail field selectors (PIN, legal description, municipal address, municipality, lot dimensions, lot area, registered owners, assessed value, property class, instrument number, registration date)
- [ ] 3.10 - Update `config/selectors/geowarehouse.ts` with all detail selectors
- [ ] 3.11 - Handle the case where registered owners are displayed as a list vs a single field - update extraction logic in `src/steps/03-geowarehouse.ts`
- [ ] 3.12 - Test step 3 end-to-end with a real property and verify spreadsheet output

## Phase 4: Selector Discovery - SkySlope Forms

- [ ] 4.1 - Navigate to SkySlope Forms, identify the login page structure
- [ ] 4.2 - Identify post-login indicator selector
- [ ] 4.3 - Update `config/selectors/skyslope.ts` -> `postLoginIndicator`
- [ ] 4.4 - Identify the "New Transaction" / "Create" button
- [ ] 4.5 - Walk through creating a new listing transaction manually - note every field and button
- [ ] 4.6 - Update `config/selectors/skyslope.ts` -> `newTransactionButton`, `transactionTypeSelect`, `propertyAddressInput`, `createTransactionSubmit`
- [ ] 4.7 - Identify how to add forms to a transaction (button location, search flow, selection mechanism)
- [ ] 4.8 - Update `config/selectors/skyslope.ts` -> `addFormButton`, `formSearchInput`, `form271Option`, `form290Option`, `addSelectedFormButton`
- [ ] 4.9 - Open Form 271 (Listing Agreement) and map every fillable field selector
- [ ] 4.10 - Update `config/selectors/skyslope.ts` -> `form271.*` with real selectors
- [ ] 4.11 - Open Form 290 (MLS Data Info) and map every fillable field selector
- [ ] 4.12 - Update `config/selectors/skyslope.ts` -> `form290.*` with real selectors
- [ ] 4.13 - Determine if SkySlope forms use iframes, shadow DOM, or PDF viewers - if so, update step 07 fill logic to handle these
- [ ] 4.14 - Update `config/field-mappings.ts` with any new fields discovered in Forms 271/290 that aren't in the current mapping
- [ ] 4.15 - Test step 6 (add forms) end-to-end
- [ ] 4.16 - Test step 7 (fill forms) end-to-end with real spreadsheet data

## Phase 5: Step Logic Fixes & Edge Cases

- [ ] 5.1 - Handle Realm returning no results for an address (show clear error message, suggest alternate search)
- [ ] 5.2 - Handle Realm search returning multiple matches (prompt user to pick the correct one instead of auto-selecting first)
- [ ] 5.3 - Handle Geowarehouse returning no results or multiple PINs
- [ ] 5.4 - Handle SkySlope form fields that are dropdowns vs text inputs vs radio buttons - step 07 currently handles select/textarea/checkbox but may miss radio groups or custom components
- [ ] 5.5 - Handle SkySlope session timeout mid-workflow (detect re-login prompt, wait for manual re-login, continue)
- [ ] 5.6 - Ensure `run-step.ts` can load an existing spreadsheet for steps 4-8 (from task 1.4)
- [ ] 5.7 - Handle the case where Realm is accessed via TRREB portal SSO vs direct URL - update navigation logic in step 02 if needed
- [ ] 5.8 - Validate that spreadsheet data types are correct before filling forms (e.g., price is numeric, dates are formatted correctly for SkySlope inputs)

## Phase 6: Resilience & Error Handling

- [ ] 6.1 - Add retry wrapper for selector resolution with configurable timeout and retry count
- [ ] 6.2 - Add screenshot-on-failure to every step (currently only in the orchestrator catch block)
- [ ] 6.3 - Add structured logging with timestamps (replace raw `console.log` with a logger that writes to both console and `data/debug/run.log`)
- [ ] 6.4 - Add page load timeout handling (portals can be slow - detect and warn instead of crashing)
- [x] ~~6.5 - No environment variables required~~
- [ ] 6.6 - Save workflow state to a JSON file after each step so `--from-step` can restore the full `WorkflowContext` (currently a resumed run starts with empty `ctx.data`)

## Phase 7: Listing Description Quality

- [ ] 7.1 - Test the interactive description flow (template suggestion + paste-your-own) with real property data
- [ ] 7.2 - Refine the template in `src/description-generator.ts` - test with several property types (detached, semi, condo, townhouse) and adjust wording
- [ ] 7.3 - Verify the copy-paste prompt prints property details in a format that works well when pasted into claude.ai
- [ ] 7.4 - Test regenerating a description with `npm run step -- 8 "address" --spreadsheet data/existing.xlsx`

## Phase 8: End-to-End Testing

- [ ] 8.1 - Run the full workflow (steps 1-8) against a real property with a TRREB account
- [ ] 8.2 - Verify spreadsheet has correct data in all worksheets (PropertyData, Realm, Geowarehouse, Comparables)
- [ ] 8.3 - Verify SkySlope transaction was created with both forms
- [ ] 8.4 - Verify all form fields are filled correctly - compare against spreadsheet data
- [ ] 8.5 - Verify listing description appears in both the spreadsheet and Form 290
- [ ] 8.6 - Test `--from-step` resume from each step (1-8)
- [ ] 8.7 - Test with a property that has no prior sales (comparables path)
- [ ] 8.8 - Test with a condo (unit number, different property type)
- [ ] 8.9 - Test with a property that has incomplete Geowarehouse data (missing fields shouldn't crash)
- [ ] 8.10 - Fix any issues found during end-to-end testing

## Phase 9: Polish

- [ ] 9.1 - Add a `--dry-run` flag that goes through steps 1-4 only (data gathering + review, no SkySlope)
- [ ] 9.2 - Add a summary printout at the end showing which fields were filled and which were skipped
- [ ] 9.3 - Add color to console output (green for success, yellow for skipped, red for errors)
- [ ] 9.4 - Document any portal-specific quirks discovered during testing in `CLAUDE.md`
- [ ] 9.5 - Clean up any unused placeholder selectors that were replaced

## Phase 10: Simple CLI Packaging & Non-Technical User Experience

- [ ] 10.1 - Define the final end-user install model: `npm` global package, standalone bundled binary, or packaged desktop-like CLI wrapper
- [ ] 10.2 - Add a single entry command with a beginner-friendly name and help text (e.g. `listing-helper`)
- [ ] 10.3 - Replace argument-only flows with guided interactive prompts when required inputs are missing
- [ ] 10.4 - Add a startup check that verifies browser profile, writable `data/` paths, and spreadsheet dependencies with clear remediation steps
- [ ] 10.5 - Add plain-language progress output so non-technical users always know what the tool is waiting for
- [ ] 10.6 - Add plain-language fatal error messages that explain what happened and what the user should do next
- [ ] 10.7 - Add a first-run setup flow for Playwright/browser installation if required
- [ ] 10.8 - Add a distributable build target so the project can be shipped as a simple CLI package
- [ ] 10.9 - Write end-user documentation for install, first run, login expectations, resume flow, and where files are saved
- [ ] 10.10 - Test the packaged CLI on a clean machine/user profile with no repo context and fix any usability issues found
