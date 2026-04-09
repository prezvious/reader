const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODELS = ['google/gemma-4-31b-it:free', 'openrouter/free'];
const DEFAULT_PROMPT_VERSION = 'reader-summary-v2';
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SUMMARY_DIR = path.join('data', 'summaries');
const SUMMARY_INDEX_PATH = path.join(SUMMARY_DIR, 'index.json');
const IMAGE_URL_RE = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?[^\s]*)?(#[^\s]*)?$/i;
const KNOWN_IMAGE_HOST_RE = /^https?:\/\/(images\.unsplash\.com|i\.imgur\.com|images\.pexels\.com|cdn\.pixabay\.com|res\.cloudinary\.com|live\.staticflickr\.com)\//i;

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details || null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function parseModelList(value) {
  const models = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return models.length ? models : DEFAULT_MODELS.slice();
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '-',
    mdash: '-',
    middot: '*',
    hellip: '...',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    copy: '(c)'
  };

  return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (full, entity) {
    if (entity.charAt(0) === '#') {
      const isHex = entity.charAt(1).toLowerCase() === 'x';
      const numeric = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : full;
    }

    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : full;
  });
}

function stripStandaloneImageParagraphs(html) {
  return String(html || '').replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, function (full, inner) {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\u200B/g, '').trim();
    if (!text) return full;
    if (IMAGE_URL_RE.test(text) || KNOWN_IMAGE_HOST_RE.test(text)) return '';
    return full;
  });
}

