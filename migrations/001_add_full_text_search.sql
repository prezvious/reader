-- ============================================================
-- Full-Text Search Migration for Reader
-- Run this in Supabase SQL Editor to enable search.
-- ============================================================

-- 1. Add search_vector column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION articles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.author_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.content_html, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to articles table
DROP TRIGGER IF EXISTS search_vector_update ON articles;
CREATE TRIGGER search_vector_update
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_vector_update();

-- 4. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS articles_search_idx ON articles USING GIN (search_vector);

-- 5. Backfill existing rows (fires the trigger for all existing articles)
UPDATE articles SET search_vector = search_vector;

-- 6. Create the search_articles RPC function
--    This is callable from the client via Supabase:
--    supabase.rpc('search_articles', { search_query: 'engineering' })
CREATE OR REPLACE FUNCTION search_articles(search_query text)
RETURNS TABLE (
  slug text,
  title text,
  excerpt text,
  author_name text,
  author_avatar text,
  author_bio text,
  category text,
  category_slug text,
  cover_image text,
  cover_image_alt text,
  published_at timestamptz,
  featured boolean,
  rank real,
  highlighted_excerpt text
) AS $$
BEGIN
  -- Handle empty or whitespace-only queries gracefully
  IF search_query IS NULL OR trim(search_query) = '' THEN
    RETURN QUERY SELECT * FROM (
      SELECT
        ''::text, ''::text, ''::text, ''::text, ''::text, ''::text,
        ''::text, ''::text, ''::text, ''::text,
        now()::timestamptz, false, 0::real, ''::text
    ) t WHERE false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.slug::text,
    a.title::text,
    a.excerpt::text,
    a.author_name::text,
    a.author_avatar::text,
    a.author_bio::text,
    a.category::text,
    a.category_slug::text,
    a.cover_image::text,
    a.cover_image_alt::text,
    a.published_at::timestamptz,
    a.featured::boolean,
    ts_rank_cd(a.search_vector, query, 32)::real AS rank,
    ts_headline('english', a.excerpt, query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10, MaxFragments=2'
    )::text AS highlighted_excerpt
  FROM articles a,
       websearch_to_tsquery('english', search_query) query
  WHERE a.search_vector @@ query
  ORDER BY rank DESC
  LIMIT 20;
END
$$ LANGUAGE plpgsql;

-- 7. Grant execute permission to anon role (required for client-side RPC)
GRANT EXECUTE ON FUNCTION search_articles(text) TO anon;
GRANT EXECUTE ON FUNCTION search_articles(text) TO authenticated;

-- ============================================================
-- Optional: Fuzzy Search Extension (pg_trgm)
-- Uncomment below if you want typo-tolerant search.
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);

-- ============================================================
-- Verification queries (run these to confirm everything works):
-- ============================================================
-- 1. Check that search_vector is populated:
--    SELECT slug, title, search_vector IS NOT NULL AS has_vector FROM articles LIMIT 5;
--
-- 2. Test the RPC function directly:
--    SELECT * FROM search_articles('engineering');
--
-- 3. Verify GIN index is used (not sequential scan):
--    EXPLAIN ANALYZE SELECT slug, title FROM articles WHERE search_vector @@ to_tsquery('english', 'engineering');
