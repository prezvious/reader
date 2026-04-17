(function () {
  'use strict';

  /* ===== SHARED UTILITIES ===== */

  /* Reusable DOM element for HTML escaping — avoids per-call allocation */
  var _escapeDiv = document.createElement('div');

  function escapeHtml(str) {
    if (str == null) return '';
    _escapeDiv.textContent = str;
    return _escapeDiv.innerHTML;
  }

  /* Sanitize HTML for storage/display — strips dangerous elements and attributes */
  var contentUtils = (typeof window !== 'undefined' && window.ArticleContentUtils) ? window.ArticleContentUtils : null;

  function sanitizeHtml(html, options) {
    if (!html || typeof html !== 'string') return '';
    if (contentUtils && typeof contentUtils.sanitizeHtml === 'function') {
      return contentUtils.sanitizeHtml(html, options);
    }
    return html;
  }

  function normalizeArticleHtml(html, options) {
    if (!html || typeof html !== 'string') return '';
    if (contentUtils && typeof contentUtils.normalizeArticleHtml === 'function') {
      return contentUtils.normalizeArticleHtml(html, options);
    }
    return html;
  }

  function scopeArticleCss(css, scopes) {
    if (!css || typeof css !== 'string') return '';
    if (contentUtils && typeof contentUtils.scopeArticleCss === 'function') {
      return contentUtils.scopeArticleCss(css, scopes);
    }
    return css;
  }

  function renderArticleHtml(html, options) {
    if (!html || typeof html !== 'string') return '';
    if (contentUtils && typeof contentUtils.renderArticleHtml === 'function') {
      return contentUtils.renderArticleHtml(html, options);
    }
    return sanitizeHtml(html, options);
  }

  /* Shared renderUser — null-safe email, uses createElement to preserve listeners */
  function renderUser(user) {
    var profile = user.profile || {};
    var email = user.email || '';
    var name = profile.display_name || (email ? email.split('@')[0] : 'Reader');
    var initials = Manifest.getInitials(name);

    var greetingEl = document.getElementById('greeting-title');
    if (greetingEl) {
      greetingEl.textContent = 'Welcome back, ' + name.split(' ')[0];
    }

    var menuNameEl = document.getElementById('menu-name');
    if (menuNameEl) menuNameEl.textContent = name;

    var menuEmailEl = document.getElementById('menu-email');
    if (menuEmailEl) menuEmailEl.textContent = email;

    var avatarInitialsEl = document.getElementById('avatar-initials');
    if (avatarInitialsEl) avatarInitialsEl.textContent = initials;

    var sidebarNameEl = document.getElementById('sidebar-name');
    if (sidebarNameEl) sidebarNameEl.textContent = name;

    var sidebarEmailEl = document.getElementById('sidebar-email');
    if (sidebarEmailEl) sidebarEmailEl.textContent = email;

    var sidebarInitialsEl = document.getElementById('sidebar-initials');
    if (sidebarInitialsEl) sidebarInitialsEl.textContent = initials;

    /* Helper: render an avatar slot with initials fallback. */
    function setInitialsAvatar(slotId, initialsId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      slot.innerHTML = '';
      var span = document.createElement('span');
      span.id = initialsId;
      span.textContent = initials;
      slot.appendChild(span);
    }

    /* Helper: render an avatar slot with an <img>, falling back to initials on error. */
    function setImageAvatar(slotId, initialsId, url) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      slot.innerHTML = '';
      var img = document.createElement('img');
      img.setAttribute('alt', name);
      img.onerror = function () { setInitialsAvatar(slotId, initialsId); };
      img.setAttribute('src', url);
      slot.appendChild(img);
    }

    if (profile.avatar_url && Supabase.isValidAvatarUrl(profile.avatar_url)) {
      setImageAvatar('header-avatar', 'avatar-initials', profile.avatar_url);
      setImageAvatar('sidebar-avatar', 'sidebar-initials', profile.avatar_url);
    } else {
      /* Always restore initials when avatar URL is null/invalid —
         must replace any stale <img> from a previous render. */
      setInitialsAvatar('header-avatar', 'avatar-initials');
      setInitialsAvatar('sidebar-avatar', 'sidebar-initials');
    }
  }

  /* Initialize avatar click via event delegation on the wrapper — survives innerHTML changes */
  function initAvatarMenu() {
    var wrapper = document.getElementById('avatar-wrapper');
    var avatar = document.getElementById('header-avatar');
    if (!wrapper || !avatar) return;

    /* Make avatar focusable and keyboard-accessible */
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('aria-haspopup', 'true');
    avatar.setAttribute('aria-expanded', 'false');
    avatar.setAttribute('aria-label', 'Open user menu');

    function openMenu() {
      var menu = document.getElementById('avatar-menu');
      if (menu) {
        menu.classList.toggle('avatar-dropdown__menu--open');
        var isOpen = menu.classList.contains('avatar-dropdown__menu--open');
        avatar.setAttribute('aria-expanded', String(isOpen));

        /* Focus first menu item when opened */
        if (isOpen) {
          var firstItem = menu.querySelector('.avatar-dropdown__item, button');
          if (firstItem) {
            setTimeout(function () { firstItem.focus(); }, 50);
          }
        }
      }
    }

    function closeMenu() {
      var menu = document.getElementById('avatar-menu');
      if (menu) {
        menu.classList.remove('avatar-dropdown__menu--open');
        avatar.setAttribute('aria-expanded', 'false');
        avatar.focus();
      }
    }

    /* Click handler */
    wrapper.addEventListener('click', function (e) {
      e.stopPropagation();
      openMenu();
    });

    /* Keyboard handler on avatar */
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      } else if (e.key === 'Escape') {
        closeMenu();
      }
    });

    /* Keyboard handler inside menu */
    var menu = document.getElementById('avatar-menu');
    if (menu) {
      menu.setAttribute('role', 'menu');
      menu.querySelectorAll('.avatar-dropdown__item, button').forEach(function (item) {
        item.setAttribute('role', 'menuitem');
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            closeMenu();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            var items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            var idx = items.indexOf(document.activeElement);
            var next = items[(idx + 1) % items.length];
            if (next) next.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            var items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            var idx = items.indexOf(document.activeElement);
            var prev = items[(idx - 1 + items.length) % items.length];
            if (prev) prev.focus();
          }
        });
      });
    }
  }

  /* Initialize signout buttons (menu + sidebar) */
  function initSignOutButtons() {
    var menuBtn = document.getElementById('menu-signout');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        menuBtn.disabled = true;
        Auth.signOut().catch(function () {
          menuBtn.disabled = false;
          window.location.href = 'signin.html';
        });
      });
    }

    var sidebarBtn = document.getElementById('sidebar-signout');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', function () {
        sidebarBtn.disabled = true;
        Auth.signOut().catch(function () {
          sidebarBtn.disabled = false;
          window.location.href = 'signin.html';
        });
      });
    }
  }

  /* Close avatar menu when clicking outside */
  function initAvatarMenuClose() {
    document.addEventListener('click', function () {
      var menu = document.getElementById('avatar-menu');
      var avatar = document.getElementById('header-avatar');
      if (menu) {
        menu.classList.remove('avatar-dropdown__menu--open');
        if (avatar) avatar.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ===== THEME ===== */
  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('reader-theme'); } catch (e) {}
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('reader-theme', next); } catch (e) {}
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  /* ===== MOBILE SIDEBAR ===== */
  function initSidebarSearchLink() {
    var nav = document.querySelector('.sidebar__nav');
    if (!nav || nav.querySelector('.sidebar__link[href="search.html"]')) return;

    var link = document.createElement('a');
    link.className = 'sidebar__link';
    link.href = 'search.html';
    link.innerHTML = (window.ReaderIcons && typeof window.ReaderIcons.render === 'function'
      ? window.ReaderIcons.render('magnifying-glass')
      : '') + 'Search';

    var homeLink = nav.querySelector('.sidebar__link[href="index.html"]');
    if (homeLink && homeLink.nextSibling) {
      nav.insertBefore(link, homeLink.nextSibling);
    } else if (homeLink) {
      nav.appendChild(link);
    } else {
      nav.insertBefore(link, nav.firstChild);
    }
  }

  function initMobileSidebar() {
    var menuBtn = document.getElementById('mobile-menu-btn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('mobile-overlay');
    if (!menuBtn || !sidebar) return;

    function renderMenuIcon(isOpen) {
      if (!window.ReaderIcons || typeof window.ReaderIcons.render !== 'function') return;
      menuBtn.innerHTML = window.ReaderIcons.render(isOpen ? 'x' : 'list', '', isOpen ? 'Close menu' : 'Open menu');
    }

    function setOpenState(isOpen) {
      sidebar.classList.toggle('open', isOpen);
      if (overlay) overlay.classList.toggle('active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      menuBtn.classList.toggle('mobile-menu-btn--open', isOpen);
      menuBtn.setAttribute('aria-expanded', String(isOpen));
      menuBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      renderMenuIcon(isOpen);
    }

    menuBtn.setAttribute('aria-controls', 'sidebar');
    menuBtn.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    renderMenuIcon(false);

    menuBtn.addEventListener('click', function () {
      setOpenState(!sidebar.classList.contains('open'));
    });

    if (overlay) {
      overlay.addEventListener('click', function () {
        setOpenState(false);
      });
    }

    sidebar.querySelectorAll('a, button').forEach(function (control) {
      control.addEventListener('click', function () {
        setOpenState(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar.classList.contains('open')) {
        setOpenState(false);
        menuBtn.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024 && sidebar.classList.contains('open')) {
        setOpenState(false);
      }
    });
  }

  /* ===== ACTIVE NAV ===== */
  function setActiveNav() {
    var page = document.body.getAttribute('data-page') || '';
    var links = document.querySelectorAll('.header__link, .sidebar__link');
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href === page + '.html' || (page === 'home' && href === 'index.html')) {
        link.classList.add('header__link--active', 'sidebar__link--active');
      }
    });
  }

  /* ===== SHARE ===== */
  function shareToX() {
    var url = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);
    window.open('https://twitter.com/intent/tweet?url=' + url + '&text=' + title, '_blank', 'noopener,noreferrer');
  }

  function shareViaEmail() {
    var subject = encodeURIComponent(document.title);
    var body = encodeURIComponent(window.location.href);
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
  }

  function copyLink() {
    var self = this;
    navigator.clipboard.writeText(window.location.href).then(function () {
      showToast('Link copied');
      if (self) {
        var original = self.getAttribute('aria-label') || '';
        self.setAttribute('aria-label', 'Copied!');
        setTimeout(function () { self.setAttribute('aria-label', original); }, 1500);
      }
    }).catch(function () {
      window.prompt('Copy this URL:', window.location.href);
    });
  }

  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('show');
      });
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
  }

  function initShareButtons() {
    var xBtn = document.getElementById('share-x');
    var emailBtn = document.getElementById('share-email');
    var copyBtn = document.getElementById('share-copy');

    if (xBtn) xBtn.addEventListener('click', shareToX);
    if (emailBtn) emailBtn.addEventListener('click', shareViaEmail);
    if (copyBtn) copyBtn.addEventListener('click', copyLink);
  }

  /* ===== SCROLL REVEAL ===== */
  function initScrollReveal() {
    _initScrollRevealInternal();
  }

  function _initScrollRevealInternal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el, i) {
      el.style.transitionDelay = (i * 0.08) + 's';
      observer.observe(el);
    });
  }

  /* ===== URL HELPERS ===== */
  function getArticleUrl(slug) {
    return 'article.html?slug=' + encodeURIComponent(slug);
  }

  function getCurrentSlug() {
    var params = new URLSearchParams(window.location.search);
    return params.get('slug') || '';
  }

  /* ===== INIT ===== */
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initSidebarSearchLink();
    initMobileSidebar();
    setActiveNav();
    initShareButtons();
    initScrollReveal();
    initAvatarMenu();
    initAvatarMenuClose();
    initSignOutButtons();

    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  });

  window.App = {
    toggleTheme: toggleTheme,
    shareToX: shareToX,
    shareViaEmail: shareViaEmail,
    copyLink: copyLink,
    showToast: showToast,
    getArticleUrl: getArticleUrl,
    getCurrentSlug: getCurrentSlug,
    escapeHtml: escapeHtml,
    sanitizeHtml: sanitizeHtml,
    normalizeArticleHtml: normalizeArticleHtml,
    renderArticleHtml: renderArticleHtml,
    scopeArticleCss: scopeArticleCss,
    renderUser: renderUser,
    initScrollReveal: initScrollReveal,
    _initScrollReveal: _initScrollRevealInternal
  };
})();
