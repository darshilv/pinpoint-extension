import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicManifestPath = path.join(rootDir, 'public', 'manifest.json');
const distDir = path.join(rootDir, 'dist');
const distManifestPath = path.join(distDir, 'manifest.json');
const docsDir = path.join(rootDir, 'docs', 'chrome-web-store');
const generatedDocsDir = path.join(docsDir, 'generated');
const artifactsDir = path.join(rootDir, 'artifacts', 'chrome-web-store');
const screenshotsDir = path.join(artifactsDir, 'screenshots');

const permissionJustifications = {
  storage: 'Stores saved annotations, local UI state, and extension preferences.',
  activeTab:
    'Allows user-triggered activation on the current tab without granting ongoing access to every site.',
  scripting:
    'Injects the Pinpoint content script and stylesheet only when the user activates the extension.',
  commands: 'Supports the keyboard shortcut that toggles Pinpoint on the current page.',
  webNavigation:
    'Re-enables Pinpoint after top-level navigation only for sites the user explicitly approved.',
};

const hostPermissionJustifications = {
  'https://*/*':
    'Optional host access that the user can grant per HTTPS site when they want persistent access and auto-activation.',
  'http://*/*':
    'Optional host access that the user can grant per HTTP site, primarily for local development or non-production environments.',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getManifest(preferDist = false) {
  if (preferDist && fileExists(distManifestPath)) return readJson(distManifestPath);
  return readJson(publicManifestPath);
}

function summarizePermissions(manifest) {
  return {
    permissions: (manifest.permissions ?? []).map((permission) => ({
      key: permission,
      justification:
        permissionJustifications[permission] ??
        'Add a reviewer-facing justification before submission.',
    })),
    hostPermissions: [
      ...(manifest.host_permissions ?? []),
      ...(manifest.optional_host_permissions ?? []),
    ].map((permission) => ({
      key: permission,
      justification:
        hostPermissionJustifications[permission] ??
        'Explain exactly which sites need this access and why.',
    })),
  };
}

function getWarnings(manifest) {
  const warnings = [];
  if ((manifest.host_permissions ?? []).includes('<all_urls>')) {
    warnings.push(
      '`<all_urls>` will trigger extra review scrutiny. Replace it with optional per-site access before submission.'
    );
  }
  if ((manifest.optional_host_permissions ?? []).length === 0)
    warnings.push(
      'No optional host permissions declared. Per-site persistence requests will not work.'
    );
  if (!fileExists(path.join(docsDir, 'privacy-policy.md'))) {
    warnings.push('Missing `docs/chrome-web-store/privacy-policy.md`.');
  }
  if (
    !fs.existsSync(screenshotsDir) ||
    fs.readdirSync(screenshotsDir).filter((name) => name.endsWith('.png')).length === 0
  ) {
    warnings.push('No store screenshots found yet in `artifacts/chrome-web-store/screenshots/`.');
  }
  return warnings;
}

function validateManifest(manifest, preferDist = false) {
  const issues = [];
  const baseDir = preferDist ? distDir : path.join(rootDir, 'public');

  if (manifest.manifest_version !== 3) issues.push('Manifest version must be 3.');
  if (!manifest.name) issues.push('Manifest is missing `name`.');
  if (!manifest.version) issues.push('Manifest is missing `version`.');
  if (!manifest.description) issues.push('Manifest is missing `description`.');
  if (!manifest.background?.service_worker)
    issues.push('Manifest is missing a background service worker.');

  const iconSet = manifest.icons ?? {};
  for (const size of ['16', '48', '128']) {
    const iconPath = iconSet[size];
    if (!iconPath) {
      issues.push(`Manifest is missing icon size ${size}.`);
      continue;
    }
    const absoluteIconPath = path.join(baseDir, iconPath);
    if (!fileExists(absoluteIconPath)) issues.push(`Missing icon file: ${absoluteIconPath}`);
  }

  return issues;
}

function writeGeneratedDocs(manifest) {
  ensureDir(generatedDocsDir);
  ensureDir(artifactsDir);

  const permissionSummary = summarizePermissions(manifest);
  const warnings = getWarnings(manifest);

  const checklist = `# Chrome Web Store Submission Checklist

Generated on ${new Date().toISOString()} from \`public/manifest.json\`.

## Ready in repo

- [x] Manifest V3 extension with action, icons, background worker, and options page
- [x] Draft privacy policy at \`docs/chrome-web-store/privacy-policy.md\`
- [x] Store listing draft at \`docs/chrome-web-store/store-listing.md\`
- [x] Reviewer notes generated from the current manifest
- [x] Packaging script for a versioned ZIP
- [ ] At least one final Chrome Web Store screenshot at 1280x800 or 640x400
- [ ] Hosted privacy policy URL for the Developer Dashboard
- [ ] Final category/language selections in the dashboard
- [ ] Developer account payment / publishing setup

## Manual dashboard fields to complete

- Extension name, summary, and detailed description
- Store category and language
- Screenshot uploads
- Privacy tab answers
- Justification for every declared permission and host permission
- Support contact details
- Public privacy policy URL

## Review risks to watch

${warnings.length === 0 ? '- No major repo-level warnings detected.' : warnings.map((warning) => `- ${warning}`).join('\n')}
`;

  const reviewerNotes = `# Reviewer Notes

## Single purpose

Pinpoint helps a user review a webpage UI, click elements, record feedback annotations, and copy those notes into an AI-ready prompt for implementation work.

## Data handling

- Annotation content is stored in \`chrome.storage.local\` on the user's machine.
- User-approved site allowlist entries are stored in \`chrome.storage.sync\` so the user's settings can follow their browser profile.
- The extension does not transmit annotation data to a backend service.
- The extension does not execute remote code.

## Declared permissions

${permissionSummary.permissions.map(({ key, justification }) => `- \`${key}\`: ${justification}`).join('\n')}

