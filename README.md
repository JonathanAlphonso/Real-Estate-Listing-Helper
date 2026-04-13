# Real Estate Listing Helper

Playwright-based automation for collecting Ontario property data and filling SkySlope listing forms from a single canonical CSV.

## What It Does

The workflow is organized as eight steps:

1. Log into the TRREB/PropTx portal.
2. Pull listing and historical data from Realm.
3. Pull legal and ownership data from Geowarehouse.
4. Pause for human review of the property CSV.
5. Log into SkySlope Forms.
6. Create the file and add required forms.
7. Fill supported form fields from the reviewed CSV.
8. Generate a listing description and write it back to the CSV.

The main artifact for each property is:

- `data/properties/<sanitized-address>/property-data.csv`

That CSV is the source of truth across reruns and resume flows.

## Requirements

- Node.js 20+
- npm
- A local Chrome/Chromium environment supported by Playwright
- Valid PropTx and SkySlope credentials
- Manual access to PropTx 2FA when logging in

## Installation

```bash
npm install
```

## Environment

Create a local `.env` file in the project root. The repo includes `.env.example` with placeholders.

Required for unattended login support:

- `PROPTX_USERNAME`
- `PROPTX_PASSWORD`
- `SKYSLOPE_EMAIL`
- `SKYSLOPE_PASSWORD`

Optional fallbacks:

- `SKYSLOPE_CLIENT_EMAIL`
- `SKYSLOPE_DEFAULT_COUNTY`
- `BROWSER_PROFILE_DIR`

Notes:

- PropTx still requires manual SMS-based 2FA.
- Browser state is stored under `artifacts/browser-data/` by default unless `BROWSER_PROFILE_DIR` is set.

## Commands

Run the full workflow:

```bash
npm run start -- "123 Main St, Toronto, ON"
```

Resume from a specific step:

```bash
npm run start -- "123 Main St, Toronto, ON" --from-step 5
```

Run the full workflow with debug mode enabled:

```bash
npm run start -- "123 Main St, Toronto, ON" --debug
```

Run a single step:

```bash
npm run step -- 6 "123 Main St, Toronto, ON"
```

Run a single step against an existing property CSV:

```bash
npm run step -- 7 --spreadsheet "data/properties/123-main-st-toronto-on/property-data.csv"
```

Run only the property-data portion of the workflow:

```bash
npm run property-data -- "123 Main St, Toronto, ON"
```

Build and test:

```bash
npm run build
npm test
```

## Project Structure

- `src/index.ts`: full eight-step workflow runner
- `scripts/run-step.ts`: single-step runner for debugging and recovery
- `scripts/run-property-data.ts`: steps 1-3 only
- `src/steps/`: step implementations
- `src/spreadsheet.ts`: CSV creation, reuse, validation, and updates
- `src/skyslope-data.ts`: normalization and derived values for SkySlope fields
- `config/field-mappings.ts`: canonical field mappings
- `config/selectors/`: portal selectors
- `config/defaults.ts`: fallback values for SkySlope form fields

## Data Model

The property CSV uses this schema:

- `source,field,value`

Expected `source` values include:

- `property`
- `realm`
- `geowarehouse`
- `generated`

Design constraints:

- Existing property CSV files are reused on rerun.
- Resume flows should not wipe prior human edits.
- Derived/default values are resolved separately from raw scraped values.

## Artifacts

Generated runtime output is intentionally ignored from Git:

- `artifacts/`: screenshots, browser state, and other runtime output
- `data/`: per-property CSV files
- `.env`: local credentials
- `.claude/`: local Codex/Claude agent settings

## Operational Notes

- SkySlope automation assumes explicit page-state transitions and does not rely on the previous step leaving the browser in the correct place.
- If a step fails, the runner captures a debug screenshot and prints the `--from-step` command needed to resume.
- The description-generation step always writes the generated description to the CSV even when the live form does not expose an editable description field.

## Safety

This repository is intended to be shared without live credentials or customer/property data.

Before publishing changes, verify that you are not committing:

- `.env`
- `artifacts/`
- `data/properties/*`
- browser profile directories
- any local tool settings under `.claude/`
