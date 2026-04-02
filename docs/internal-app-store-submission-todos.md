# Internal App Store Submission TODOs

Use this as a pause-friendly checklist for listing the extension in the internal app store.

## Minimum Viable Submission (15-20 min fast path)

If you are short on time, complete only this section first:

- [ ] Build and upload `pinpoint-extension.zip` (code + contextualized `manifest.json`).
- [ ] Provide one required icon file: `128x128`.
- [ ] Provide at least one required screenshot: `1280x800`.
- [ ] Create a short use-case + permissions doc that includes:
  - [ ] What the extension does / who it is for.
  - [ ] Full list of `manifest.json` scopes/permissions.
  - [ ] One-line justification per scope.
- [ ] Upload everything to one Google Drive folder.
- [ ] Set sharing to: `Anyone at Salesforce.com with this link can view`.
- [ ] Paste into case/form:
  - [ ] Drive folder link
  - [ ] ZIP file link
  - [ ] Use-case + permissions doc link
  - [ ] Visibility choice (`internal web store` OR `link-only`)

Done with this fast path = valid initial submission package.

---

## Quick Status

- Owner: `TBD`
- Target submission date: `TBD`
- Current status: `Not started`

---

## Phase 1: Package and Artifacts

- [ ] Create extension submission ZIP:
  - [ ] Include full extension code.
  - [ ] Include fully contextualized `manifest.json`.
  - [ ] Verify ZIP opens correctly.
- [ ] Prepare required listing assets:
  - [ ] `128x128` icon (required).
  - [ ] At least 1 screenshot at `1280x800` (up to 5).
- [ ] Prepare optional promo images (if desired):
  - [ ] `1400x560`
  - [ ] `920x680`
  - [ ] `440x280`

---

## Phase 2: Documentation

- [ ] Create use-case + permissions document (Google Doc or markdown).
- [ ] Include:
  - [ ] Problem statement and target users.
  - [ ] Detailed extension behavior/workflows.
  - [ ] Full list of scopes/permissions from `manifest.json`.
  - [ ] Justification for each scope/permission (why needed).
  - [ ] Security/privacy notes (if any restricted scope).
- [ ] Add optional support documentation link (Confluence / Google Doc / Site / Basecamp).

---

## Phase 3: Google Drive Setup

- [ ] Create one Drive folder for all submission assets.
- [ ] Upload:
  - [ ] Submission ZIP
  - [ ] Use-case + permissions doc
  - [ ] Icon/screenshots/promo assets
- [ ] Set sharing on folder and files to:
  - [ ] `Anyone at Salesforce.com with this link can view`
- [ ] Copy and save these links:
  - [ ] Drive folder link
  - [ ] ZIP file link
  - [ ] Use-case doc link
  - [ ] Optional support link

---

## Phase 4: Submission Form / Case Entry

- [ ] Paste the required first-field link exactly as requested by the case form.
- [ ] Include the Drive folder link in the case.
- [ ] Include ZIP link and use-case doc link in the case.
- [ ] Answer listing visibility question explicitly:
  - [ ] "List this in the internal web store"
  - [ ] OR "Make this available by direct link only"
- [ ] Confirm all shared links are accessible from a Salesforce account.

---

## Phase 5: Post-Submission Follow-Up

- [ ] Watch for Google follow-up form (for new listings or restricted scopes).
- [ ] Respond with any requested compliance details.
- [ ] Track review status and final approval date.

---

## Copy/Paste Snippets

### Case Note Template

```
Hi team,

Please find the required links below for the extension listing:

- Google Drive folder (Salesforce-viewable): <PASTE_LINK>
- Extension ZIP: <PASTE_LINK>
- Use-case + scopes/permissions doc: <PASTE_LINK>
- Support link (optional): <PASTE_LINK>

Listing visibility preference:
- <Choose one: internal web store listing OR link-only availability>

All links are set to "Anyone at Salesforce.com with this link can view."
```

### Visibility Preference Options

- Internal store listing:
  - `Please list this extension in the internal web store.`
- Link-only:
  - `Please make this extension available by direct link only (not broadly listed in the internal web store).`

---

## Final Gate Before Submit

- [ ] ZIP validated
- [ ] Manifest scopes match documentation
- [ ] At least one valid screenshot present
- [ ] Icon is exactly `128x128`
- [ ] Link permissions verified as Salesforce-viewable
