(function () {
  'use strict';

  var searchQuery = '';
  var debounceTimer = null;
  var isOpen = false;
  var results = [];
  var focusedIndex = -1;

  function renderIcon(name, className) {
    if (window.ReaderIcons && typeof window.ReaderIcons.render === 'function') {
      return window.ReaderIcons.render(name, className);
    }

    return '';
  }

  function init() {
    var trigger = document.getElementById('search-trigger');
    if (trigger) {
      trigger.addEventListener('click', toggleOverlay);
    }

    document.querySelectorAll('.header__search-trigger').forEach(function (item) {
      item.removeEventListener('click', toggleOverlay);
      item.addEventListener('click', toggleOverlay);
    });

    document.addEventListener('keydown', handleKeydown);
  }

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.id = 'search-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Search articles');
    overlay.innerHTML =
      '<div class="search-palette">' +
        '<div class="search-input-wrapper">' +
          renderIcon('magnifying-glass') +
          '<input type="text" class="search-input" id="search-input" placeholder="Search articles..." aria-label="Search articles" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="search-results" aria-owns="search-results">' +
        '</div>' +
        '<div class="search-results" id="search-results" role="listbox" aria-label="Search results"></div>' +
        '<div class="search-keyboard-hints">' +
          '<span><kbd>up</kbd><kbd>down</kbd> navigate</span>' +
          '<span><kbd>enter</kbd> open</span>' +
          '<span><kbd>esc</kbd> close</span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeOverlay();
    });

    document.getElementById('search-input').addEventListener('input', function (event) {
      searchQuery = event.target.value;
      debouncedSearch(searchQuery);
    });

    return overlay;
  }

  function openOverlay() {
    var overlay = document.getElementById('search-overlay');
    if (!overlay) {
      overlay = createOverlay();
    }

    overlay.classList.add('search-overlay--open');
    document.body.classList.add('search-open');

    var input = document.getElementById('search-input');
    if (input) {
      input.setAttribute('aria-expanded', 'true');
      input.focus();
    }

    isOpen = true;
    if (searchQuery) executeSearch(searchQuery);
  }

  function closeOverlay() {
    var overlay = document.getElementById('search-overlay');
    if (overlay) overlay.classList.remove('search-overlay--open');

    document.body.classList.remove('search-open');
    clearTimeout(debounceTimer);
    isOpen = false;

    var input = document.getElementById('search-input');
    if (input) input.setAttribute('aria-expanded', 'false');

    var trigger = document.getElementById('search-trigger');
    if (trigger) trigger.focus();
  }

  function toggleOverlay() {
    if (isOpen) {
      closeOverlay();
      return;
    }

    openOverlay();
  }

  function debouncedSearch(query) {
    clearTimeout(debounceTimer);

    if (!query || query.length < 2) {
      document.getElementById('search-results').innerHTML = '<div class="search-empty"><div class="search-empty__text">Type at least 2 characters...</div></div>';
      return;
    }

    debounceTimer = setTimeout(function () {
      executeSearch(query.trim());
    }, 300);
  }

  async function executeSearch(query) {
    document.getElementById('search-results').innerHTML = '<div class="search-empty"><div class="search-empty__text">Searching...</div></div>';

    var dbResults = window.Supabase && window.Supabase.searchArticles ? await window.Supabase.searchArticles(query) : [];
    var staticResults = window.Manifest && window.Manifest.searchArticles ? window.Manifest.searchArticles(query) : [];

    var allResults = dbResults.concat(staticResults.filter(function (item) {
      return !dbResults.some(function (dbItem) { return dbItem.slug === item.slug; });
    }));

    results = allResults;
    focusedIndex = -1;
    renderResults(results);
  }

  function renderResults(items) {
    var container = document.getElementById('search-results');

    if (!items || items.length === 0) {
      container.innerHTML =
        '<div class="search-empty">' +
          renderIcon('magnifying-glass', 'search-empty__icon') +
          '<div class="search-empty__title">No articles match "' + searchQuery + '"</div>' +
          '<div class="search-empty__text">Try different keywords, or <a href="articles.html">Browse all articles</a></div>' +
        '</div>';
      return;
    }

    var html = items.slice(0, 5).map(function (item, index) {
      var highlighted = item.highlighted_excerpt || item.excerpt || '';
      var author = item.author_name || 'Unknown';
      var category = item.category || 'Uncategorized';

      return '<a href="article.html?slug=' + item.slug + '" class="search-result" data-index="' + index + '" role="option" id="search-option-' + index + '">' +
        renderIcon('file-text', 'search-result__icon') +
        '<div class="search-result__body">' +
          '<span class="search-result__title">' + item.title + '</span>' +
          '<span class="search-result__meta">' + author + ' | ' + category + '</span>' +
          '<span class="search-result__excerpt">' + highlighted + '</span>' +
        '</div>' +
      '</a>';
    }).join('');

    if (items.length > 5) {
      html += '<a href="search.html?q=' + encodeURIComponent(searchQuery) + '" class="search-view-all">View all ' + items.length + ' results</a>';
    }

    container.innerHTML = html;
  }

  function handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      toggleOverlay();
      return;
    }

    if (!isOpen) return;

    var palette = document.querySelector('.search-palette');
    var items = document.querySelectorAll('.search-result, .search-view-all');

    if (event.key === 'Escape') {
      closeOverlay();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (items.length === 0) return;
      focusedIndex = (focusedIndex + 1) % items.length;
      updateFocus(items);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length === 0) return;
      focusedIndex = (focusedIndex - 1 + items.length) % items.length;
      updateFocus(items);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (focusedIndex >= 0 && items[focusedIndex]) {
        window.location.href = items[focusedIndex].getAttribute('href');
      } else if (searchQuery.length >= 2) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
      }
      return;
    }

    if (event.key === 'Tab' && palette) {
      var focusable = Array.from(palette.querySelectorAll('input, a, button, [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;

      var firstEl = focusable[0];
      var lastEl = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }
  }

  function updateFocus(items) {
    var input = document.getElementById('search-input');

    items.forEach(function (item, index) {
      if (index === focusedIndex) {
        item.classList.add('search-result--focused');
        item.setAttribute('aria-selected', 'true');
        if (input) input.setAttribute('aria-activedescendant', item.id);
      } else {
        item.classList.remove('search-result--focused');
        item.removeAttribute('aria-selected');
      }
    });

    if (focusedIndex < 0 && input) input.removeAttribute('aria-activedescendant');
  }

  function navigateToResults(query) {
    window.location.href = 'search.html?q=' + encodeURIComponent(query);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Search = {
    open: openOverlay,
    close: closeOverlay,
    toggle: toggleOverlay,
    execute: executeSearch,
    navigateToResults: navigateToResults
  };
})();
