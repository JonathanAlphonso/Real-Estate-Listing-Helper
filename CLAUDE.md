# Real Estate Listing Helper

Playwright-based automation tool that gathers Ontario real estate property data and fills out SkySlope listing forms.

## Project Overview

This tool automates the workflow of creating a new real estate listing by:
1. Logging into the TRREB realtor portal and establishing the PropTx session.
2. Pulling historical property data from Realm.
3. Pulling legal and ownership data from Geowarehouse.
4. Opening the property CSV for human review and edits.
5. Logging into SkySlope Forms.
6. Creating a listing file and adding Form 271 and Form 290.
7. Filling SkySlope forms from reviewed CSV data plus derived/default values.
8. Generating and writing a listing description back to the CSV and Form 290.

## Tech Stack

- TypeScript with `tsx` for direct execution
- Playwright in headed mode with a persistent browser profile
- CSV-based state in `source,field,value` format
- ESM modules (`"type": "module"`)

## Commands

```bash
# Full workflow
npm run start -- "123 Main St, Toronto, ON"

# Resume from a specific step. Existing property data is reused.
npm run start -- "123 Main St, Toronto, ON" --from-step 5

# Run a single step in debug mode
npm run step -- <step-number> "123 Main St, Toronto, ON"

# Property-data-only flow (steps 1-3)
npm run property-data -- "123 Main St, Toronto, ON"

# Tests and build
npm test
npm run build
```

## Data Model

The canonical artifact for each property is:
- `data/properties/<sanitized-address>/property-data.csv`

Schema:
- `source,field,value`

The `source` column separates concerns:
- `property`
- `realm`
- `geowarehouse`
- `generated`

The `property` source now carries first-class fields used later by SkySlope:
- `Property Address`
- `City`
- `Province`
- `Postal Code`
- `County`
- `Seller Name`
- `Seller Email`
- `SkySlope File URL`

Important invariants:
- Reruns must reuse the existing property CSV.
- Resume flows must not wipe previously gathered data or human edits.
- New schema rows must be backfilled into older property CSVs when they are reused.

## Core Files

- `config/field-mappings.ts`: canonical field names to CSV columns and form selectors
- `config/defaults.ts`: fallback values for Form 290
- `config/selectors/`: portal selectors
- `src/spreadsheet.ts`: CSV creation, reading, validation, and row replacement
- `src/skyslope.ts`: shared SkySlope page-state helpers
- `src/skyslope-data.ts`: address parsing, county inference, contact parsing, and normalized 290 value resolution
- `src/steps/`: independent workflow steps

## SkySlope State Model

Treat SkySlope as an explicit page-state machine:
- `/add-forms`
- `/documents`
- `/fill/envelope/...`

Rules:
- Step 6 must end on `/documents`.
- Steps 7 and 8 must explicitly open the target form from `/documents`.
- Do not assume the browser is already on the correct page because a previous step touched SkySlope.
- Saving must return to `/documents`; if it does not, treat that as a failure.

## Value Resolution Rules

For Form 290, values are resolved in this order:
1. Direct CSV value for the field's mapped column
2. Derived value from related CSV fields
3. Default value from `config/defaults.ts`

Examples of derived values:
- `garageType` from `Garage`
- `garageParkingSpaces` from `Parking`
- `driveway` and `drivewayParkingSpaces` from `Parking`
- `approxSquareFootage` from `Square Footage`
- `county` from inferred municipality or city

Do not add one-off parsing directly inside step logic when the behavior belongs in `src/skyslope-data.ts`.

## Login Auto-Fill

Every login step must attempt to auto-fill credentials from `.env` before falling back to manual login. Never leave login fields empty when environment variables are available. This applies to all portals (PropTx, SkySlope, and any future login steps).

- `PROPTX_USERNAME` / `PROPTX_PASSWORD` for PropTx (Step 1). Note: PropTx requires SMS 2FA, so the script fills credentials then waits for the user to complete 2FA.
- `SKYSLOPE_EMAIL` / `SKYSLOPE_PASSWORD` for SkySlope (Step 5).

When adding new login steps, follow the same pattern: try env-var auto-fill first, then fall back to waiting for manual login.

## Error Handling

When a step fails:
- Save a debug screenshot under `artifacts/images/`
- Exit non-zero
- Print the exact `--from-step` command to resume

Do not print `Workflow complete!` after a failed step.

## Environment Variables

Commonly used:
- `SKYSLOPE_EMAIL`
- `SKYSLOPE_PASSWORD`

Optional create-file fallbacks:
- `SKYSLOPE_CLIENT_EMAIL`
- `SKYSLOPE_DEFAULT_COUNTY`
- `BROWSER_PROFILE_DIR`

Artifact locations:
- Images are written to `artifacts/images/`
- Browser profiles and saved auth state are written to `artifacts/browser-data/` by default

Description generation remains interactive and does not require an API key.

## Form Notes

### Form 290

- The main automation target.
- Uses a mix of text inputs and checkbox mappings.
- Text fields are written via controlled-input event dispatch, not plain `fill()` when persistence depends on React dirty tracking.

### Form 271

- Opened explicitly from the documents page.
- The live editor currently auto-populates the key seller and address content from file creation.
- Step 7 now verifies that prepopulation and only fills the fields that are still editable.

## Verification Expectations

After modifying live-form automation:
1. Run the relevant step or flow against the real portal.
2. Capture screenshots.
3. Confirm the browser actually transitioned through the expected SkySlope states.
4. Do not trust DOM writes alone; verify save/navigation behavior.

### Form 290 description caveat
The current live 290 editor did not expose an editable description field during verification.
Step 8 still writes the generated description to the canonical CSV and attempts to find a real field in the editor.
If no such field exists, it leaves the form unchanged, captures a screenshot, and exits cleanly instead of failing.

## Development Guidance

- Prefer adding normalization in `src/skyslope-data.ts` over scattering string parsing across steps.
- Prefer adding selectors in config over embedding raw selectors in step files.
- Keep CSV writes source-scoped. Do not mix property, realm, and geowarehouse rows casually.
- If a live portal changes, update selectors or page-state helpers first, then the step logic.
