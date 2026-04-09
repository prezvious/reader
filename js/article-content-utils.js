(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ArticleContentUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ALLOWED_FONT_SIZES = ['12', '14', '16', '18', '19', '20', '24', '28', '32'];
  var ALLOWED_CLASS_RE = /^(article-font-size--(?:12|14|16|18|19|20|24|28|32)|article-indent-1|article-image|article-image__inline)$/;
  var BLOCK_TAGS = {
    P: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    BLOCKQUOTE: true,
    UL: true,
    OL: true,
    LI: true,
    FIGURE: true,
    FIGCAPTION: true,
    PRE: true,
    HR: true
  };
  var DROP_WITH_CONTENT = {
    SCRIPT: true,
    STYLE: true,
    IFRAME: true,
    OBJECT: true,
    EMBED: true,
    FORM: true,
    LINK: true,
    META: true,
    BASE: true
  };
  var UNWRAP_TAGS = {
    BDI: true,
    BDO: true,
    SMALL: true,
    BIG: true,
    MARK: true,
    S: true,
    DEL: true,
    INS: true,
    SUB: true,
    SUP: true,
    FONT: true
  };

  function getDocument(options) {
    if (options && options.document) return options.document;
    if (typeof document !== 'undefined') return document;
    throw new Error('A DOM-capable document is required.');
  }

  function createContainer(doc, html) {
    var container = doc.createElement('div');
    container.innerHTML = html || '';
    return container;
  }

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  function replaceTag(doc, element, tagName) {
    var replacement = doc.createElement(tagName);
    toArray(element.attributes).forEach(function (attr) {
      replacement.setAttribute(attr.name, attr.value);
    });
    while (element.firstChild) {
      replacement.appendChild(element.firstChild);
    }
    element.parentNode.replaceChild(replacement, element);
    return replacement;
  }

  function unwrapElement(element) {
    if (!element || !element.parentNode) return;
    while (element.firstChild) {
      element.parentNode.insertBefore(element.firstChild, element);
    }
    element.parentNode.removeChild(element);
  }

  function removeNode(node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function isWhitespaceText(node) {
    return node && node.nodeType === 3 && !/\S/.test(node.nodeValue || '');
  }

  function hasBlockDescendant(element) {
    var children = toArray(element.childNodes);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 1) {
        if (BLOCK_TAGS[child.tagName]) return true;
        if (hasBlockDescendant(child)) return true;
      }
    }
    return false;
  }

  function stripDisallowedClasses(element) {
    if (!element.className || typeof element.className !== 'string') return;
    var kept = element.className.split(/\s+/).filter(function (name) {
      return ALLOWED_CLASS_RE.test(name);
    });
    if (kept.length) {
      element.className = kept.join(' ');
    } else {
      element.removeAttribute('class');
    }
  }

  function convertStyleToClasses(element) {
    var style = element.getAttribute('style') || '';
    if (!style) return;

    var styleMap = {};
    style.split(';').forEach(function (entry) {
      var parts = entry.split(':');
      if (parts.length < 2) return;
      var key = parts.shift().trim().toLowerCase();
      var value = parts.join(':').trim();
      if (!key) return;
      styleMap[key] = value;
    });

    var fontSize = styleMap['font-size'];
    if (fontSize) {
      var sizeMatch = fontSize.match(/(\d+)(px)?/i);
      if (sizeMatch && ALLOWED_FONT_SIZES.indexOf(sizeMatch[1]) !== -1) {
        element.classList.add('article-font-size--' + sizeMatch[1]);
      }
    }

    if (styleMap['padding-left'] || styleMap['text-indent']) {
      element.classList.add('article-indent-1');
    }

    element.removeAttribute('style');
  }

  function normalizeElement(node, doc) {
    if (node.nodeType !== 1) return;

    if (DROP_WITH_CONTENT[node.tagName]) {
      removeNode(node);
      return;
    }

    if (node.tagName === 'B') {
      node = replaceTag(doc, node, 'strong');
    } else if (node.tagName === 'I') {
      node = replaceTag(doc, node, 'em');
    }

    convertStyleToClasses(node);

    if (node.tagName === 'DIV') {
      if (node.parentNode && node.parentNode.id === 'editor-content') {
        if (hasBlockDescendant(node)) {
          unwrapElement(node);
          return;
        }
        node = replaceTag(doc, node, 'p');
      } else if (!hasBlockDescendant(node)) {
        node = replaceTag(doc, node, 'p');
      } else {
        unwrapElement(node);
        return;
      }
    } else if (UNWRAP_TAGS[node.tagName]) {
      unwrapElement(node);
      return;
    }

    if (node.tagName === 'IMG') {
      if (!node.getAttribute('alt')) node.setAttribute('alt', '');
      node.setAttribute('loading', 'lazy');
    }
  }

  function removeEmptyNodes(rootNode) {
    var walker = rootNode.ownerDocument.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
    var toRemove = [];
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (node.tagName === 'HR' || node.tagName === 'IMG' || node.tagName === 'BR') continue;
      var text = (node.textContent || '').replace(/\u200B/g, '').trim();
      if (!text && node.children.length === 0) {
        if (node.tagName !== 'A' || !node.getAttribute('href')) {
          toRemove.push(node);
        }
      }
    }
    for (var i = 0; i < toRemove.length; i++) {
      removeNode(toRemove[i]);
    }
  }

  function removeDisallowedAttributes(element) {
    var allowedAttrsByTag = {
      A: { href: true, rel: true, target: true },
      IMG: { src: true, alt: true, loading: true },
      OL: { type: true, start: true },
      SPAN: { class: true },
      P: { class: true },
      H1: { class: true },
      H2: { class: true },
      H3: { class: true },
      H4: { class: true },
      H5: { class: true },
      H6: { class: true },
      BLOCKQUOTE: { class: true },
      LI: { class: true },
      FIGURE: { class: true }
    };
    var allowed = allowedAttrsByTag[element.tagName] || {};

    toArray(element.attributes).forEach(function (attr) {
      var name = attr.name.toLowerCase();
      if (name.indexOf('on') === 0) {
        element.removeAttribute(attr.name);
        return;
      }
      if (name === 'class') {
        stripDisallowedClasses(element);
        return;
      }
      if (!allowed[name]) {
        element.removeAttribute(attr.name);
      }
    });

    if (element.tagName === 'A') {
      var href = element.getAttribute('href');
      if (!isSafeUri(href, false)) {
        unwrapElement(element);
        return;
      }
      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer');
      } else {
        element.removeAttribute('target');
        element.removeAttribute('rel');
      }
    }

    if (element.tagName === 'IMG') {
      var src = element.getAttribute('src');
      if (!isSafeUri(src, true)) {
        removeNode(element);
      }
    }

    if (element.tagName === 'OL') {
      var type = element.getAttribute('type');
      if (type && !/^(1|a|A|i|I)$/.test(type)) {
        element.removeAttribute('type');
      }
    }
  }

  function isSafeUri(uri, allowDataImage) {
    if (!uri) return false;
    var value = String(uri).trim().toLowerCase();
    if (!value) return false;
    if (value.indexOf('javascript:') === 0 || value.indexOf('vbscript:') === 0) return false;
    if (value.indexOf('data:') === 0) {
      return allowDataImage && value.indexOf('data:image/') === 0;
    }
    if (value.indexOf('http://') === 0 || value.indexOf('https://') === 0) return true;
    if (value.indexOf('/') === 0 || value.indexOf('./') === 0 || value.indexOf('../') === 0) return true;
    if (value.indexOf('#') === 0 || value.indexOf('mailto:') === 0 || value.indexOf('tel:') === 0) return true;
    return false;
  }

  function sanitizeHtml(html, options) {
    if (!html || typeof html !== 'string') return '';
    var doc = getDocument(options);
    var container = createContainer(doc, html);
    var allowedTags = {
      P: true,
      BR: true,
      H1: true,
      H2: true,
      H3: true,
      H4: true,
      H5: true,
      H6: true,
      STRONG: true,
      EM: true,
      U: true,
      A: true,
      UL: true,
      OL: true,
      LI: true,
      BLOCKQUOTE: true,
      HR: true,
      IMG: true,
      FIGURE: true,
      FIGCAPTION: true,
      CODE: true,
      PRE: true,
      SPAN: true
    };

    var walker = doc.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    var elements = [];
    while (walker.nextNode()) {
      elements.push(walker.currentNode);
    }

    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (!element.parentNode) continue;
      if (!allowedTags[element.tagName]) {
        if (DROP_WITH_CONTENT[element.tagName]) {
          removeNode(element);
        } else {
          unwrapElement(element);
        }
        continue;
      }
      removeDisallowedAttributes(element);
    }

    removeEmptyNodes(container);
    return container.innerHTML;
  }

  function normalizeArticleHtml(editorHtml, options) {
    if (!editorHtml || typeof editorHtml !== 'string') return '';
    var doc = getDocument(options);
    var container = createContainer(doc, editorHtml);
    var walker = doc.createTreeWalker(container, NodeFilter.SHOW_ALL);
    var nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.parentNode) continue;
      if (node.nodeType === 8) {
        removeNode(node);
        continue;
      }
      if (node.nodeType === 1) {
        normalizeElement(node, doc);
      }
    }

    removeEmptyNodes(container);
    return container.innerHTML;
  }

  function splitSelectors(list) {
    var parts = [];
    var depth = 0;
    var quote = '';
    var start = 0;
    for (var i = 0; i < list.length; i++) {
      var char = list.charAt(i);
      if (quote) {
        if (char === quote && list.charAt(i - 1) !== '\\') quote = '';
        continue;
      }
      if (char === '"' || char === '\'') {
        quote = char;
      } else if (char === '(' || char === '[') {
        depth++;
      } else if (char === ')' || char === ']') {
        depth = Math.max(0, depth - 1);
      } else if (char === ',' && depth === 0) {
        parts.push(list.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(list.slice(start));
    return parts;
  }

  function scopeSelector(selector, scope) {
    var trimmed = selector.trim();
    if (!trimmed) return '';
    if (/^(html|body|:root)$/i.test(trimmed)) return scope;
    if (trimmed.indexOf(scope) === 0) return trimmed;
    return scope + ' ' + trimmed;
  }

  function scopeRulePrelude(prelude, scopes) {
    var selectors = splitSelectors(prelude);
    var scoped = [];
    for (var i = 0; i < scopes.length; i++) {
      for (var j = 0; j < selectors.length; j++) {
        var scopedSelector = scopeSelector(selectors[j], scopes[i]);
        if (scopedSelector) scoped.push(scopedSelector);
      }
    }
    return scoped.join(', ');
  }

  function scopeArticleCss(css, scopes) {
    if (!css || typeof css !== 'string') return '';
    var scopeList = Array.isArray(scopes) ? scopes.filter(Boolean) : [scopes].filter(Boolean);
    if (!scopeList.length) return css;

    var out = '';
    var i = 0;
    var len = css.length;
    var depth = 0;
    var keyframesDepth = -1;

    while (i < len) {
      var ch = css.charAt(i);
      if (ch === '/' && css.charAt(i + 1) === '*') {
        var end = css.indexOf('*/', i + 2);
        if (end === -1) {
          out += css.slice(i);
          break;
        }
        out += css.slice(i, end + 2);
        i = end + 2;
        continue;
      }

      if (ch === '}') {
        depth--;
        if (depth <= keyframesDepth) keyframesDepth = -1;
        out += ch;
        i++;
        continue;
      }

      var start = i;
      while (i < len) {
        var current = css.charAt(i);
        if (current === '{' || current === '}') break;
        if (current === '/' && css.charAt(i + 1) === '*') {
          var commentEnd = css.indexOf('*/', i + 2);
          i = commentEnd === -1 ? len : commentEnd + 2;
          continue;
        }
        i++;
      }

      var prelude = css.slice(start, i);
      var trimmed = prelude.trim();

      if (i >= len || css.charAt(i) === '}') {
        out += prelude;
        continue;
      }

      if (trimmed.charAt(0) === '@') {
        if (/^@(-\w+-)?keyframes\b/i.test(trimmed)) {
          keyframesDepth = depth;
        }
        out += prelude + '{';
        depth++;
        i++;
        continue;
      }

      if (keyframesDepth !== -1 && depth > keyframesDepth) {
        out += prelude + '{';
        depth++;
        i++;
        continue;
      }

      out += scopeRulePrelude(prelude, scopeList) + ' {';
      depth++;
      i++;
    }

    return out;
  }

  return {
    ALLOWED_FONT_SIZES: ALLOWED_FONT_SIZES.slice(),
    normalizeArticleHtml: normalizeArticleHtml,
    sanitizeHtml: sanitizeHtml,
    scopeArticleCss: scopeArticleCss,
    splitSelectors: splitSelectors
  };
});
