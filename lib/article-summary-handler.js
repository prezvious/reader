const {
  HttpError,
  loadRuntimeConfig,
  resolveArticleBySlug,
  resolveSummaryForArticle,
  toClientSummaryPayload
} = require('./summary-service');

const UNAVAILABLE_SUMMARY_MESSAGE = 'Summary generation is unavailable for this article.';

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

function getRequestOrigin(req) {
  const headers = (req && req.headers) || {};
  const protoHeader = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'];
  const hostHeader = headers['x-forwarded-host'] || headers['X-Forwarded-Host'] || headers.host || headers.Host;
  const protocol = String(Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'http').split(',')[0].trim() || 'http';
  const host = String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || '127.0.0.1').split(',')[0].trim() || '127.0.0.1';
  return protocol + '://' + host;
}

function getRequestUrl(req) {
  return new URL(req.url || '/', getRequestOrigin(req));
}

function isUnavailableSummaryError(error) {
  return error instanceof HttpError && error.status === 503 && error.message === UNAVAILABLE_SUMMARY_MESSAGE;
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
      const config = await loadRuntimeConfig(rootDir, process.env, {
        assetBaseUrl: requestUrl.origin
      });
      const article = await resolveArticleBySlug(rootDir, config.supabase, slug);
      if (!article) {
        sendJson(res, 404, { error: 'Article not found.' });
        return;
      }

      let result;
      try {
        result = await resolveSummaryForArticle({
          rootDir: rootDir,
          config: config,
          article: article,
          logger: logger,
          maxAttemptsPerModel: 1,
          retryDelayMs: 0
        });
      } catch (error) {
        if (isUnavailableSummaryError(error)) {
          sendJson(
            res,
            200,
            toClientSummaryPayload(article, null),
            {
              'X-Reader-Summary-Source': 'unavailable',
              'X-Reader-Summary-Stale': '0',
              'X-Reader-Summary-Available': '0'
            }
          );
          return;
        }

        throw error;
      }

      sendJson(
        res,
        200,
        toClientSummaryPayload(result.article, result.summary),
        {
          'X-Reader-Summary-Source': result.source,
          'X-Reader-Summary-Stale': result.stale ? '1' : '0',
          'X-Reader-Summary-Available': '1'
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
