(function () {
  'use strict';

  var currentUser = null;

  async function initAuth() {
    if (!window.Supabase) {
      console.error('Supabase module not loaded. Ensure supabase.js is loaded before auth.js.');
      return null;
    }

    try {
      var sessionResult = await window.Supabase.client.auth.getSession();
      var session = sessionResult.data.session;

      if (!session) {
        return null;  // Don't redirect — caller decides
      }

      currentUser = session.user;

      var profile = await window.Supabase.getProfile(currentUser.id);
      if (profile) {
        currentUser.profile = profile;
      }
      window.currentUser = currentUser;

      return currentUser;
    } catch (error) {
      console.error('Auth initialization error:', error);
      return null;  // Don't redirect — caller decides
    }
  }

  /* requireAuth: redirects if no session — use on protected pages only */
  function requireAuth() {
    return initAuth().then(function (user) {
      if (!user) {
        redirectToSignin();
      }
      return user;
    });
  }

  function isValidRedirect(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.indexOf('://') !== -1) return false;
    if (url.indexOf('//') === 0) return false;
    if (url.indexOf('\\') !== -1) return false;
    return url.charAt(0) === '/' || url.indexOf('.html') !== -1;
  }

  function redirectToSignin() {
    var currentPath = window.location.pathname + window.location.search;
    var signinPages = ['signin.html', 'signup.html'];
    var currentPage = window.location.pathname.split('/').pop();

    if (signinPages.indexOf(currentPage) !== -1) {
      return;
    }

    var redirectParam = '?redirect=' + encodeURIComponent(currentPath);
    window.location.href = 'signin.html' + redirectParam;
  }

  function redirectIfLoggedIn() {
    if (!window.Supabase) return Promise.resolve(false);

    return window.Supabase.client.auth.getSession().then(function (result) {
      if (result.data.session) {
        var params = new URLSearchParams(window.location.search);
        var redirect = params.get('redirect');
        window.location.href = (isValidRedirect(redirect) ? redirect : 'dashboard.html');
        return true;
      }
      return false;
    });
  }

  async function signIn(email, password) {
    var result = await window.Supabase.client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      throw mapAuthError(result.error.message);
    }

    currentUser = result.data.user;
    var profile = await window.Supabase.getProfile(currentUser.id);
    if (profile) {
      currentUser.profile = profile;
    }
    window.currentUser = currentUser;

    handlePostAuthRedirect(false);
    return currentUser;
  }

  async function signUp(email, password, displayName) {
    var result = await window.Supabase.client.auth.signUp({
      email: email,
      password: password,
      options: { data: { display_name: displayName } }
    });

    if (result.error) {
      throw mapAuthError(result.error.message);
    }

    if (result.data.user) {
      currentUser = result.data.user;
      currentUser.profile = {
        id: currentUser.id,
        email: email,
        display_name: displayName,
        avatar_url: null,
        bio: null
      };
      window.currentUser = currentUser;
    }

    if (!result.data.session) {
      return { user: currentUser, requiresConfirmation: true };
    }

    handlePostAuthRedirect(true);
    return { user: currentUser, requiresConfirmation: false };
  }

  async function signInWithGoogle() {
    var params = new URLSearchParams(window.location.search);
    var redirect = params.get('redirect');
    /* Store redirect target in sessionStorage so verify.html can retrieve it */
    if (redirect) {
      try { sessionStorage.setItem('oauth-redirect', redirect); } catch (e) {}
    }
    var result = await window.Supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/verify.html'
      }
    });
    if (result.error) throw mapAuthError(result.error.message);
  }

  async function signOut() {
    /* Clear local state immediately — even if the server call fails */
    var prevUser = currentUser;
    currentUser = null;
    window.currentUser = null;

    try {
      var result = await window.Supabase.client.auth.signOut();
      if (result.error) throw mapAuthError(result.error.message);
    } catch (error) {
      /* Restore state on failure so the app remains consistent */
      currentUser = prevUser;
      window.currentUser = prevUser;
      throw error;
    }

    window.location.href = 'signin.html';
  }

  async function resetPassword(email) {
    var result = await window.Supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/profile.html'
    });
    if (result.error) throw mapAuthError(result.error.message);
  }

  async function updatePassword(newPassword) {
    var result = await window.Supabase.client.auth.updateUser({
      password: newPassword
    });
    if (result.error) throw mapAuthError(result.error.message);
  }

  function getUser() {
    return currentUser;
  }

  function getSession() {
    return window.Supabase ? window.Supabase.client.auth.getSession() : null;
  }

  function onAuthChange(callback) {
    if (!window.Supabase) return null;
    /* Track whether we have already processed the initial SIGNED_IN event
       to prevent handlePostAuthRedirect from firing on every token refresh. */
    var hasHandledInitialAuth = false;

    return window.Supabase.client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        window.currentUser = currentUser;
        window.Supabase.getProfile(currentUser.id).then(function (profile) {
          if (profile) {
            currentUser.profile = profile;
            window.currentUser = currentUser;
          }
        });

        /* Only perform the redirect flow once, on the initial sign-in.
           Token refresh (TOKEN_REFRESHED) should NOT trigger a redirect. */
        if (!hasHandledInitialAuth) {
          hasHandledInitialAuth = true;
          var isNewUser = isNewSignup(session.user);
          handlePostAuthRedirect(isNewUser);
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        window.currentUser = null;
      }
      callback(event, session);
    });
  }

  function isNewSignup(user) {
    if (!user || !user.created_at || !user.last_sign_in_at) return false;
    var created = new Date(user.created_at).getTime();
    var lastSignIn = new Date(user.last_sign_in_at).getTime();
    return Math.abs(lastSignIn - created) < 60000;
  }

  function handlePostAuthRedirect(isNewUser) {
    /* Check sessionStorage for OAuth redirect first */
    var redirect = null;
    try { redirect = sessionStorage.getItem('oauth-redirect'); } catch (e) {}
    if (redirect) {
      try { sessionStorage.removeItem('oauth-redirect'); } catch (e) {}
    }

    /* Fall back to URL param */
    if (!redirect) {
      var params = new URLSearchParams(window.location.search);
      redirect = params.get('redirect');
    }

    if (isValidRedirect(redirect)) {
      window.location.href = redirect;
    } else if (isNewUser) {
      window.location.href = 'verify.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  }

  function mapAuthError(message) {
    if (message.indexOf('Invalid login credentials') !== -1) {
      return new Error('Invalid email or password. Please try again.');
    }
    if (message.indexOf('Email not confirmed') !== -1 || message.indexOf('not confirmed') !== -1) {
      return new Error('Please check your email and confirm your account before signing in.');
    }
    if (message.indexOf('already registered') !== -1 || message.indexOf('already in use') !== -1 || message.indexOf('User already registered') !== -1) {
      return new Error('An account with this email already exists.');
    }
    if (message.indexOf('Password should be at least') !== -1) {
      return new Error('Password must be at least 8 characters with 1 uppercase letter and 1 number.');
    }
    if (message.indexOf('rate limit') !== -1 || message.indexOf('Too many') !== -1) {
      return new Error('Too many attempts. Please try again in a moment.');
    }
    if (message.indexOf('NetworkError') !== -1 || message.indexOf('fetch') !== -1) {
      return new Error('Unable to connect. Please check your internet connection.');
    }
    return new Error(message);
  }

  window.Auth = {
    initAuth: initAuth,
    requireAuth: requireAuth,
    redirectIfLoggedIn: redirectIfLoggedIn,
    signIn: signIn,
    signUp: signUp,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    getUser: getUser,
    getSession: getSession,
    onAuthChange: onAuthChange,
    isNewSignup: isNewSignup
  };
})();
