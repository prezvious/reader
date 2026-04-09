const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.NodeFilter = dom.window.NodeFilter;

const utils = require('../../js/article-content-utils.js');

test('normalizeArticleHtml converts inline font sizes and editor divs into semantic classes', () => {
  const html = utils.normalizeArticleHtml(
    '<div><span style="font-size: 24px;">Hello</span></div><p style="padding-left:2em;">Indented</p>',
    { document: dom.window.document }
  );

  assert.match(html, /<p><span class="article-font-size--24">Hello<\/span><\/p>/);
  assert.match(html, /<p class="article-indent-1">Indented<\/p>/);
});

test('sanitizeHtml strips unsafe markup while preserving allowed ordered-list attributes', () => {
  const html = utils.sanitizeHtml(
    '<p onclick="alert(1)" class="article-indent-1 bad-class">Safe</p><script>alert(1)</script><ol type="I" style="color:red"><li>One</li></ol><img src="javascript:alert(1)" onerror="boom()">',
    { document: dom.window.document }
  );

  assert.equal(html.includes('onclick='), false);
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('bad-class'), false);
  assert.match(html, /<p class="article-indent-1">Safe<\/p>/);
  assert.match(html, /<ol type="I"><li>One<\/li><\/ol>/);
  assert.equal(html.includes('javascript:'), false);
});

test('scopeArticleCss scopes selectors while preserving keyframes', () => {
  const scoped = utils.scopeArticleCss(
    '@media (min-width: 700px) {.hero, p { color: red; }} @keyframes fade { 0% { opacity: 0; } 100% { opacity: 1; } }',
    '#article-body'
  );

  assert.match(scoped, /@media \(min-width: 700px\) \{#article-body \.hero, #article-body p \{/);
  assert.match(scoped, /@keyframes fade \{ 0% \{ opacity: 0; \} 100% \{ opacity: 1; \} \}/);
});

test('renderArticleHtml converts standalone image URLs into figures', () => {
  const url = 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370?q=80&w=1332&auto=format';
  const html = utils.renderArticleHtml(
    `<p>${url}</p><p>Body copy</p>`,
    { document: dom.window.document }
  );

  assert.match(html, /<figure class="article-image"><img src="https:\/\/images\.unsplash\.com\/photo-1711409664431-4e7914ac2370\?q=80&amp;w=1332&amp;auto=format" alt="" loading="lazy"><\/figure>/);
  assert.match(html, /<p>Body copy<\/p>/);
});

test('renderArticleHtml removes body media that duplicates the selected cover image', () => {
  const url = 'https://images.unsplash.com/photo-1711409664431-4e7914ac2370?q=80&w=1332&auto=format';
  const html = utils.renderArticleHtml(
    `<p>${url}</p><figure class="article-image"><img src="${url}" alt="" loading="lazy"></figure><p>Body copy</p>`,
    { document: dom.window.document, coverImage: url }
  );

  assert.equal(html.includes('images.unsplash.com/photo-1711409664431-4e7914ac2370'), false);
  assert.match(html, /<p>Body copy<\/p>/);
});
