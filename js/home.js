(function () {
  'use strict';

  var state = {
    tab: 'latest'
  };

  function getSafeArticles() {
    return Array.isArray(window.ARTICLES) ? window.ARTICLES.slice() : [];
  }

  function getDisplayName(article) {
    return article && article.author && article.author.name ? article.author.name : 'Anonymous';
  }

  function getSortTime(article) {
    var value = article && (article.updatedAt || article.publishedAt);
    var time = value ? new Date(value).getTime() : NaN;
    return isNaN(time) ? 0 : time;
  }

  function sortByRecent(articles) {
    return articles.slice().sort(function (a, b) {
      return getSortTime(b) - getSortTime(a);
    });
  }

  function getVisibleArticles() {
    var articles = sortByRecent(getSafeArticles());
    if (state.tab === 'featured') {
      return articles.filter(function (article) { return !!article.featured; });
    }
    return articles;
  }

  function formatShortDate(value) {
    if (!value) return '';

    var date = new Date(value);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  function getReadTime(article) {
    return article && article.readTime ? article.readTime + ' min read' : 'Quick read';
  }

  function buildMedia(article) {
    var initials = Manifest.getInitials(getDisplayName(article));
    var category = article && article.category ? article.category : 'Reader';

    if (article && article.coverImage) {
      return '<div class="feed-item__media feed-item__media--image">' +
        '<img src="' + App.escapeHtml(article.coverImage) + '" alt="' + App.escapeHtml(article.coverImageAlt || article.title || category) + '" loading="lazy">' +
      '</div>';
    }

    return '<div class="feed-item__media" aria-hidden="true">' +
      '<span class="feed-item__media-initials">' + App.escapeHtml(initials) + '</span>' +
      '<span class="feed-item__media-label">' + App.escapeHtml(category) + '</span>' +
    '</div>';
  }

  function buildFeedItem(article, index) {
    var href = App.getArticleUrl(article.slug);
    var author = getDisplayName(article);
    var category = article && article.category ? article.category : 'General';
    var date = formatShortDate(article && (article.updatedAt || article.publishedAt));

    return '<article class="feed-item">' +
      '<a class="feed-item__link" href="' + App.escapeHtml(href) + '">' +
        '<div class="feed-item__content">' +
          '<div class="feed-item__kicker">' +
            '<span>' + App.escapeHtml(author) + '</span>' +
            '<span class="feed-item__dot" aria-hidden="true"></span>' +
            '<span>' + App.escapeHtml(category) + '</span>' +
          '</div>' +
          '<h2 class="feed-item__title">' + App.escapeHtml(article.title || 'Untitled') + '</h2>' +
          '<p class="feed-item__excerpt">' + App.escapeHtml(article.excerpt || 'Read the full piece.') + '</p>' +
          '<div class="feed-item__meta">' +
            '<span>' + App.escapeHtml(date) + '</span>' +
            '<span class="feed-item__dot" aria-hidden="true"></span>' +
            '<span>' + App.escapeHtml(getReadTime(article)) + '</span>' +
          '</div>' +
        '</div>' +
        buildMedia(article) +
      '</a>' +
    '</article>';
  }

  function renderTabs() {
    var buttons = document.querySelectorAll('[data-home-tab]');
    buttons.forEach(function (button) {
      var isActive = button.getAttribute('data-home-tab') === state.tab;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  function renderFeed() {
    var container = document.getElementById('home-feed-list');
    if (!container) return;

    var articles = getVisibleArticles();
    if (!articles.length) {
      container.innerHTML = '<div class="home-feed__empty">Nothing here yet.</div>';
      return;
    }

    container.innerHTML = articles.map(buildFeedItem).join('');
  }

  function renderTopics() {
    var container = document.getElementById('home-topics');
    if (!container) return;

    var counts = {};
    getSafeArticles().forEach(function (article) {
      var slug = article && article.categorySlug ? article.categorySlug : 'general';
      if (!counts[slug]) {
        counts[slug] = {
          name: article && article.category ? article.category : 'General',
          slug: slug,
          count: 0
        };
      }
      counts[slug].count += 1;
    });

    var topics = Object.keys(counts).map(function (key) { return counts[key]; }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.name < b.name ? -1 : 1;
    });

    container.innerHTML = topics.map(function (topic) {
      return '<a class="topic-chip" href="articles.html?category=' + encodeURIComponent(topic.slug) + '">' +
        App.escapeHtml(topic.name) +
      '</a>';
    }).join('');
  }

  function renderRecent() {
    var container = document.getElementById('home-recent');
    if (!container) return;

    var html = sortByRecent(getSafeArticles()).slice(0, 3).map(function (article) {
      return '<a class="rail-list__item" href="' + App.escapeHtml(App.getArticleUrl(article.slug)) + '">' +
        '<span class="rail-list__eyebrow">' + App.escapeHtml(formatShortDate(article.updatedAt || article.publishedAt)) + '</span>' +
        '<span class="rail-list__title">' + App.escapeHtml(article.title || 'Untitled') + '</span>' +
      '</a>';
    }).join('');

    container.innerHTML = html || '<p class="rail-note">New pieces will show up here.</p>';
  }

  function bindEvents() {
    document.querySelectorAll('[data-home-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.tab = button.getAttribute('data-home-tab') || 'latest';
        renderTabs();
        renderFeed();
      });
    });
  }

  function init() {
    if (!document.getElementById('home-feed-list')) return;

    bindEvents();

    Manifest.load()
      .then(function () { return Manifest.calcAllReadTimes(); })
      .catch(function () { return []; })
      .finally(function () {
        renderTabs();
        renderFeed();
        renderTopics();
        renderRecent();
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