## Declared host permissions

${
  permissionSummary.hostPermissions.length === 0
    ? '- None'
    : permissionSummary.hostPermissions
        .map(({ key, justification }) => `- \`${key}\`: ${justification}`)
        .join('\n')
}

## Suggested privacy-tab answers

- Single purpose: Annotate webpage UI elements and compile implementation-ready feedback.
- Is remote code used: No.
- Does the extension collect or transmit user data: It stores user-entered annotations locally and stores the user-approved site allowlist in Chrome sync storage. It does not send that data to a remote server.
- Web browsing activity: Access is only used to enable annotation features on the page the user activates or on sites the user explicitly approved for persistent access.
`;

  const listingDraft = `# Store Listing Draft

## Short description

Annotate live webpages and turn UI feedback into implementation-ready prompts.

## Detailed description

Pinpoint is a Manifest V3 Chrome extension for product reviews, QA passes, and design handoff. Activate it on any webpage, click the exact UI element you want to discuss, and attach a focused note with the intended change. Pinpoint keeps the notes anchored to the relevant elements and lets you copy the open feedback into a clean prompt that can be handed to a coding agent or engineer.

Key workflows:

- Activate Pinpoint on the current page from the toolbar button or keyboard shortcut.
- Click any visible UI element to attach feedback directly to that element.
- Review, update, resolve, and copy notes from the review panel.
- Optionally configure URL patterns in settings so Pinpoint auto-activates on the pages you review frequently.

## Permission copy for the dashboard

${permissionSummary.permissions
  .concat(permissionSummary.hostPermissions)
  .map(({ key, justification }) => `- \`${key}\`: ${justification}`)
  .join('\n')}

## Submission notes

- Replace this draft with final marketing copy if you want a more polished public listing.
- Keep the per-site permission story explicit in the privacy tab.
- Add the hosted privacy policy URL before submission.
`;

  fs.writeFileSync(path.join(generatedDocsDir, 'submission-checklist.md'), checklist);
  fs.writeFileSync(path.join(generatedDocsDir, 'reviewer-notes.md'), reviewerNotes);
  fs.writeFileSync(path.join(generatedDocsDir, 'store-listing-draft.md'), listingDraft);
  fs.writeFileSync(
    path.join(artifactsDir, 'submission-metadata.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        extensionName: manifest.name,
        version: manifest.version,
        permissions: permissionSummary.permissions,
        hostPermissions: permissionSummary.hostPermissions,
        warnings,
      },
      null,
      2
    )
  );
}

function packageExtension(manifest) {
  if (!fileExists(distManifestPath)) {
    throw new Error('Missing `dist/manifest.json`. Run `npm run build` before packaging.');
  }

  ensureDir(artifactsDir);
  const zipName = `${manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-extension-v${manifest.version}.zip`;
  const zipPath = path.join(artifactsDir, zipName);
  if (fileExists(zipPath)) fs.rmSync(zipPath);

  execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
  return zipPath;
}

function printCheckReport(manifest, issues, warnings) {
  console.log(`Chrome Web Store check for ${manifest.name} v${manifest.version}`);
  if (issues.length === 0) {
    console.log('Manifest checks: PASS');
  } else {
    console.log('Manifest checks: FAIL');
    for (const issue of issues) console.log(`- ${issue}`);
  }
  console.log(warnings.length === 0 ? 'Warnings: none' : 'Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

const command = process.argv[2] ?? 'all';
const manifest = getManifest(command === 'package');

if (command === 'check') {
  const issues = validateManifest(manifest);
  const warnings = getWarnings(manifest);
  printCheckReport(manifest, issues, warnings);
  if (issues.length > 0) process.exitCode = 1;
}

if (command === 'generate') {
  const issues = validateManifest(manifest);
  if (issues.length > 0) {
    printCheckReport(manifest, issues, getWarnings(manifest));
    process.exit(1);
  }
  writeGeneratedDocs(manifest);
  console.log(`Generated Chrome Web Store docs in ${generatedDocsDir}`);
}

if (command === 'package') {
  const builtManifest = getManifest(true);
  const issues = validateManifest(builtManifest, true);
  if (issues.length > 0) {
    printCheckReport(builtManifest, issues, getWarnings(builtManifest));
    process.exit(1);
  }
  const zipPath = packageExtension(builtManifest);
  console.log(`Packaged extension: ${zipPath}`);
}

if (command === 'all') {
  const builtManifest = getManifest(true);
  const publicIssues = validateManifest(manifest);
  const buildIssues = validateManifest(builtManifest, true);
  const issues = [...publicIssues, ...buildIssues];
  if (issues.length > 0) {
    printCheckReport(builtManifest, issues, getWarnings(builtManifest));
    process.exit(1);
  }
  writeGeneratedDocs(builtManifest);
  const zipPath = packageExtension(builtManifest);
  console.log(`Generated docs and packaged extension: ${zipPath}`);
}
