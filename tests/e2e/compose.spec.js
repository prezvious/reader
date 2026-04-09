const { test, expect } = require('@playwright/test');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function stubComposeDependencies(page) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.supabase = { createClient: function () { return {}; } };'
    });
  });

  await page.route('**/js/supabase.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Supabase = {
          getArticleBySlug: async function () { return null; },
          publishArticle: async function (article) { window.__publishedArticle = article; return article; },
          updateArticle: async function (slug, article) { window.__publishedArticle = article; return article; }
        };
      `
    });
  });

  await page.route('**/js/auth.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Auth = {
          requireAuth: async function () {
            return {
              email: 'saxumfluens@gmail.com',
              profile: { display_name: 'QA Admin' }
            };
          },
          signOut: async function () {}
        };
      `
    });
  });

  await page.route('**/js/manifest.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Manifest = {
          load: async function () { return []; },
          getInitials: function (name) {
            return String(name || '')
              .split(/\\s+/)
              .filter(Boolean)
              .map(function (part) { return part.charAt(0).toUpperCase(); })
              .join('')
              .slice(0, 2) || '?';
          },
          formatDate: function (value) { return value || ''; }
        };
      `
    });
  });

  await page.route('**/js/app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.App = {
          renderUser: function () {},
          showToast: function (message) { window.__lastToast = message; },
          escapeHtml: ${escapeHtml.toString()},
          sanitizeHtml: function (html) {
            return window.ArticleContentUtils.sanitizeHtml(
              window.ArticleContentUtils.normalizeArticleHtml(html || '')
            );
          },
          normalizeArticleHtml: function (html) {
            return window.ArticleContentUtils.normalizeArticleHtml(html || '');
          },
          scopeArticleCss: function (css, scopes) {
            return window.ArticleContentUtils.scopeArticleCss(css || '', scopes);
          }
        };
      `
    });
  });

  await page.route('**/js/search.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: ''
    });
  });
}

async function setEditorHtml(page, html) {
  await page.locator('#editor-content').evaluate((node, nextHtml) => {
    node.innerHTML = nextHtml;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, html);
  await page.waitForTimeout(650);
}

async function selectParagraphText(page) {
  await page.locator('#editor-content').evaluate((node) => {
    const paragraph = node.querySelector('p');
    const textNode = paragraph && paragraph.firstChild;
    if (!textNode) return;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.textContent.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

test.beforeEach(async ({ page }) => {
  await stubComposeDependencies(page);
  await page.goto('/compose.html');
  await expect(page.locator('#compose-page')).toBeVisible();
});

test('draft save and restore persists HTML, custom CSS, slug mode, and cover image', async ({ page }) => {
  await page.fill('#meta-title', 'Drafted article');
  await page.fill('#meta-slug', 'custom-draft-slug');
  await page.fill('#meta-excerpt', 'Excerpt');
  await page.locator('#use-custom-style').check();
  await page.fill('#custom-css-input', '.article-body h2 { color: red; }');
  await setEditorHtml(page, '<p>Intro</p><p><img src="https://images.unsplash.com/photo-example" alt=""></p>');

  await page.locator('#cover-options').evaluate((container, value) => {
    const input = container.querySelector('input[name="cover-image"][value="' + value + '"]');
    if (!input) return;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, 'https://images.unsplash.com/photo-example');
  await page.click('#save-draft-btn');
  await page.waitForTimeout(500);

  const storedDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('reader-draft')));
  expect(storedDraft.contentHtml).toContain('<p>Intro</p>');
  expect(storedDraft.slugManual).toBe(true);
  expect(storedDraft.coverImage).toBe('https://images.unsplash.com/photo-example');
  expect(storedDraft.useCustomStyle).toBe(true);

  await page.reload();
  await expect(page.locator('#draft-banner')).toBeVisible();
  await expect(page.locator('#meta-slug')).toHaveValue('custom-draft-slug');
  await expect(page.locator('#custom-css-input')).toHaveValue('.article-body h2 { color: red; }');
  await expect(page.locator('#editor-content')).toContainText('Intro');
  await expect(page.locator('input[name="cover-image"][value="https://images.unsplash.com/photo-example"]')).toBeChecked();
});

test('toolbar actions emit semantic HTML and undo/redo round-trips editor state', async ({ page }) => {
  await setEditorHtml(page, '<p>Quoted text</p>');
  await selectParagraphText(page);
  await page.getByTitle('Blockquote').click();
  await expect(page.locator('#editor-content')).toContainText('Quoted text');
  await expect(await page.locator('#editor-content').innerHTML()).toContain('<blockquote>');

  await setEditorHtml(page, '<p>List item</p>');
  await selectParagraphText(page);
  await page.getByTitle('Bullet List').click();
  expect(await page.locator('#editor-content').innerHTML()).toContain('<ul>');
  expect(await page.locator('#editor-content').innerHTML()).not.toContain('- ');

  await setEditorHtml(page, '<p>Divider target</p>');
  await page.locator('#editor-content').click();
  await page.getByTitle('Divider').click();
  expect(await page.locator('#editor-content').innerHTML()).toContain('<hr>');

  await setEditorHtml(page, '<p>First state</p>');
  await setEditorHtml(page, '<p>Second state</p>');
  await page.click('#undo-btn');
  await expect(page.locator('#editor-content')).toContainText('First state');
  await page.click('#redo-btn');
  await expect(page.locator('#editor-content')).toContainText('Second state');
});

test('find and replace stays scoped to editor content', async ({ page }) => {
  await page.fill('#meta-title', 'alpha title');
  await setEditorHtml(page, '<p>alpha beta alpha</p>');

  await page.press('#editor-content', 'Control+f');
  await page.fill('#find-input', 'alpha');
  await expect(page.locator('#find-count')).toHaveText('1 of 2');

  await page.click('#find-toggle-replace');
  await page.fill('#replace-input', 'omega');
  await page.click('#find-replace-btn');

  await expect(page.locator('#meta-title')).toHaveValue('alpha title');
  await expect(page.locator('#editor-content')).toContainText('omega beta alpha');
});
