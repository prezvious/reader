-- ============================================================
-- Migration: Add Articles Table
-- Run this in the Supabase SQL Editor to enable auto-publishing
-- ============================================================

-- Articles table: stores admin-published article content
CREATE TABLE IF NOT EXISTS articles (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  category text NOT NULL DEFAULT 'General',
  category_slug text NOT NULL DEFAULT 'general',
  author_name text NOT NULL DEFAULT 'Anonymous',
  author_avatar text,
  author_bio text,
  cover_image text,
  cover_image_alt text,
  published_at date NOT NULL DEFAULT CURRENT_DATE,
  featured boolean NOT NULL DEFAULT false,
  content_html text NOT NULL,
  custom_css text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category_slug ON articles(category_slug);

-- Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read articles
CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  USING (true);

-- Only admin can write
CREATE POLICY "Only admins can insert articles"
  ON articles FOR INSERT
  WITH CHECK (auth.jwt()->>'email' = 'saxumfluens@gmail.com');

CREATE POLICY "Only admins can update articles"
  ON articles FOR UPDATE
  USING (auth.jwt()->>'email' = 'saxumfluens@gmail.com');

CREATE POLICY "Only admins can delete articles"
  ON articles FOR DELETE
  USING (auth.jwt()->>'email' = 'saxumfluens@gmail.com');

-- Auto-update updated_at timestamp
CREATE TRIGGER set_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
