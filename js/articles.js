(function () {
  'use strict';

  var Utils = window.ArticlesPageUtils || {
    DEFAULT_SORT: 'modified-desc',
    DEFAULT_VIEW: 'tiles',
    STORAGE_KEYS: {
      sort: 'reader-articles-sort',
      view: 'reader-articles-view'
    },
    coerceSort: function (value) { return value || 'modified-desc'; },
    coerceView: function (value) { return value || 'tiles'; },
    sortArticles: function (articles) {
      return Array.isArray(articles) ? articles.slice() : [];
    }
  };

  var pageState = {
    category: '',
    sort: Utils.DEFAULT_SORT,
    view: Utils.DEFAULT_VIEW
  };

  function readStoredPreference(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStoredPreference(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* Ignore storage failures in privacy-restricted browsers. */
    }
  }

  function initializeState() {
    pageState.sort = Utils.coerceSort(readStoredPreference(Utils.STORAGE_KEYS.sort));
    pageState.view = Utils.coerceView(readStoredPreference(Utils.STORAGE_KEYS.view));
  }

  function readRequestedCategory() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('category') || '';
    } catch (e) {
      return '';
    }
  }

  function getAuthorName(article) {
    return article && article.author && article.author.name ? article.author.name : 'Anonymous';
  }

  function getAuthorAvatar(article) {
    return article && article.author ? article.author.avatar : '';
  }

  function getCardAriaLabel(article) {
    return App.escapeHtml(article.title) + ' by ' + App.escapeHtml(getAuthorName(article));
  }

  function getReadTimeLabel(article) {
    return article && article.readTime ? article.readTime + ' min read' : '— min read';
  }

  function buildAvatar(article, initials) {
    var authorName = getAuthorName(article);
    var avatar = getAuthorAvatar(article);

    if (avatar) {
      return '<div class="article-card__avatar"><img src="' + App.escapeHtml(avatar) + '" alt="' + App.escapeHtml(authorName) + '" loading="lazy"></div>';
    }

    return '<div class="article-card__avatar">' + App.escapeHtml(initials) + '</div>';
  }

  function buildMedia(article, view, initials) {
    var hasImage = article.coverImage && article.coverImage.length > 0;
    var mediaClass = 'article-card__media article-card__media--' + view;
    var imageClass = 'article-card__image article-card__image--' + view;

    if (hasImage) {
      return '<div class="' + mediaClass + '"><img class="' + imageClass + '" src="' + App.escapeHtml(article.coverImage) + '" alt="' + App.escapeHtml(article.coverImageAlt || article.title) + '" loading="lazy"></div>';
    }

    return '<div class="' + mediaClass + '"><div class="' + imageClass + ' article-card__image--placeholder">' + App.escapeHtml(initials) + '</div></div>';
  }

  function buildTileCard(article, index) {
    var initials = Manifest.getInitials(getAuthorName(article));
    var date = Manifest.formatDate(article.publishedAt);
    var url = App.getArticleUrl(article.slug);

    return '<article class="article-card article-card--tile reveal" data-slug="' + App.escapeHtml(article.slug) + '" style="transition-delay:' + (index * 0.06) + 's">' +
      '<a href="' + App.escapeHtml(url) + '" class="article-card__surface article-card__surface--tile" aria-label="' + getCardAriaLabel(article) + '">' +
        buildMedia(article, 'tile', initials) +
        '<div class="article-card__body article-card__body--tile">' +
          '<span class="article-card__category">' + App.escapeHtml(article.category) + '</span>' +
          '<h2 class="article-card__title article-card__title--tile">' + App.escapeHtml(article.title) + '</h2>' +
          '<div class="article-card__meta article-card__meta--tile">' +
            buildAvatar(article, initials) +
            '<div class="article-card__info">' +
              '<div class="article-card__author">' + App.escapeHtml(getAuthorName(article)) + '</div>' +
              '<div class="article-card__date">' + App.escapeHtml(date) + '</div>' +
            '</div>' +
            '<span class="article-card__read-time">' + App.escapeHtml(getReadTimeLabel(article)) + '</span>' +
          '</div>' +
        '</div>' +
      '</a>' +
    '</article>';
  }

  function buildListCard(article, index) {
    var initials = Manifest.getInitials(getAuthorName(article));
    var date = Manifest.formatDate(article.publishedAt);
    var url = App.getArticleUrl(article.slug);

    return '<article class="article-card article-card--list reveal" data-slug="' + App.escapeHtml(article.slug) + '" style="transition-delay:' + (index * 0.04) + 's">' +
      '<a href="' + App.escapeHtml(url) + '" class="article-card__surface article-card__surface--list" aria-label="' + getCardAriaLabel(article) + '">' +
        buildMedia(article, 'list', initials) +
        '<div class="article-card__body article-card__body--list">' +
          '<h2 class="article-card__title article-card__title--list">' + App.escapeHtml(article.title) + '</h2>' +
          '<div class="article-card__meta-line">' +
            '<span class="article-card__date">' + App.escapeHtml(date) + '</span>' +
            '<span class="article-card__meta-separator" aria-hidden="true">|</span>' +
            '<span class="article-card__read-time">' + App.escapeHtml(getReadTimeLabel(article)) + '</span>' +
          '</div>' +
        '</div>' +
      '</a>' +
    '</article>';
  }

  function getFilteredArticles() {
    var allArticles = Array.isArray(window.ARTICLES) ? window.ARTICLES : [];
    var filtered = pageState.category
      ? allArticles.filter(function (article) { return article.categorySlug === pageState.category; })
      : allArticles;

    return Utils.sortArticles(filtered, pageState.sort);
  }

  function renderArticles(articles) {
    var grid = document.getElementById('article-grid');
    if (!grid) return;

    grid.classList.remove('article-grid--tiles', 'article-grid--list');
    grid.classList.add('article-grid--' + pageState.view);
    grid.setAttribute('data-view', pageState.view);

    if (!articles || articles.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p class="empty-state__title">No articles found</p><p class="empty-state__text">Try a different category or check back later.</p></div>';
      return;
    }

    grid.innerHTML = articles.map(function (article, index) {
      if (pageState.view === 'list') return buildListCard(article, index);
      return buildTileCard(article, index);
    }).join('');

    if (window.App && window.App._initScrollReveal) {
      window.App._initScrollReveal();
    }
  }

  function renderCategoryFilters() {
    var container = document.getElementById('category-filter');
    if (!container) return;

    var categories = Manifest.getCategories();
    var html = '<button class="category-filter__btn' + (pageState.category === '' ? ' category-filter__btn--active' : '') + '" data-category="">All</button>';

    categories.forEach(function (cat) {
      var isActive = pageState.category === cat.slug;
      html += '<button class="category-filter__btn' + (isActive ? ' category-filter__btn--active' : '') + '" data-category="' + App.escapeHtml(cat.slug) + '">' + App.escapeHtml(cat.name) + '</button>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.category-filter__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pageState.category = btn.getAttribute('data-category') || '';
        renderCategoryFilters();
        renderArticles(getFilteredArticles());
      });
    });
  }

  function syncToolbar() {
    var sortSelect = document.getElementById('articles-sort');
    if (sortSelect) sortSelect.value = pageState.sort;

    document.querySelectorAll('.articles-view-toggle__btn').forEach(function (button) {
      var isActive = button.getAttribute('data-view') === pageState.view;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setSort(sort) {
    pageState.sort = Utils.coerceSort(sort);
    writeStoredPreference(Utils.STORAGE_KEYS.sort, pageState.sort);
    syncToolbar();
    renderArticles(getFilteredArticles());
  }

  function setView(view) {
    pageState.view = Utils.coerceView(view);
    writeStoredPreference(Utils.STORAGE_KEYS.view, pageState.view);
    syncToolbar();
    renderArticles(getFilteredArticles());
  }

  function initToolbar() {
    var sortSelect = document.getElementById('articles-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        setSort(sortSelect.value);
      });
    }

    document.querySelectorAll('.articles-view-toggle__btn').forEach(function (button) {
      button.addEventListener('click', function () {
        setView(button.getAttribute('data-view') || Utils.DEFAULT_VIEW);
      });
    });

    syncToolbar();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initializeState();
    initToolbar();

    Manifest.load().then(function () {
      pageState.category = readRequestedCategory() || pageState.category;
      return Manifest.calcAllReadTimes();
    }).then(function () {
      renderCategoryFilters();
      renderArticles(getFilteredArticles());
    });
  });
})();
