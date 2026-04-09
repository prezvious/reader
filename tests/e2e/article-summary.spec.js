const { test, expect } = require('@playwright/test');

function serialize(value) {
  return JSON.stringify(value);
}

async function stubSharedDependencies(page, options) {
  const publishedArticles = (options && options.publishedArticles) || [];
  const articleContentBySlug = (options && options.articleContentBySlug) || {};

  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.supabase = { createClient: function () { return {}; } };'
    });
  });

  await page.route('**/js/supabase.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body:
        'window.Supabase = {' +
        '  isConfigured: true,' +
        '  getPublishedArticles: async function () { return ' + serialize(publishedArticles) + '; },' +
        '  getArticleContent: async function (slug) { return (' + serialize(articleContentBySlug) + ')[slug] || null; },' +
        '  getArticleBySlug: async function (slug) {' +
        '    return (' + serialize(publishedArticles) + ').find(function (article) { return article.slug === slug; }) || null;' +
        '  },' +
        '  isValidAvatarUrl: function (url) { return /^https?:\\/\\//.test(String(url || "")); }' +
        '};'
    });
  });

  await page.route('**/js/auth.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.Auth = { initAuth: async function () { return null; } };'
    });
  });

  await page.route('**/js/search.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: ''
    });
  });
}

test('bundled articles load their summary through the shared summary endpoint', async ({ page }) => {
  await stubSharedDependencies(page);

  await page.goto('/article.html?slug=first-principles-thinking');
  await expect(page.locator('#summary-trigger-label')).toHaveText('Open summary');

  await page.click('#summary-trigger');
  await expect(page.locator('#summary-content')).toContainText('Overview');
  await expect(page.locator('#summary-content')).toContainText('The text contrasts two modes of human reasoning');
});

test('db-backed articles use the same summary drawer contract as bundled articles', async ({ page }) => {
  const slug = 'fresh-db-article';
  await stubSharedDependencies(page, {
    publishedArticles: [
      {
        id: 99,
        slug: slug,
        title: 'Fresh DB Article',
        excerpt: 'Fresh excerpt',
        category: 'Psychology',
        category_slug: 'psychology',
        author_name: 'Max',
        author_avatar: '',
        author_bio: '',
        cover_image: '',
        cover_image_alt: '',
        published_at: '2026-04-10',
        updated_at: '2026-04-10T00:00:00Z',
        featured: false
      }
    ],
    articleContentBySlug: {
      'fresh-db-article': {
        content_html: '<p>Fresh body copy from the database.</p>',
        custom_css: ''
      }
    }
  });

  await page.route('**/api/article-summary?slug=fresh-db-article', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        slug: slug,
        title: 'Fresh DB Article',
        model: 'openrouter/free',
        generatedAt: '2026-04-10T00:00:00.000Z',
        summaryMarkdown: '## Overview\nFresh summary text from the shared API route.'
      })
    });
  });

  await page.goto('/article.html?slug=' + slug);
  await expect(page.locator('#summary-trigger-label')).toHaveText('Open summary');

  await page.click('#summary-trigger');
  await expect(page.locator('#summary-content')).toContainText('Fresh summary text from the shared API route.');
});
