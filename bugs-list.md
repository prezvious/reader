# Reader — Master Bug Audit Report

> **Audit Date**: April 8, 2026
> **Scope**: Full website — HTML, CSS, JavaScript, architecture, auth flow, data persistence
> **Actual Bugs Confirmed**: 12
> **Team Audit Verdicts**: 26 original issues reviewed (5 confirmed, 1 partially supported, 1 unverified, 19 not current bugs or not bugs)

---

## Table of Contents

- [Part 1: Actual Bugs (12)](#part-1-actual-bugs)
- [Part 2: Team Bug Audit Table](#part-2-team-bug-audit-table)
- [Part 3: Hardening Opportunities](#part-3-hardening-opportunities)
- [Part 4: Priority Fix Order](#part-4-priority-fix-order)

---

## Part 1: Actual Bugs

---

### BUG-A01: Mandatory Auth Blocks Public / Offline Browsing

| Detail | Value |
|--------|-------|
| **Severity** | 🔴 Critical |
| **Type** | Functional — Auth Gate |
| **Files** | `index.html:150`, `articles.html:144`, `article.html:192`, `js/auth.js:50` |
| **Contradicts** | [README.md:7](README.md) — *"Reader is a static website that works right out of the box. No build step, no server setup."* |

#### Description
Every public-facing page (`index.html`, `articles.html`, `article.html`) calls `Auth.requireAuth()` on load, which calls `initAuth()`. If no Supabase session exists, `redirectToSignin()` fires, sending the user to `signin.html`. This means **no one can browse, search, or read articles without signing in** — including local/offline users who open `index.html` directly from their filesystem.

#### Evidence
```javascript
// index.html:150
Auth.requireAuth().then(function (user) {
  if (!user) return;  // ← No user → nothing renders
  // ...render featured articles
});

// auth.js:50 — initAuth()
if (!session) {
  redirectToSignin();  // ← Unauthenticated users always redirected away
  return null;
}
```

#### Impact
- The entire public-facing site is inaccessible without authentication
- README claims the site works "right out of the box" — this is false
- Local/offline usage (a stated goal in README) is impossible because Supabase SDK requires network
- Search engines cannot crawl content

#### Fix
Remove `Auth.requireAuth()` from public pages. Load and render articles unconditionally. Only gate user-specific features (dashboard, bookmarks, history, profile):

```javascript
// On index.html, articles.html, article.html:
Manifest.load().then(function () {
  // Render articles for everyone
});

// Optionally hydrate user-specific UI if logged in:
Auth.requireAuth().then(function (user) {
  if (user) App.renderUser(user);
}).catch(function () { /* User not logged in — that's fine */ });
```

Or, if mandatory auth is intentional, update the README to reflect that Reader requires a Supabase backend and user accounts.

---

### BUG-A02: Bookmarks / History Pages Skip Manifest Load Before Resolving Slugs

| Detail | Value |
|--------|-------|
| **Severity** | 🔴 Critical |
| **Type** | Functional — Missing Dependency |
| **Files** | `bookmarks.html:138`, `bookmarks.html:158`, `history.html:141`, `history.html:178`, `js/manifest.js:47` |

#### Description
Both `bookmarks.html` and `history.html` call `Manifest.getBySlug()` (via `Manifest.getBySlug` or `articles.find(...)`) to look up article metadata for bookmarked/historical entries. However, **neither page calls `Manifest.load()` first**. After a fresh page load, `window.ARTICLES` is still empty, so every lookup returns `undefined` and valid entries render as "Article no longer available."

#### Evidence
```javascript
// bookmarks.html:138 — No Manifest.load() call
Auth.requireAuth().then(function (user) {
  if (!user) return;
  App.renderUser(user);
  loadBookmarks(user.id);  // ← Calls Manifest.getBySlug() inside
});

// bookmarks.html:158 — Inside loadBookmarks()
var article = articles.find(function (a) { return a.slug === b.article_slug; });
// ↑ articles = window.ARTICLES || [] — still empty because Manifest.load() was never called
```

```javascript
// history.html:141 — Same pattern, no Manifest.load()
Auth.requireAuth().then(function (user) {
  if (!user) return;
  currentUser = user;
  App.renderUser(user);
  loadHistory(user.id);  // ← Manifest.getBySlug() called with empty manifest
});
```

#### Impact
- All bookmarks appear as "Article no longer available" on fresh page load
- All reading history entries show "Article no longer available"
- Refreshing the page makes bookmarks/history look broken even though they're valid
- The `Manifest.load()` in `manifest.js:47` fetches `manifest.json` asynchronously — without awaiting it, `window.ARTICLES` stays `[]`

#### Fix
Load the manifest before rendering bookmarks/history:

```javascript
// bookmarks.html and history.html:
document.addEventListener('DOMContentLoaded', function () {
  Auth.requireAuth().then(function (user) {
    if (!user) return;
    App.renderUser(user);
    return Manifest.load();  // ← Wait for manifest
  }).then(function () {
    loadBookmarks(userId);   // ← Now Manifest.getBySlug() works
  }).catch(function (err) {
    console.error('Bookmarks init error:', err);
  });
});
```

---

### BUG-A03: Stored XSS — Unsafe Path Starts in Composer, Not Only Reader

| Detail | Value |
|--------|-------|
| **Severity** | 🔴 Critical |
| **Type** | Security — Cross-Site Scripting (Stored XSS) |
| **Files** | `compose.html:566`, `compose.html:578`, `compose.html:717`, `compose.html:860`, `js/reader.js:144`, `js/reader.js:151` |

#### Description
The compose page's live preview renders the Markdown-to-HTML output directly into the DOM via `innerHTML`. When the article is published, the same raw `content_html` (including any HTML, event handlers, or scripts) is stored in Supabase and later injected into `reader.js`'s `loadDbArticleContent()` via `innerHTML` — executing in every reader's browser.

The XSS path has **three stages**, all unsanitized:

1. **Composer preview** (`compose.html:566`) — `previewBody.innerHTML = articleHTML;`
2. **Database storage** (`compose.html:860`) — `articleData.content_html = articleHTML;` (stored as-is)
3. **Reader display** (`js/reader.js:144`) — `container.innerHTML = data.content_html;`

#### Evidence
```javascript
// compose.html:566 — Preview renders raw HTML
var previewBody = document.getElementById('preview-body');
previewBody.innerHTML = articleHTML;  // ← No sanitization

// compose.html:860 — Publish stores raw HTML
var articleData = {
  slug: slug,
  content_html: articleHTML,  // ← Stored unsanitized
  custom_css: customCSSContent,
  // ...
};
await Supabase.publishArticle(articleData);

// js/reader.js:144 — Reader injects into DOM
container.innerHTML = data.content_html;  // ← Executes in reader's browser
```

#### Impact
- A compromised or malicious admin account can store `<script>alert('XSS')</script>` or `<img onerror="stealTokens()">` in article content
- Every user who reads the article has the script execute in their browser
- Session tokens, bookmarks, profile data, and reading history are exposed
- The Supabase anon key (public but scoped by RLS) could be used to make authenticated requests as the victim

#### Fix
Sanitize at **both** the composer (on publish) and the reader (on display) as defense-in-depth:

**Composer-side (on publish):**
```javascript
function sanitizeForStorage(html) {
  var div = document.createElement('div');
  div.innerHTML = html;
  // Remove dangerous elements
  div.querySelectorAll('script, iframe, object, embed, form, input[type="hidden"]').forEach(function (el) { el.remove(); });
  // Remove event handlers from all elements
  div.querySelectorAll('*').forEach(function (el) {
    Array.from(el.attributes).forEach(function (attr) {
      if (attr.name.indexOf('on') === 0) el.removeAttribute(attr.name);
    });
    // Strip javascript: and data: URIs
    ['href', 'src', 'action', 'formaction'].forEach(function (attrName) {
      var val = el.getAttribute(attrName);
      if (val && (val.trim().toLowerCase().indexOf('javascript:') === 0 || val.trim().toLowerCase().indexOf('data:') === 0)) {
        el.removeAttribute(attrName);
      }
    });
  });
  return div.innerHTML;
}

articleData.content_html = sanitizeForStorage(articleHTML);
```

**Reader-side (on display):**
```javascript
// Same sanitizeForStorage() function applied before innerHTML:
container.innerHTML = sanitizeForStorage(data.content_html);
```

---

### BUG-A04: Published Custom CSS Is Stored Raw and Injected Unscoped

| Detail | Value |
|--------|-------|
| **Severity** | 🟠 High |
| **Type** | Security — CSS Injection / UI Defacement |
| **Files** | `compose.html:861`, `js/reader.js:156`, `js/reader.js:162` |

#### Description
Custom CSS entered in the composer is stored in the `articles.custom_css` column and injected directly into `<head>` as a `<style>` element with no scoping. This means a single article's CSS can restyle or hide **any element on the entire page** — header, footer, buttons, overlays, other articles.

#### Evidence
```javascript
// compose.html:861 — Custom CSS stored raw
articleData.custom_css = customCSSContent;  // ← No validation or scoping

// js/reader.js:156-162 — CSS injected into <head> unscoped
if (data.custom_css) {
  var style = document.createElement('style');
  style.textContent = data.custom_css;  // ← Global CSS, no scoping
  style.id = 'article-custom-style';
  document.head.appendChild(style);
}
```

#### Impact
- Malicious CSS can hide UI elements (`.header { display: none; }`), create phishing overlays, or deface the page
- `body::after { content: 'Site compromised'; position: fixed; ... }` — full-page overlay
- Can steal visible content via CSS-only attacks (font exfiltration, though limited)
- Legitimate articles with aggressive CSS can break the site layout for all readers

#### Fix
Scope custom CSS to the article body only:

```javascript
if (data.custom_css) {
  // Wrap in article-body scope
  var scopedCSS = data.custom_css.replace(/([^{}]+)\{/g, function (match, selector) {
    // Skip @-rules
    if (selector.trim().indexOf('@') === 0) return match;
    return '#article-body ' + selector + ' {';
  });

  var style = document.createElement('style');
  style.textContent = scopedCSS;
  style.id = 'article-custom-style';
  document.head.appendChild(style);
}
```

Alternatively, reject CSS that targets global selectors (`body`, `html`, `.header`, `.footer`, etc.) at publish time.

---

### BUG-A05: Completing an Article Can Silently Fail for First-Time Readers

| Detail | Value |
|--------|-------|
| **Severity** | 🟠 High |
| **Type** | Functional — Data Loss |
| **Files** | `article.html:329`, `article.html:335`, `js/supabase.js:114` |

#### Description
`markComplete()` uses `.update()` instead of `.upsert()`. If a user has never had their progress tracked before (no existing `reading_history` row for this article + user), calling `markComplete()` does nothing — the row is never created. This means reading completion, streak tracking, and "articles read" stats are silently lost.

#### Evidence
```javascript
// article.html:329 — markComplete called on ≥90% scroll or beforeunload
if (progress >= 90) {
  Supabase.markComplete(currentUser.id, currentSlug);  // ← Calls UPDATE, not UPSERT
}

// js/supabase.js:114 — Uses UPDATE, not upsert
async function markComplete(userId, slug) {
  var result = await client
    .from('reading_history')
    .update({ progress_percent: 100, completed_at: new Date().toISOString(), last_read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('article_slug', slug)
    .select()
    .single();
  return result.error ? null : result.data;  // ← Returns null if no row exists (UPDATE affects 0 rows)
}
```

#### Impact
- Users who read an article quickly and scroll to the bottom (≥90%) on their first visit get no completion record
- Streak tracking fails — "Current Streak" stays at 0 even after reading articles daily
- "Articles Read" stat is always lower than actual
- Users who read and complete articles without any prior progress interaction lose all credit

#### Fix
Change `markComplete()` to use `upsert`:

```javascript
async function markComplete(userId, slug) {
  var result = await client
    .from('reading_history')
    .upsert(
      {
        user_id: userId,
        article_slug: slug,
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      },
      { onConflict: 'user_id,article_slug' }
    )
    .select()
    .single();
  return result.error ? null : result.data;
}
```

This is consistent with how `updateProgress()` already works (it uses `.upsert()`).

---

### BUG-A06: Supabase Helper Methods Swallow Failures Into Fake Empty States

| Detail | Value |
|--------|-------|
| **Severity** | 🟠 High |
| **Type** | Error Handling — Silent Failure Masking |
| **Files** | `js/supabase.js:40`, `js/supabase.js:78`, `js/supabase.js:172`, `bookmarks.html:149`, `history.html:164`, `dashboard.html:206` |

#### Description
Many Supabase helper functions return empty arrays (`[]`) or zero values on error instead of throwing or returning an error indicator. Callers then interpret empty results as "no data" and render empty states. This means **any failure** — network error, RLS policy denial, malformed query, database downtime — appears to users as "No bookmarks yet" or "No reading history yet."

#### Evidence
```javascript
// supabase.js:40 — getBookmarks swallows errors
async function getBookmarks(userId) {
  var result = await client
    .from('bookmarks')
    .select('id, article_slug, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return result.error ? [] : result.data;  // ← Error → empty array
}

// supabase.js:78 — getReadingHistory swallows errors
async function getReadingHistory(userId) {
  var result = await client
    .from('reading_history')
    .select('id, article_slug, progress_percent, started_at, completed_at, last_read_at')
    .eq('user_id', userId)
    .order('last_read_at', { ascending: false });
  return result.error ? [] : result.data;  // ← Error → empty array
}

// supabase.js:172 — getTotalReadCount swallows errors
async function getTotalReadCount(userId) {
  var result = await client
    .from('reading_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null);
  return result.error ? 0 : (result.count || 0);  // ← Error → zero
}
```

```javascript
// bookmarks.html:149 — Caller can't tell if [] means "no bookmarks" or "error"
var bookmarks = await Supabase.getBookmarks(userId);
if (bookmarks.length === 0) {
  container.innerHTML = '<div class="empty-state">No bookmarks yet</div>';  // ← Could be a network error!
}
```

#### Impact
- Users cannot distinguish between "no data" and "something is broken"
- RLS policy misconfigurations appear as empty user accounts
- Network failures show no error, no retry option
- Debugging is extremely difficult — logs show errors but users see nothing wrong
- Stats on dashboard (total articles, read count, bookmarks, streak) can all silently show zeros on failure

#### Fix
Return error information to callers:

Option A — Return `{ data, error }` tuples:
```javascript
async function getBookmarks(userId) {
  var result = await client
    .from('bookmarks')
    .select('id, article_slug, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: result.data || [], error: result.error };
}
```

Option B — Throw on error (consistent with article CRUD helpers which already throw):
```javascript
async function getBookmarks(userId) {
  var result = await client
    .from('bookmarks')
    .select('id, article_slug, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return result.data || [];
}
```

Then update callers to handle errors:
```javascript
try {
  var bookmarks = await Supabase.getBookmarks(userId);
  renderBookmarks(bookmarks);
} catch (err) {
  container.innerHTML = '<div class="empty-state"><p class="empty-state__title">Unable to load bookmarks</p><p class="empty-state__text">Please check your connection and try again.</p></div>';
}
```

---

### BUG-A07: OAuth / Deep-Link Redirects Lost on `verify.html`

| Detail | Value |
|--------|-------|
| **Severity** | 🟠 High |
| **Type** | Functional — Lost Redirect |
| **Files** | `js/auth.js:107`, `verify.html:312` |

#### Description
When a user signs in via Google OAuth from a protected deep link (e.g., `dashboard.html?redirect=article.html?slug=some-article`), Supabase redirects them to `verify.html`. The `verify.html` page then calls `Auth.requireAuth()` which hydrates the session and calls `handlePostAuthRedirect(isNewUser)`. However, `handlePostAuthRedirect` reads `?redirect=` from `window.location.search` — but after the OAuth callback, the URL is `verify.html` **without** the original `?redirect=` parameter. The redirect target is lost and the user always lands on `dashboard.html`.

#### Evidence
```javascript
// auth.js:107 — OAuth redirect includes ?redirect=
async function signInWithGoogle() {
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');
  var result = await window.Supabase.client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/verify.html' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '')
    }
  });
  // ↑ Correctly appends ?redirect= to verify.html URL
}

// But after OAuth completes, Supabase redirects to:
// verify.html  ← Without ?redirect= (Supabase strips query params on callback)

// verify.html:312 — handlePostAuthRedirect reads from current URL
function handlePostAuthRedirect(isNewUser) {
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');  // ← null, because redirect param was stripped
  if (isValidRedirect(redirect)) {
    window.location.href = redirect;
  } else if (isNewUser) {
    window.location.href = 'verify.html';
  } else {
    window.location.href = 'dashboard.html';  // ← Always lands here
  }
}
```

#### Impact
- Users who click a bookmarked article link, sign in with Google, expect to be taken to that article — instead they always land on dashboard
- Deep links shared via email/social lose their target after OAuth
- Users must manually navigate back to the original destination

#### Fix
Store the redirect target in `sessionStorage` before initiating OAuth, then retrieve it on `verify.html`:

```javascript
// auth.js — Before OAuth:
async function signInWithGoogle() {
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');
  if (redirect) {
    try { sessionStorage.setItem('oauth-redirect', redirect); } catch (e) {}
  }
  // ... OAuth call
}

// verify.html — After auth resolves:
function handlePostAuthRedirect(isNewUser) {
  var redirect = null;
  try { redirect = sessionStorage.getItem('oauth-redirect'); } catch (e) {}
  if (redirect) {
    try { sessionStorage.removeItem('oauth-redirect'); } catch (e) {}
  }
  if (!redirect) {
    var params = new URLSearchParams(window.location.search);
    redirect = params.get('redirect');
  }
  if (isValidRedirect(redirect)) {
    window.location.href = redirect;
  } else if (isNewUser) {
    window.location.href = 'verify.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}
```

---

### BUG-A08: `beforeunload` Progress Writes Are Unreliable

| Detail | Value |
|--------|-------|
| **Severity** | 🟡 Medium |
| **Type** | Functional — Data Loss |
| **Files** | `article.html:278`, `article.html:282`, `article.html:284` |
| **Team ID** | Confirmed BUG-03 |

#### Description
The `beforeunload` event handler fires async Supabase calls (`markComplete`, `updateProgress`) but does not wait for them to complete. The page navigates away before the requests finish, so progress data near tab close or navigation is lost.

#### Evidence
```javascript
window.addEventListener('beforeunload', function () {
  if (currentUser && currentSlug) {
    var progress = calculateScrollProgress();
    if (progress >= 90) {
      Supabase.markComplete(currentUser.id, currentSlug);  // ← Fire-and-forget
    } else if (progress !== lastSavedProgress) {
      Supabase.updateProgress(currentUser.id, currentSlug, progress);  // ← Fire-and-forget
    }
  }
});
```

#### Impact
- Users who read to ≥90% and close the tab never get the article marked as completed
- Final progress updates (last 5-10%) are lost
- Streak tracking can miss the final completion
- The 10-second interval timer (`startProgressTracking`) catches most updates, but the gap between the last interval tick and page close is still lost

#### Fix
Option A — Use `navigator.sendBeacon()`:
```javascript
window.addEventListener('beforeunload', function () {
  if (currentUser && currentSlug) {
    var progress = calculateScrollProgress();
    var payload = JSON.stringify({
      user_id: currentUser.id,
      article_slug: currentSlug,
      progress_percent: progress,
      last_read_at: new Date().toISOString()
    });
    if (progress >= 90) {
      payload.completed_at = new Date().toISOString();
    }
    var blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(
      'https://wgeckjaxqgkvivskbtrk.supabase.co/rest/v1/reading_history',
      blob
    );
  }
});
```

Option B — Remove the `beforeunload` handler entirely and rely on the 10-second interval timer (which already saves progress every 5% change). The maximum data loss would be ~10 seconds of reading, which is acceptable.

---

### BUG-A09: Removing Avatar Does Not Restore Initials Until Full Reload

| Detail | Value |
|--------|-------|
| **Severity** | 🟡 Medium |
| **Type** | UX — Stale DOM State |
| **Files** | `js/app.js:45`, `profile.html:215` |
| **Team ID** | Confirmed BUG-09 (lower severity) |

#### Description
When a user clears their avatar URL in profile settings, `Supabase.updateProfile()` saves `avatar_url: null`. The response updates the UI via `App.renderUser()`, but `renderUser` only handles the **positive case** — it replaces avatar initials with an `<img>` when `avatar_url` is truthy. It has **no logic to reverse** this when `avatar_url` is cleared, leaving the `<img>` element (now broken) visible instead of restoring the initials.

#### Evidence
```javascript
// app.js:45 — Only handles positive case
if (profile.avatar_url && Supabase.isValidAvatarUrl(profile.avatar_url)) {
  var headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) {
    headerAvatar.innerHTML = '';
    var headerImg = document.createElement('img');
    headerImg.setAttribute('src', profile.avatar_url);
    headerAvatar.appendChild(headerImg);  // ← Replaces initials with <img>
  }
  // ← No else branch! When avatar_url is null, initials are never restored
}

// profile.html:215 — After save, calls renderUser with updated profile
App.renderUser(currentUser);  // ← currentUser.profile.avatar_url is now null
```

#### Impact
- After clearing avatar URL, a broken `<img>` (empty `src`) is displayed
- Initials ("JD" etc.) are permanently hidden until full page reload
- Profile page shows no visual feedback that the avatar was cleared

#### Fix
Add an `else` branch to `renderUser` that restores initials when avatar URL is null/invalid:

```javascript
if (profile.avatar_url && Supabase.isValidAvatarUrl(profile.avatar_url)) {
  var headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) {
    headerAvatar.innerHTML = '';
    var headerImg = document.createElement('img');
    headerImg.setAttribute('src', profile.avatar_url);
    headerImg.setAttribute('alt', name);
    headerAvatar.appendChild(headerImg);
  }
  // ... same for sidebarAvatar ...
} else {
  // Restore initials
  var headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) {
    headerAvatar.innerHTML = '';
    var initialsSpan = document.createElement('span');
    initialsSpan.id = 'avatar-initials';
    initialsSpan.textContent = initials;
    headerAvatar.appendChild(initialsSpan);
  }
  // ... same for sidebarAvatar ...
}
```

---

### BUG-A10: Dashboard Bookmark Removal Can Throw on Regex Match

| Detail | Value |
|--------|-------|
| **Severity** | 🟡 Medium |
| **Type** | Runtime Error — TypeError |
| **Files** | `dashboard.html:365`, `dashboard.html:368` |
| **Team ID** | Confirmed BUG-24 |

#### Description
After removing a bookmark, the dashboard attempts to update the "Showing X of Y" text using a regex. If the paragraph text doesn't match the expected pattern (e.g., after all bookmarks are removed, or if the text is modified), `match()` returns `null` and accessing `[1]` throws a TypeError.

#### Evidence
```javascript
// dashboard.html:365-368
var showAllText = container.querySelector('p[style*="text-align:center"]');
if (showAllText) {
  var remainingCards = container.querySelectorAll('.bookmark-card').length - 1;
  var totalBm = parseInt(showAllText.textContent.match(/of (\d+)/)[1]) - 1;  // ← Can crash
  // ...
}
```

#### Impact
- After removing the last bookmark, the "Showing X of Y" text changes to "No bookmarks — ..." which doesn't match the regex
- Subsequent bookmark removals throw `TypeError: Cannot read property '1' of null`
- The UI update fails silently — remaining cards aren't updated

#### Fix
```javascript
var match = showAllText.textContent.match(/of (\d+)/);
var totalBm = match ? parseInt(match[1]) - 1 : 0;
```

---

### BUG-A11: Like / Bookmark Controls Can Noop Before Auth Hydration

| Detail | Value |
|--------|-------|
| **Severity** | 🟡 Medium |
| **Type** | UX — Race Condition |
| **Files** | `article.html:192`, `article.html:201`, `article.html:237` |
| **Team ID** | Confirmed BUG-09 |

#### Description
The `like-btn` and `bookmark-btn` click listeners are attached during DOM parsing, but `currentUser` and `currentSlug` are only set inside the `Auth.requireAuth()` callback. Clicking like/bookmark before auth resolves causes the handlers to silently return (`if (!currentUser || !currentSlug) return;`) with no feedback.

#### Evidence
```javascript
// article.html:192 — Variables initialized as empty
var currentUser = null;
var currentSlug = '';

// article.html:201 — Listeners attached immediately
document.getElementById('like-btn').addEventListener('click', function () {
  if (!currentUser || !currentSlug) return;  // ← Silently does nothing
  // ...
});

// article.html:237 — Auth resolves later
document.addEventListener('DOMContentLoaded', function () {
  Auth.requireAuth().then(function (user) {
    if (!user) return;
    currentUser = user;
    currentSlug = App.getCurrentSlug();
    // ...
  });
});
```

#### Impact
- On slow connections, users may click like/bookmark and nothing happens
- No loading state, spinner, or "please wait" message
- Users may think the feature is broken and try repeatedly, or abandon it

#### Fix
Disable the buttons until auth resolves:

```html
<button class="reaction-btn" id="like-btn" disabled aria-label="Like this article">
<button class="bookmark-btn" id="bookmark-btn" disabled aria-label="Bookmark this article">
```

Enable them after auth:
```javascript
Auth.requireAuth().then(function (user) {
  if (!user) return;
  currentUser = user;
  currentSlug = App.getCurrentSlug();
  document.getElementById('like-btn').disabled = false;
  document.getElementById('bookmark-btn').disabled = false;
  loadArticleInteractions(user.id, currentSlug);
});
```

Add a CSS rule to show a subtle loading style on disabled buttons:
```css
.reaction-btn:disabled, .bookmark-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
```

---

### BUG-A12: `"null min read"` Display Bug

| Detail | Value |
|--------|-------|
| **Severity** | 🟡 Low |
| **Type** | Display — UI Polish |
| **Files** | `js/reader.js:92`, `js/manifest.js:130` |
| **Team ID** | Confirmed BUG-14 |

#### Description
`Manifest.calcReadTime()` can return `null` when the article folder is missing or the fetch fails. The value is used directly in string concatenation in `renderArticleHero()`, producing the literal text `"null min read"`.

#### Evidence
```javascript
// js/reader.js:92 — Used without null check
article.readTime + ' min read'  // When article.readTime is null → "null min read"

// js/manifest.js:130 — calcReadTime can return null
try {
  var response = await fetch(folder + 'index.html');
  if (!response.ok) return null;  // ← Returns null on 404
  // ...
} catch (e) {
  return null;  // ← Returns null on network error
}
```

#### Impact
- Users see "null min read" in the article byline
- Looks unprofessional and broken

#### Fix
Apply null coalescing everywhere `readTime` is displayed:

```javascript
// In reader.js, renderArticleHero():
(article.readTime || '—') + ' min read'

// In reader.js, renderRelatedArticles():
(a.readTime || '—') + ' min read'

// In articles.js, buildCard():
(article.readTime || '—') + ' min read'

// In index.html inline rendering:
(article.readTime || '—') + ' min read'
```

---

## Part 2: Team Bug Audit Table

| Team ID | Original Claim | Verdict | Notes |
|---------|---------------|---------|-------|
| BUG-01 | Stored XSS in `reader.js` | **Confirmed** | Real, but the unsafe HTML path starts in `compose.html` too, not only `reader.js`. See BUG-A03. |
| BUG-02 | Missing Supabase `articles` table | **Unverified** | This is database runtime state, not source code. The repo cannot prove whether the migration has or has not been run. The migration file exists and is correct. |
| BUG-03 | `beforeunload` async calls never complete | **Confirmed** | Real. See BUG-A08. |
| BUG-04 | Scroll listener memory leak | **Not a current bug** | `initReadingProgress()` runs once per page load. The report assumes SPA/router re-entry that does not exist in this static multi-page site. |
| BUG-05 | Unhandled Promise rejection in `reader.js:init()` | **Not supported** | `Manifest.load()` and `calcReadTime()` already absorb the cited failures (return `null` / empty array) instead of rejecting. The cited failure paths do not throw. |
| BUG-06 | `Promise.all` without `.catch()` in `renderRelatedArticles` | **Not supported** | `calcReadTime()` returns `null` on failure, so `Promise.all()` does not reject in the described scenario. |
| BUG-07 | No `.catch()` on Articles page init | **Not supported** | Same reasoning: `Manifest.load()` and `calcAllReadTimes()` do not reject on the expected failure paths. |
| BUG-08 | Dynamically injected `<link>`/`<script>` never cleaned up | **Not a current bug** | Same SPA/re-navigation assumption as BUG-04. This is a static multi-page site; navigation = full page reload, clearing all DOM. |
| BUG-09 | Like/bookmark controls noop before auth | **Confirmed (lower severity)** | Real UX race, but not as severe as originally reported. See BUG-A11. |
| BUG-10 | `verify.html` not excluded from auth redirect | **Partially supported** | The flow is brittle, but the exact redirect-loop claim is not provable from code alone. The more concrete bug is the lost redirect on `verify.html` after OAuth. See BUG-A07. |
| BUG-11 | `bookmarks.html` missing `.catch()` on auth init | **Not supported** | `Auth.requireAuth()` resolves `null` and redirects; it does not reject in the normal failure path. |
| BUG-12 | `history.html` and `profile.html` missing `.catch()` | **Not supported** | Same reasoning as BUG-11. |
| BUG-13 | Inconsistent `const`/`let`/`var` in `manifest.js` | **Not a bug** | Style consistency issue only. No functional impact. |
| BUG-14 | `"null min read"` rendered | **Confirmed** | Real. See BUG-A12. |
| BUG-15 | No Content Security Policy | **Hardening gap** | Worth doing, but this is defense-in-depth, not a direct bug by itself. See Part 3. |
| BUG-16 | Duplicate scroll reveal implementations | **Not a bug** | Duplication/maintainability issue. Both work correctly. |
| BUG-17 | Hardcoded admin emails | **Not a bug** | Maintainability/config issue. No functional defect. |
| BUG-18 | Fragile error message string matching | **Not a current bug** | Robustness improvement, not a demonstrated defect. Supabase error messages are stable. |
| BUG-19 | Missing loading states | **Not a bug** | UX/loading polish. Not a functional defect. |
| BUG-20 | Inline styles throughout HTML | **Not a bug** | Style/structure issue. No functional impact. |
| BUG-21 | `btn--auth--loading` applied inconsistently | **Not a bug** | CSS consistency issue. Works correctly on all current usages. |
| BUG-22 | Empty article script file | **Not a bug** | Dead file / unnecessary request, but not a functional defect. |
| BUG-23 | `chat-private/` exported chat log | **Not an app bug** | Repo hygiene issue. Not related to application behavior. |
| BUG-24 | Dashboard bookmark removal regex crash | **Confirmed** | Real. See BUG-A10. |
| BUG-25 | Missing profile link in header nav | **Not a bug** | Product/design choice. |
| BUG-26 | `manifest.json` articles missing `readTime` | **Not a bug** | Performance optimization only. Not a functional defect at current scale. |

---

## Part 3: Hardening Opportunities

These are not bugs — the application works as coded. But they would improve security posture and user experience.

### H-01: Content Security Policy (CSP)

No HTML page includes a `<meta http-equiv="Content-Security-Policy">` header. Adding one would provide defense-in-depth against XSS (BUG-A03) by blocking inline scripts from external sources.

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://wgeckjaxqgkvivskbtrk.supabase.co;">
```

### H-02: Error Code Matching Instead of String Matching

`js/auth.js:211-222` matches Supabase error messages using `indexOf()` on strings. If Supabase changes error wording, the mapping breaks. Using error codes (if available from the client) would be more robust.

### H-03: Loading States on Data-Fetching Pages

`dashboard.html`, `history.html`, and `profile.html` show no loading indicator while fetching data. `bookmarks.html` already has skeleton loaders. Adding consistent loading states would improve perceived performance.

---

## Part 4: Priority Fix Order

### 1. Remove mandatory auth from public browse/read pages
**Files**: `index.html`, `articles.html`, `article.html`
**Why**: This is the most impactful bug. The README explicitly states Reader works "right out of the box" and can be used offline. Mandatory auth contradicts both claims and makes the entire public site unusable without an account.
**Approach**: Remove `Auth.requireAuth()` from public pages. Render articles unconditionally. Only hydrate user-specific UI if the user happens to be logged in.

### 2. Fix XSS path end-to-end (composer + reader)
**Files**: `compose.html`, `js/reader.js`
**Why**: Stored XSS is the most severe security vulnerability. It affects every reader of a malicious article and can steal session data, deface the site, or phish credentials.
**Approach**: Sanitize `content_html` at publish time (compose.html) and at display time (reader.js). Remove `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers, and `javascript:`/`data:` URIs. Scope custom CSS to `#article-body`.

### 3. Load manifest on bookmarks/history before resolving slugs
**Files**: `bookmarks.html`, `history.html`
**Why**: All valid bookmarks and history entries appear as "Article no longer available" on every fresh page load. This makes both features appear broken to every user.
**Approach**: Add `return Manifest.load()` before calling `loadBookmarks()` and `loadHistory()`.

### 4. Stop swallowing Supabase errors into fake empty states
**Files**: `js/supabase.js`
**Why**: Backend failures (network, RLS, downtime) appear as "No bookmarks yet" / "No reading history yet" / zero stats. Users cannot distinguish between "no data" and "something is broken."
**Approach**: Change helper methods to throw on error (consistent with article CRUD helpers). Update callers to catch errors and show error states.

### 5. Change `markComplete()` to upsert, not update-only
**Files**: `js/supabase.js`
**Why**: First-time readers who complete articles quickly never get a `reading_history` row created. Completion, streak tracking, and "articles read" stats are silently lost.
**Approach**: Change `.update()` to `.upsert({ onConflict: 'user_id,article_slug' })` in `markComplete()`, matching the pattern already used in `updateProgress()`.

---

## Appendix: Fix Effort Estimates

| Priority | Bug | Effort | Risk |
|----------|-----|--------|------|
| 1 | BUG-A01: Remove mandatory auth | 30 min | Low — straightforward removal, test public rendering |
| 2 | BUG-A03: Fix XSS end-to-end | 1 hour | Medium — ensure sanitization doesn't break legitimate HTML |
| 2 | BUG-A04: Scope custom CSS | 20 min | Low — add scoping wrapper or reject global selectors |
| 3 | BUG-A02: Load manifest on bookmarks/history | 15 min | Low — add single `Manifest.load()` call |
| 4 | BUG-A06: Stop swallowing Supabase errors | 2 hours | Medium — update all callers to handle errors |
| 5 | BUG-A05: Change markComplete to upsert | 10 min | Low — single function change, well-tested pattern |
| — | BUG-A07: Fix OAuth redirect loss | 30 min | Low — sessionStorage round-trip |
| — | BUG-A08: Fix beforeunload reliability | 15 min | Low — use sendBeacon or remove handler |
| — | BUG-A09: Fix avatar initial restoration | 15 min | Low — add else branch to renderUser |
| — | BUG-A10: Fix dashboard regex crash | 5 min | Low — add null check |
| — | BUG-A11: Disable buttons before auth | 10 min | Low — add `disabled` attribute |
| — | BUG-A12: Fix "null min read" | 15 min | Low — add `|| '—'` everywhere |
