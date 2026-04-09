(function () {
  'use strict';

  var searchQuery = '';
  var debounceTimer = null;
  var isOpen = false;
  var results = [];
  var focusedIndex = -1;

  function init() {
    var trigger = document.getElementById('search-trigger');
    if (trigger) {
      trigger.addEventListener('click', toggleOverlay);
    }
    // Handle triggers across multiple pages if there are multiple elements (though ID should be unique, sometimes it's not)
    var triggers = document.querySelectorAll('.header__search-trigger');
    triggers.forEach(function(t) {
      t.removeEventListener('click', toggleOverlay); // Prevent dupes
      t.addEventListener('click', toggleOverlay);
    });
    
    document.addEventListener('keydown', handleKeydown);
  }

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.id = 'search-overlay';
    overlay.innerHTML = `
      <div class="search-palette">
        <div class="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="search-input" id="search-input" placeholder="Search articles..." aria-label="Search articles" autocomplete="off">
        </div>
        <div class="search-results" id="search-results" role="listbox"></div>
        <div class="search-keyboard-hints">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeOverlay();
    });
    
    document.getElementById('search-input').addEventListener('input', function(e) {
      searchQuery = e.target.value;
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
    document.getElementById('search-input').focus();
    isOpen = true;
    if (searchQuery) executeSearch(searchQuery);
  }

  function closeOverlay() {
    var overlay = document.getElementById('search-overlay');
    if (overlay) overlay.classList.remove('search-overlay--open');
    document.body.classList.remove('search-open');
    clearTimeout(debounceTimer);
    isOpen = false;
    var trigger = document.getElementById('search-trigger');
    if (trigger) trigger.focus();
  }

  function toggleOverlay() {
    if (isOpen) closeOverlay();
    else openOverlay();
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

    var allResults = dbResults.concat(staticResults.filter(function (s) {
      return !dbResults.some(function (d) { return d.slug === s.slug; });
    }));
    
    results = allResults;
    focusedIndex = -1;
    renderResults(results);
  }

  function renderResults(results) {
    var container = document.getElementById('search-results');
    if (!results || results.length === 0) {
      container.innerHTML = `<div class="search-empty">
        <svg class="search-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <div class="search-empty__title">No articles match "${searchQuery}"</div>
        <div class="search-empty__text">Try different keywords, or <a href="articles.html">Browse all articles</a></div>
      </div>`;
      return;
    }

    var html = results.slice(0, 5).map(function (r, i) {
      var highlighted = r.highlighted_excerpt || r.excerpt || '';
      var author = r.author_name || 'Unknown';
      var cat = r.category || 'Uncategorized';
      return `<a href="article.html?slug=${r.slug}" class="search-result" data-index="${i}" role="option" id="search-option-${i}">
        <span class="search-result__icon">📄</span>
        <div class="search-result__body">
          <span class="search-result__title">${r.title}</span>
          <span class="search-result__meta">${author} · ${cat}</span>
          <span class="search-result__excerpt">${highlighted}</span>
        </div>
      </a>`;
    }).join('');

    if (results.length > 5) {
      html += `<a href="search.html?q=${encodeURIComponent(searchQuery)}" class="search-view-all">View all ${results.length} results →</a>`;
    }

    container.innerHTML = html;
  }

  function handleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleOverlay();
      return;
    }
    
    if (!isOpen) return;

    var items = document.querySelectorAll('.search-result, .search-view-all');
    if (e.key === 'Escape') {
      closeOverlay();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      focusedIndex = (focusedIndex + 1) % items.length;
      updateFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      focusedIndex = (focusedIndex - 1 + items.length) % items.length;
      updateFocus(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && items[focusedIndex]) {
        window.location.href = items[focusedIndex].getAttribute('href');
      } else if (searchQuery.length >= 2) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
      }
    }
  }

  function updateFocus(items) {
    items.forEach(function(item, i) {
      if (i === focusedIndex) {
        item.classList.add('search-result--focused');
        item.focus();
      } else {
        item.classList.remove('search-result--focused');
      }
    });
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