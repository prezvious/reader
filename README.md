# Reader

A clean, minimal reading space for essays, guides, and long-form articles. Reader gives you a distraction-free place to browse, read, bookmark, and track your reading — all from your browser.

## What It Is

Reader is a static website that works right out of the box. No build step, no server setup, no dependencies to install. Just open `index.html` in your browser and you're good to go.

It comes with:

- **Curated articles** — handpicked reads organized by category
- **User accounts** — sign up, sign in, and keep your stuff private
- **Bookmarks** — save articles you want to come back to
- **Reading history** — automatically tracks what you've read
- **Dashboard** — see your reading stats at a glance
- **Profile settings** — customize your display name, avatar, and bio
- **Dark mode** — toggle between light and dark themes (it even remembers your preference)
- **Responsive design** — works on desktop, tablet, and mobile with a collapsible sidebar

## How to Use It Offline

Reader is built to work without any server, so running it locally is dead simple:

1. Clone or download this repo to your computer
2. Open the folder and double-click `index.html` (or drag it into your browser)
3. That's it — the site loads entirely from your local files

If you want a proper local server (recommended for auth and some browser features), you can use any basic static file server:

```bash
# With Python
python -m http.server 8000

# With Node.js (npx)
npx serve .

# With PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Project Structure

```
reader/
├── index.html            # Home page with featured articles
├── articles.html         # Full article listing with filters
├── article.html          # Single article reader view
├── dashboard.html        # User dashboard with reading stats
├── bookmarks.html        # Saved articles
├── history.html          # Reading history
├── profile.html          # Account settings
├── signin.html           # Sign in page
├── signup.html           # Sign up page
├── manifest.json         # Article metadata (titles, authors, categories, etc.)
├── css/                  # Stylesheets
├── js/                   # JavaScript modules
├── articles/             # Article content folders
├── assets/               # Icons and images
└── .gitignore            # Files excluded from version control
```

## Adding Your Own Articles

Articles are stored as plain HTML files inside the `articles/` folder. Each article gets its own subfolder with an `index.html` for the content. Then you register it in `manifest.json` with its title, author, category, and other metadata. That's all it takes — no database, no CMS, just files.

## AI Summaries

Article pages can preload a right-side AI summary drawer from static payloads in `data/summaries/`. To rebuild those files, run:

```bash
OPENROUTER_API_KEY=your_key_here node scripts/generate-article-summaries.mjs --force
```

The generator tries `google/gemma-4-31b-it:free` first, then falls back to `openrouter/free` if the primary route is rate-limited. You can override the model chain with `OPENROUTER_SUMMARY_MODELS` or `--models`.

For a one-command retry loop on Windows PowerShell:

```powershell
$env:OPENROUTER_API_KEY="your_key_here"
.\scripts\retry-generate-article-summaries.ps1 -Force
```

Run either script after adding or updating articles so the drawer stays in sync.

## Tech

- Plain HTML, CSS, and vanilla JavaScript — no frameworks, no build tools
- Responsive layout with CSS Grid and Flexbox
- Smooth scroll-reveal animations and dark mode with CSS custom properties
- Authentication and data persistence handled through a cloud backend (configured in `js/supabase.js`)

## License

All rights reserved.
