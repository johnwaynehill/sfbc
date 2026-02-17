'use strict';

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function generateSlug(title, author) {
  const parts = author ? `${title} ${author}` : title;
  return slugify(parts);
}

function bookPath(title, author) {
  return `/books/${slugify(author)}/${slugify(title)}`;
}

module.exports = { slugify, generateSlug, bookPath };
