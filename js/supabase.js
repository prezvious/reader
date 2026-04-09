(function () {
  'use strict';

  var LOCAL_CONFIG_PATH = 'js/private-config.local.json';
  var UNAVAILABLE_MESSAGE = 'Connected features are unavailable until your private local config is added.';

  function createAuthStub(message) {
    function authError() {
      return { message: message };
    }

    return {
      getSession: function () {
        return Promise.resolve({ data: { session: null }, error: null });
      },
      signInWithPassword: function () {
        return Promise.resolve({ data: { user: null, session: null }, error: authError() });
      },
      signUp: function () {
        return Promise.resolve({ data: { user: null, session: null }, error: authError() });
      },
      signInWithOAuth: function () {
        return Promise.resolve({ data: null, error: authError() });
      },
      signOut: function () {
        return Promise.resolve({ error: null });
      },
      resetPasswordForEmail: function () {
        return Promise.resolve({ data: null, error: authError() });
      },
      updateUser: function () {
        return Promise.resolve({ data: null, error: authError() });
      },
      refreshSession: function () {
        return Promise.resolve({ data: { session: null, user: null }, error: null });
      },
      onAuthStateChange: function () {
        return {
          data: {
            subscription: {
              unsubscribe: function () {}
            }
          }
        };
      }
    };
  }

  function isValidAvatarUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var trimmed = url.trim().toLowerCase();
    if (trimmed.indexOf('javascript:') === 0 || trimmed.indexOf('data:') === 0) return false;
    return trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0;
  }

  function createUnavailableApi(message) {
    function rejectUnavailable() {
      return Promise.reject(new Error(message));
    }

    return {
      isConfigured: false,
      client: {
        auth: createAuthStub(message)
      },
      getProfile: function () { return Promise.resolve(null); },
      updateProfile: rejectUnavailable,
      getBookmarks: function () { return Promise.resolve([]); },
      addBookmark: rejectUnavailable,
      removeBookmark: rejectUnavailable,
      isBookmarked: function () { return Promise.resolve({ value: false, error: null }); },
      getReadingHistory: function () { return Promise.resolve([]); },
      getHistoryEntry: function () { return Promise.resolve(null); },
      updateProgress: rejectUnavailable,
      markComplete: rejectUnavailable,
      clearHistory: rejectUnavailable,
      getReactionCount: function () { return Promise.resolve(0); },
      addReaction: rejectUnavailable,
      removeReaction: rejectUnavailable,
      hasReacted: function () { return Promise.resolve({ value: false, error: null }); },
      getTotalReadCount: function () { return Promise.resolve(0); },
      getCurrentStreak: function () { return Promise.resolve(0); },
      isValidAvatarUrl: isValidAvatarUrl,
      publishArticle: rejectUnavailable,
      updateArticle: rejectUnavailable,
      deleteArticle: rejectUnavailable,
      getPublishedArticles: function () { return Promise.resolve([]); },
      getArticleContent: function () { return Promise.resolve(null); },
      getArticleBySlug: function () { return Promise.resolve(null); },
      searchArticles: function () { return Promise.resolve([]); }
    };
  }

  function setUnavailable(reason) {
    console.warn(reason);
    window.Supabase = createUnavailableApi(reason);
    return null;
  }

  function loadPrivateConfig() {
    try {
      var request = new XMLHttpRequest();
      request.open('GET', LOCAL_CONFIG_PATH, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300 && request.responseText) {
        return JSON.parse(request.responseText);
      }
    } catch (error) {
      console.warn('Unable to load local private config:', error);
    }

    return null;
  }

  if (typeof window.supabase === 'undefined') {
    setUnavailable('Reader data client SDK not loaded. Connected features are disabled.');
    return;
  }

  var privateConfig = loadPrivateConfig();
  if (!privateConfig || !privateConfig.url || !privateConfig.anonKey) {
    setUnavailable(UNAVAILABLE_MESSAGE);
    return;
  }

  var client = window.supabase.createClient(privateConfig.url, privateConfig.anonKey);

  async function getProfile(userId) {
    var result = await client
      .from('profiles')
      .select('id, email, display_name, avatar_url, bio, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function updateProfile(userId, data) {
    var result = await client
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function getBookmarks(userId) {
    var result = await client
      .from('bookmarks')
      .select('id, article_slug, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function addBookmark(userId, slug) {
    var result = await client
      .from('bookmarks')
      .upsert({ user_id: userId, article_slug: slug }, { onConflict: 'user_id,article_slug' })
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function removeBookmark(userId, slug) {
    var result = await client
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('article_slug', slug);
    if (result.error) throw result.error;
  }

  async function isBookmarked(userId, slug) {
    var result = await client
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (result.error) throw result.error;
    return { value: result.data !== null, error: null };
  }

  async function getReadingHistory(userId) {
    var result = await client
      .from('reading_history')
      .select('id, article_slug, progress_percent, started_at, completed_at, last_read_at')
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getHistoryEntry(userId, slug) {
    var result = await client
      .from('reading_history')
      .select('id, article_slug, progress_percent, started_at, completed_at, last_read_at')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function updateProgress(userId, slug, progress) {
    var result = await client
      .from('reading_history')
      .upsert(
        {
          user_id: userId,
          article_slug: slug,
          progress_percent: progress,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id,article_slug' }
      )
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function markComplete(userId, slug) {
    var result = await client
      .from('reading_history')
      .upsert(
        {
          user_id: userId,
          article_slug: slug,
          progress_percent: 100,
          completed_at: new Date().toISOString(),
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id,article_slug' }
      )
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function clearHistory(userId) {
    var result = await client
      .from('reading_history')
      .delete()
      .eq('user_id', userId);
    if (result.error) throw result.error;
  }

  async function getReactionCount(slug) {
    var result = await client
      .from('reactions')
      .select('id', { count: 'exact', head: true })
      .eq('article_slug', slug)
      .eq('reaction_type', 'like');
    if (result.error) throw result.error;
    return result.count || 0;
  }

  async function addReaction(userId, slug, type) {
    var reactionType = type || 'like';
    var result = await client
      .from('reactions')
      .upsert({ user_id: userId, article_slug: slug, reaction_type: reactionType }, { onConflict: 'user_id,article_slug,reaction_type' })
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function removeReaction(userId, slug) {
    var result = await client
      .from('reactions')
      .delete()
      .eq('user_id', userId)
      .eq('article_slug', slug);
    if (result.error) throw result.error;
  }

  async function hasReacted(userId, slug) {
    var result = await client
      .from('reactions')
      .select('id')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (result.error) throw result.error;
    return { value: result.data !== null, error: null };
  }

  async function getTotalReadCount(userId) {
    var result = await client
      .from('reading_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('completed_at', 'is', null);
    if (result.error) throw result.error;
    return result.count || 0;
  }

  async function getCurrentStreak(userId) {
    var result = await client
      .from('reading_history')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });
    if (result.error) throw result.error;
    if (!result.data || result.data.length === 0) return 0;

    var dates = result.data.map(function (d) {
      var dt = new Date(d.completed_at);
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    });

    var unique = [];
    var seen = {};
    for (var i = 0; i < dates.length; i++) {
      if (!seen[dates[i]]) {
        seen[dates[i]] = true;
        unique.push(dates[i]);
      }
    }

    var streak = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var latestParts = unique[0].split('-');
    var latestDate = new Date(parseInt(latestParts[0], 10), parseInt(latestParts[1], 10) - 1, parseInt(latestParts[2], 10));
    var daysSinceLatest = Math.round((today - latestDate) / (1000 * 60 * 60 * 24));

    var expected;
    if (daysSinceLatest === 0) {
      expected = new Date(today);
    } else if (daysSinceLatest === 1) {
      expected = new Date(today);
      expected.setDate(expected.getDate() - 1);
    } else {
      return 0;
    }

    for (var j = 0; j < unique.length; j++) {
      var parts = unique[j].split('-');
      var entryDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      var diff = Math.round((expected - entryDate) / (1000 * 60 * 60 * 24));
      if (diff === 0) {
        streak++;
        expected.setDate(expected.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  async function publishArticle(articleData) {
    var result = await client
      .from('articles')
      .insert([articleData])
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function updateArticle(slug, updates) {
    var result = await client
      .from('articles')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function deleteArticle(slug) {
    var result = await client
      .from('articles')
      .delete()
      .eq('slug', slug);
    if (result.error) throw result.error;
  }

  async function getPublishedArticles() {
    var result = await client
      .from('articles')
      .select('id, slug, title, excerpt, category, category_slug, author_name, author_avatar, author_bio, cover_image, cover_image_alt, published_at, featured')
      .order('published_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getArticleContent(slug) {
    var result = await client
      .from('articles')
      .select('content_html, custom_css')
      .eq('slug', slug)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function getArticleBySlug(slug) {
    var result = await client
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single();
    if (result.error) return null;
    return result.data;
  }

  async function searchArticles(query) {
    if (!query || query.length < 2) return [];
    var sanitized = query.replace(/[<>]/g, '').trim();
    if (!sanitized) return [];
    try {
      var result = await client.rpc('search_articles', { search_query: sanitized });
      if (result.error) throw result.error;
      return result.data || [];
    } catch (err) {
      console.error('Search query failed:', err);
      return [];
    }
  }

  window.Supabase = {
    isConfigured: true,
    client: client,
    getProfile: getProfile,
    updateProfile: updateProfile,
    getBookmarks: getBookmarks,
    addBookmark: addBookmark,
    removeBookmark: removeBookmark,
    isBookmarked: isBookmarked,
    getReadingHistory: getReadingHistory,
    getHistoryEntry: getHistoryEntry,
    updateProgress: updateProgress,
    markComplete: markComplete,
    clearHistory: clearHistory,
    getReactionCount: getReactionCount,
    addReaction: addReaction,
    removeReaction: removeReaction,
    hasReacted: hasReacted,
    getTotalReadCount: getTotalReadCount,
    getCurrentStreak: getCurrentStreak,
    isValidAvatarUrl: isValidAvatarUrl,
    publishArticle: publishArticle,
    updateArticle: updateArticle,
    deleteArticle: deleteArticle,
    getPublishedArticles: getPublishedArticles,
    getArticleContent: getArticleContent,
    getArticleBySlug: getArticleBySlug,
    searchArticles: searchArticles
  };
})();
