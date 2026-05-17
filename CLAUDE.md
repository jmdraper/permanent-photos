# YMS Photo Gallery System — Claude Context

This folder contains scripts and widgets for the York Musical Society (YMS) photo gallery system, embedded in the YMS Squarespace website. Everything needed to maintain and extend the system is here or documented below.

---

## What this system does

A single combined widget on the YMS Squarespace site shows photos from two sources:

1. **Permanent.org** — the YMS photo archive, organised into year folders (Public → 2026 → album subfolders)
2. **Flickr** — galleries curated by photographer Allan Harris, listed in `flickr-galleries-config.json`

A GitHub Actions workflow runs nightly, fetches data from both sources, and writes `combined-gallery.json` to the GitHub repo. GitHub Pages serves this file publicly. The Squarespace widget fetches it and renders the gallery.

---

## Repository

**GitHub:** https://github.com/jmdraper/permanent-photos
**GitHub Pages base URL:** https://jmdraper.github.io/permanent-photos/
**Key manifest URL:** https://jmdraper.github.io/permanent-photos/combined-gallery.json
**Gallery Manager form:** https://jmdraper.github.io/permanent-photos/add-gallery.html
**GitHub Actions:** https://github.com/jmdraper/permanent-photos/actions
**GitHub Secrets:** https://github.com/jmdraper/permanent-photos/settings/secrets/actions

---

## Active files (currently in use)

### Scripts
| File | Purpose |
|---|---|
| `generate-combined-gallery.mjs` | **Main nightly script.** Fetches Permanent.org photos and Flickr gallery metadata, merges by year, writes `combined-gallery.json` |
| `permanent-config.json` | Photographer credit config for Permanent albums. `defaultPhotographer` applies to all albums; `albums` object contains per-album overrides keyed by exact folder name |
| `flickr-galleries-config.json` | List of Flickr galleries. Each entry: `{ title, year, flickrUrl, coverPhotoUrl }` |

### Widget & Admin UI
| File | Purpose |
|---|---|
| `combined-widget.html` | The Squarespace Code block — paste this into a single HTML code block on the page |
| `add-gallery.html` | Browser-based Gallery Manager form, hosted on GitHub Pages. Manages `flickr-galleries-config.json` and `permanent-config.json` via the GitHub API |

### Workflow
| File | Purpose |
|---|---|
| `.github/workflows/refresh-photos.yml` | Runs `generate-combined-gallery.mjs` nightly at 02:00 UTC; commits `combined-gallery.json`; calls Homey webhook on failure |

---

## Historical / reference files (no longer in active use)

These were used during setup and migration and are kept for reference:

| File | Notes |
|---|---|
| `generate-manifest.mjs` | Old Permanent-only manifest script, superseded by `generate-combined-gallery.mjs` |
| `generate-flickr-galleries.mjs` | Old Flickr-only script, superseded |
| `squarespace-widget.html` | Old Permanent-only widget, superseded by `combined-widget.html` |
| `flickr-galleries-widget.html` | Old Flickr-only widget, superseded |
| `flickr-upload.mjs` | One-time migration: uploaded Flickr photos to Permanent.org |
| `flickr-organise.mjs` | One-time migration: attempted to organise photos into folders (abandoned in favour of re-upload) |
| `flickr-to-permanent.mjs` | Earlier version of upload script |
| `find-missing.mjs` | One-time migration: found photos missing from Permanent.org |
| `apply-flickr-metadata.mjs` | One-time migration: applied Flickr metadata to Permanent.org records |
| `delete-all-photos.mjs` | Utility: deletes all photos from a Permanent.org folder in passes |
| `check-record-fields.mjs` | Debug utility: inspects field names on Permanent.org records |
| `test-metadata-update.mjs` | Debug utility: tested metadata update API |
| `cloudflare-worker.js` | Early prototype (never deployed) |
| `README.md`, `GITHUB-ACTIONS-SETUP.md` | Early documentation, superseded by NotePlan notes |

---

## GitHub Secrets (set in the repo)

| Secret | Value |
|---|---|
| `PERMANENT_TOKEN` | Bearer JWT from Permanent.org. Get from Safari → app.permanent.org → DevTools → Storage → Local Storage → `AUTH_TOKEN`. Expires periodically — refresh as needed. |
| `PERMANENT_FOLDER_ID` | `232580` — the YMS Public folder ID in Permanent.org. Does not change. |

