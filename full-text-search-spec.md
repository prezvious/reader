# Full-Text Search Feature Specification

## Overview

A Google-like full-text search system for the Reader platform, powered by PostgreSQL `tsvector` via Supabase. No third-party search services required — the existing Postgres database handles everything natively.

### Goals
1. Users can search across all article content — titles, excerpts, authors, categories, and full body text
2. Results are ranked by relevance, with matches highlighted
3. The experience feels instant and intuitive
4. Works on both desktop (command palette) and mobile (full-screen overlay)
5. Search URLs are shareable and bookmarkable

---

## 1. Database Architecture

### 1.1 Schema Changes

Add a `search_vector` column to the `articles` table. This column stores a pre-computed, weighted text search index that PostgreSQL uses for full-text matching.

```sql
ALTER TABLE articles ADD COLUMN search_vector tsvector;
```

**Why `tsvector`?** It's a sorted list of distinct lexemes (normalized words) that PostgreSQL can search efficiently. It handles:
- **Stemming**: "engineering" matches "engineer", "engineered", "engineering"
- **Stop words**: "the", "a", "is" are ignored automatically
- **Ranking**: Results scored by relevance, not just boolean match/no-match

### 1.2 Weighting Strategy

Not all article fields are equally important. The search vector uses four weight levels (A > B > C > D):

| Weight | Fields | Rationale |
|--------|--------|-----------|
| **A** (highest) | `title` | Users search by title most often. A match here should rank first. |
| **B** | `author_name`, `excerpt` | Author search ("by Callum Rhea") and description matches are highly relevant. |
| **C** | `category`, `content_html` | Deep content search. Useful but produces lower-relevance matches. |
| **D** (lowest) | _unused_ | Reserved for future fields like tags or footnotes. |

The ranking algorithm (`ts_rank_cd`) multiplies matches by these weights. A title match is worth ~4× a body text match.

### 1.3 Automatic Trigger

The search vector updates automatically whenever an article is inserted or updated. No application-side logic needed.

```sql
CREATE OR REPLACE FUNCTION articles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.author_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.content_html, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_vector_update
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_vector_update();
```

**How it works:**
1. `coalesce(NEW.title, '')` — prevents NULL from breaking the concatenation
2. `to_tsvector('english', ...)` — tokenizes and stems the text using English language rules
3. `setweight(..., 'A')` — assigns the weight level
4. `||` — concatenates the weighted vectors into one
5. The trigger fires on every INSERT and UPDATE, keeping the index always fresh

### 1.4 GIN Index

A Generalized Inverted Index (GIN) makes full-text search fast even with thousands of articles.

```sql
CREATE INDEX articles_search_idx ON articles USING GIN (search_vector);
```

**How GIN works:** Think of it as a reverse index — for each unique word, it stores a list of article IDs that contain that word. Looking up "engineering" is O(1) instead of scanning every row.

### 1.5 Backfill Existing Data

The trigger only fires on new writes. Existing rows need a manual update:

```sql
UPDATE articles SET search_vector = search_vector;
```

This "no-op" update (setting the column to itself) fires the trigger for every existing row, populating `search_vector`.

### 1.6 Optional: Fuzzy Search Extension

For typo tolerance ("enginnering" → "engineering"), add the `pg_trgm` extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);
```

This creates a trigram index on titles. Trigrams split text into 3-character chunks: "engineering" → "eng", "ngi", "gin", "ine", "nee", "eer", "eri", "rin", "ing". "Enginnering" shares enough trigrams with "Engineering" to be considered a match.

**Only needed if:** Users report typos causing zero results. Start without it — it's an additive optimization.

---

## 2. Search Query Logic

### 2.1 Primary Search Query

```sql
SELECT
  slug,
  title,
  excerpt,
  author_name,
  author_avatar,
  author_bio,
  category,
  category_slug,
  cover_image,
  cover_image_alt,
  published_at,
  featured,
  ts_rank_cd(search_vector, query, 32) AS rank,
  ts_headline('english', excerpt, query,
    'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10, MaxFragments=2'
  ) AS highlighted_excerpt
FROM articles,
     websearch_to_tsquery('english', $1) query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

**Explained field by field:**

