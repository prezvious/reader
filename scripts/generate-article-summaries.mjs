import { mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'data', 'summaries');
const INDEX_PATH = path.join(OUTPUT_DIR, 'index.json');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODELS = ['google/gemma-4-31b-it:free', 'openrouter/free'];

const force = process.argv.includes('--force');
const slugArgIndex = process.argv.indexOf('--slug');
const onlySlug = slugArgIndex !== -1 ? process.argv[slugArgIndex + 1] : '';
const modelsArgIndex = process.argv.indexOf('--models');
const modelsArg = modelsArgIndex !== -1 ? process.argv[modelsArgIndex + 1] : '';
const apiKey = process.env.OPENROUTER_API_KEY;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const requestedModels = (modelsArg || process.env.OPENROUTER_SUMMARY_MODELS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const MODELS_TO_TRY = requestedModels.length ? requestedModels : DEFAULT_MODELS;

if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY. Set it in your shell before running this script.');
  process.exit(1);
}

const summarizerPrompt = (text) => `Note: Add your text between % % signs for this prompt to work.
%
${text}
%

Act as a professional summarizer and careful analytical reader. Create an accurate, coherent, and sufficiently developed summary of the text enclosed in %% above, using only the information contained in that text.

Your goal is to produce a summary that is not too short, does not oversimplify, and remains fully consistent with the source. The summary must preserve the main ideas in a connected and logically organized way, so that the original argument, explanation, or narrative is not fragmented or diluted.

Guidelines:

[
- Rely strictly on the text provided in %% above. Do not add external information, assumptions, interpretations, or background knowledge.
- Preserve the original meaning, emphasis, and internal logic of the text.
- Ensure the summary is highly accurate and fully consistent with the source.
- Do not make the summary too brief. It should be condensed, but still long enough to retain the essential reasoning, development of ideas, and important supporting details.
- Keep the main ideas intact and connected. Do not reduce them to isolated fragments or disconnected points.
- Capture the central thesis, major arguments, key supporting points, important examples, and conclusions when they are relevant to understanding the text.
- If the source develops ideas in stages, reflects multiple sections, or builds an argument progressively, preserve that structure clearly in the summary.
- Maintain important nuance, distinctions, qualifications, limitations, and contrasts present in the original text.
- Avoid distortion through excessive compression.
- Avoid unnecessary repetition, filler, or minor details that do not materially support the main ideas.
- Do not introduce criticism, evaluation, or commentary unless the source itself does so.
- Use precise paraphrasing rather than copying long phrases from the original.

Output format:

# Comprehensive Summary

## Overview
Write one substantial paragraph that identifies the overall subject, purpose, and central idea of the text.

## Main Ideas and Development
Write one or more well-formed paragraphs that explain the main ideas in the order and relationship in which they are developed in the original text. Make sure the summary reads as a continuous and coherent account, not as disconnected observations.

## Key Supporting Details
Write one or more paragraphs covering the most important supporting explanations, examples, evidence, sub-arguments, or clarifications that are necessary to preserve the full meaning of the text.

## Conclusion
Write one final paragraph summarizing the overall takeaway, final conclusion, or closing implication of the text.

Quality standard:
The summary must be concise but not minimal. It should be detailed enough to preserve the integrity of the original text, while still being significantly shorter and easier to read than the source.
]`;

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    middot: '·',
    hellip: '…',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    copy: '©'
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : _;
  });
}

function htmlToPlainText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|blockquote|pre|figure|figcaption|tr)>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<\/(li|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSupabaseConfig(fileContents) {
  const urlMatch = fileContents.match(/var SUPABASE_URL = '([^']+)'/);
  const keyMatch = fileContents.match(/var SUPABASE_ANON_KEY = '([^']+)'/);
  if (!urlMatch || !keyMatch) return null;
  return {
    url: urlMatch[1],
    anonKey: keyMatch[1]
  };
}

async function loadStaticArticles() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const articles = manifest.articles || [];

  const staticArticles = [];
  for (const article of articles) {
    const articlePath = path.join(ROOT, article.folder || '', 'index.html');
    const html = await readFile(articlePath, 'utf8');
    staticArticles.push({
      slug: article.slug,
      title: article.title,
      source: 'static',
      html
    });
  }

  return staticArticles;
}

