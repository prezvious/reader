(function () {
  'use strict';

  var state = {
    article: null,
    summary: null,
    status: 'idle',
    drawerOpen: false,
    request: null,
    requestSlug: '',
    els: null
  };
  var bundledSummaryIndexPromise = null;

  function getEls() {
    if (state.els) return state.els;
    state.els = {
      launcher: document.getElementById('summary-launcher'),
      trigger: document.getElementById('summary-trigger'),
      triggerLabel: document.getElementById('summary-trigger-label'),
      triggerStatus: document.getElementById('summary-trigger-status'),
      backdrop: document.getElementById('summary-backdrop'),
      drawer: document.getElementById('summary-drawer'),
      close: document.getElementById('summary-close'),
      title: document.getElementById('summary-title'),
      subtitle: document.getElementById('summary-subtitle'),
      chip: document.getElementById('summary-chip'),
      model: document.getElementById('summary-model'),
      loading: document.getElementById('summary-loading'),
      error: document.getElementById('summary-error'),
      empty: document.getElementById('summary-empty'),
      content: document.getElementById('summary-content')
    };
    return state.els;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
  }

  function formatInlineMarkdown(text) {
    var html = escapeHtml(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return html;
  }

  function normalizeHeadingLine(text) {
    return String(text || '').replace(/^\*\*(#+\s+.+?)\*\*$/, '$1').trim();
  }

  function renderMarkdown(markdown) {
    if (!markdown || !markdown.trim()) return '';

    var lines = markdown.replace(/\r\n/g, '\n').split('\n');
    var html = [];
    var paragraph = [];
    var listItems = [];
    var listTag = '';

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push('<p>' + formatInlineMarkdown(paragraph.join(' ').trim()) + '</p>');
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) return;
      html.push('<' + listTag + '>' + listItems.join('') + '</' + listTag + '>');
      listItems = [];
      listTag = '';
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      var normalizedHeading = normalizeHeadingLine(trimmed);
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (/^#\s+/i.test(normalizedHeading) && normalizedHeading.replace(/^#\s+/i, '').toLowerCase() === 'comprehensive summary') {
        flushParagraph();
        flushList();
        return;
      }

      if (/^#\s+/.test(normalizedHeading)) {
        flushParagraph();
        flushList();
        html.push('<h3>' + escapeHtml(normalizedHeading.replace(/^#\s+/, '')) + '</h3>');
        return;
      }

      if (/^##\s+/.test(normalizedHeading)) {
        flushParagraph();
        flushList();
        html.push('<h3>' + escapeHtml(normalizedHeading.replace(/^##\s+/, '')) + '</h3>');
        return;
      }

      if (/^###\s+/.test(normalizedHeading)) {
        flushParagraph();
        flushList();
        html.push('<h4>' + escapeHtml(normalizedHeading.replace(/^###\s+/, '')) + '</h4>');
        return;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        flushParagraph();
        if (listTag !== 'ul') {
          flushList();
          listTag = 'ul';
        }
        listItems.push('<li>' + formatInlineMarkdown(trimmed.replace(/^[-*]\s+/, '')) + '</li>');
        return;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        flushParagraph();
        if (listTag !== 'ol') {
          flushList();
          listTag = 'ol';
        }
        listItems.push('<li>' + formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, '')) + '</li>');
        return;
      }

      flushList();
      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();

    return html.join('');
  }

  function formatGeneratedAt(iso) {
    if (!iso) return '';
    var parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function updateTriggerUi() {
    var els = getEls();
    if (!els.trigger) return;

    els.trigger.classList.remove(
      'summary-trigger--loading',
      'summary-trigger--ready',
      'summary-trigger--error',
      'summary-trigger--empty'
    );

    if (state.status === 'ready') {
      els.trigger.classList.add('summary-trigger--ready');
      els.triggerLabel.textContent = 'Open summary';
      els.triggerStatus.textContent = '';
    } else if (state.status === 'loading') {
      els.trigger.classList.add('summary-trigger--loading');
      els.triggerLabel.textContent = 'Preparing summary';
      els.triggerStatus.textContent = '';
    } else if (state.status === 'empty') {
      els.trigger.classList.add('summary-trigger--empty');
      els.triggerLabel.textContent = 'No summary yet';
      els.triggerStatus.textContent = '';
    } else if (state.status === 'error') {
      els.trigger.classList.add('summary-trigger--error');
      els.triggerLabel.textContent = 'Summary unavailable';
      els.triggerStatus.textContent = '';
    } else {
      els.triggerLabel.textContent = 'Preparing summary';
      els.triggerStatus.textContent = '';
    }
  }

  function updateDrawerMeta() {
    var els = getEls();
    if (!els.drawer) return;

    if (!state.article) {
      els.subtitle.textContent = 'An AI overview will appear here once it is ready.';
      els.chip.textContent = 'Preparing summary';
      els.model.textContent = '';
      return;
    }

    els.title.textContent = 'Article Summary';
    els.subtitle.textContent = state.article.title;

    if (state.status === 'ready' && state.summary) {
      els.chip.textContent = 'Ready';
      var generatedAt = formatGeneratedAt(state.summary.generatedAt);
      var model = state.summary.model || '';
      if (model && generatedAt) {
        els.model.textContent = model + ' • ' + generatedAt;
      } else {
        els.model.textContent = model || generatedAt || '';
      }
      return;
    }

    if (state.status === 'loading') {
      els.chip.textContent = 'Preparing summary';
      els.model.textContent = 'Loading a cached summary or generating a fresh one';
      return;
    }

    if (state.status === 'empty') {
      els.chip.textContent = 'No summary';
      els.model.textContent = '';
      return;
    }

    if (state.status === 'error') {
      els.chip.textContent = 'Unavailable';
      els.model.textContent = '';
      return;
    }

    els.chip.textContent = 'Preparing summary';
    els.model.textContent = '';
  }

  function render() {
    var els = getEls();
    if (!els.drawer) return;

    updateTriggerUi();
    updateDrawerMeta();

    setVisible(els.loading, state.status === 'loading' || state.status === 'idle');
    setVisible(els.error, state.status === 'error');
    setVisible(els.empty, state.status === 'empty');
    setVisible(els.content, state.status === 'ready' && state.summary && state.summary.summaryMarkdown);

    if (state.status === 'ready' && state.summary && state.summary.summaryMarkdown) {
      els.content.innerHTML = renderMarkdown(state.summary.summaryMarkdown);
    } else {
      els.content.innerHTML = '';
    }
  }

  function openDrawer() {
    var els = getEls();
    if (!els.drawer || !els.trigger) return;

    state.drawerOpen = true;
    els.trigger.setAttribute('aria-expanded', 'true');
    els.drawer.setAttribute('aria-hidden', 'false');
    els.backdrop.hidden = false;
    document.body.classList.add('summary-open');

    requestAnimationFrame(function () {
      els.backdrop.classList.add('summary-backdrop--visible');
      els.drawer.classList.add('summary-drawer--open');
    });

    if (!state.request && state.article && state.status === 'idle') {
      prefetchSummary(state.article.slug);
    }

    setTimeout(function () {
      if (els.close) els.close.focus();
    }, 60);
  }

  function closeDrawer() {
    var els = getEls();
    if (!els.drawer || !els.trigger) return;

    state.drawerOpen = false;
    els.trigger.setAttribute('aria-expanded', 'false');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.backdrop.classList.remove('summary-backdrop--visible');
    els.drawer.classList.remove('summary-drawer--open');
    document.body.classList.remove('summary-open');

    setTimeout(function () {
      if (!state.drawerOpen && els.backdrop) els.backdrop.hidden = true;
    }, 280);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && state.drawerOpen) {
      closeDrawer();
    }
  }

  function prefetchSummary(slug) {
    if (!slug) return Promise.resolve(null);
    if (state.request && state.requestSlug === slug) return state.request;

    state.status = 'loading';
    state.summary = null;
    state.requestSlug = slug;
    render();

    state.request = loadSummaryPayload(slug)
      .then(function (payload) {
        state.summary = payload;
        if (payload && payload.summaryMarkdown && payload.summaryMarkdown.trim()) {
          state.status = 'ready';
        } else if (payload) {
          state.status = 'empty';
        } else {
          state.status = 'error';
        }
        render();
        return payload;
      })
      .catch(function (error) {
        console.error('Summary preload failed:', error);
        state.status = 'error';
        render();
        return null;
      })
      .finally(function () {
        state.request = null;
      });

    return state.request;
  }

  function fetchSummaryJson(url, cacheMode) {
    return fetch(url, {
      cache: cacheMode
    }).then(function (response) {
      if (response.status === 404) return null;
      if (!response.ok) {
        var error = new Error('Failed to load summary JSON');
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function loadBundledSummaryIndex() {
    if (bundledSummaryIndexPromise) return bundledSummaryIndexPromise;

    bundledSummaryIndexPromise = fetchSummaryJson('data/summaries/index.json', 'force-cache')
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.summaries)) return null;

        return payload.summaries.reduce(function (lookup, entry) {
          if (entry && entry.slug) lookup[entry.slug] = true;
          return lookup;
        }, {});
      })
      .catch(function () {
        return null;
      });

    return bundledSummaryIndexPromise;
  }

  function createEmptySummaryPayload(slug) {
    return {
      slug: slug,
      model: '',
      generatedAt: '',
      summaryMarkdown: '',
      wordCount: 0
    };
  }

  function loadBundledSummary(slug) {
    return loadBundledSummaryIndex().then(function (lookup) {
      if (lookup && !lookup[slug]) return null;
      return fetchSummaryJson('data/summaries/' + encodeURIComponent(slug) + '.json', 'force-cache');
    });
  }

  function loadApiSummary(slug) {
    return fetchSummaryJson('/api/article-summary?slug=' + encodeURIComponent(slug), 'no-store');
  }

  function loadSummaryPayload(slug) {
    if (window.location.protocol === 'file:') {
      return loadBundledSummary(slug).then(function (bundledPayload) {
        return bundledPayload || createEmptySummaryPayload(slug);
      });
    }

    return loadApiSummary(slug)
      .then(function (apiPayload) {
        if (apiPayload) return apiPayload;
        return loadBundledSummary(slug);
      })
      .catch(function (apiError) {
        return loadBundledSummary(slug).then(function (bundledPayload) {
          if (bundledPayload) return bundledPayload;
          throw apiError;
        });
      });
  }

  function init() {
    var els = getEls();
    if (!els.trigger || !els.drawer) return;

    els.trigger.addEventListener('click', openDrawer);
    if (els.close) els.close.addEventListener('click', closeDrawer);
    if (els.backdrop) els.backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', handleKeydown);
    render();
  }

  function prepare(article) {
    var els = getEls();
    if (!els.trigger || !article || !article.slug) return;

    state.article = article;
    els.launcher.hidden = false;
    prefetchSummary(article.slug);
  }

  document.addEventListener('DOMContentLoaded', init);

  window.ArticleSummary = {
    prepare: prepare,
    open: openDrawer,
    close: closeDrawer
  };
})();