| Field | Purpose |
|-------|---------|
| `slug, title, excerpt, ...` | Standard article data for rendering cards |
| `ts_rank_cd(...)` | Relevance score. Higher = more relevant. Used for sorting. |
| `ts_headline(...)` | Returns the excerpt with matched terms wrapped in `<mark>` tags. |

**Key parameters:**

- **`websearch_to_tsquery('english', $1)`**: Parses the user's query using Google-like syntax:
  - `engineering mindset` → both terms must match (AND)
  - `"first principles"` → exact phrase match
  - `engineering -science` → exclude "science"
  - `thinking OR learning` → either term matches
  - Unlike `to_tsquery`, it handles spaces, quotes, and operators naturally — no manual parsing needed

- **`ts_rank_cd(..., 32)`**: The `32` flag enables `COVER` density normalization. This adjusts the score based on how close matched terms are to each other in the document. "engineering" and "mindset" appearing next to each other ranks higher than appearing 500 words apart.

- **`ts_headline(...)`** parameters:
  - `StartSel=<mark>, StopSel=</mark>` — wraps matched terms in `<mark>` tags
  - `MaxWords=30, MinWords=10` — keeps the snippet between 10-30 words
  - `MaxFragments=2` — returns up to 2 separate matching fragments (useful when terms appear in different parts of the excerpt)

### 2.2 Static Articles Fallback

Articles defined in `manifest.json` don't have Supabase rows. The search function performs a client-side fallback:

1. Query Supabase for DB articles
2. Search static articles (`window.ARTICLES`) using basic string matching
3. Merge results, with DB articles first (they have proper ranking)
4. Static articles get a default rank of `0` (lowest)

**Static search logic:**
```javascript
function searchStaticArticles(query) {
  var terms = query.toLowerCase().split(/\s+/);
  return window.ARTICLES.filter(function (article) {
    var searchableText = [
      article.title,
      article.excerpt,
      article.author.name,
      article.category,
      article.author.bio
    ].join(' ').toLowerCase();
    return terms.some(function (term) {
      return searchableText.indexOf(term) !== -1;
    });
  }).map(function (article) {
    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      author_name: article.author.name,
      author_avatar: article.author.avatar,
      category: article.category,
      published_at: article.publishedAt,
      featured: article.featured,
      rank: 0,
      source: 'static'
    };
  });
}
```

### 2.3 Minimum Query Length

Queries shorter than 2 characters return "Type at least 2 characters..." without hitting the database. This prevents:
- Unnecessary network requests for single keystrokes
- Overly broad results (every article contains "a", "I")
- Poor user experience with noise results

---

## 3. UI/UX Design

### 3.1 Three-Tier Interaction Model

The search experience has three levels of engagement, each progressively deeper:

