'use strict';

const { marked } = require('marked');
const DOMPurify = require('isomorphic-dompurify');

// ---------------------------------------------------------------------------
// Custom spoiler extension: ||spoiler text|| → <span class="spoiler">…</span>
// ---------------------------------------------------------------------------
const spoilerExtension = {
  name: 'spoiler',
  level: 'inline',
  start(src) {
    return src.indexOf('||');
  },
  tokenizer(src) {
    const match = src.match(/^\|\|([^|]+?)\|\|/);
    if (match) {
      return {
        type: 'spoiler',
        raw: match[0],
        text: match[1],
      };
    }
  },
  renderer(token) {
    return `<span class="spoiler" role="button" tabindex="0" aria-label="Spoiler (click to reveal)">${token.text}</span>`;
  },
};

// ---------------------------------------------------------------------------
// Configure marked
// ---------------------------------------------------------------------------
marked.use({
  extensions: [spoilerExtension],
  breaks: true,       // Convert single newlines to <br>
  gfm: true,          // GitHub-flavored markdown
});

// ---------------------------------------------------------------------------
// DOMPurify config — allow only safe tags + spoiler spans
// ---------------------------------------------------------------------------
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3',
    'a', 'span',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'role', 'tabindex', 'aria-label'],
  ALLOW_DATA_ATTR: false,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Render markdown text to sanitized HTML.
 * Supports bold, italic, lists, blockquotes, code, and ||spoiler|| syntax.
 * Returns an empty string for falsy input.
 */
function renderMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(text);
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/**
 * Strip markdown to plain text (for excerpts / previews).
 * Removes all markdown formatting, spoiler syntax, and HTML tags.
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    // Remove spoiler syntax
    .replace(/\|\|(.+?)\|\|/g, '$1')
    // Remove markdown bold/italic
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.+?)_{1,3}/g, '$1')
    // Remove strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquote markers
    .replace(/^>\s?/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Collapse multiple newlines
    .replace(/\n{2,}/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { renderMarkdown, stripMarkdown };
