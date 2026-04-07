(function () {
  'use strict';

  function renderArticles(articles) {
    var grid = document.getElementById('article-grid');
    if (!grid) return;

    if (!articles || articles.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p class="empty-state__title">No articles found</p><p class="empty-state__text">Try a different category or check back later.</p></div>';
      return;
    }

    var sorted = articles.slice().sort(function (a, b) {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    grid.innerHTML = sorted.map(function (article, i) {
      return buildCard(article, i);
    }).join('');

    grid.querySelectorAll('.article-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var slug = card.getAttribute('data-slug');
        if (slug) window.location.href = App.getArticleUrl(slug);
      });
    });

    initScrollReveal();
  }

  function buildCard(article, index) {
    var initials = Manifest.getInitials(article.author.name);
    var date = Manifest.formatDate(article.publishedAt);
    var url = App.getArticleUrl(article.slug);
    var hasImage = article.coverImage && article.coverImage.length > 0;

    var imageHtml;
    if (hasImage) {
      imageHtml = '<img class="article-card__image" src="' + article.coverImage + '" alt="' + (article.coverImageAlt || article.title) + '" loading="lazy">';
    } else {
      imageHtml = '<div class="article-card__image article-card__image--placeholder">' + initials + '</div>';
    }

    var avatarHtml;
    if (article.author.avatar) {
      avatarHtml = '<div class="article-card__avatar"><img src="' + article.author.avatar + '" alt="' + article.author.name + '"></div>';
    } else {
      avatarHtml = '<div class="article-card__avatar">' + initials + '</div>';
    }

    return '<article class="article-card reveal" data-slug="' + article.slug + '" style="transition-delay:' + (index * 0.06) + 's">' +
      '<a href="' + url + '" class="article-card__link" aria-hidden="true" tabindex="-1">' + imageHtml + '</a>' +
      '<div class="article-card__body">' +
        '<span class="article-card__category">' + escapeHtml(article.category) + '</span>' +
        '<h3 class="article-card__title">' + escapeHtml(article.title) + '</h3>' +
        '<p class="article-card__excerpt">' + escapeHtml(article.excerpt) + '</p>' +
        '<div class="article-card__meta">' +
          avatarHtml +
          '<div class="article-card__info">' +
            '<div class="article-card__author">' + escapeHtml(article.author.name) + '</div>' +
            '<div class="article-card__date">' + date + '</div>' +
          '</div>' +
          '<span class="article-card__read-time">' + article.readTime + ' min read</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderCategoryFilters() {
    var container = document.getElementById('category-filter');
    if (!container) return;

    var categories = Manifest.getCategories();
    var html = '<button class="category-filter__btn category-filter__btn--active" data-category="">All</button>';

    categories.forEach(function (cat) {
      html += '<button class="category-filter__btn" data-category="' + escapeHtml(cat.slug) + '">' + escapeHtml(cat.name) + '</button>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.category-filter__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        container.querySelectorAll('.category-filter__btn').forEach(function (b) { b.classList.remove('category-filter__btn--active'); });
        btn.classList.add('category-filter__btn--active');
        var category = btn.getAttribute('data-category');
        filterByCategory(category);
      });
    });
  }

  function filterByCategory(category) {
    var allArticles = window.ARTICLES || [];
    if (!category) {
      renderArticles(allArticles);
    } else {
      renderArticles(Manifest.getByCategory(category));
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal:not(.visible)');
    if (!els.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { observer.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Manifest.load().then(function () {
      return Manifest.calcAllReadTimes();
    }).then(function () {
      renderCategoryFilters();
      renderArticles(window.ARTICLES);
    });
  });
})();
