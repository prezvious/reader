(function () {
  'use strict';

  function init() {
    var slug = App.getCurrentSlug();
    if (!slug) {
      showError('No article specified', 'Please select an article from the list.');
      return;
    }

    Manifest.load().then(function () {
      var article = Manifest.getBySlug(slug);
      if (!article) {
        showError('Article not found', 'The article you\'re looking for doesn\'t exist.');
        return;
      }

      return Manifest.calcReadTime(article).then(function () {
        setPageMetadata(article);
        renderArticleHero(article);
        loadArticleContent(article);
        renderRelatedArticles(article);
      });
    });
  }

  function setPageMetadata(article) {
    document.title = article.title + ' — Reader';

    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', article.excerpt);

    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', article.title);

    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', article.excerpt);

    if (article.coverImage) {
      var ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', article.coverImage);
    }
  }

  function renderArticleHero(article) {
    var hero = document.getElementById('article-hero');
    if (!hero) return;

    var initials = Manifest.getInitials(article.author.name);
    var date = Manifest.formatDate(article.publishedAt);
    var hasImage = article.coverImage && article.coverImage.length > 0;

    var heroClass = hasImage ? 'article-hero' : 'article-hero article-hero--no-image';
    hero.className = heroClass;

    var imageHtml;
    if (hasImage) {
      imageHtml = '<img class="article-hero__image" src="' + App.escapeHtml(article.coverImage) + '" alt="' + App.escapeHtml(article.coverImageAlt || article.title) + '">';
    } else {
      imageHtml = '<div class="article-hero__image article-hero__image--placeholder"></div>';
    }

    var avatarHtml;
    if (article.author.avatar) {
      avatarHtml = '<div class="article-byline__avatar avatar"><img src="' + App.escapeHtml(article.author.avatar) + '" alt="' + App.escapeHtml(article.author.name) + '"></div>';
    } else {
      avatarHtml = '<div class="article-byline__avatar avatar">' + App.escapeHtml(initials) + '</div>';
    }

    hero.innerHTML =
      imageHtml +
      '<div class="article-hero__overlay">' +
        '<span class="badge article-hero__badge">' + App.escapeHtml(article.category) + '</span>' +
        '<h1 class="article-hero__title">' + App.escapeHtml(article.title) + '</h1>' +
        (article.excerpt ? '<p class="article-hero__subtitle">' + App.escapeHtml(article.excerpt) + '</p>' : '') +
      '</div>';

    if (!hasImage) {
      hero.innerHTML =
        '<div class="article-hero__content">' +
          '<span class="badge article-hero__badge">' + App.escapeHtml(article.category) + '</span>' +
          '<h1 class="article-hero__title">' + App.escapeHtml(article.title) + '</h1>' +
          (article.excerpt ? '<p class="article-hero__subtitle">' + App.escapeHtml(article.excerpt) + '</p>' : '') +
        '</div>';
    }

    var byline = document.getElementById('article-byline');
    if (byline) {
      byline.innerHTML =
        avatarHtml +
        '<div class="article-byline__info">' +
          '<div class="article-byline__author">' + App.escapeHtml(article.author.name) + '</div>' +
          '<div class="article-byline__meta">' +
            '<span>' + date + '</span>' +
            '<span class="article-byline__divider">&middot;</span>' +
            '<span class="article-byline__read-time">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
              article.readTime + ' min read' +
            '</span>' +
          '</div>' +
        '</div>';
    }
  }

  function loadArticleContent(article) {
    var container = document.getElementById('article-body');
    if (!container) return;

    var folder = article.folder || '';
    if (!folder) {
      container.innerHTML = '<p class="article-error__text">Unable to load this article. The article content is not available.</p>';
      return;
    }

    var url = folder + 'index.html';

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Failed to load article content');
        return response.text();
      })
      .then(function (html) {
        container.innerHTML = html;
        var readTime = Manifest.calcReadTimeFromText(container.textContent || '');
        updateBylineReadTime(readTime);
        loadArticleStyles(article.folder);
        loadArticleScript(article.folder);
        initReadingProgress();
      })
      .catch(function (error) {
        console.error('Article content load error:', error);
        container.innerHTML = '<p class="article-error__text">Unable to load this article. Please try again later.</p>';
      });
  }

  function updateBylineReadTime(minutes) {
    var readTimeEl = document.querySelector('.article-byline__read-time');
    if (!readTimeEl) return;
    var svg = readTimeEl.querySelector('svg');
    var svgHTML = svg ? svg.outerHTML : '';
    readTimeEl.innerHTML = svgHTML + ' ' + minutes + ' min read';
  }

  function loadArticleStyles(folder) {
    if (!folder) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = folder + 'style.css';
    link.onerror = function () { this.remove(); };
    document.head.appendChild(link);
  }

  function loadArticleScript(folder) {
    if (!folder) return;
    var script = document.createElement('script');
    script.src = folder + 'script.js';
    script.onerror = function () { this.remove(); };
    document.body.appendChild(script);
  }

  function initReadingProgress() {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;

    function update() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function renderRelatedArticles(article) {
    var container = document.getElementById('related-articles');
    if (!container) return;

    var allArticles = window.ARTICLES || [];
    var related = Manifest.getByCategory(article.categorySlug)
      .filter(function (a) { return a.slug !== article.slug; })
      .slice(0, 3);

    if (related.length < 3) {
      var remaining = 3 - related.length;
      var others = allArticles
        .filter(function (a) { return a.slug !== article.slug && related.every(function (r) { return r.slug !== a.slug; }); })
        .slice(0, remaining);
      related = related.concat(others);
    }

    if (related.length === 0) {
      container.style.display = 'none';
      return;
    }

    var promises = related.map(function (a) {
      return Manifest.calcReadTime(a);
    });

    Promise.all(promises).then(function () {
      var html = '<h2 class="related-section__title">More like this</h2><div class="related-grid">';

      related.forEach(function (a) {
        var initials = Manifest.getInitials(a.author.name);
        var url = App.getArticleUrl(a.slug);
        var hasImage = a.coverImage && a.coverImage.length > 0;

        var imageHtml;
        if (hasImage) {
          imageHtml = '<img class="article-card__image" src="' + App.escapeHtml(a.coverImage) + '" alt="' + App.escapeHtml(a.coverImageAlt || a.title) + '" loading="lazy">';
        } else {
          imageHtml = '<div class="article-card__image article-card__image--placeholder">' + App.escapeHtml(initials) + '</div>';
        }

        html += '<article class="article-card" data-slug="' + App.escapeHtml(a.slug) + '">' +
          '<a href="' + App.escapeHtml(url) + '" aria-hidden="true" tabindex="-1">' + imageHtml + '</a>' +
          '<div class="article-card__body">' +
            '<span class="article-card__category">' + App.escapeHtml(a.category) + '</span>' +
            '<h3 class="article-card__title">' + App.escapeHtml(a.title) + '</h3>' +
            '<div class="article-card__meta">' +
              '<div class="article-card__info">' +
                '<div class="article-card__author">' + App.escapeHtml(a.author.name) + '</div>' +
                '<div class="article-card__date">' + Manifest.formatDate(a.publishedAt) + '</div>' +
              '</div>' +
              '<span class="article-card__read-time">' + (a.readTime || '—') + ' min read</span>' +
            '</div>' +
          '</div>' +
        '</article>';
      });

      html += '</div>';
      container.innerHTML = html;

      container.querySelectorAll('.article-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var slug = card.getAttribute('data-slug');
          if (slug) window.location.href = App.getArticleUrl(slug);
        });
      });
    });
  }

  function showError(title, text) {
    var hero = document.getElementById('article-hero');
    var byline = document.getElementById('article-byline');
    var body = document.getElementById('article-body');
    var footer = document.getElementById('article-footer');

    if (hero) hero.style.display = 'none';
    if (byline) byline.style.display = 'none';
    if (footer) footer.style.display = 'none';

    if (body) {
      body.innerHTML =
        '<div class="article-error">' +
          '<svg class="article-error__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          '<h2 class="article-error__title">' + App.escapeHtml(title) + '</h2>' +
          '<p class="article-error__text">' + App.escapeHtml(text) + '</p>' +
          '<a href="articles.html" class="btn btn--primary">Browse all articles</a>' +
        '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
