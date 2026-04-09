const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const summaryService = require('../../lib/summary-service.js');

const TEST_ROOT = path.join(process.cwd(), 'test-results', 'summary-service');
const SILENT_LOGGER = {
  warn: function () {},
  error: function () {}
};

async function resetTestRoot() {
  await fs.rm(TEST_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(TEST_ROOT, 'data', 'summaries'), { recursive: true });
}

test('htmlToPlainText removes standalone image paragraphs before summarization', () => {
  const text = summaryService.htmlToPlainText(
    '<p>https://images.unsplash.com/photo-1711409664431-4e7914ac2370?q=80&w=1332&auto=format</p><p>Body copy stays here.</p>'
  );

  assert.equal(text.includes('images.unsplash.com'), false);
  assert.match(text, /Body copy stays here\./);
});

test('resolveSummaryForArticle returns a fresh bundled summary when the cache is empty', async () => {
  await resetTestRoot();

  const article = {
    slug: 'sample-static-article',
    title: 'Sample Static Article',
    source: 'static',
    html: '<p>Body copy stays here.</p>'
  };
  const fingerprint = summaryService.buildFingerprint(article);

  await fs.writeFile(
    path.join(TEST_ROOT, 'data', 'summaries', article.slug + '.json'),
    JSON.stringify({
      slug: article.slug,
      model: 'openrouter/free',
      generatedAt: '2026-04-10T00:00:00.000Z',
      summaryMarkdown: '## Overview\nBody copy stays here.',
      contentHash: fingerprint.contentHash,
      promptVersion: summaryService.DEFAULT_PROMPT_VERSION,
      wordCount: fingerprint.wordCount
    }, null, 2),
    'utf8'
  );

  const result = await summaryService.resolveSummaryForArticle({
    rootDir: TEST_ROOT,
    config: {
      promptVersion: summaryService.DEFAULT_PROMPT_VERSION,
      openRouterApiKey: '',
      models: [],
      supabase: {
        url: '',
        anonKey: '',
        serviceRoleKey: ''
      }
    },
    article: article,
    allowGeneration: false,
    logger: SILENT_LOGGER
  });

  assert.equal(result.source, 'bundled');
  assert.equal(result.stale, false);
  assert.match(result.summary.summaryMarkdown, /## Overview/);
});

test('resolveSummaryForArticle falls back to a stale bundled summary when regeneration is unavailable', async () => {
  await resetTestRoot();

  const article = {
    slug: 'stale-static-article',
    title: 'Stale Static Article',
    source: 'static',
    html: '<p>Updated body copy stays here.</p>'
  };

  await fs.writeFile(
    path.join(TEST_ROOT, 'data', 'summaries', article.slug + '.json'),
    JSON.stringify({
      slug: article.slug,
      model: 'Seed summary',
      generatedAt: '2026-04-09T00:00:00.000Z',
      summaryMarkdown: '## Overview\nOlder summary text.',
      contentHash: 'outdated-hash',
      promptVersion: 'legacy-prompt',
      wordCount: 3
    }, null, 2),
    'utf8'
  );

  const result = await summaryService.resolveSummaryForArticle({
    rootDir: TEST_ROOT,
    config: {
      promptVersion: summaryService.DEFAULT_PROMPT_VERSION,
      openRouterApiKey: '',
      models: [],
      supabase: {
        url: '',
        anonKey: '',
        serviceRoleKey: ''
      }
    },
    article: article,
    allowGeneration: false,
    logger: SILENT_LOGGER
  });

  assert.equal(result.source, 'bundled');
  assert.equal(result.stale, true);
  assert.match(result.summary.summaryMarkdown, /Older summary text\./);
});

test('loadRuntimeConfig falls back to deployment config asset when local files are unavailable', async () => {
  await resetTestRoot();
  const originalFetch = global.fetch;

  global.fetch = async function (url) {
    if (String(url).endsWith('/js/config.json')) {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return JSON.stringify({
            url: 'https://example.supabase.co',
            anonKey: 'anon-token'
          });
        }
      };
    }

    return {
      ok: false,
      status: 404,
      text: async function () {
        return '';
      }
    };
  };

  try {
    const config = await summaryService.loadRuntimeConfig(TEST_ROOT, {}, {
      assetBaseUrl: 'https://reader-zeta-six.vercel.app'
    });

    assert.equal(config.supabase.url, 'https://example.supabase.co');
    assert.equal(config.supabase.anonKey, 'anon-token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('loadStaticArticleBySlug falls back to deployment assets when files are not bundled locally', async () => {
  await resetTestRoot();
  const originalFetch = global.fetch;

  global.fetch = async function (url) {
    const value = String(url);
    if (value.endsWith('/manifest.json')) {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return JSON.stringify({
            articles: [
              {
                slug: 'remote-static-article',
                title: 'Remote Static Article',
                folder: 'articles/remote-static-article/'
              }
            ]
          });
        }
      };
    }

    if (value.endsWith('/articles/remote-static-article/index.html')) {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return '<p>Remote static body.</p>';
        }
      };
    }

    return {
      ok: false,
      status: 404,
      text: async function () {
        return '';
      }
    };
  };

  try {
    const article = await summaryService.loadStaticArticleBySlug(TEST_ROOT, 'remote-static-article', {
      assetBaseUrl: 'https://reader-zeta-six.vercel.app'
    });

    assert.equal(article.slug, 'remote-static-article');
    assert.match(article.html, /Remote static body/);
  } finally {
    global.fetch = originalFetch;
  }
});