#### Tier 1: Trigger (Always Visible)
- **Desktop**: Search input in the header navigation bar, or a `Cmd+K` keyboard shortcut
- **Mobile**: Search icon (magnifying glass) in the header, opens full-screen overlay
- **Keyboard**: `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) opens the command palette
- The header shows a subtle search placeholder: "Search articles..." or "Search..."

#### Tier 2: Inline Results (Command Palette)
- A centered overlay appears with the search input at the top
- After 2+ characters, results appear below in real-time
- Debounced at 300ms — the query fires 300ms after the user stops typing
- Maximum 5 results shown inline
- Each result shows: title, author, category, and highlighted excerpt snippet
- Arrow keys (↑↓) navigate between results with a visible focus indicator
- `Enter` opens the currently highlighted result
- `Escape` closes the overlay
- Bottom link: "View all {N} results →" navigates to the full search page

#### Tier 3: Full Results Page (`search.html?q=...`)
- Dedicated page showing all matching articles in the existing card grid layout
- Search bar at the top for refinement
- Shows result count and query time
- URL reflects the query — shareable and bookmarkable
- Empty state with helpful messaging and fallback link

### 3.2 Command Palette Design

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 🔍 engineering mindset                     │ │  ← Search input (auto-focused)
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 📄 The Three Essential Properties of the    │ │  ← Result 1 (hover/focus highlight)
│   │    Engineering Mindset                      │ │
│   │    Callum Rhea · Science                    │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 📄 Inversion: The Problem-Solving...       │ │  ← Result 2
│   │    ...engineers use a unique mode of...     │ │
│   │    Callum Rhea · Science                    │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 📄 Why First Principles Thinking...        │ │  ← Result 3
│   │    ...problems down to their fundamental... │ │
│   │    Magnus Pax · Education                   │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 📄 The Art of Making Decisions...          │ │  ← Result 4
│   │    ...decisions failed not because they...  │ │
│   │    Zephyr Alder · Education                 │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ┌────────────────────────────────────────────┐ │
│   │ 📄 How Reading Slowly Filled...            │ │  ← Result 5
│   │    ...finding stillness between pages...    │ │
│   │    Anonymous · Personal                     │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│              View all 8 results →               │  ← Link to search.html
│                                                  │
│   ↑↓ navigate  ·  ↵ open  ·  esc close          │  ← Keyboard hints
└──────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Auto-focus**: The search input is focused immediately when the overlay opens
- **Backdrop**: Semi-transparent overlay (`var(--overlay)`) dims the page behind
- **Position**: Centered, max-width 600px, max-height 80vh
- **Scroll**: Results container scrolls internally if > 5 results
- **Keyboard hints**: Bottom row shows available shortcuts (hidden on mobile)
- **No-results state**: "No articles match 'xyz'. Try different keywords or browse all articles."

### 3.3 Full Search Results Page

```
┌──────────────────────────────────────────────────┐
│ [Header with search bar]                         │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🔍 Search results for "engineering mindset" │ │  ← Search bar (pre-filled)
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ 5 results · 0.03s                                │  ← Meta info
│                                                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ │ [Card 1]   │ │ [Card 2]   │ │ [Card 3]   │   │  ← Reuses article-card
│ └────────────┘ └────────────┘ └────────────┘   │    component
│ ┌────────────┐ ┌────────────┐                   │
│ │ [Card 4]   │ │ [Card 5]   │                   │
│ └────────────┘ └────────────┘                   │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Footer]                                         │
└──────────────────────────────────────────────────┘
```

**Empty state:**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│           🔍                                     │
│   No articles match "xyzabc123"                  │
│   Try different keywords, or                     │
│   [Browse all articles](articles.html)           │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3.4 Highlighting Matched Terms

Matched terms in excerpts are wrapped in `<mark>` tags by `ts_headline()`. CSS styles them:

```css
mark {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 2px;
  font-weight: 600;
}
```

This makes matching terms visually pop without being jarring. In dark mode, the background automatically adjusts via the CSS variable.

---

## 4. JavaScript Architecture

### 4.1 New File: `js/search.js`

A self-contained IIFE module that handles all search logic.

```javascript
(function () {
  'use strict';

  var searchQuery = '';
  var debounceTimer = null;
  var isOpen = false;
  var results = [];
  var focusedIndex = -1;

  // ... all functions documented below ...

  window.Search = {
    open: openOverlay,
    close: closeOverlay,
    toggle: toggleOverlay,
    execute: executeSearch,
    navigateToResults: navigateToResults
  };
})();
```

### 4.2 Core Functions

#### `init()` — Initialization
Called on `DOMContentLoaded`. Sets up:
- Event listeners for search trigger (input, keyboard shortcut)
- Overlay DOM references
- Escape key global handler

#### `openOverlay()` — Show Command Palette
1. Creates or reveals the `.search-overlay` element
2. Focuses the search input
3. Sets `isOpen = true`
4. Adds `body.search-open` class (prevents background scrolling)
5. If there's existing query text, re-runs the search

#### `closeOverlay()` — Hide Command Palette
1. Hides the overlay
2. Removes `body.search-open`
3. Clears `debounceTimer` (cancels in-flight query)
4. Restores focus to the trigger element (accessibility)
5. Sets `isOpen = false`

#### `executeSearch(query)` — Perform Search
1. Validates query length (≥ 2 chars)
2. Shows loading skeletons
3. Calls `Supabase.searchArticles(query)` for DB articles
4. Searches `window.ARTICLES` for static articles
5. Merges and sorts results by rank
6. Renders results inline (max 5)
7. Updates "View all N results" link
8. Resets `focusedIndex = -1`

#### `debouncedSearch(query)` — Debounced Search
```javascript
function debouncedSearch(query) {
  clearTimeout(debounceTimer);
  if (!query || query.length < 2) {
    renderEmptyOrPlaceholder();
    return;
  }
  debounceTimer = setTimeout(function () {
    executeSearch(query.trim());
  }, 300);
}
```
The 300ms debounce balances responsiveness with efficiency — users typing quickly won't fire a request per keystroke.

#### `handleKeydown(e)` — Keyboard Navigation
```
Key          Action
─────────────────────────────────────────────
Escape       Close overlay
Enter        Open focused result (or search page if none focused)
ArrowDown    Move focus to next result (wrap around)
ArrowUp      Move focus to previous result (wrap around)
Cmd+K/Ctrl+K Toggle overlay (global, even when overlay is closed)
```

**Focus management:**
- When overlay opens: focus moves to the search input
- When user presses ↓: focus moves to the first result
- When overlay closes: focus returns to the trigger element
- Focus trap: Tab/Shift+Tab cycles within the overlay only

#### `renderResults(results)` — Inline Results Rendering
```javascript
function renderResults(results) {
  var container = document.getElementById('search-results');
  if (!results || results.length === 0) {
    container.innerHTML = emptyStateHTML(searchQuery);
    return;
  }

  var html = results.slice(0, 5).map(function (r, i) {
    return resultItemHTML(r, i);
  }).join('');

  if (results.length > 5) {
    html += '<a href="search.html?q=' + encodeURIComponent(searchQuery) +
            '" class="search-view-all">View all ' + results.length + ' results →</a>';
  }

  container.innerHTML = html;
}
```

Each result item:
```html
<a href="article.html?slug={slug}" class="search-result" data-index="{i}" role="option" id="search-option-{i}">
  <span class="search-result__icon">📄</span>
  <div class="search-result__body">
    <span class="search-result__title">{title}</span>
    <span class="search-result__meta">{author} · {category}</span>
    <span class="search-result__excerpt">{highlighted_excerpt}</span>
  </div>
