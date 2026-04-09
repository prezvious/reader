const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const { createArticleSummaryHandler } = require('../../lib/article-summary-handler.js');

const TEST_ROOT = path.join(process.cwd(), 'test-results', 'article-summary-handler');
const SILENT_LOGGER = {
  warn: function () {},
  error: function () {}
};

async function resetTestRoot() {
  await fs.rm(TEST_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(TEST_ROOT, 'articles', 'handler-empty-summary'), { recursive: true });
  await fs.mkdir(path.join(TEST_ROOT, 'data', 'summaries'), { recursive: true });
  await fs.mkdir(path.join(TEST_ROOT, 'js'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_ROOT, 'manifest.json'),
    JSON.stringify({
      articles: [
        {
          slug: 'handler-empty-summary',
          title: 'Handler Empty Summary',
          folder: 'articles/handler-empty-summary/'
        }
      ]
    }, null, 2),
    'utf8'
  );

  await fs.writeFile(
    path.join(TEST_ROOT, 'articles', 'handler-empty-summary', 'index.html'),
    '<article><p>This article exists, but no summary has been generated yet.</p></article>',
    'utf8'
  );

  await fs.writeFile(
    path.join(TEST_ROOT, 'js', 'config.json'),
    JSON.stringify({
      url: '',
      anonKey: ''
    }, null, 2),
    'utf8'
  );
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader: function (key, value) {
      this.headers[key] = value;
    },
    end: function (body) {
      this.body = body;
    }
  };
}

test('article summary handler returns an empty payload when the article exists but no summary is available', { concurrency: false }, async () => {
  await resetTestRoot();
  const originalFetch = global.fetch;

  global.fetch = async function () {
    return {
      ok: false,
      status: 404,
      text: async function () {
        return '';
      }
    };
  };

  try {
    const handler = createArticleSummaryHandler({
      rootDir: TEST_ROOT,
      logger: SILENT_LOGGER
    });
    const response = createMockResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/article-summary?slug=handler-empty-summary',
        headers: {
          host: '127.0.0.1:41731'
        }
      },
      response
    );

    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['X-Reader-Summary-Source'], 'unavailable');
    assert.equal(response.headers['X-Reader-Summary-Stale'], '0');
    assert.equal(response.headers['X-Reader-Summary-Available'], '0');
    assert.equal(payload.slug, 'handler-empty-summary');
    assert.equal(payload.title, 'Handler Empty Summary');
    assert.equal(payload.summaryMarkdown, '');
    assert.equal(payload.model, '');
  } finally {
    global.fetch = originalFetch;
  }
});
