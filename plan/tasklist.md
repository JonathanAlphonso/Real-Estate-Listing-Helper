# Real Estate Listing Helper - Task List

> Verified against the current codebase on 2026-04-10.
> `[x]` = implemented in code, `[ ]` = still missing / not fully verified.
> Task wording was updated where the project now uses per-property CSV output or endpoint-based extraction instead of the original spreadsheet / DOM-selector assumptions.

## Phase 1: Fix Scaffolding Gaps

- [x] 1.1 - Add artifact directory auto-creation in `src/browser.ts` (`takeScreenshot`) and `src/index.ts` before any step runs
- [x] 1.2 - Add input validation for address argument (non-empty, reasonable format)
- [x] ~~1.3 - No API keys needed (description generation is interactive)~~
- [x] 1.4 - Fix `run-step.ts` to accept an optional `--spreadsheet <path>` flag so steps 4-8 can reuse an existing property CSV instead of always creating a blank one
- [x] 1.5 - Add `.gitkeep` to `data/` so the directory is tracked but contents are ignored

## Phase 2: Selector Discovery - TRREB Portal & Realm

These tasks require hands-on browser interaction. Run `npm run step -- <N> "address"` with debug mode to open Playwright Inspector.

- [x] 2.1 - Run step 1, log into the TRREB portal, and identify the correct post-login indicator selector (e.g., a dashboard element, nav bar, or logout link)
- [x] 2.2 - Update `config/selectors/realm.ts` -> `postLoginIndicator` with the real selector
- [x] 2.3 - Navigate to Realm manually, identify the search input and search button selectors
- [x] 2.4 - Update `config/selectors/realm.ts` -> `searchInput`, `searchButton`
- [x] 2.5 - Perform a property search, identify how results are displayed in the current historical search flow (table view + listing links)
- [x] 2.6 - Update `config/selectors/realm.ts` -> `resultsTable`, `resultRow`, `resultAddress`
- [x] 2.7 - Verify the property detail view exposes the required data points and that `src/steps/02-realm-search.ts` can extract them from the current section-based DOM
- [x] 2.8 - Keep `config/selectors/realm.ts` focused on entry points and section anchors; per-field extraction now lives in `src/steps/02-realm-search.ts`
- [x] 2.9 - Find the sales history source in the current Realm flow (UI section and/or listing history endpoint)
- [x] 2.10 - Update prior-sale extraction to match the current app (`salesHistory*` selectors retained, `/history` endpoint used in step 2)
- [x] 2.11 - Confirm comparable data comes from the `/similar` endpoint in the current Realm flow; no stable comparables table mapping is required right now
- [x] 2.12 - Keep `config/selectors/realm.ts` comparable selectors as optional probes only; main comparable extraction now lives in `fetchComparables()`
- [x] 2.13 - Update extraction logic in `src/steps/02-realm-search.ts` if the DOM structure differs from assumptions (e.g., data in divs instead of tables, different cell ordering)
- [x] 2.14 - Test step 2 end-to-end with a real property address and verify property CSV output

## Phase 3: Selector Discovery - Geowarehouse

- [x] 3.1 - Navigate to Geowarehouse and confirm access is handed off from PropTx SSO rather than requiring a separate login
- [x] 3.2 - Identify post-login indicator selector
- [x] 3.3 - Update `config/selectors/geowarehouse.ts` -> `postLoginIndicator`
- [x] 3.4 - PropTx SSO handoff is the active path; standalone Geowarehouse login handling is not required right now
- [x] 3.5 - Identify the property search input and button selectors
- [x] 3.6 - Update `config/selectors/geowarehouse.ts` -> `searchInput`, `searchButton`
- [x] 3.7 - Perform a search and replace the current generic result-click heuristics with a verified results list structure
- [x] 3.8 - Update `config/selectors/geowarehouse.ts` with stable `resultsList` / `resultItem` selectors
- [x] 3.9 - Finish mapping all detail fields needed from the current Geowarehouse panels (PIN, legal description, municipal address, municipality, lot dimensions, lot area, registered owners, assessed value, property class, instrument number, registration date)
- [x] 3.10 - Move the verified detail-field selectors / IDs into `config/selectors/geowarehouse.ts` instead of relying on hardcoded IDs inside `src/steps/03-geowarehouse.ts`
- [x] 3.11 - Normalize registered owners reliably whether Geowarehouse renders a list, a flat string, or multiple separators
- [x] 3.12 - Test step 3 end-to-end with a real property and verify property CSV output

## Phase 4: Selector Discovery - SkySlope Forms

- [x] 4.1 - Navigate to SkySlope Forms, identify the login page structure
- [x] 4.2 - Identify post-login indicator selector
- [x] 4.3 - Update `config/selectors/skyslope.ts` -> `postLoginIndicator`
- [x] 4.4 - Identify the "New Transaction" / "Create" button
- [x] 4.5 - Walk through creating a new listing transaction manually - note every field and button
- [x] 4.6 - Update `config/selectors/skyslope.ts` for the current `/create` flow (`newTransactionButton`, `transactionTypeSelect`, `propertyAddressInput`, `createTransactionSubmit`, plus the required file-creation inputs)
- [x] 4.7 - Identify how to add forms to a transaction (button location, search flow, selection mechanism)
- [x] 4.8 - Update `config/selectors/skyslope.ts` -> `addFormButton`, `formSearchInput`, `form271Option`, `form290Option`, `addSelectedFormButton`
- [ ] 4.9 - Open Form 271 (Listing Agreement) and map every fillable field selector
- [ ] 4.10 - Update `config/selectors/skyslope.ts` -> `form271.*` with real selectors
- [ ] 4.11 - Finish mapping the full set of Form 290 fillable fields; the current code only covers a verified subset of text fields and checkbox groups
- [x] 4.12 - Store the verified Form 290 subset in `config/selectors/skyslope.ts` as `form290Text` / `form290Checkboxes`
- [x] 4.13 - Determine if SkySlope forms use iframes, shadow DOM, or PDF viewers; current PropTx editor works from the main DOM without special iframe handling
- [ ] 4.14 - Continue updating `config/field-mappings.ts` for any additional Form 271 / Form 290 fields needed beyond the current subset
- [ ] 4.15 - Complete step 6 end-to-end once the workflow collects the seller / contact metadata required by SkySlope `/create`
- [ ] 4.16 - Test step 7 (fill forms) end-to-end with real property CSV data and verify save / reopen persistence

