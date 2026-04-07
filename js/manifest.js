(function () {
  'use strict';

  const MANIFEST_URL = 'manifest.json';
  let articles = [];

  /**
   * Load articles from both manifest.json (static) and the Supabase
   * articles table (DB-published). DB articles take precedence if the
   * slug collides.
   */
  async function loadManifest() {
    /* Load static manifest */
    var staticArticles = [];
    try {
      var response = await fetch(MANIFEST_URL);
      if (response.ok) {
        var data = await response.json();
        staticArticles = data.articles || [];
      }
    } catch (e) {
      console.warn('Static manifest load failed:', e);
    }

    /* Load DB articles (if Supabase is available) */
    var dbArticles = [];
    try {
      if (window.Supabase && Supabase.getPublishedArticles) {
        var rows = await Supabase.getPublishedArticles();
        dbArticles = rows.map(normalizeDbArticle);
      }
    } catch (e) {
      console.warn('DB articles load failed:', e);
    }

    /* Merge: DB articles override static by slug */
    var slugMap = {};
    staticArticles.forEach(function (a) { slugMap[a.slug] = a; });
    dbArticles.forEach(function (a) { slugMap[a.slug] = a; });
    articles = Object.values(slugMap);

    /* Sort by publishedAt descending */
    articles.sort(function (a, b) {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    window.ARTICLES = articles;
    return articles;
  }

  /**
   * Convert a Supabase articles row into the same shape
   * used by the rest of the application.
   */
  function normalizeDbArticle(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || '',
      category: row.category,
      categorySlug: row.category_slug,
      author: {
        name: row.author_name || 'Anonymous',
        avatar: row.author_avatar || '',
        bio: row.author_bio || ''
      },
      coverImage: row.cover_image || '',
      coverImageAlt: row.cover_image_alt || '',
      publishedAt: row.published_at,
      featured: row.featured,
      folder: '',          /* No folder — content lives in DB */
      source: 'db'         /* Marker for reader.js */
    };
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

    /* DB articles: fetch content_html for word count */
    if (article.source === 'db') {
      try {
        var content = await Supabase.getArticleContent(slug);
        if (content && content.content_html) {
          var temp = document.createElement('div');
          temp.innerHTML = content.content_html;
          var text = temp.textContent || temp.innerText || '';
          var minutes = calcReadTimeFromText(text);
          readTimeCache[slug] = minutes;
          article.readTime = minutes;
          return minutes;
        }
      } catch (e) {
        /* fall through */
      }
      return null;
    }

    /* Static articles: fetch from folder */
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
