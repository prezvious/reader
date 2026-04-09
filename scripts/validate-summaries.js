const fs = require('fs/promises');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest.json');
const summariesDir = path.join(root, 'data', 'summaries');
const indexPath = path.join(summariesDir, 'index.json');
const privateConfigPath = path.join(root, 'js', 'private-config.local.json');
const shouldPrune = process.argv.includes('--prune');

async function loadPrivateConfig() {
  const source = await fs.readFile(privateConfigPath, 'utf8');
  const parsed = JSON.parse(source);
  if (!parsed || !parsed.url || !parsed.anonKey) {
    throw new Error('Unable to read a valid private local config from js/private-config.local.json');
  }
  return { url: parsed.url, anonKey: parsed.anonKey };
}

async function fetchPublishedSlugs() {
  const { url, anonKey } = await loadPrivateConfig();
  const response = await fetch(url + '/rest/v1/articles?select=slug', {
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey
    }
  });

  if (!response.ok) {
    throw new Error('Connected summary validation failed: ' + response.status + ' ' + response.statusText);
  }

  const rows = await response.json();
  return new Set((rows || []).map((row) => row.slug).filter(Boolean));
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const summaryIndex = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  const staticSlugs = new Set((manifest.articles || []).map((article) => article.slug).filter(Boolean));
  const dbSlugs = await fetchPublishedSlugs();
  const knownSlugs = new Set([...staticSlugs, ...dbSlugs]);

  const orphanSummaries = (summaryIndex.summaries || []).filter((entry) => !knownSlugs.has(entry.slug));
  const orphanFiles = [];

  for (const entry of orphanSummaries) {
    const summaryFile = path.join(summariesDir, entry.slug + '.json');
    try {
      await fs.access(summaryFile);
      orphanFiles.push(summaryFile);
    } catch (error) {
      /* Missing file is still reported through the index entry below. */
    }
  }

  console.log('Static manifest slugs:', staticSlugs.size);
  console.log('Published DB slugs:', dbSlugs.size);
  console.log('Indexed summaries:', (summaryIndex.summaries || []).length);
  console.log('Orphan summaries:', orphanSummaries.length);

  orphanSummaries.forEach((entry) => {
    console.log('- ' + entry.slug);
  });

  if (!shouldPrune || orphanSummaries.length === 0) {
    return;
  }

  for (const filePath of orphanFiles) {
    await fs.unlink(filePath);
  }

  const nextSummaries = (summaryIndex.summaries || []).filter((entry) => knownSlugs.has(entry.slug));
  const nextIndex = Object.assign({}, summaryIndex, {
    generatedAt: new Date().toISOString(),
    count: nextSummaries.length,
    summaries: nextSummaries
  });
  await fs.writeFile(indexPath, JSON.stringify(nextIndex, null, 2) + '\n', 'utf8');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
