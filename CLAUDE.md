# Real Estate Listing Helper

Playwright-based automation tool that gathers Ontario real estate property data and fills out SkySlope listing forms.

## Project Overview

This tool automates the workflow of creating a new real estate listing by:
1. Logging into the TRREB realtor portal (manual login, script waits)
2. Pulling property data from Realm (prior sales or comparables)
3. Pulling legal/ownership data from Geowarehouse
4. Letting the human review all data in an Excel spreadsheet
5. Logging into SkySlope Forms (manual login, script waits)
6. Creating a new listing transaction with Form 271 (Listing Agreement) and Form 290 (MLS Data Info)
7. Auto-filling form fields from the spreadsheet
8. Generating a one-line listing description (interactive — paste from claude.ai or accept template)

## Tech Stack

- **TypeScript** with `tsx` for direct execution (no build step needed during dev)
- **Playwright** in headed mode with persistent browser context (cookies survive between runs)
- **ExcelJS** for spreadsheet read/write
- **No API keys required** — description generation is interactive (user pastes from their Claude subscription or accepts the auto-generated template)
- **ESM modules** (`"type": "module"` in package.json)

## Commands

```bash
# Full workflow
npm run start -- "123 Main St, Toronto, ON"

# Resume from a specific step (1-8)
npm run start -- "123 Main St, Toronto, ON" --from-step 5

# Run a single step in debug mode (opens Playwright Inspector)
npm run step -- <step-number> "123 Main St, Toronto, ON"

# Full workflow with debug mode
npm run start -- "123 Main St, Toronto, ON" --debug

# Type-check
npx tsc --noEmit
```

## Architecture

### Data Flow

The **spreadsheet** (`data/*.xlsx`) is the central data interchange artifact:
- Steps 2-3 write data into it (Realm + Geowarehouse worksheets)
- Step 4 opens it for human review/editing
- Steps 7-8 read from it to fill forms and generate the description

### Key Directories

- `config/selectors/` — DOM selectors for each portal. **These are the most frequently edited files.** Selectors are placeholders until discovered via Playwright Inspector.
- `config/field-mappings.ts` — Single source of truth mapping canonical field names to spreadsheet columns and SkySlope form selectors.
- `config/urls.ts` — All portal base URLs.
- `src/steps/` — Each step is an independent module exporting `async run(ctx)`. Steps can be run individually via `npm run step`.
- `src/types/` — TypeScript interfaces for property data and workflow state.

### Workflow Steps

| Step | File | What it does |
|------|------|-------------|
| 1 | `src/steps/01-portal-login.ts` | Opens TRREB portal, waits for manual login |
| 2 | `src/steps/02-realm-search.ts` | Searches Realm for property, extracts prior sale or comparables |
| 3 | `src/steps/03-geowarehouse.ts` | Looks up property in Geowarehouse (PIN, legal desc, owners) |
| 4 | `src/steps/04-human-review.ts` | Opens spreadsheet in Excel, waits for user to press Enter |
| 5 | `src/steps/05-skyslope-login.ts` | Opens SkySlope Forms, waits for manual login |
| 6 | `src/steps/06-skyslope-add-forms.ts` | Creates transaction, adds Form 271 + Form 290 |
| 7 | `src/steps/07-skyslope-fill.ts` | Fills form fields from spreadsheet data |
| 8 | `src/steps/08-generate-description.ts` | Prompts for listing description (template suggestion + paste-your-own), saves to spreadsheet + form |

## Development Guidelines

### Selector Discovery

All DOM selectors in `config/selectors/` are placeholders. To discover real selectors:

1. Run a step with debug mode: `npm run step -- 2 "123 Main St"`
2. Playwright Inspector opens — use it to find correct selectors
3. Update the corresponding file in `config/selectors/`
4. Re-run the step to verify

Prefer selectors in this order of resilience:
1. `data-testid` attributes
2. ARIA roles/labels (`page.getByRole(...)`)
3. Text content (`page.getByText(...)`)
4. CSS selectors (keep shallow)

Use comma-separated fallback chains in selector strings for resilience.

### Adding New Form Fields

1. Add the field to the relevant interface in `src/types/property-data.ts`
2. Add extraction logic in the appropriate step (02 or 03)
3. Add the mapping in `config/field-mappings.ts` (spreadsheet column + form selector key)
4. Add the DOM selector in `config/selectors/skyslope.ts` under the relevant form
5. The fill logic in step 07 will automatically pick it up from the mapping

### Browser Context

The browser uses a persistent context stored in `browser-profile/` (gitignored). This means:
- Login sessions persist between runs — you won't need to re-login every time
- To force a fresh session, delete the `browser-profile/` directory

### Error Handling

When a step fails:
- A debug screenshot is saved to `data/debug/`
- The console shows the exact `--from-step` command to resume
- Fix the issue (usually a selector) and re-run from that step

## Environment Variables

No API keys or environment variables are required. The listing description in step 8 is interactive — the script generates a template suggestion and prints all property details so you can paste them into claude.ai to get a polished description.