</a>
```

The `highlighted_excerpt` contains `<mark>` tags from `ts_headline()`. For static articles (no headline available), the regular excerpt is used.

### 4.3 Supabase Integration: `js/supabase.js`

New method added to the `window.Supabase` object:

```javascript
async function searchArticles(query) {
  if (!query || query.length < 2) return [];

  // Sanitize: remove anything that could break the query
  var sanitized = query.replace(/[<>]/g, '').trim();
  if (!sanitized) return [];

  try {
    var result = await client.rpc('search_articles', { search_query: sanitized });
    if (result.error) throw result.error;
    return result.data || [];
  } catch (err) {
    console.error('Search query failed:', err);
    return [];
  }
}
```

**Security note:** `websearch_to_tsquery` is safe from SQL injection because the query is passed as a parameterized RPC call, not string-concatenated. The client-side sanitization strips HTML tags that could leak into result rendering.

### 4.4 Integration with `js/app.js`

Two changes:
1. Register `Cmd+K` / `Ctrl+K` global shortcut
2. Initialize search module on pages that have the search trigger

```javascript
document.addEventListener('keydown', function (e) {
  // Cmd+K / Ctrl+K
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (window.Search) window.Search.toggle();
  }
});
```

### 4.5 Integration with `js/manifest.js`

The static article search function (`searchStaticArticles`) lives in `manifest.js` since it operates on the manifest data. The `search.js` module calls it:

```javascript
// In search.js, inside executeSearch():
var dbResults = await Supabase.searchArticles(query);
var staticResults = Manifest.searchArticles(query); // client-side fallback

