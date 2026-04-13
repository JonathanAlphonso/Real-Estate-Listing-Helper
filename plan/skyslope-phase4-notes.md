# SkySlope Phase 4 Discovery Notes

Date: 2026-04-09

## What was completed

- Logged into SkySlope Forms through the embedded Okta flow on `https://skyslope.com/forms-login/`.
- Confirmed the post-login dashboard is the Forms SPA at `https://forms.skyslope.com/?tab=all`.
- Created a dummy seller file named `123 Maple Grove Ave - Dummy Automation Listing`.
- Added both target forms:
  - `271 Seller Designated Representation Agreement Authority to Offer for Sale - PropTx-OREA`
  - `290 Freehold - Sale MLS Data Information Form - PropTx-OREA`
- Filled a dummy `290 Freehold - Sale MLS Data Information Form - PropTx-OREA` with fake but valid-looking data.

## Dummy data used

- Client: `Jordan Mercer`
- Email: `jordan.mercer@example.com`
- Address: `123 Maple Grove Ave, Brampton, ON L6Y 2K3`
- County: `Peel`
- MLS number: `W12345678`
- Assessment roll: `140701000123456`
- PIN: `06123-4567`
- Additional PIN: `06123-4568`
- Community: `Downtown Brampton`
- Lot frontage: `36.09`
- Lot depth: `101.71`
- List price: `949900`
- Taxes: `4850.00`
- Tax year: `2025`
- Assessment value: `612000`
- Assessment year: `2025`
- Year built: `2008`
- Garage spaces: `2`
- Driveway spaces: `2`
- Total parking spaces: `4`
- Rooms: `9 + 1`
- Bedrooms: `4 + 1`
- Kitchens: `1 + 0`
- Fireplaces: `1`

## Actual SkySlope flow

### Login

- The public entry page is marketing content plus an embedded Okta login widget.
- Username field selector: `input[name="identifier"]`
- Password field selector: `input[name="credentials.passcode"]`
- Next button selector: `input[type="submit"][value="Next"]`
- Safe post-login indicator: dashboard `Create` button or `/create` link.

### Create file

- The dashboard create action navigates to `/create`.
- This is not a transaction-type modal. It is a dedicated `Create Your File` page.
- Required fields observed on this page:
  - Representation (`Seller` radio for listing files)
  - Primary client first name
  - Primary client last name
  - Primary client email
  - Street address
  - City
  - Province
  - Postal code
  - County
  - File name

### Add forms

- After file creation, SkySlope lands on `/file/<id>/add-forms`.
- Forms are added one row at a time from the library search results.
- The actual action is the per-row button with `aria-label="Add form to list"`.
- There is no modal-level `Add Selected` confirmation in this account flow.
- After adding forms, use the footer `Next` button to reach `/file/<id>/documents`.

### Documents page

- Forms appear as interactive cards, not plain anchor links.
- Opening a form card launches the PropTx editor at `/fill/envelope/<id>`.
- Useful selectors:
  - 271 form card: `[aria-label*="271 Seller Designated Representation Agreement Authority to Offer for Sale"]`
  - 290 form card: `[aria-label*="290 Freehold - Sale MLS Data Information Form"]`

## PropTx editor behavior

- The editor is not running inside an iframe-based document editor.
- There is a helper iframe (`#chmln-reference-iframe`) on the page, but the form fields themselves are native `input` elements in the main DOM.
- There was no shadow DOM dependency in the live editor.
- The page selector is a Material UI dropdown with `#pageNumberDDL`.
- The editor uses page-local, absolutely positioned inputs and checkboxes over the PDF template.
- Many field ids are generated from the underlying form label plus coordinate fragments.

## Important automation findings

### Checkbox persistence — WORKS
- Playwright's `locator.check()` and `locator.uncheck()` persist correctly through Save & Exit.
- DOM `.click()` via `page.evaluate()` also works for checkboxes — the click fires React's synthetic event system.
- 26 checkboxes have been verified to persist across save/reopen cycles.

### Text field persistence — PARTIALLY WORKS
- **`locator.fill()`, `locator.type()`, `pressSequentially()`** — **DO NOT trigger PropTx's dirty tracking.** Values appear in the DOM but are NOT included in the save payload. The Save & Exit button stays disabled.
- **`page.evaluate(() => input.value = ...)` with native setter + React event dispatch** — Triggers dirty tracking (Save button enables) but text values **still do not persist** after Save & Exit and reopen in most cases.
- **File-level metadata** (MLS #, List Price, address, city, postal, county) entered via File Details or file creation **DO persist** and auto-populate into forms.
- The only text field observed to reliably persist is List Price, which comes from file metadata.

### Recommended approach for text fields
- Enter file-level data (MLS#, address, sale price) via the File Details page or file creation step.
- For form-specific text fields (lot dimensions, taxes, assessment, year built, parking counts), use the React native event dispatch approach AND keep the editor open for manual review before final submission.
- The React event dispatch pattern is:
  1. `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)`
  2. `el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))`
  3. `el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))`
  4. `el.dispatchEvent(new Event('change', { bubbles: true }))`
  5. `el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))`
- Do not rely on `page.evaluate(() => input.value = ...)` without the full event chain.

## Field-id patterns worth reusing

- Stable-enough page 1 text fields:
  - `input[id*="*MLS Number"]`
  - `input[id*="*Assessor's Parcel Number"]`
  - `input[id*="Text1111_011"]` for PIN
  - `input[id*="*List Price"]`
  - `input[id*="Text12_0"]` for lot frontage
  - `input[id*="Text13_0"]` for lot depth
  - `input[id*="Text18_0"]` for taxes
  - `input[id*="Text19_0"]` for tax year
  - `input[id*="Text20_0"]` for assessment value
  - `input[id*="Text21_0"]` for assessment year
- Stable-enough later-page fields:
  - `input[id*="*Year Built"]`
  - `input[id*="Text39_0"]` for garage parking spaces
  - `input[id*="Text65_0"]` for driveway parking spaces
  - `input[id*="Text64_0"]` for total parking spaces
  - `input[id*="Text74_0"]` for rooms
  - `input[id*="Text75_0"]` for rooms plus
  - `input[id*="q_0-218.73500061035156-66.91400146484375"]` for bedrooms
  - `input[id*="qq_0-313.5090026855469-66.91400146484375"]` for bedrooms plus
  - `input[id*="qqq_0-392.7510070800781-66.91400146484375"]` for kitchens
  - `input[id*="qqqq_0-487.5169982910156-66.91400146484375"]` for kitchens plus

## Known blockers for full automation

- Step 6 cannot fully create a real file yet because the workflow does not currently collect:
  - Seller first name
  - Seller last name
  - Seller email
  - County
  - Preferred file name
- Step 7 cannot fully automate the 290 form yet because many MLS fields are option checkboxes, not plain text inputs.
- Several current spreadsheet-to-form mappings are one-to-many in PropTx:
  - `style`
  - `garage`
  - `parking`
  - `basement`
  - `heating`
  - `cooling`
  - `propertyType`
- Those need value normalization before the app can select the correct checkbox option.

## Recommended next implementation steps

1. Extend the workflow data model and spreadsheet template with seller/contact metadata required by `/create`.
2. Split step 7 into page-specific fill routines for the PropTx editor instead of a single generic `fillFormFields()` loop.
3. Add value-to-checkbox mapping tables for OREA 290 options such as style, garage type, basement type, heat type, and air conditioning.
4. Use the discovered `#pageNumberDDL` selector to drive deterministic page navigation before filling each section.
5. Keep the exact field-id patterns in config, but expect to refresh them if PropTx updates the form template version.
