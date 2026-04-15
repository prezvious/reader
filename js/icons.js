(function () {
  'use strict';

  var SPRITE_PATH = 'icon/phosphor-sprite.svg';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function render(name, className, label) {
    var classes = ['ph-icon', className || ''].filter(Boolean).join(' ').trim();
    var accessibility = label
      ? 'role="img" aria-label="' + escapeHtml(label) + '"'
      : 'aria-hidden="true"';

    return '<svg class="' + classes + '" ' + accessibility + ' focusable="false"><use href="' + SPRITE_PATH + '#' + name + '"></use></svg>';
  }

  function replaceElementIcon(element, name) {
    if (!element) return;
    var className = element.getAttribute('class') || '';
    element.outerHTML = render(name, className);
  }

  function replaceDirect(selector, name, root) {
    root.querySelectorAll(selector).forEach(function (element) {
      replaceElementIcon(element, name);
    });
  }

  function replaceFirstNested(selector, name, root) {
    root.querySelectorAll(selector).forEach(function (container) {
      var icon = container.querySelector('svg, img');
      if (icon) replaceElementIcon(icon, name);
    });
  }

  function refresh(root) {
    root = root || document;

    replaceDirect('.header__search-trigger svg', 'magnifying-glass', root);
    replaceDirect('.theme-toggle .icon-sun', 'sun', root);
    replaceDirect('.theme-toggle .icon-moon', 'moon', root);
    replaceDirect('.mobile-menu-btn svg', 'list', root);

    replaceDirect('.sidebar__link[href="index.html"] svg', 'house', root);
    replaceDirect('.sidebar__link[href="articles.html"] svg', 'newspaper-clipping', root);
    replaceDirect('.sidebar__link[href="dashboard.html"] svg', 'squares-four', root);
    replaceDirect('.sidebar__link[href="bookmarks.html"] svg', 'bookmark-simple', root);
    replaceDirect('.sidebar__link[href="history.html"] svg', 'clock-counter-clockwise', root);
    replaceDirect('.sidebar__link[href="profile.html"] svg', 'user-circle', root);

    replaceDirect('.avatar-dropdown__item[href="dashboard.html"] svg', 'squares-four', root);
    replaceDirect('.avatar-dropdown__item[href="bookmarks.html"] svg', 'bookmark-simple', root);
    replaceDirect('.avatar-dropdown__item[href="history.html"] svg', 'clock-counter-clockwise', root);
    replaceDirect('.avatar-dropdown__item[href="profile.html"] svg', 'user-circle', root);
    replaceDirect('.sidebar__signout svg, #menu-signout svg', 'sign-out', root);

    replaceDirect('#bookmark-btn svg', 'bookmark-simple', root);
    replaceDirect('#share-copy svg', 'link-simple', root);
    replaceDirect('#like-btn svg', 'heart', root);
    replaceDirect('.back-link svg', 'arrow-left', root);
    replaceDirect('.summary-drawer__close svg, .find-bar__close svg, .bookmark-card__remove svg', 'x', root);
    replaceDirect('.find-bar__icon, .search-empty__icon, .search-page__input-wrapper svg', 'magnifying-glass', root);
    replaceDirect('.find-bar__nav-btn#find-prev svg', 'caret-up', root);
    replaceDirect('.find-bar__nav-btn#find-next svg', 'caret-down', root);
    replaceDirect('.article-byline__read-time svg', 'clock', root);
    replaceDirect('.article-error__icon', 'warning-circle', root);
    replaceDirect('.verify-card__icon svg', 'check-circle', root);
    replaceDirect('#continue-btn svg, .admin-compose-card__arrow', 'arrow-right', root);
    replaceDirect('.admin-compose-card__icon, #tab-editor svg', 'note-pencil', root);
    replaceDirect('.compose-gate__icon', 'lock-simple', root);
    replaceDirect('.compose-draft-banner svg', 'file-text', root);
    replaceDirect('.compose-cover__header svg', 'image-square', root);
    replaceDirect('#tab-preview svg', 'eye', root);
    replaceDirect('#undo-btn svg', 'arrow-counter-clockwise', root);
    replaceDirect('#redo-btn svg', 'arrow-clockwise', root);
    replaceDirect('.compose-toolbar__btn[title="Bold"] svg', 'text-b', root);
    replaceDirect('.compose-toolbar__btn[title="Italic"] svg', 'text-italic', root);
    replaceDirect('.compose-toolbar__btn[title="Underline"] svg', 'text-underline', root);
    replaceDirect('.compose-toolbar__btn[title="Blockquote"] svg', 'quotes', root);
    replaceDirect('.social-buttons .btn--social svg', 'google-logo', root);

    replaceFirstNested('.summary-trigger__icon-wrap', 'sparkle', root);

    root.querySelectorAll('.verify-card__provider-badge').forEach(function (badge) {
      var icon = badge.querySelector('svg, img');
      if (!icon) return;

      var text = (badge.textContent || '').toLowerCase();
      if (text.indexOf('google') !== -1) {
        replaceElementIcon(icon, 'google-logo');
      } else if (text.indexOf('email') !== -1) {
        replaceElementIcon(icon, 'envelope-simple');
      }
    });
  }

  refresh(document);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      refresh(document);
    });
  }

  window.ReaderIcons = {
    render: render,
    refresh: refresh,
    spritePath: SPRITE_PATH
  };
})();