// Merge: DB results first (ranked), then static (rank=0)
var allResults = dbResults.concat(staticResults.filter(function (s) {
  // De-duplicate: skip static articles that exist in DB results
  return !dbResults.some(function (d) { return d.slug === s.slug; });
}));
```

---

## 5. CSS Architecture

### 5.1 New Component Styles in `css/components.css`

#### Search Overlay
```css
.search-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: none;
  align-items: flex-start;
  justify-content: center;
  z-index: 400;
  padding: 15vh var(--space-6) var(--space-6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.search-overlay--open {
  display: flex;
}

/* Prevent background scroll when overlay is open */
body.search-open {
  overflow: hidden;
}
```

#### Search Palette
```css
.search-palette {
  width: 100%;
  max-width: 600px;
  max-height: 70vh;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: palette-enter 200ms ease-out;
}

@keyframes palette-enter {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

#### Search Input
```css
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.search-input-wrapper svg {
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}
```

#### Search Results
```css
.search-results {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) 0;
}

.search-result {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--transition-fast);
}

.search-result:hover,
.search-result--focused {
  background: var(--bg-secondary);
}

.search-result__icon {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-result__body {
  flex: 1;
  min-width: 0;
}

.search-result__title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result__meta {
  font-family: 'Outfit', sans-serif;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  display: block;
  margin-top: 2px;
}

.search-result__excerpt {
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: block;
  margin-top: var(--space-1);
  line-height: 1.4;
}
```

#### Match Highlighting
```css
.search-result__excerpt mark {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 2px;
  font-weight: 600;
}
```

#### View All Link
```css
.search-view-all {
  display: block;
  text-align: center;
  padding: var(--space-3) var(--space-5);
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  border-top: 1px solid var(--border);
  transition: background-color var(--transition-fast);
}

.search-view-all:hover {
  background: var(--accent-subtle);
}
```

#### Keyboard Hints
```css
.search-keyboard-hints {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  padding: var(--space-2) var(--space-5) var(--space-3);
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.search-keyboard-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
}
```

#### Empty State
```css
.search-empty {
  text-align: center;
  padding: var(--space-10) var(--space-6);
}

.search-empty__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto var(--space-4);
  color: var(--text-tertiary);
}

.search-empty__title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.search-empty__text {
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.search-empty__text a {
  color: var(--accent);
  text-decoration: underline;
}
```

#### Header Search Trigger
```css
.header__search-trigger {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.header__search-trigger:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.header__search-trigger svg {
  width: 18px;
  height: 18px;
}

/* On wide screens, show expanded search input instead of icon */
@media (min-width: 1024px) {
  .header__search-trigger {
    width: auto;
    padding: 0 var(--space-4);
    gap: var(--space-2);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-tertiary);
  }

  .header__search-trigger span {
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
  }

  .header__search-trigger kbd {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 1px 4px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-tertiary);
  }
}
```

#### Mobile Adjustments
```css
@media (max-width: 767px) {
  .search-overlay {
    padding: 0;
    align-items: stretch;
  }

  .search-palette {
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
    animation: none;
  }

  .search-keyboard-hints {
    display: none; /* No keyboard on mobile */
  }
}
```

### 5.2 Search Results Page: `css/search.css` (New File)

```css
.search-page__header {
  padding: var(--space-8) 0 var(--space-4);
}

.search-page__input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 600px;
  margin: 0 auto;
}

.search-page__input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-page__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.search-page__meta {
  text-align: center;
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin: var(--space-4) 0 var(--space-6);
}
```

---

## 6. New File: `search.html`

The full results page reuses the existing site shell (header, sidebar, footer) and adds a search-specific main content area.

```html
<main>
  <section class="container" style="padding-top:var(--space-6);padding-bottom:var(--space-16);">
    <div class="search-page__header">
      <div class="search-page__input-wrapper">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-page__input" id="search-page-input" type="text" placeholder="Search articles..." aria-label="Search articles">
      </div>
    </div>
    <div class="search-page__meta" id="search-page-meta"></div>
    <div class="article-grid" id="search-results-grid"></div>
  </section>
</main>
```

**Page logic (inline `<script>`):**
1. Read `?q=` from URL
2. Pre-fill search input
3. Call `Supabase.searchArticles(q)` + `Manifest.searchArticles(q)`
4. Render results in article card grid
5. Update `<title>` to "{query} — Search — Reader"
6. Update meta description

---

## 7. File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| **Supabase SQL** | Migration | Add `search_vector` column, trigger, GIN index, backfill |
| `js/supabase.js` | Modify | Add `searchArticles()` method |
| `js/manifest.js` | Modify | Add `searchArticles()` client-side fallback |
| `js/search.js` | **New** | Search overlay, debounce, keyboard nav, rendering |
| `js/app.js` | Modify | Register `Cmd+K` shortcut, init search module |
| `css/components.css` | Modify | Add search overlay, palette, results, highlights, empty state, header trigger |
| `css/search.css` | **New** | Search results page styles |
| `search.html` | **New** | Full search results page |
| `index.html` | Modify | Add search trigger to header |
| `articles.html` | Modify | Add search trigger to header |
| `dashboard.html` | Modify | Add search trigger to header |
| `article.html` | Modify | Add search trigger to header |
| All other pages | Modify | Add search trigger to header |

---

## 8. Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Query < 2 chars** | Show "Type at least 2 characters..." — no DB query |
| **Query > 200 chars** | Truncate to 200 chars silently |
| **SQL injection attempt** | Safe — parameterized RPC call. XSS chars (`<>`) stripped client-side |
| **Network failure** | Show "Search unavailable. [Try again]" with retry button |
| **Slow connection** | Show loading skeletons immediately; debounce increases to 500ms |
| **Zero results** | Empty state with "No articles match '{query}'" + browse all link |
| **Special characters in query** | `websearch_to_tsquery` handles `+`, `-`, `"`, `OR` natively |
| **Static article with no DB row** | Included in results with `rank: 0` (lowest priority) |
| **Duplicate slug (DB + static)** | Static result is filtered out — DB version takes precedence |
| **Overlay open, user navigates away** | Overlay closes automatically on page change |
| **User presses Escape during loading** | Abort in-flight request via `AbortController`, close overlay |
| **Mobile: virtual keyboard opens** | Full-screen overlay prevents keyboard overlap issues |
| **User rapidly types** | Debounce ensures only the final query fires after 300ms pause |

---

## 9. Accessibility Checklist

- [x] Search input has `aria-label="Search articles"`
- [x] Results list has `role="listbox"` and each result has `role="option"`
- [x] `aria-activedescendant` updates as user navigates with arrow keys
- [x] Overlay has `role="dialog"` and `aria-modal="true"`
- [x] Focus trap: Tab/Shift+Tab cycles within overlay only
- [x] Escape key closes overlay
- [x] Focus returns to trigger element on close
- [x] `<mark>` tags are semantic — screen readers announce them as "mark"
- [x] Loading state has `aria-live="polite"` for screen reader announcements
- [x] Empty state has descriptive text (not just an icon)
- [x] `prefers-reduced-motion`: palette animation reduced to instant display
- [x] Color contrast on `mark` tags meets WCAG AA (4.5:1 minimum)

---

## 10. Performance Considerations

### Query Performance
- **GIN index**: O(1) lookup per term, regardless of article count
- **Expected latency**: < 50ms for < 1,000 articles; < 200ms for < 100,000
- **Limit 20**: Only 20 rows returned — pagination is cheap

### Client-Side Performance
- **Debounce (300ms)**: Prevents query-per-keystroke during fast typing
- **AbortController**: Previous in-flight request is cancelled when a new query fires
- **Skeleton loading**: Perceived performance — user sees immediate feedback
- **Max 5 inline results**: DOM stays light in the overlay

### Asset Impact
- New JS file (`search.js`): ~8KB minified
- New CSS (`search.css`): ~3KB minified
- New HTML (`search.html`): ~6KB
- Total added: ~17KB before compression, ~5KB gzipped

---

## 11. Testing Plan

### Manual Testing
1. **Basic search**: Type "engineering" → verify results appear with correct ranking
2. **Phrase search**: Type `"first principles"` → verify exact phrase matching
3. **Exclusion**: Type "engineering -science" → verify science articles excluded
4. **Author search**: Type "Callum" → verify author matches work
5. **Short query**: Type "e" → verify "Type at least 2 characters" message
6. **Empty results**: Type "xyzabc123" → verify empty state displays
7. **Keyboard nav**: Open with Cmd+K, type query, press ↓↓, press Enter → verify navigation
8. **Escape**: Press Escape while overlay open → verify it closes
9. **Focus trap**: Press Tab repeatedly in overlay → verify focus stays inside
10. **View all**: Click "View all N results" → verify search.html opens with pre-filled query
11. **Mobile**: Open on narrow viewport → verify full-screen overlay
12. **Shareable URL**: Navigate to `search.html?q=engineering` → verify results load
13. **Dark mode**: Switch theme while overlay open → verify colors update
14. **Reduced motion**: Enable `prefers-reduced-motion` → verify no animation

### Database Testing
1. Insert a new article via compose → verify `search_vector` is populated
2. Update an article title → verify `search_vector` updates
3. Run `EXPLAIN ANALYZE` on a search query → verify GIN index is used (not sequential scan)

---

## 12. Future Extensions

### 12.1 Fuzzy Search (pg_trgm)
If users report typos causing zero results:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);
```
Combine with tsvector: if tsvector returns 0 results, fall back to trigram similarity:
```sql
SELECT slug, title, similarity(title, $1) AS sim
FROM articles WHERE title % $1 ORDER BY sim DESC LIMIT 5;
```

### 12.2 Search Analytics
Track what users search for to improve content discovery:
```sql
CREATE TABLE search_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query text NOT NULL,
  result_count int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX search_analytics_query_idx ON search_analytics (query);
```
Surface "Trending searches" in the empty overlay state.

### 12.3 Advanced Filters
Add filter chips below the search input:
- **By category**: "Science" "Education" "Personal"
- **By author**: Filter to specific authors
- **By date**: "Last week" "Last month" "This year"

### 12.4 Saved Searches
Let users bookmark search queries and get notified when new articles match.

---

## 13. Implementation Phases

### Phase 1: Database Setup (15 min)
- [ ] Run SQL migration (column, trigger, index, backfill)
- [ ] Test search query in Supabase SQL editor with sample terms
- [ ] Verify GIN index is used with `EXPLAIN ANALYZE`

### Phase 2: Supabase JS Method (10 min)
- [ ] Add `searchArticles()` to `js/supabase.js`
- [ ] Add `searchArticles()` to `js/manifest.js` (static fallback)
- [ ] Test from browser console: `Supabase.searchArticles('engineering')`

### Phase 3: Search JS Module (45 min)
- [ ] Create `js/search.js` with IIFE structure
- [ ] Implement `openOverlay()`, `closeOverlay()`, `toggle()`
- [ ] Implement `debouncedSearch()` with AbortController
- [ ] Implement `executeSearch()` — DB + static merge
- [ ] Implement `renderResults()` with skeleton loading
- [ ] Implement `handleKeydown()` — Enter, Escape, Arrow keys, Cmd+K
- [ ] Expose `window.Search` API

### Phase 4: CSS Components (30 min)
- [ ] Add search overlay and palette styles
- [ ] Add search result item styles
- [ ] Add `mark` highlighting
- [ ] Add empty state styles
- [ ] Add header search trigger styles
- [ ] Add mobile responsive adjustments
- [ ] Add `prefers-reduced-motion` support

### Phase 5: Search Results Page (20 min)
- [ ] Create `search.html` with site shell
- [ ] Add `css/search.css`
- [ ] Wire up `?q=` param reading and search execution
- [ ] Add result count + timing display

### Phase 6: Integration (15 min)
- [ ] Add search trigger to all page headers
- [ ] Register `Cmd+K` shortcut in `js/app.js`
- [ ] Wire up `DOMContentLoaded` initialization
- [ ] Test full flow: type → results → navigate → open article

### Phase 7: Polish & Testing (30 min)
- [ ] Test keyboard accessibility (full tab-through)
- [ ] Test empty state messaging
- [ ] Test mobile full-screen overlay
- [ ] Test dark mode
- [ ] Test shareable search URLs
- [ ] Test network failure handling
- [ ] Verify no console errors

**Estimated total: ~2.5 hours**

---

## 14. Security Notes

1. **SQL injection**: Impossible — the query is passed as a parameterized argument to a Supabase RPC function, never string-concatenated into SQL.
2. **XSS in results**: The `ts_headline()` output contains `<mark>` tags. These are safe — they're generated by PostgreSQL, not user input. All other fields are escaped via `App.escapeHtml()` before rendering.
3. **Rate limiting**: Supabase's built-in rate limiting applies. For heavy usage, add application-side rate limiting (max 10 searches/minute per session).
4. **Data exposure**: Search only returns public article data (title, excerpt, author, category). No private or user-specific data is exposed.
5. **Content Security Policy**: The existing CSP allows `'unsafe-inline'` for scripts — the search module is a self-contained IIFE with no `eval()` or dynamic script injection.
