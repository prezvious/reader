const { HttpError, loadRuntimeConfig, resolveSummaryForSlug, toClientSummaryPayload } = require('./summary-service');

function sendJson(res, status, payload, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  Object.keys(headers || {}).forEach(function (key) {
    res.setHeader(key, headers[key]);
  });

  res.end(JSON.stringify(payload));
}

function getRequestMethod(req) {
  return String((req && req.method) || 'GET').toUpperCase();
}

function getRequestUrl(req) {
  return new URL(req.url || '/', 'http://127.0.0.1');
}

function createArticleSummaryHandler(options) {
  const rootDir = (options && options.rootDir) || process.cwd();
  const logger = (options && options.logger) || console;

  return async function handleArticleSummary(req, res) {
    const method = getRequestMethod(req);
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
      return;
    }

    const requestUrl = getRequestUrl(req);
    const slug = String(requestUrl.searchParams.get('slug') || '').trim();

    if (!slug) {
      sendJson(res, 400, { error: 'Missing required "slug" query parameter.' });
      return;
    }

    try {
      const config = await loadRuntimeConfig(rootDir, process.env);
      const result = await resolveSummaryForSlug({
        rootDir: rootDir,
        config: config,
        slug: slug,
        logger: logger,
        maxAttemptsPerModel: 1,
        retryDelayMs: 0
      });

      sendJson(
        res,
        200,
        toClientSummaryPayload(result.article, result.summary),
        {
          'X-Reader-Summary-Source': result.source,
          'X-Reader-Summary-Stale': result.stale ? '1' : '0'
        }
      );
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      logger.error('Article summary request failed:', {
        slug: slug,
        status: status,
        message: error && error.message ? error.message : String(error)
      });

      sendJson(res, status, {
        error:
          status === 404
            ? 'Article not found.'
            : error && error.message
              ? error.message
              : 'Failed to load article summary.'
      });
    }
  };
}

module.exports = {
  createArticleSummaryHandler
};
