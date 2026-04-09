const path = require('path');
const { createArticleSummaryHandler } = require('../lib/article-summary-handler');

module.exports = createArticleSummaryHandler({
  rootDir: path.resolve(__dirname, '..')
});
