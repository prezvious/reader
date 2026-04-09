# Reader

Reader is a warm, editorial-style reading site for essays, notes, and long-form pieces. The current version leans harder into a calmer article layout, better spacing, richer typography, a cleaner app shell, and a much more capable writing flow. It still ships as a mostly static site, but it feels closer to a real reading product now instead of a simple demo.

## What's new in this version

- The public pages have a more magazine-like feel: narrower reading width, softer surfaces, stronger article hierarchy, and a cleaner browse flow.
- The article page now includes a precomputed AI summary drawer, quick share actions, bookmark controls, reaction counts, and a more polished reading rhythm.
- Search is its own page and can combine the shipped article catalog with extra connected content when your private local config is available.
- The dashboard is more useful now: reading stats, streaks, continue-reading cards, and bookmark snapshots are all easier to scan.
- The compose experience got a major upgrade with live preview, formatting tools, cover-image selection, optional custom CSS, find/replace, draft autosave, and a publish flow.
- Static summary payloads live in `data/summaries/`, so the summary drawer can open fast without waiting for a live request.

## What ships in the public repo

- `index.html`, `articles.html`, and `article.html` for the reading flow
- `dashboard.html`, `bookmarks.html`, `history.html`, `profile.html`, `signin.html`, `signup.html`, and `verify.html` for the account side
- `compose.html` for writing and publishing articles
- `articles/` for static article source files
- `data/summaries/` for prebuilt summary JSON
- `css/` and `js/` for the styling and browser logic
- `scripts/` and `tests/` for local tooling and verification

## Running it offline

If you only want to browse the shipped content, offline use is easy.

1. Clone or download the repo.
2. Open `index.html` directly in your browser, or launch a tiny local server if you prefer cleaner routing and fewer browser restrictions.
3. Start reading.

Out of the box, the static repo is enough for:

- browsing the landing page and article index
- reading bundled articles
- opening the prebuilt AI summaries
- using the theme toggle
- searching the shipped catalog
- writing in the composer and restoring drafts saved in browser storage

If you want a local server, use one of these:

```bash
node scripts/static-server.js 41731
```

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:41731` or `http://localhost:8000`.

## Connected features

Sign-in, synced bookmarks, reading history, profile updates, and publishing rely on a private local config file that is intentionally not committed to this repository.

1. Copy `js/private-config.example.json` to `js/private-config.local.json`.
2. Fill in your private project URL and key.
3. Start the site from a local server and use it normally.

That local file is ignored on purpose, so it stays on your machine and out of the public repo.

## Rebuilding summary files

The repo already includes summary JSON, so you do not need to regenerate anything just to browse the site. If you add or rewrite articles and want fresh summaries, set your API key locally and run:

```bash
OPENROUTER_API_KEY=your_key_here node scripts/generate-article-summaries.mjs --force
node scripts/validate-summaries.js --prune
```

On PowerShell:

```powershell
$env:OPENROUTER_API_KEY = "your_key_here"
node .\scripts\generate-article-summaries.mjs --force
node .\scripts\validate-summaries.js --prune
```

There is also a retry helper if you want a one-command loop:

```powershell
.\scripts\retry-generate-article-summaries.ps1 -Force
```

## Project shape

```text
reader/
|-- articles/              static article source
|-- css/                   shared styles and page-specific styles
|-- data/summaries/        prebuilt summary payloads
|-- js/                    browser modules and local config template
|-- scripts/               local utilities
|-- tests/                 unit and Playwright coverage
|-- compose.html           article editor and publish flow
|-- index.html             landing page
|-- article.html           single article reader
|-- articles.html          browse view
|-- dashboard.html         reading dashboard
|-- bookmarks.html         saved articles
|-- history.html           reading history
|-- profile.html           profile settings
|-- search.html            full search page
|-- manifest.json          static catalog metadata
`-- README.md
```

## Tech

- plain HTML, CSS, and vanilla JavaScript
- static article files plus optional connected content
- local draft persistence through browser storage
- Playwright and Node-based checks for local verification

## License

All rights reserved.