## Phase 5: Step Logic Fixes & Edge Cases

- [ ] 5.1 - Improve Realm no-results handling beyond the current broad-search retry (clear remediation guidance / alternate search strategy)
- [ ] 5.2 - Handle Realm search returning multiple matches (prompt user to pick the correct one instead of auto-selecting first)
- [ ] 5.3 - Handle Geowarehouse returning no results or multiple PINs
- [ ] 5.4 - Handle SkySlope form fields that are dropdowns vs text inputs vs radio buttons; step 07 currently handles text + checkboxes but not full control coverage
- [ ] 5.5 - Handle SkySlope session timeout mid-workflow (detect re-login prompt, wait for manual re-login, continue)
- [x] 5.6 - Ensure `run-step.ts` can load an existing property CSV for steps 4-8 (from task 1.4)
- [x] 5.7 - Handle Realm access via TRREB / PropTx SSO vs the direct Realm auth URL; step 02 now opens `auth/amp` and selects Member access when needed
- [ ] 5.8 - Validate that property CSV data types are correct before filling forms (e.g., price is numeric, dates are formatted correctly for SkySlope inputs)

## Phase 6: Resilience & Error Handling

- [ ] 6.1 - Add retry wrapper for selector resolution with configurable timeout and retry count
- [ ] 6.2 - Add screenshot-on-failure to every step (current coverage is partial: orchestrator + selected step screenshots)
- [ ] 6.3 - Add structured logging with timestamps (replace raw `console.log` with a logger that writes to both console and an ignored artifact log file)
- [ ] 6.4 - Add page load timeout handling (some steps have custom wait loops, but there is no shared slow-page handling yet)
- [x] ~~6.5 - No environment variables required~~
- [ ] 6.6 - Save workflow state to a JSON file after each step so `--from-step` can restore the full `WorkflowContext` (currently a resumed run starts with empty `ctx.data`)

## Phase 7: Listing Description Quality

- [ ] 7.1 - Test the interactive description flow (template suggestion + paste-your-own) with real property data
- [ ] 7.2 - Refine the template in `src/description-generator.ts` - test with several property types (detached, semi, condo, townhouse) and adjust wording
- [ ] 7.3 - Verify the copy-paste prompt prints property details in a format that works well when pasted into an LLM tool
- [ ] 7.4 - Test regenerating a description with `npm run step -- 8 "address" --spreadsheet data/properties/<property>/property-data.csv`

## Phase 8: End-to-End Testing

- [ ] 8.1 - Run the full workflow (steps 1-8) against a real property with a TRREB account
- [ ] 8.2 - Verify the property CSV has correct data for `property`, `realm`, `geowarehouse`, and comparable rows
- [ ] 8.3 - Verify SkySlope transaction was created with both forms
- [ ] 8.4 - Verify all form fields are filled correctly - compare against property CSV data
- [ ] 8.5 - Verify listing description appears in both the property CSV and Form 290
- [ ] 8.6 - Test `--from-step` resume from each step (1-8)
- [ ] 8.7 - Test with a property that has no prior sales (comparables path)
- [ ] 8.8 - Test with a condo (unit number, different property type)
- [ ] 8.9 - Test with a property that has incomplete Geowarehouse data (missing fields shouldn't crash)
- [ ] 8.10 - Fix any issues found during end-to-end testing

## Phase 9: Polish

- [ ] 9.1 - Add a `--dry-run` flag that goes through steps 1-4 only (data gathering + review, no SkySlope)
- [ ] 9.2 - Add a summary printout at the end showing which fields were filled and which were skipped
- [ ] 9.3 - Add color to console output (green for success, yellow for skipped, red for errors)
- [ ] 9.4 - Document any portal-specific quirks discovered during testing in `CLAUDE.md` and reconcile the doc with the property CSV workflow
- [ ] 9.5 - Clean up placeholder selectors and legacy spreadsheet wording that were replaced during discovery

## Phase 10: Simple CLI Packaging & Non-Technical User Experience

- [ ] 10.1 - Define the final end-user install model: `npm` global package, standalone bundled binary, or packaged desktop-like CLI wrapper
- [ ] 10.2 - Add a single entry command with a beginner-friendly name and help text (e.g. `listing-helper`)
- [ ] 10.3 - Replace argument-only flows with guided interactive prompts when required inputs are missing
- [ ] 10.4 - Add a startup check that verifies browser profile, writable `data/` paths, and runtime dependencies with clear remediation steps
- [ ] 10.5 - Add plain-language progress output so non-technical users always know what the tool is waiting for
- [ ] 10.6 - Add plain-language fatal error messages that explain what happened and what the user should do next
- [ ] 10.7 - Add a first-run setup flow for Playwright/browser installation if required
- [ ] 10.8 - Add a distributable build target so the project can be shipped as a simple CLI package
- [ ] 10.9 - Write end-user documentation for install, first run, login expectations, resume flow, and where files are saved
- [ ] 10.10 - Test the packaged CLI on a clean machine/user profile with no repo context and fix any usability issues found
