const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../../js/articles-page-utils.js');

function makeArticle(overrides) {
  return Object.assign({
    slug: 'slug',
    title: 'Title',
    publishedAt: '2026-04-01',
    updatedAt: '2026-04-01T00:00:00Z'
  }, overrides);
}

test('sortArticles orders titles case-insensitively with slug tie-break for A-Z', () => {
  const sorted = utils.sortArticles([
    makeArticle({ slug: 'beta', title: 'alpha' }),
    makeArticle({ slug: 'alpha', title: 'Alpha' }),
    makeArticle({ slug: 'gamma', title: 'Zulu' })
  ], 'title-asc');

  assert.deepEqual(sorted.map((article) => article.slug), ['alpha', 'beta', 'gamma']);
});

test('sortArticles orders titles Z-A', () => {
  const sorted = utils.sortArticles([
    makeArticle({ slug: 'alpha', title: 'Alpha' }),
    makeArticle({ slug: 'gamma', title: 'Zulu' }),
    makeArticle({ slug: 'beta', title: 'Middle' })
  ], 'title-desc');

  assert.deepEqual(sorted.map((article) => article.slug), ['gamma', 'beta', 'alpha']);
});

test('sortArticles orders by modified newest first and falls back to publishedAt when updatedAt is invalid', () => {
  const sorted = utils.sortArticles([
    makeArticle({ slug: 'fallback', title: 'Fallback', updatedAt: 'not-a-date', publishedAt: '2026-04-03' }),
    makeArticle({ slug: 'latest', title: 'Latest', updatedAt: '2026-04-04T08:00:00Z' }),
    makeArticle({ slug: 'invalid', title: 'Invalid', updatedAt: '', publishedAt: '' })
  ], 'modified-desc');

  assert.deepEqual(sorted.map((article) => article.slug), ['latest', 'fallback', 'invalid']);
});

test('sortArticles orders by modified oldest first with slug tie-break on equal timestamps', () => {
  const sorted = utils.sortArticles([
    makeArticle({ slug: 'bravo', updatedAt: '2026-04-05T08:00:00Z' }),
    makeArticle({ slug: 'alpha', updatedAt: '2026-04-05T08:00:00Z' }),
    makeArticle({ slug: 'oldest', updatedAt: '2026-03-01T08:00:00Z' })
  ], 'modified-asc');

  assert.deepEqual(sorted.map((article) => article.slug), ['oldest', 'alpha', 'bravo']);
});
