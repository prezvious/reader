import summaryService from '../lib/summary-service.js';

const {
  loadRuntimeConfig,
  loadStaticArticles,
  loadDbArticles,
  mergeArticles,
  resolveSummaryForArticle,
  writeBundledSummary,
  listBundledSummaries,
  writeBundledSummaryIndex
} = summaryService;

const ROOT = process.cwd();
const force = process.argv.includes('--force');
const slugArgIndex = process.argv.indexOf('--slug');
const onlySlug = slugArgIndex !== -1 ? process.argv[slugArgIndex + 1] : '';
const modelsArgIndex = process.argv.indexOf('--models');
const modelsArg = modelsArgIndex !== -1 ? process.argv[modelsArgIndex + 1] : '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const runtimeConfig = await loadRuntimeConfig(ROOT, process.env);
  if (!runtimeConfig.openRouterApiKey) {
    throw new Error('Missing OPENROUTER_API_KEY. Set it in your shell before running this script.');
  }

  if (modelsArg) {
    runtimeConfig.models = String(modelsArg)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const staticArticles = await loadStaticArticles(ROOT, { includeHtml: true });
  let dbArticles = [];

  try {
    dbArticles = await loadDbArticles(runtimeConfig.supabase, { includeHtml: true });
  } catch (error) {
    console.warn('Skipping connected articles: ' + (error.message || error));
  }

  const articles = mergeArticles(staticArticles, dbArticles);
  const staticSlugSet = new Set(staticArticles.map((article) => article.slug));
  const filtered = onlySlug
    ? articles.filter((article) => article.slug === onlySlug)
    : articles;

  if (!filtered.length) {
    throw new Error('No article matched slug "' + onlySlug + '".');
  }

  for (const article of filtered) {
    console.log('Syncing summary for ' + article.slug + '...');
    const result = await resolveSummaryForArticle({
      rootDir: ROOT,
      config: runtimeConfig,
      article: article,
      logger: console,
      forceRegenerate: force,
      maxAttemptsPerModel: 6,
      retryDelayMs: 4000
    });

    if (staticSlugSet.has(article.slug)) {
      await writeBundledSummary(ROOT, result.summary);
    }

    console.log(
      'Ready ' +
        article.slug +
        ' (' +
        result.source +
        (result.stale ? ', stale fallback' : '') +
        ')'
    );

    if (result.source === 'generated') {
      await sleep(1200);
    }
  }

  const bundledSummaries = await listBundledSummaries(ROOT);
  await writeBundledSummaryIndex(ROOT, bundledSummaries, runtimeConfig.models);
  console.log('Wrote ' + bundledSummaries.length + ' bundled summary records to data/summaries');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