function htmlToPlainText(html) {
  const cleaned = stripStandaloneImageParagraphs(html);
  return decodeHtmlEntities(
    cleaned
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

function createContentHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function buildSummaryPrompt(text) {
  return (
    'Note: Add your text between % % signs for this prompt to work.\n' +
    '%\n' +
    text +
    '\n%\n\n' +
    'Act as a professional summarizer and careful analytical reader. Create an accurate, coherent, and sufficiently developed summary of the text enclosed in %% above, using only the information contained in that text.\n\n' +
    'Your goal is to produce a summary that is not too short, does not oversimplify, and remains fully consistent with the source. The summary must preserve the main ideas in a connected and logically organized way, so that the original argument, explanation, or narrative is not fragmented or diluted.\n\n' +
    'Guidelines:\n\n' +
    '[\n' +
    '- Rely strictly on the text provided in %% above. Do not add external information, assumptions, interpretations, or background knowledge.\n' +
    '- Preserve the original meaning, emphasis, and internal logic of the text.\n' +
    '- Ensure the summary is highly accurate and fully consistent with the source.\n' +
    '- Do not make the summary too brief. It should be condensed, but still long enough to retain the essential reasoning, development of ideas, and important supporting details.\n' +
    '- Keep the main ideas intact and connected. Do not reduce them to isolated fragments or disconnected points.\n' +
    '- Capture the central thesis, major arguments, key supporting points, important examples, and conclusions when they are relevant to understanding the text.\n' +
    '- If the source develops ideas in stages, reflects multiple sections, or builds an argument progressively, preserve that structure clearly in the summary.\n' +
    '- Maintain important nuance, distinctions, qualifications, limitations, and contrasts present in the original text.\n' +
    '- Avoid distortion through excessive compression.\n' +
    '- Avoid unnecessary repetition, filler, or minor details that do not materially support the main ideas.\n' +
    '- Do not introduce criticism, evaluation, or commentary unless the source itself does so.\n' +
    '- Use precise paraphrasing rather than copying long phrases from the original.\n\n' +
    'Output format:\n\n' +
    '# Comprehensive Summary\n\n' +
    '## Overview\n' +
    'Write one substantial paragraph that identifies the overall subject, purpose, and central idea of the text.\n\n' +
    '## Main Ideas and Development\n' +
    'Write one or more well-formed paragraphs that explain the main ideas in the order and relationship in which they are developed in the original text. Make sure the summary reads as a continuous and coherent account, not as disconnected observations.\n\n' +
    '## Key Supporting Details\n' +
    'Write one or more paragraphs covering the most important supporting explanations, examples, evidence, sub-arguments, or clarifications that are necessary to preserve the full meaning of the text.\n\n' +
    '## Conclusion\n' +
    'Write one final paragraph summarizing the overall takeaway, final conclusion, or closing implication of the text.\n\n' +
    'Quality standard:\n' +
    'The summary must be concise but not minimal. It should be detailed enough to preserve the integrity of the original text, while still being significantly shorter and easier to read than the source.\n' +
    ']'
  );
}

function createSummaryRecord(article, generated, fingerprint, promptVersion) {
  return {
    slug: article.slug,
    model: generated.model,
    generatedAt: new Date().toISOString(),
    summaryMarkdown: generated.summaryMarkdown,
    contentHash: fingerprint.contentHash,
    promptVersion: promptVersion,
    wordCount: fingerprint.wordCount
  };
}

function normalizeSummaryRecord(record) {
  if (!record) return null;
  return {
    slug: record.slug || '',
    model: record.model || '',
    generatedAt: record.generatedAt || record.generated_at || '',
    summaryMarkdown: record.summaryMarkdown || record.summary_markdown || '',
    contentHash: record.contentHash || record.content_hash || '',
    promptVersion: record.promptVersion || record.prompt_version || '',
    wordCount: Number(record.wordCount || record.word_count || 0)
  };
}

function toSummaryRow(summary) {
  return {
    slug: summary.slug,
    model: summary.model,
    generated_at: summary.generatedAt,
    summary_markdown: summary.summaryMarkdown,
    content_hash: summary.contentHash,
    prompt_version: summary.promptVersion,
    word_count: summary.wordCount || 0
  };
}

function applyFingerprint(summary, fingerprint, promptVersion) {
  if (!summary) return null;
  return Object.assign({}, summary, {
    contentHash: summary.contentHash || fingerprint.contentHash,
    promptVersion: summary.promptVersion || promptVersion,
    wordCount: summary.wordCount || fingerprint.wordCount
  });
}

function isFreshSummary(summary, fingerprint, promptVersion) {
  return Boolean(
    summary &&
    summary.summaryMarkdown &&
    summary.summaryMarkdown.trim() &&
    summary.contentHash === fingerprint.contentHash &&
    summary.promptVersion === promptVersion
  );
}

function isMissingSummaryTableError(error) {
  const message = String((error && error.message) || '').toLowerCase();
  const details = JSON.stringify(error && error.details ? error.details : '').toLowerCase();
  return message.indexOf('article_summaries') !== -1 && (message.indexOf('does not exist') !== -1 || message.indexOf('could not find the table') !== -1 || details.indexOf('article_summaries') !== -1);
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function fetchDeploymentAsset(assetBaseUrl, assetPath) {
  if (!assetBaseUrl) return null;

  const response = await fetch(new URL(assetPath.replace(/^\/+/, ''), assetBaseUrl).toString(), {
    cache: 'no-store'
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(response.status, 'Failed to fetch deployment asset ' + assetPath + '.');
  }

  return response.text();
}

async function loadRuntimeConfig(rootDir, env, options) {
  const assetBaseUrl = String((options && options.assetBaseUrl) || '').trim();
  const localConfig = await readJsonIfExists(path.join(rootDir, 'js', 'private-config.local.json'));
  let publicConfig = await readJsonIfExists(path.join(rootDir, 'js', 'config.json'));

  if (!publicConfig) {
    const deployedConfigText = await fetchDeploymentAsset(assetBaseUrl, '/js/config.json');
    if (deployedConfigText) {
      publicConfig = JSON.parse(deployedConfigText);
    }
  }

  const fileConfig = localConfig || publicConfig || {};

  return {
    openRouterApiKey: String((env && env.OPENROUTER_API_KEY) || '').trim(),
    models: parseModelList((env && (env.OPENROUTER_SUMMARY_MODELS || env.READER_SUMMARY_MODELS)) || ''),
    promptVersion: String((env && env.READER_SUMMARY_PROMPT_VERSION) || DEFAULT_PROMPT_VERSION).trim() || DEFAULT_PROMPT_VERSION,
    assetBaseUrl: assetBaseUrl,
    supabase: {
      url: String((env && (env.SUPABASE_URL || env.READER_SUPABASE_URL)) || fileConfig.url || '').trim(),
      anonKey: String((env && (env.SUPABASE_ANON_KEY || env.READER_SUPABASE_ANON_KEY)) || fileConfig.anonKey || '').trim(),
      serviceRoleKey: String((env && (env.SUPABASE_SERVICE_ROLE_KEY || env.READER_SUPABASE_SERVICE_ROLE_KEY)) || '').trim()
    }
  };
}

function getSupabaseReadHeaders(config) {
  if (!config || !config.url) return null;
  const token = config.serviceRoleKey || config.anonKey;
  if (!token) return null;
  return {
    apikey: token,
    Authorization: 'Bearer ' + token
  };
}

function getSupabaseWriteHeaders(config) {
  if (!config || !config.url || !config.serviceRoleKey) return null;
  return {
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message =
      (payload && payload.error && payload.error.message) ||
      (payload && payload.message) ||
      (payload && payload.details) ||
      response.statusText ||
      'Request failed.';
    throw new HttpError(response.status, message, payload);
  }

  return payload;
}

async function loadStaticManifest(rootDir, options) {
  const manifestText = await readTextIfExists(path.join(rootDir, 'manifest.json'));
  if (manifestText) {
    const manifest = JSON.parse(manifestText);
    return (manifest && manifest.articles) || [];
  }

  const fallbackText = await fetchDeploymentAsset(options && options.assetBaseUrl, '/manifest.json');
  const manifest = fallbackText ? JSON.parse(fallbackText) : null;
  return (manifest && manifest.articles) || [];
}

async function loadStaticArticleBySlug(rootDir, slug, options) {
  const articles = await loadStaticManifest(rootDir, options);
  const match = articles.find(function (article) {
    return article.slug === slug;
  });

  if (!match || !match.folder) return null;

  const articlePath = path.join(rootDir, match.folder, 'index.html');
  let html = await readTextIfExists(articlePath);

  if (html === null) {
    html = await fetchDeploymentAsset(options && options.assetBaseUrl, '/' + match.folder.replace(/^\/+/, '') + 'index.html');
  }

  if (html === null) return null;

  return {
    slug: match.slug,
    title: match.title,
    source: 'static',
    folder: match.folder,
    html: html,
    publishedAt: match.publishedAt || '',
    updatedAt: match.updatedAt || match.publishedAt || ''
  };
}

async function loadStaticArticles(rootDir, options) {
  const includeHtml = !options || options.includeHtml !== false;
  const articles = await loadStaticManifest(rootDir, options);

  return Promise.all(
    articles.map(async function (article) {
      const next = {
        slug: article.slug,
        title: article.title,
        source: 'static',
        folder: article.folder || '',
        publishedAt: article.publishedAt || '',
        updatedAt: article.updatedAt || article.publishedAt || ''
      };

      if (includeHtml && article.folder) {
        const filePath = path.join(rootDir, article.folder, 'index.html');
        const html = await readTextIfExists(filePath);
        next.html =
          html !== null
            ? html
            : (await fetchDeploymentAsset(options && options.assetBaseUrl, '/' + article.folder.replace(/^\/+/, '') + 'index.html')) || '';
      }

      return next;
    })
  );
}

async function loadDbArticleBySlug(config, slug) {
  const headers = getSupabaseReadHeaders(config);
  if (!headers) return null;

  const query = new URLSearchParams({
    select: 'slug,title,published_at,updated_at,content_html',
    slug: 'eq.' + slug,
    limit: '1'
  });

  const rows = await fetchJson(config.url + '/rest/v1/articles?' + query.toString(), {
    headers: headers
  });
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) return null;

  return {
    slug: row.slug,
    title: row.title,
    source: 'db',
    html: row.content_html || '',
    publishedAt: row.published_at || '',
    updatedAt: row.updated_at || row.published_at || ''
  };
}

async function loadDbArticles(config, options) {
  const headers = getSupabaseReadHeaders(config);
  if (!headers) return [];

  const includeHtml = !options || options.includeHtml !== false;
  const select = includeHtml
    ? 'slug,title,published_at,updated_at,content_html'
    : 'slug,title,published_at,updated_at';

  const rows = await fetchJson(
    config.url + '/rest/v1/articles?select=' + encodeURIComponent(select) + '&order=published_at.desc',
    { headers: headers }
  );

  return (rows || []).map(function (row) {
    return {
      slug: row.slug,
      title: row.title,
      source: 'db',
      html: includeHtml ? row.content_html || '' : '',
      publishedAt: row.published_at || '',
      updatedAt: row.updated_at || row.published_at || ''
    };
  });
}

function mergeArticles(staticArticles, dbArticles) {
  const merged = new Map();
  (staticArticles || []).forEach(function (article) {
    merged.set(article.slug, article);
  });
  (dbArticles || []).forEach(function (article) {
    merged.set(article.slug, article);
  });
  return Array.from(merged.values());
}

async function resolveArticleBySlug(rootDir, config, slug) {
  const dbArticle = await loadDbArticleBySlug(config, slug);
  if (dbArticle) return dbArticle;
  return loadStaticArticleBySlug(rootDir, slug, { assetBaseUrl: config && config.assetBaseUrl });
}

function buildFingerprint(article) {
  const articleText = htmlToPlainText(article && article.html ? article.html : '');
  return {
    articleText: articleText,
    contentHash: createContentHash(articleText),
    wordCount: countWords(articleText)
  };
}

async function readBundledSummary(rootDir, slug, options) {
  const localPayload = await readJsonIfExists(path.join(rootDir, SUMMARY_DIR, slug + '.json'));
  if (localPayload) {
    return normalizeSummaryRecord(localPayload);
  }

  const deployedPayload = await fetchDeploymentAsset(options && options.assetBaseUrl, '/' + SUMMARY_DIR + '/' + slug + '.json');
  return normalizeSummaryRecord(deployedPayload ? JSON.parse(deployedPayload) : null);
}

async function listBundledSummaries(rootDir) {
  try {
    const names = await fs.readdir(path.join(rootDir, SUMMARY_DIR));
    const summaries = [];

    for (const name of names) {
      if (!name.endsWith('.json') || name === 'index.json') continue;
      const payload = await readJsonIfExists(path.join(rootDir, SUMMARY_DIR, name));
      const summary = normalizeSummaryRecord(payload);
      if (summary && summary.slug) {
        summaries.push(summary);
      }
    }

    return summaries.sort(function (left, right) {
      return left.slug.localeCompare(right.slug);
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeBundledSummary(rootDir, summary) {
  const normalized = normalizeSummaryRecord(summary);
  await writeJsonFile(path.join(rootDir, SUMMARY_DIR, normalized.slug + '.json'), normalized);
}

async function writeBundledSummaryIndex(rootDir, summaries, models) {
  const list = (summaries || [])
    .map(normalizeSummaryRecord)
    .filter(Boolean)
    .sort(function (left, right) {
      return left.slug.localeCompare(right.slug);
    })
    .map(function (summary) {
      return {
        slug: summary.slug,
        generatedAt: summary.generatedAt,
        model: summary.model
      };
    });

  await writeJsonFile(path.join(rootDir, SUMMARY_INDEX_PATH), {
    generatedAt: new Date().toISOString(),
    model: (models || [])[0] || DEFAULT_MODELS[0],
    fallbackModels: (models || DEFAULT_MODELS).slice(1),
    count: list.length,
    summaries: list
  });
}

async function loadSummaryRow(config, slug) {
  const headers = getSupabaseReadHeaders(config);
  if (!headers) return null;

  const query = new URLSearchParams({
    select: 'slug,model,generated_at,summary_markdown,content_hash,prompt_version,word_count',
    slug: 'eq.' + slug,
    limit: '1'
  });

  const rows = await fetchJson(config.url + '/rest/v1/article_summaries?' + query.toString(), {
    headers: headers
  });

  return normalizeSummaryRecord(Array.isArray(rows) ? rows[0] : null);
}

async function listSummaryRows(config) {
  const headers = getSupabaseReadHeaders(config);
  if (!headers) return [];

  const rows = await fetchJson(
    config.url + '/rest/v1/article_summaries?select=slug,model,generated_at,summary_markdown,content_hash,prompt_version,word_count',
    { headers: headers }
  );

  return (rows || []).map(normalizeSummaryRecord).filter(Boolean);
}

async function upsertSummaryRow(config, summary) {
  const headers = getSupabaseWriteHeaders(config);
  if (!headers) return null;

  const rows = await fetchJson(config.url + '/rest/v1/article_summaries?on_conflict=slug', {
    method: 'POST',
    headers: Object.assign({}, headers, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify(toSummaryRow(summary))
  });

  return normalizeSummaryRecord(Array.isArray(rows) ? rows[0] : rows);
}

async function generateSummaryFromText(options) {
  const apiKey = String((options && options.apiKey) || '').trim();
  if (!apiKey) {
    throw new HttpError(503, 'OPENROUTER_API_KEY is not configured.');
  }

  const models = parseModelList((options && options.models) || '');
  const maxAttemptsPerModel = Math.max(1, Number((options && options.maxAttemptsPerModel) || 1));
  const retryDelayMs = Math.max(0, Number((options && options.retryDelayMs) || 0));
  const articleText = String((options && options.articleText) || '').trim();
  const logger = (options && options.logger) || console;
  let lastError = null;

  if (!articleText) {
    throw new HttpError(422, 'Article text was empty after preprocessing.');
  }

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      let response;
      let payload = null;

      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://reader.local',
            'X-Title': 'Reader summary generator'
          },
          body: JSON.stringify({
            model: model,
            temperature: 0.2,
            messages: [
              {
                role: 'user',
                content: buildSummaryPrompt(articleText)
              }
            ]
          })
        });

        const raw = await response.text();
        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch (error) {
            payload = raw;
          }
        }

        if (response.ok) {
          const summaryMarkdown = payload && payload.choices && payload.choices[0] && payload.choices[0].message
            ? String(payload.choices[0].message.content || '').trim()
            : '';

          if (!summaryMarkdown) {
            throw new HttpError(502, 'OpenRouter returned an empty summary.', payload);
          }

          return {
            model: model,
            summaryMarkdown: summaryMarkdown
          };
        }

        const message =
          (payload && payload.error && (payload.error.metadata && payload.error.metadata.raw || payload.error.message)) ||
          (payload && payload.message) ||
          response.statusText ||
          'OpenRouter request failed.';

        lastError = new HttpError(response.status, message, payload);

        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttemptsPerModel) {
          break;
        }

        if (retryDelayMs > 0) {
          const delay = Math.min(retryDelayMs * Math.pow(2, attempt - 1), 30000);
          logger.warn('Retrying summary generation for model ' + model + ' in ' + Math.round(delay / 1000) + 's (' + message + ')');
          await sleep(delay);
        }
      } catch (error) {
        lastError = error instanceof HttpError ? error : new HttpError(502, error.message || 'OpenRouter request failed.', error);
        if (attempt === maxAttemptsPerModel) break;
        if (retryDelayMs > 0) {
          const delay = Math.min(retryDelayMs * Math.pow(2, attempt - 1), 30000);
          logger.warn('Retrying summary generation for model ' + model + ' in ' + Math.round(delay / 1000) + 's (' + lastError.message + ')');
          await sleep(delay);
        }
      }
    }
  }

  throw lastError || new HttpError(502, 'Failed to summarize article.');
}

