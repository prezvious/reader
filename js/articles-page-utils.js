(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ArticlesPageUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_SORT = 'modified-desc';
  var DEFAULT_VIEW = 'tiles';
  var STORAGE_KEYS = {
    sort: 'reader-articles-sort',
    view: 'reader-articles-view'
  };
  var VALID_SORTS = {
    'title-asc': true,
    'title-desc': true,
    'modified-asc': true,
    'modified-desc': true
  };
  var VALID_VIEWS = {
    tiles: true,
    list: true
  };

  function coerceSort(value) {
    return VALID_SORTS[value] ? value : DEFAULT_SORT;
  }

  function coerceView(value) {
    return VALID_VIEWS[value] ? value : DEFAULT_VIEW;
  }

  function getSafeTime(value) {
    var time = value ? new Date(value).getTime() : NaN;
    return isNaN(time) ? null : time;
  }

  function getModifiedTime(article) {
    var updatedTime = getSafeTime(article && article.updatedAt);
    if (updatedTime !== null) return updatedTime;
    return getSafeTime(article && article.publishedAt);
  }

  function compareSlug(a, b) {
    var slugA = a && a.slug ? String(a.slug) : '';
    var slugB = b && b.slug ? String(b.slug) : '';

    if (slugA < slugB) return -1;
    if (slugA > slugB) return 1;
    return 0;
  }

  function compareTitle(a, b, descending) {
    var titleA = a && a.title ? String(a.title).toLocaleLowerCase() : '';
    var titleB = b && b.title ? String(b.title).toLocaleLowerCase() : '';

    if (titleA !== titleB) {
      if (descending) return titleA < titleB ? 1 : -1;
      return titleA < titleB ? -1 : 1;
    }

    return compareSlug(a, b);
  }

  function compareModified(a, b, ascending) {
    var timeA = getModifiedTime(a);
    var timeB = getModifiedTime(b);
    var validA = typeof timeA === 'number';
    var validB = typeof timeB === 'number';

    if (validA && validB) {
      if (timeA !== timeB) {
        return ascending ? timeA - timeB : timeB - timeA;
      }
      return compareSlug(a, b);
    }

    if (validA) return -1;
    if (validB) return 1;
    return compareSlug(a, b);
  }

  function sortArticles(articles, requestedSort) {
    var sort = coerceSort(requestedSort);
    var next = Array.isArray(articles) ? articles.slice() : [];

    next.sort(function (a, b) {
      if (sort === 'title-asc') return compareTitle(a, b, false);
      if (sort === 'title-desc') return compareTitle(a, b, true);
      if (sort === 'modified-asc') return compareModified(a, b, true);
      return compareModified(a, b, false);
    });

    return next;
  }

  return {
    DEFAULT_SORT: DEFAULT_SORT,
    DEFAULT_VIEW: DEFAULT_VIEW,
    STORAGE_KEYS: STORAGE_KEYS,
    coerceSort: coerceSort,
    coerceView: coerceView,
    sortArticles: sortArticles,
    getModifiedTime: getModifiedTime
  };
});