---

## Permanent.org API notes

Two separate APIs — auth works differently for each:

**Stela API** (modern, used by the SDK)
- Base URL: `https://api.permanent.org/api/v2`
- Auth: `Authorization: Bearer <token>` header
- Used for: reading folders, records, uploading files, creating folders
- SDK: `@permanentorg/sdk` — `getFolder`, `uploadFile`, `createArchiveRecord`, `createFolder`, `deleteArchiveRecord`
- `getFolder({ folderId })` returns `{ folders, archiveRecords }` — note: does **not** include folder `description`

**Legacy API** (older, PHP-based)
- Base URL: `https://app.permanent.org/api`
- Auth: `Authorization: Bearer <token>` header — **do NOT include `Request-Version: 2`** (breaks auth)
- Used for: write operations like `record/update`, folder metadata
- Request format: `{ RequestVO: { data: [{ RecordVO: { ... } }] } }`
- Response: `{ Results: [{ data: [...], isSuccessful: bool }] }`

**Key gotchas:**
- The Stela API folder object does NOT expose `description` — photographer names must come from `permanent-config.json`
- Folder IDs in the Stela API (returned by `getFolder`) are numeric and work with the legacy API's `record/move` — but folders created by the Stela SDK use a different ID namespace that the legacy `record/move` does NOT accept. Always use one API consistently for create + move operations.
- `getFolder` paginates results inconsistently — when fetching all records from a folder, loop until empty rather than assuming one call returns everything

---

## Flickr notes

- Flickr's public feed (`feeds/photos_public.gne`) does NOT support gallery filtering without an API key
- Flickr oEmbed (`https://www.flickr.com/services/oembed/?url=PHOTO_URL&format=json`) works without auth and returns `{ url, thumbnail_url, author_name, title, license }` for any public photo
- Flickr blocks server-side requests (403) but oEmbed works from both browser and Node.js
- Gallery pages and individual photo page URLs both work as oEmbed input (the `in/gallery-…` suffix is ignored)
- Username `alh1` maps to `Allan Harris` — see `AUTHOR_NAMES` in `generate-combined-gallery.mjs`

---

## Permanent.org archive structure (YMS)

```
Public (folderId: 232580)
├── 2009/
│   └── YMS visit to Munster May 2009/  ← album folder
│       └── [photos]
├── 2010/
│   └── ...
└── 2026/
    └── [album folders]
```

- Year folders are at the root of Public
- Album folders are one level inside year folders
- Photographer credit comes from `permanent-config.json` (defaultPhotographer or per-album override), NOT from Permanent.org folder description (not accessible via API)
- Photos must be marked **public** in Permanent.org — private photos won't have accessible CDN URLs

---

## Homey webhook (token expiry notification)

When the Permanent.org token expires or the script fails, the workflow calls:

```
GET https://webhook.homey.app/677c09939dac128f0fab76ae/photos_widget_token?tag=TOKEN
```

Tags: `token_expired` (exit code 2 from script) or `script_error` (any other failure).

---

## Widget behaviour

- **Year view** (initial): one tile per year, showing folder icon badge. Cover = first Flickr gallery cover for that year (if any), else first Permanent photo thumb.
- **Album view**: mix of Permanent album tiles (folder icon) and Flickr gallery tiles (Flickr icon). Shows "Photos by [photographer]" credit. On desktop: grid. On mobile: horizontal list (thumbnail left, text right).
- **Photo view** (Permanent albums only): photo grid, no text overlay. Click opens lightbox with title + date.
- Flickr gallery tiles open Flickr in a new tab (no in-widget lightbox for Flickr).
- Albums sorted reverse-alphabetically within each year (so newest concert appears first if named consistently).
- Years sorted descending (2026 first).
- Empty years are omitted.
- Font: Almarai (loaded from Google Fonts), matching YMS Squarespace template.

---

## Running the script locally

```bash
cd ~/permanent-gallery
npm install  # first time only
PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node generate-combined-gallery.mjs
```

Output: `combined-gallery.json` in the current directory. Upload to GitHub to update the live site, or wait for the nightly run.

---

## Full system documentation

Full documentation including setup-from-scratch instructions, token refresh steps, and the Flickr migration history is in NotePlan: **YMS Photo Gallery System**.