async function resolveSummaryForArticle(options) {
  const rootDir = options.rootDir;
  const config = options.config || {};
  const article = options.article;
  const logger = options.logger || console;
  const allowGeneration = options.allowGeneration !== false;
  const forceRegenerate = options.forceRegenerate === true;
  const maxAttemptsPerModel = options.maxAttemptsPerModel || 1;
  const retryDelayMs = options.retryDelayMs || 0;

  if (!article || !article.slug) {
    throw new HttpError(404, 'Article not found.');
  }

  const promptVersion = config.promptVersion || DEFAULT_PROMPT_VERSION;
  const fingerprint = buildFingerprint(article);

  if (!fingerprint.articleText) {
    throw new HttpError(422, 'Article content was empty after preprocessing.');
  }

  let cachedSummary = null;
  try {
    cachedSummary = await loadSummaryRow(config.supabase, article.slug);
  } catch (error) {
    if (!isMissingSummaryTableError(error)) {
      logger.warn('Summary cache read failed for ' + article.slug + ': ' + error.message);
    }
  }

  if (!forceRegenerate && isFreshSummary(cachedSummary, fingerprint, promptVersion)) {
    return {
      article: article,
      summary: applyFingerprint(cachedSummary, fingerprint, promptVersion),
      source: 'cache',
      stale: false
    };
  }

  const bundledSummary = await readBundledSummary(rootDir, article.slug, {
    assetBaseUrl: config && config.assetBaseUrl
  });
  if (!forceRegenerate && isFreshSummary(bundledSummary, fingerprint, promptVersion)) {
    const seeded = applyFingerprint(bundledSummary, fingerprint, promptVersion);
    try {
      await upsertSummaryRow(config.supabase, seeded);
    } catch (error) {
      if (!isMissingSummaryTableError(error)) {
        logger.warn('Summary cache seed failed for ' + article.slug + ': ' + error.message);
      }
    }

    return {
      article: article,
      summary: seeded,
      source: 'bundled',
      stale: false
    };
  }

  if (allowGeneration && config.openRouterApiKey) {
    const generated = await generateSummaryFromText({
      apiKey: config.openRouterApiKey,
      models: config.models,
      articleText: fingerprint.articleText,
      maxAttemptsPerModel: maxAttemptsPerModel,
      retryDelayMs: retryDelayMs,
      logger: logger
    });
    const summary = createSummaryRecord(article, generated, fingerprint, promptVersion);

    try {
      await upsertSummaryRow(config.supabase, summary);
    } catch (error) {
      if (!isMissingSummaryTableError(error)) {
        logger.warn('Summary cache write failed for ' + article.slug + ': ' + error.message);
      }
    }

    return {
      article: article,
      summary: summary,
      source: 'generated',
      stale: false
    };
  }

  if (cachedSummary && cachedSummary.summaryMarkdown && cachedSummary.summaryMarkdown.trim()) {
    return {
      article: article,
      summary: applyFingerprint(cachedSummary, fingerprint, promptVersion),
      source: 'cache',
      stale: true
    };
  }

  if (bundledSummary && bundledSummary.summaryMarkdown && bundledSummary.summaryMarkdown.trim()) {
    return {
      article: article,
      summary: applyFingerprint(bundledSummary, fingerprint, promptVersion),
      source: 'bundled',
      stale: true
    };
  }

  throw new HttpError(503, 'Summary generation is unavailable for this article.');
}

