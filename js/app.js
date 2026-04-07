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

    if (profile.avatar_url && Supabase.isValidAvatarUrl(profile.avatar_url)) {
      var headerAvatar = document.getElementById('header-avatar');
      if (headerAvatar) {
        headerAvatar.innerHTML = '';
        var headerImg = document.createElement('img');
        headerImg.setAttribute('src', profile.avatar_url);
        headerImg.setAttribute('alt', name);
        headerAvatar.appendChild(headerImg);
      }

      var sidebarAvatar = document.getElementById('sidebar-avatar');
      if (sidebarAvatar) {
        sidebarAvatar.innerHTML = '';
        var sidebarImg = document.createElement('img');
        sidebarImg.setAttribute('src', profile.avatar_url);
        sidebarImg.setAttribute('alt', name);
        sidebarAvatar.appendChild(sidebarImg);
      }
    }
  }

  /* Initialize avatar click via event delegation on the wrapper — survives innerHTML changes */
  function initAvatarMenu() {
    var wrapper = document.getElementById('avatar-wrapper');
    if (!wrapper) return;

    wrapper.addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = document.getElementById('avatar-menu');
      if (menu) menu.classList.toggle('avatar-dropdown__menu--open');
    });
  }

  /* Initialize signout buttons (menu + sidebar) */
  function initSignOutButtons() {
    var menuBtn = document.getElementById('menu-signout');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        Auth.signOut().catch(function () { window.location.href = 'signin.html'; });
      });
    }

    var sidebarBtn = document.getElementById('sidebar-signout');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', function () {
        Auth.signOut().catch(function () { window.location.href = 'signin.html'; });
      });
    }
  }

  /* Close avatar menu when clicking outside */
  function initAvatarMenuClose() {
    document.addEventListener('click', function () {
      var menu = document.getElementById('avatar-menu');
      if (menu) menu.classList.remove('avatar-dropdown__menu--open');
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
  function initMobileSidebar() {
    var menuBtn = document.getElementById('mobile-menu-btn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('mobile-overlay');
    if (!menuBtn || !sidebar) return;

    menuBtn.addEventListener('click', function () {
      var isOpen = sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
    });

    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
    }

    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
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
    renderUser: renderUser
  };
})();