async function loadDbArticles() {
  const supabaseJs = await readFile(path.join(ROOT, 'js', 'supabase.js'), 'utf8');
  const config = extractSupabaseConfig(supabaseJs);
  if (!config) {
    console.warn('Could not parse Supabase config. Skipping DB-backed articles.');
    return [];
  }

  const response = await fetch(
    `${config.url}/rest/v1/articles?select=slug,title,content_html&order=published_at.desc`,
    {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    }
  );

  if (!response.ok) {
    console.warn(`Skipping DB-backed articles. Supabase returned ${response.status}.`);
    return [];
  }

  const rows = await response.json();
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    source: 'db',
    html: row.content_html || ''
  }));
}

function mergeArticles(staticArticles, dbArticles) {
  const merged = new Map();
  staticArticles.forEach((article) => merged.set(article.slug, article));
  dbArticles.forEach((article) => merged.set(article.slug, article));
  return Array.from(merged.values());
}

async function summarizeArticle(article) {
  const articleText = htmlToPlainText(article.html);
  let lastError = null;

  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://reader.local',
          'X-Title': 'Reader summary generator'
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: summarizerPrompt(articleText)
            }
          ]
        })
      });

      const payload = await response.json();
      if (response.ok) {
        const summaryMarkdown = payload?.choices?.[0]?.message?.content?.trim();
        if (!summaryMarkdown) {
          throw new Error('OpenRouter returned an empty summary.');
        }

        return {
          slug: article.slug,
          title: article.title,
          source: article.source,
          model,
          generatedAt: new Date().toISOString(),
          wordCount: articleText.split(/\s+/).filter(Boolean).length,
          summaryMarkdown
        };
      }

      const message = payload?.error?.metadata?.raw || payload?.error?.message || response.statusText;
      lastError = new Error(message);
      const shouldRetry = RETRYABLE_STATUS_CODES.has(response.status);

      if (!shouldRetry || attempt === 6) {
        if (!shouldRetry) {
          throw lastError;
        }
        break;
      }

      const delayMs = Math.min(4000 * 2 ** (attempt - 1), 30000);
      console.warn(`Retrying ${article.slug} with ${model} in ${Math.round(delayMs / 1000)}s (${message})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (model !== MODELS_TO_TRY[MODELS_TO_TRY.length - 1]) {
      console.warn(`Falling back from ${model} to ${MODELS_TO_TRY[MODELS_TO_TRY.indexOf(model) + 1]} for ${article.slug}`);
    }
  }

  throw lastError || new Error('Failed to summarize article.');
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const staticArticles = await loadStaticArticles();
  const dbArticles = await loadDbArticles();
  let articles = mergeArticles(staticArticles, dbArticles);

  if (onlySlug) {
    articles = articles.filter((article) => article.slug === onlySlug);
    if (!articles.length) {
      throw new Error(`No article matched slug "${onlySlug}".`);
    }
  }

  for (const article of articles) {
    const outputPath = path.join(OUTPUT_DIR, `${article.slug}.json`);
    if (!force && (await pathExists(outputPath))) {
      console.log(`Skipped ${article.slug}`);
      continue;
    }

    console.log(`Summarizing ${article.slug}...`);
    const summary = await summarizeArticle(article);
    await writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const summaryFiles = (await readdir(OUTPUT_DIR))
    .filter((fileName) => fileName.endsWith('.json') && fileName !== 'index.json');
  const generated = [];

  for (const fileName of summaryFiles) {
    const payload = JSON.parse(await readFile(path.join(OUTPUT_DIR, fileName), 'utf8'));
    generated.push({
      slug: payload.slug,
      title: payload.title,
      generatedAt: payload.generatedAt,
      model: payload.model
    });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    model: MODELS_TO_TRY[0],
    fallbackModels: MODELS_TO_TRY.slice(1),
    count: generated.length,
    summaries: generated.sort((a, b) => a.slug.localeCompare(b.slug))
  };

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${generated.length} summary records to ${path.relative(ROOT, OUTPUT_DIR)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
