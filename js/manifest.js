(function () {
  'use strict';

  const MANIFEST_URL = 'manifest.json';
  let articles = [];

  async function loadManifest() {
    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) throw new Error('Failed to load manifest');
      const data = await response.json();
      articles = data.articles || [];
      window.ARTICLES = articles;
      return articles;
    } catch (error) {
      console.error('Manifest load error:', error);
      window.ARTICLES = [];
      return [];
    }
  }

  function getArticleBySlug(slug) {
    return articles.find(function (a) { return a.slug === slug; });
  }

  function getArticlesByCategory(categorySlug) {
    return articles.filter(function (a) { return a.categorySlug === categorySlug; });
  }

  function getFeaturedArticles() {
    return articles.filter(function (a) { return a.featured; });
  }

  function getAllCategories() {
    const seen = new Set();
    return articles.filter(function (a) {
      if (seen.has(a.categorySlug)) return false;
      seen.add(a.categorySlug);
      return true;
    }).map(function (a) {
      return { name: a.category, slug: a.categorySlug };
    });
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function getInitials(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') return '?';
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }

  const WORDS_PER_MINUTE = 230;
  var readTimeCache = {};

  function calcReadTimeFromText(text) {
    if (!text || typeof text !== 'string') return 1;
    var words = text.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
    var minutes = Math.ceil(words.length / WORDS_PER_MINUTE);
    return Math.max(1, minutes);
  }

  async function calcReadTime(article) {
    var slug = article.slug;
    if (readTimeCache[slug]) {
      article.readTime = readTimeCache[slug];
      return readTimeCache[slug];
    }

    var folder = article.folder || '';
    if (!folder) return null;

    try {
      var response = await fetch(folder + 'index.html');
      if (!response.ok) return null;
      var html = await response.text();
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var text = temp.textContent || temp.innerText || '';
      var minutes = calcReadTimeFromText(text);
      readTimeCache[slug] = minutes;
      article.readTime = minutes;
      return minutes;
    } catch (e) {
      return null;
    }
  }

  async function calcAllReadTimes() {
    var promises = articles.map(function (article) {
      return calcReadTime(article);
    });
    await Promise.all(promises);
    return articles;
  }

  window.Manifest = {
    load: loadManifest,
    getBySlug: getArticleBySlug,
    getByCategory: getArticlesByCategory,
    getFeatured: getFeaturedArticles,
    getCategories: getAllCategories,
    formatDate: formatDate,
    getInitials: getInitials,
    calcReadTime: calcReadTime,
    calcAllReadTimes: calcAllReadTimes,
    calcReadTimeFromText: calcReadTimeFromText
  };
})();
