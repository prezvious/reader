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
        if (window.ArticleSummary && typeof window.ArticleSummary.prepare === 'function') {
          window.ArticleSummary.prepare(article);
        }
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

    var mainEl = document.querySelector('main');
    var initials = Manifest.getInitials(article.author.name);
    var date = Manifest.formatDate(article.publishedAt);
    var hasImage = article.coverImage && article.coverImage.length > 0;

    var avatarHtml;
    if (article.author.avatar) {
      avatarHtml = '<div class="article-byline__avatar avatar"><img src="' + App.escapeHtml(article.author.avatar) + '" alt="' + App.escapeHtml(article.author.name) + '"></div>';
    } else {
      avatarHtml = '<div class="article-byline__avatar avatar">' + App.escapeHtml(initials) + '</div>';
    }

    var bylineInnerHtml =
      avatarHtml +
      '<div class="article-byline__info">' +
        '<div class="article-byline__author">' + App.escapeHtml(article.author.name) + '</div>' +
        '<div class="article-byline__meta">' +
          '<span>' + date + '</span>' +
          '<span class="article-byline__divider">&middot;</span>' +
          '<span class="article-byline__read-time">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            (article.readTime || '—') + ' min read' +
          '</span>' +
        '</div>' +
      '</div>';

    if (hasImage) {
      /* ===== PHOTO LAYOUT ===== */
      if (mainEl) mainEl.setAttribute('data-layout', 'photo');
      hero.className = 'article-hero article-hero--photo';

      hero.innerHTML =
        '<img class="article-hero__image" src="' + App.escapeHtml(article.coverImage) + '" alt="' + App.escapeHtml(article.coverImageAlt || article.title) + '">' +
        '<div class="article-hero__overlay">' +
          '<span class="badge article-hero__badge">' + App.escapeHtml(article.category) + '</span>' +
          '<h1 class="article-hero__title">' + App.escapeHtml(article.title) + '</h1>' +
          (article.excerpt ? '<p class="article-hero__subtitle">' + App.escapeHtml(article.excerpt) + '</p>' : '') +
        '</div>';

      /* Build floating metadata card — replaces separate byline + actions */
      var bylineEl = document.getElementById('article-byline');
      var actionsEl = document.getElementById('article-actions');

      if (bylineEl && actionsEl) {
        /* Create wrapper */
        var cardWrapper = document.createElement('div');
        cardWrapper.className = 'article-meta-card-wrapper';

        var card = document.createElement('div');
        card.className = 'article-meta-card';

        /* Move byline into card */
        bylineEl.className = 'article-byline';
        bylineEl.removeAttribute('style');
        bylineEl.innerHTML = bylineInnerHtml;
        card.appendChild(bylineEl);

        /* Move actions into card */
        actionsEl.className = 'article-actions';
        actionsEl.removeAttribute('style');
        card.appendChild(actionsEl);

        cardWrapper.appendChild(card);

        /* Insert card wrapper right after the hero */
        hero.insertAdjacentElement('afterend', cardWrapper);
      }

    } else {
      /* ===== CENTER LAYOUT ===== */
      if (mainEl) mainEl.setAttribute('data-layout', 'center');
      hero.className = 'article-hero article-hero--center';

      hero.innerHTML =
        '<div class="article-hero__content">' +
          '<span class="badge article-hero__badge">' + App.escapeHtml(article.category) + '</span>' +
          '<h1 class="article-hero__title">' + App.escapeHtml(article.title) + '</h1>' +
          (article.excerpt ? '<p class="article-hero__subtitle">' + App.escapeHtml(article.excerpt) + '</p>' : '') +
        '</div>';

      /* Populate byline in its existing container */
      var byline = document.getElementById('article-byline');
      if (byline) {
        byline.removeAttribute('style');
        byline.innerHTML = bylineInnerHtml;
      }

      /* Clean up actions container */
      var actions = document.getElementById('article-actions');
      if (actions) {
        actions.removeAttribute('style');
      }
    }
  }

  function loadArticleContent(article) {
    var container = document.getElementById('article-body');
    if (!container) return;

    /* DB-sourced article: load from Supabase */
    if (article.source === 'db') {
      loadDbArticleContent(article, container);
      return;
    }

    /* Static article: load from folder */
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
        container.innerHTML = App.sanitizeHtml(html);
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

  function loadDbArticleContent(article, container) {
    Supabase.getArticleContent(article.slug)
      .then(function (data) {
        if (!data || !data.content_html) {
          container.innerHTML = '<p class="article-error__text">Unable to load this article. The article content is not available.</p>';
          return;
        }

        /* Sanitize stored HTML before injection */
        container.innerHTML = App.sanitizeHtml(data.content_html);

        var readTime = Manifest.calcReadTimeFromText(container.textContent || '');
        updateBylineReadTime(readTime);

        /* Inject custom CSS if present (scoped) */
        if (data.custom_css) {
          injectScopedCSS(data.custom_css);
        }

        initReadingProgress();
      })
      .catch(function (error) {
        console.error('DB article content load error:', error);
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
    var existing = document.getElementById('article-style');
    if (existing) existing.remove();
    var link = document.createElement('link');
    link.id = 'article-style';
    link.rel = 'stylesheet';
    link.href = folder + 'style.css';
    link.onerror = function () { this.remove(); };
    document.head.appendChild(link);
  }

  function loadArticleScript(folder) {
    if (!folder) return;
    var existing = document.getElementById('article-script');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.id = 'article-script';
    script.src = folder + 'script.js';
    script.onerror = function () { this.remove(); };
    document.body.appendChild(script);
  }

  /* Inject custom CSS scoped to #article-body only.
     Handles comma-separated selectors (each one is scoped) and skips
     percentage selectors inside @keyframes blocks. */
  function injectScopedCSS(css) {
    var existing = document.getElementById('article-custom-style');
    if (existing) existing.remove();

    var scopedCSS = scopeCss(css);

    var style = document.createElement('style');
    style.textContent = scopedCSS;
    style.id = 'article-custom-style';
    document.head.appendChild(style);
  }

  /* Token-based CSS scoper.
     Walks the CSS once, tracking @keyframes nesting and brace depth.
     Each selector list before a top-level '{' is split on commas and each
     part is prefixed with '#article-body '. Selectors inside @keyframes or
     other @-rule prelude are passed through unchanged. */
  function scopeCss(css) {
    var out = '';
    var i = 0;
    var len = css.length;
    var depth = 0;
    var keyframesDepth = -1;  /* depth at which we entered an @keyframes */

    while (i < len) {
      var ch = css.charAt(i);

      /* Skip comments */
      if (ch === '/' && css.charAt(i + 1) === '*') {
        var end = css.indexOf('*/', i + 2);
        if (end === -1) { out += css.slice(i); break; }
        out += css.slice(i, end + 2);
        i = end + 2;
        continue;
      }

      if (ch === '}') {
        depth--;
        if (depth <= keyframesDepth) keyframesDepth = -1;
        out += ch;
        i++;
        continue;
      }

      /* Read until next '{' or '}' to capture a selector or at-rule prelude */
      var start = i;
      while (i < len) {
        var c = css.charAt(i);
        if (c === '{' || c === '}') break;
        if (c === '/' && css.charAt(i + 1) === '*') {
          var ce = css.indexOf('*/', i + 2);
          i = ce === -1 ? len : ce + 2;
          continue;
        }
        i++;
      }

      var prelude = css.slice(start, i);
      var trimmed = prelude.trim();

      if (i >= len || css.charAt(i) === '}') {
        /* Trailing content with no '{' — emit verbatim */
        out += prelude;
        continue;
      }

      /* css.charAt(i) === '{' here */
      if (trimmed.charAt(0) === '@') {
        /* @-rule: don't scope its prelude. Track @keyframes so its
           inner percentage selectors are not scoped either. */
        if (/^@(-\w+-)?keyframes\b/i.test(trimmed)) {
          keyframesDepth = depth;
        }
        out += prelude + '{';
        depth++;
        i++;
        continue;
      }

      if (depth > keyframesDepth && keyframesDepth !== -1) {
        /* Inside @keyframes — leave percentage/from/to selectors alone */
        out += prelude + '{';
        depth++;
        i++;
        continue;
      }

      /* Scope every comma-separated selector individually */
      var parts = splitSelectors(prelude);
      var scoped = parts.map(function (p) {
        var t = p.trim();
        if (!t) return p;
        return '#article-body ' + t;
      }).join(', ');

      out += scoped + ' {';
      depth++;
      i++;
    }

    return out;
  }

  /* Split a selector list on top-level commas (ignoring commas inside
     parentheses or brackets, e.g. :is(.a, .b) or [data-x="a,b"]). */
  function splitSelectors(list) {
    var parts = [];
    var depth = 0;
    var start = 0;
    for (var i = 0; i < list.length; i++) {
      var c = list.charAt(i);
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) {
        parts.push(list.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(list.slice(start));
    return parts;
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
          '<a href="' + App.escapeHtml(url) + '" class="article-card__link" aria-label="' + App.escapeHtml(a.title) + ' by ' + App.escapeHtml(a.author.name) + '">' + imageHtml + '</a>' +
          '<div class="article-card__body">' +
            '<span class="article-card__category">' + App.escapeHtml(a.category) + '</span>' +
            '<h2 class="article-card__title">' + App.escapeHtml(a.title) + '</h2>' +
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
    var banner = document.getElementById('continue-banner');
    var actions = document.getElementById('article-actions');

    if (hero) hero.style.display = 'none';
    if (byline) byline.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (banner) banner.style.display = 'none';
    if (actions) actions.style.display = 'none';

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
