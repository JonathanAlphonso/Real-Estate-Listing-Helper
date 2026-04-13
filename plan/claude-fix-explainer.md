# Claude Fix Explainer

Date: 2026-04-10

This document explains the automation fixes that were applied after the audit. It is meant to give the next model enough context to continue work without re-deriving the same assumptions.

## What changed

### 1. Property CSV creation is now idempotent

Files:
- `src/spreadsheet.ts`
- `src/index.ts`
- `scripts/run-step.ts`
- `scripts/run-property-data.ts`
- `test/property-csv.test.ts`

Before:
- `createWorkbook()` always rewrote `property-data.csv`.
- `npm run start -- ... --from-step N` could silently wipe prior Realm/Geowarehouse data and human edits before resuming.

Now:
- `createWorkbook()` reuses an existing property CSV if one already exists.
- It only backfills the `property:Property Address` row when that row is missing.
- Older property CSVs are upgraded in place with any newly introduced `property` rows.
- The command entrypoints now log `Created` vs `Reusing` so resume behavior is explicit.

Important invariant:
- A property folder should be stable across reruns.
- Resume paths must never destroy the existing CSV.

### 2. Workflow failures no longer report success

Files:
- `src/index.ts`
- `scripts/run-step.ts`

Before:
- A failed step only broke the loop.
- The process could still print `Workflow complete!`.
- Single-step runs could fail while still exiting cleanly.

Now:
- Full runs only print completion when every step completes.
- Step failures set a non-zero exit code.
- Error screenshots use `ctx.page`, not the original page handle, so popup-based failures are captured from the current browser surface.
- Screenshots are written to `artifacts/images/`, which is gitignored.

### 3. SkySlope now has explicit page-state helpers

Files:
- `src/skyslope.ts`

This is the new shared control layer for SkySlope. It provides:
- `continueFromAddFormsIfNeeded()`
- `ensureDocumentsPage()`
- `openFormEditor()`
- `leaveEditorWithoutSaving()`
- `saveAndExitForm()`
- `setControlledFieldValue()`

Why it exists:
- Steps 6, 7, and 8 previously assumed they were already on the right page.
- The flow now treats SkySlope as a state machine:
  - `/add-forms`
  - `/documents`
  - `/fill/envelope/...`

Important invariant:
- Do not fill or save forms unless the code has explicitly navigated into the editor.
- Do not assume the previous step left the browser on the right page.

### 4. Step 6 now lands deterministically on the documents page

Files:
- `src/steps/06-skyslope-add-forms.ts`
- `config/selectors/skyslope.ts`
- `.env.example`
- `src/browser.ts`
- `src/runtime.ts`

Before:
- Step 6 used timeouts and optimistic clicks.
- It added forms with an outdated picker assumption.
- It never guaranteed the handoff to `/documents`.

Now:
- It waits for the actual create page heading.
- It submits the create flow by waiting for `/file/.../(add-forms|documents)`.
- It adds forms using the per-row `Add form to list` button when available, with the old flow left as a fallback.
- It explicitly advances from `/add-forms` to `/documents`.

Additional create-file hardening:
- If SkySlope shows first name, last name, client email, or county fields, the step now fills them from available data or fails immediately with a clear message.
- Fallback env vars were added:
  - `SKYSLOPE_CLIENT_EMAIL`
  - `SKYSLOPE_DEFAULT_COUNTY`
  - `BROWSER_PROFILE_DIR` can now override the persistent profile path for disposable verification runs under `artifacts/browser-data/`.

Current data sources for create-file fields:
- First/last name: Geowarehouse owners or CSV `Seller Name`
- Email: CSV `Seller Email` or `SKYSLOPE_CLIENT_EMAIL`
- County: CSV `County` or `SKYSLOPE_DEFAULT_COUNTY`
- File name: derived from address
- The created SkySlope file URL is now written back to the property CSV as `SkySlope File URL`.

### 5. Step 7 now opens the actual form editors and keeps counts honest

Files:
- `src/steps/07-skyslope-fill.ts`
- `config/defaults.ts`

Before:
- Step 7 started filling without first opening 271/290 from the documents page.
- Checkbox mismatches were still counted as filled.
- `config/defaults.ts` was dead config.
- Save failures were swallowed.

Now:
- Step 7 opens 271 and 290 explicitly from `/documents`.
- If step 7 is resumed in a fresh browser session, it now navigates back to the saved SkySlope file via `SkySlope File URL` before opening the forms.
- 271 saves only after real edits; otherwise it exits the editor without saving and fails.
- After live verification, 271 was adjusted to verify file-level prepopulation instead of treating missing direct input selectors as a hard failure.
- 290 saves only after real edits; opening the editor and filling zero fields is now a hard failure.
- Checkbox mismatches are counted as skipped, not filled.
- `listingDefaults` is live. If CSV data is missing and a default exists for that canonical field name, step 7 uses the default and logs it.
- Save uses the shared `saveAndExitForm()` helper and fails closed.

Important invariant:
- `filled` means the automation actually resolved a selector and performed the interaction.
- Defaults are keyed by canonical field name from `fieldMappings`, not by spreadsheet column label.

### 6. Step 8 now reopens Form 290 before writing the description

Files:
- `src/steps/08-generate-description.ts`

Before:
- Step 8 tried to paste into whatever page happened to be open.
- Description writes were swallowed on failure.

Now:
- Step 8 reopens the 290 editor explicitly.
- It uses the saved `SkySlope File URL` to recover from a fresh browser launch.
- It attempts to locate a real editable description/remarks field in the current 290 editor.
- During live verification, no editable description field was exposed by the current 290 template, so step 8 now writes the description to the canonical CSV, captures a screenshot, and exits cleanly when the field is genuinely absent.

## New or updated selectors

File:
- `config/selectors/skyslope.ts`

Added:
- `formLibraryRow`
- `formRowAddButton`
- `form271Title`
- `form290Title`
- `editorIndicator`
- `descriptionField`

These were added so the new page-state helpers and add-form flow could target the live UI more directly.

## Tests and verification

Verified locally:
- `npm test`
- `npm run build`

New test coverage:
- Existing property CSVs are reused instead of being overwritten on rerun.
- Partial property-row updates no longer blank unspecified property fields.
- Address parsing, county inference, contact parsing, and 290 normalization helpers are covered by unit tests.

Artifact hygiene:
- Browser profiles and saved auth state now default to `artifacts/browser-data/default-profile`.
- Screenshots now default to `artifacts/images/`.
- Both artifact directories are gitignored so `git add .` does not pick up local session state or debug images.

## Known limitations

These were not silently papered over:
- Form 271 still has limited direct-selector coverage, but the live flow is safer now because auto-populated content is verified explicitly.
- Step 6 still depends on the SkySlope create-page fields matching the current selectors.
- The 290 mapping tables still need ongoing selector maintenance if PropTx changes template IDs.
- The current live 290 editor did not expose a writable description field to automation, so step 8 cannot guarantee writeback into the form itself.

## If you continue this work

Recommended next targets:
1. Add explicit tests for address parsing and create-file metadata resolution in step 6.
2. Move more SkySlope behavior behind pure helper functions so selector drift is easier to unit test.
3. Expand property CSV schema if `Seller Email` and `County` should become first-class reviewed fields instead of ad hoc rows.
4. Revisit 271 selectors and decide whether 271 should stay fail-closed or become an intentionally separate manual-review step.
