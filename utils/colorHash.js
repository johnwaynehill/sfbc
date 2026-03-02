'use strict';

/**
 * Generate a deterministic hue (0–360) from a string.
 * Used for book placeholder cover backgrounds.
 *
 * Uses djb2 hash for better distribution than naive charCodeAt sum.
 */
function colorHash(str) {
  if (!str) return 0;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return Math.abs(hash) % 360;
}

module.exports = { colorHash };
