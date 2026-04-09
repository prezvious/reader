const { test, expect } = require('@playwright/test');

async function stubArticlesDependencies(page) {
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
          isConfigured: true,
          getPublishedArticles: async function () { return []; },
          getArticleContent: async function () { return null; },
          isValidAvatarUrl: function (url) {
            return /^https?:\\/\\//.test(String(url || ''));
          }
        };
      `
    });
  });

  await page.route('**/js/auth.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Auth = {
          initAuth: async function () { return null; }
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

async function waitForArticles(page) {
  await expect(page.locator('#article-grid .article-card')).toHaveCount(5);
}

async function getRenderedTitles(page) {
  return await page.locator('#article-grid .article-card .article-card__title').evaluateAll((nodes) => {
    return nodes.map((node) => (node.textContent || '').trim());
  });
}

test.beforeEach(async ({ page }) => {
  await stubArticlesDependencies(page);
  await page.goto('/articles.html');
  await waitForArticles(page);
});

test('articles page defaults to tile view sorted by newest modified first', async ({ page }) => {
  await expect(page.locator('#article-grid')).toHaveClass(/article-grid--tiles/);
  await expect(page.locator('#articles-view-tiles')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#articles-sort')).toHaveValue('modified-desc');

  await expect(page.locator('#article-grid .article-card__category')).toHaveCount(5);

  const titles = await getRenderedTitles(page);
  expect(titles).toEqual([
    "How Reading Slowly Filled the Gaps I Didn't Know I Had",
    'The Three Essential Properties of the Engineering Mindset',
    'Why First Principles Thinking Beats Analogical Reasoning',
    'Inversion: The Problem-Solving Technique Nobody Uses',
    'The Art of Making Decisions That Stick'
  ]);
});

test('sort control changes ordering and persists with the selected view mode', async ({ page }) => {
  await page.selectOption('#articles-sort', 'title-asc');
  await page.click('#articles-view-list');

  await expect(page.locator('#article-grid')).toHaveClass(/article-grid--list/);
  await expect(page.locator('#articles-view-list')).toHaveAttribute('aria-pressed', 'true');

  const titles = await getRenderedTitles(page);
  expect(titles).toEqual([
    "How Reading Slowly Filled the Gaps I Didn't Know I Had",
    'Inversion: The Problem-Solving Technique Nobody Uses',
    'The Art of Making Decisions That Stick',
    'The Three Essential Properties of the Engineering Mindset',
    'Why First Principles Thinking Beats Analogical Reasoning'
  ]);

  await page.reload();
  await waitForArticles(page);

  await expect(page.locator('#article-grid')).toHaveClass(/article-grid--list/);
  await expect(page.locator('#articles-sort')).toHaveValue('title-asc');
});

test('list view renders compact metadata and category filters still work after sort changes', async ({ page }) => {
  await page.selectOption('#articles-sort', 'title-desc');
  await page.click('#articles-view-list');

  await expect(page.locator('#article-grid .article-card__category')).toHaveCount(0);
  await expect(page.locator('#article-grid .article-card__author')).toHaveCount(0);
  await expect(page.locator('#article-grid .article-card__meta-line')).toHaveCount(5);
  await expect(page.locator('#article-grid .article-card__meta-line').first()).toContainText('min read');

  await page.getByRole('button', { name: 'Science' }).click();
  await expect(page.locator('#article-grid .article-card')).toHaveCount(2);

  const titles = await getRenderedTitles(page);
  expect(titles).toEqual([
    'The Three Essential Properties of the Engineering Mindset',
    'Inversion: The Problem-Solving Technique Nobody Uses'
  ]);
});
