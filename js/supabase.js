(function () {
  'use strict';

  var SUPABASE_URL = 'https://wgeckjaxqgkvivskbtrk.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZWNramF4cWdrdml2c2tidHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTc3MjUsImV4cCI6MjA5MTA3MzcyNX0.aXll2awgZo1iNQGdDeHUFqy7W-LR0zThdr4TUwBYAD4';

  if (typeof window.supabase === 'undefined') {
    console.error('Supabase SDK not loaded. Include the SDK before supabase.js.');
    window.Supabase = null;
    return;
  }

  if (SUPABASE_URL.indexOf('YOUR_SUPABASE') !== -1 || SUPABASE_ANON_KEY.indexOf('YOUR_SUPABASE') !== -1) {
    console.error('Supabase credentials are still placeholders. Set valid values in js/supabase.js.');
    window.Supabase = null;
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getProfile(userId) {
    var result = await client
      .from('profiles')
      .select('id, email, display_name, avatar_url, bio, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();
    return result.error ? null : result.data;
  }

  async function updateProfile(userId, data) {
    var result = await client
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
    return result.error ? null : result.data;
  }

  async function getBookmarks(userId) {
    var result = await client
      .from('bookmarks')
      .select('id, article_slug, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return result.error ? [] : result.data;
  }

  async function addBookmark(userId, slug) {
    var result = await client
      .from('bookmarks')
      .upsert({ user_id: userId, article_slug: slug }, { onConflict: 'user_id,article_slug' })
      .select()
      .single();
    return result.error ? null : result.data;
  }

  async function removeBookmark(userId, slug) {
    var result = await client
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('article_slug', slug);
    return result.error;
  }

  async function isBookmarked(userId, slug) {
    var result = await client
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (result.error) return { value: false, error: result.error };
    return { value: result.data !== null, error: null };
  }

  async function getReadingHistory(userId) {
    var result = await client
      .from('reading_history')
      .select('id, article_slug, progress_percent, started_at, completed_at, last_read_at')
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false });
    return result.error ? [] : result.data;
  }

  async function getHistoryEntry(userId, slug) {
    var result = await client
      .from('reading_history')
      .select('id, article_slug, progress_percent, started_at, completed_at, last_read_at')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    return result.error ? null : result.data;
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
    return result.error ? null : result.data;
  }

  async function markComplete(userId, slug) {
    var result = await client
      .from('reading_history')
      .update({ progress_percent: 100, completed_at: new Date().toISOString(), last_read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .select()
      .single();
    return result.error ? null : result.data;
  }

  async function clearHistory(userId) {
    var result = await client
      .from('reading_history')
      .delete()
      .eq('user_id', userId);
    return result.error;
  }

  async function getReactionCount(slug) {
    var result = await client
      .from('reactions')
      .select('id', { count: 'exact', head: true })
      .eq('article_slug', slug)
      .eq('reaction_type', 'like');
    return result.error ? 0 : (result.count || 0);
  }

  async function addReaction(userId, slug, type) {
    var reactionType = type || 'like';
    var result = await client
      .from('reactions')
      .upsert({ user_id: userId, article_slug: slug, reaction_type: reactionType }, { onConflict: 'user_id,article_slug,reaction_type' })
      .select()
      .single();
    return result.error ? null : result.data;
  }

  async function removeReaction(userId, slug) {
    var result = await client
      .from('reactions')
      .delete()
      .eq('user_id', userId)
      .eq('article_slug', slug);
    return result.error;
  }

  async function hasReacted(userId, slug) {
    var result = await client
      .from('reactions')
      .select('id')
      .eq('user_id', userId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (result.error) return { value: false, error: result.error };
    return { value: result.data !== null, error: null };
  }

  async function getTotalReadCount(userId) {
    var result = await client
      .from('reading_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('completed_at', 'is', null);
    return result.error ? 0 : (result.count || 0);
  }

  async function getCurrentStreak(userId) {
    var result = await client
      .from('reading_history')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });
    if (result.error || !result.data || result.data.length === 0) return 0;

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
    var expected = new Date(today);

    for (var j = 0; j < unique.length; j++) {
      var parts = unique[j].split('-');
      var entryDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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

  function isValidAvatarUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var trimmed = url.trim().toLowerCase();
    if (trimmed.indexOf('javascript:') === 0 || trimmed.indexOf('data:') === 0) return false;
    return trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0;
  }

  /* =========================================
     ARTICLE CRUD (admin-published articles)
     ========================================= */
  async function publishArticle(articleData) {
    var { data, error } = await client
      .from('articles')
      .insert([articleData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateArticle(slug, updates) {
    var { data, error } = await client
      .from('articles')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteArticle(slug) {
    var { error } = await client
      .from('articles')
      .delete()
      .eq('slug', slug);
    if (error) throw error;
  }

  async function getPublishedArticles() {
    var { data, error } = await client
      .from('articles')
      .select('id, slug, title, excerpt, category, category_slug, author_name, author_avatar, author_bio, cover_image, cover_image_alt, published_at, featured')
      .order('published_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getArticleContent(slug) {
    var { data, error } = await client
      .from('articles')
      .select('content_html, custom_css')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  }

  async function getArticleBySlug(slug) {
    var { data, error } = await client
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) return null;
    return data;
  }

  window.Supabase = {
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
    getArticleBySlug: getArticleBySlug
  };
})();