async function resolveSummaryForSlug(options) {
  const article = await resolveArticleBySlug(options.rootDir, options.config && options.config.supabase, options.slug);
  if (!article) {
    throw new HttpError(404, 'Article not found.');
  }

  return resolveSummaryForArticle(
    Object.assign({}, options, {
      article: article
    })
  );
}

function toClientSummaryPayload(article, summary) {
  const normalized = normalizeSummaryRecord(summary) || {
    model: '',
    generatedAt: '',
    summaryMarkdown: '',
    wordCount: 0
  };
  return {
    slug: article.slug,
    title: article.title,
    model: normalized.model,
    generatedAt: normalized.generatedAt,
    summaryMarkdown: normalized.summaryMarkdown,
    wordCount: normalized.wordCount
  };
}

module.exports = {
  DEFAULT_MODELS,
  DEFAULT_PROMPT_VERSION,
  HttpError,
  SUMMARY_DIR,
  SUMMARY_INDEX_PATH,
  applyFingerprint,
  buildFingerprint,
  buildSummaryPrompt,
  countWords,
  createContentHash,
  createSummaryRecord,
  fetchJson,
  generateSummaryFromText,
  htmlToPlainText,
  isFreshSummary,
  listBundledSummaries,
  listSummaryRows,
  loadDbArticleBySlug,
  loadDbArticles,
  loadRuntimeConfig,
  loadStaticArticleBySlug,
  loadStaticArticles,
  loadSummaryRow,
  mergeArticles,
  normalizeSummaryRecord,
  readBundledSummary,
  resolveArticleBySlug,
  resolveSummaryForArticle,
  resolveSummaryForSlug,
  toClientSummaryPayload,
  upsertSummaryRow,
  writeBundledSummary,
  writeBundledSummaryIndex
};
