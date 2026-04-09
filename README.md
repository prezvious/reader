# Reader

Reader is an editorial-style reading site built with static HTML, CSS, and vanilla JavaScript. It ships with a small bundled article catalog, bundled summary fallbacks, reader accounts, and a browser-based compose flow for connected deployments.

## Included pages

- `index.html` for the landing page and featured reads
- `articles.html` for the full article catalog with sort and view controls
- `article.html` for the single-article reading experience
- `search.html` for catalog search
- `dashboard.html`, `bookmarks.html`, `history.html`, and `profile.html` for signed-in reading activity
- `signin.html`, `signup.html`, and `verify.html` for account access
- `compose.html` for writing and publishing when a backend config is available

## Local use

You can browse the bundled catalog directly from the files, or serve the repo locally for a cleaner browser experience.

```bash
node scripts/static-server.js 41731
```

Then open [http://127.0.0.1:41731](http://127.0.0.1:41731).

The static bundle includes:

- the home page and article catalog
- the bundled article files in `articles/`
- bundled summary fallbacks in `data/summaries/`
- browser-side theme switching
- local draft persistence in the compose page

## Connected features

Bookmarks, reactions, profile updates, publishing, connected search, and the deployed summary cache require browser config for the Supabase client.

For local work:

1. Copy `js/private-config.example.json` to `js/private-config.local.json`.
2. Fill in your own project URL and public client key.
3. Run the site on `localhost` or open it directly from disk.

For hosted deployments, the browser can also read an injected `window.READER_BACKEND_CONFIG` object before `js/supabase.js` loads.

AI summaries are served through `GET /api/article-summary?slug=<slug>`. In deployed environments, that endpoint expects:

- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Static bundled summaries remain in `data/summaries/` as a fallback for local/static browsing.

## Repository layout

```text
reader/
|-- articles/              bundled article source
|-- css/                   shared and page-specific styles
|-- data/summaries/        bundled summary fallbacks
|-- api/                   deployed summary endpoint
|-- lib/                   shared server-side summary logic
|-- js/                    browser modules and config template
|-- scripts/               local utility scripts
|-- compose.html           browser editor
|-- index.html             landing page
|-- article.html           single article reader
|-- articles.html          catalog page
|-- dashboard.html         reader dashboard
|-- bookmarks.html         saved articles
|-- history.html           reading history
|-- profile.html           profile settings
|-- search.html            search page
|-- manifest.json          bundled article metadata
`-- README.md
```

## License

All rights reserved.
