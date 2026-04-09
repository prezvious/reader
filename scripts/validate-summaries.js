const fs = require('fs/promises');
const path = require('path');
const summaryService = require('../lib/summary-service');

const {
  loadRuntimeConfig,
  loadStaticArticles,
  loadDbArticles,
  mergeArticles,
  listSummaryRows,
  listBundledSummaries,
  writeBundledSummaryIndex
} = summaryService;

const root = path.resolve(__dirname, '..');
const shouldPrune = process.argv.includes('--prune');

async function removeBundledSummary(rootDir, slug) {
  const summaryPath = path.join(rootDir, 'data', 'summaries', slug + '.json');
  try {
    await fs.unlink(summaryPath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function printList(label, entries) {
  if (!entries.length) return;
  console.log(label + ':');
  entries.forEach(function (entry) {
    console.log('- ' + entry);
  });
}

async function main() {
  const runtimeConfig = await loadRuntimeConfig(root, process.env);
  const staticArticles = await loadStaticArticles(root, { includeHtml: false });
  let dbArticles = [];
  let summaryRows = [];

  try {
    dbArticles = await loadDbArticles(runtimeConfig.supabase, { includeHtml: false });
  } catch (error) {
    console.warn('Skipping connected articles during validation: ' + (error.message || error));
  }

  try {
    summaryRows = await listSummaryRows(runtimeConfig.supabase);
  } catch (error) {
    console.warn('Skipping remote summary cache validation: ' + (error.message || error));
  }

  const mergedArticles = mergeArticles(staticArticles, dbArticles);
  const knownSlugs = new Set(mergedArticles.map((article) => article.slug));
  const staticSlugs = new Set(staticArticles.map((article) => article.slug));
  const bundledSummaries = await listBundledSummaries(root);
  const bundledSlugs = new Set(bundledSummaries.map((summary) => summary.slug));
  const cacheSlugs = new Set(summaryRows.map((summary) => summary.slug));

  const missingCache = mergedArticles
    .filter((article) => !cacheSlugs.has(article.slug))
    .map((article) => article.slug)
    .sort();
  const missingBundled = staticArticles
    .filter((article) => !bundledSlugs.has(article.slug))
    .map((article) => article.slug)
    .sort();
  const orphanBundled = bundledSummaries
    .filter((summary) => !knownSlugs.has(summary.slug))
    .map((summary) => summary.slug)
    .sort();
  const orphanCache = summaryRows
    .filter((summary) => !knownSlugs.has(summary.slug))
    .map((summary) => summary.slug)
    .sort();

  console.log('Static manifest slugs:', staticSlugs.size);
  console.log('Published DB slugs:', dbArticles.length);
  console.log('Known article slugs:', knownSlugs.size);
  console.log('Remote cached summaries:', summaryRows.length);
  console.log('Bundled fallback summaries:', bundledSummaries.length);
  console.log('Missing remote cache coverage:', missingCache.length);
  console.log('Missing bundled fallback coverage:', missingBundled.length);
  console.log('Orphan remote cache rows:', orphanCache.length);
  console.log('Orphan bundled fallback files:', orphanBundled.length);

  printList('Missing remote cache coverage', missingCache);
  printList('Missing bundled fallback coverage', missingBundled);
  printList('Orphan remote cache rows', orphanCache);
  printList('Orphan bundled fallback files', orphanBundled);

  if (shouldPrune && orphanBundled.length) {
    for (const slug of orphanBundled) {
      await removeBundledSummary(root, slug);
    }

    const nextBundled = (await listBundledSummaries(root)).filter(function (summary) {
      return knownSlugs.has(summary.slug);
    });
    await writeBundledSummaryIndex(root, nextBundled, runtimeConfig.models);
    console.log('Pruned orphan bundled summary files.');
  }

  if (missingCache.length || missingBundled.length || orphanCache.length || orphanBundled.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
