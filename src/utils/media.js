/**
 * Centralized media resolver (Phase 3 — R2 migration).
 * Converts runtime media paths (wp-content, reading-assets, videos) to R2 public URLs.
 *
 * Media keys follow the pattern: cognition/{kind}/{identifier}
 * The R2 public base URL is configured via VITE_MEDIA_BASE_URL.
 */

const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE_URL || 'https://pub-b158c0b753f14ee386f9d3217c48d007.r2.dev';

// Consecutive dots in R2 object keys trip Cloudflare's path-traversal WAF rules
// and block uploads; keys are stored with dot runs collapsed (mirrored by the
// media manifest generator).
const sanitizeR2Key = (key) => key.replace(/\.{2,}/g, '.');

/**
 * Resolves a runtime media path to its R2 public URL.
 * Handles all production media path patterns:
 *   /wp-content/uploads/audio/X.mp3     → cognition/audio/listening/X.mp3
 *   /wp-content/uploads/YYYY/MM/X.png   → cognition/images/writing/X.png (or listening)
 *   /reading-assets/X.png               → cognition/images/reading/X.png
 *   /videos/Speaking/X.mp4              → cognition/video/Speaking/X.mp4
 */
export function resolveMediaUrl(path) {
  if (!path) return path;
  // Already an R2 URL or data URI — return as-is
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  // Strip leading slash for key construction
  const clean = path.replace(/^\//, '');

  // Listening audio: /wp-content/uploads/audio/X.mp3
  const audioMatch = clean.match(/^wp-content\/uploads\/audio\/(.+\.mp3)$/);
  if (audioMatch) return `${MEDIA_BASE}/cognition/audio/listening/${encodeURIComponent(audioMatch[1])}`;

  // Reading assets: /reading-assets/X.png
  const readingMatch = clean.match(/^reading-assets\/(.+)$/);
  if (readingMatch) return `${MEDIA_BASE}/cognition/images/reading/${readingMatch[1]}`;

  // Videos: /videos/Speaking/X.mp4 or /videos/Writing/X.mp4 etc.
  // Encode per path segment so the '/' separators stay literal.
  const videoMatch = clean.match(/^videos\/(.+\.mp4)$/);
  if (videoMatch) {
    const key = videoMatch[1].split('/').map(encodeURIComponent).join('/');
    return `${MEDIA_BASE}/cognition/video/${sanitizeR2Key(key)}`;
  }

  // Listening images: /wp-content/uploads/YYYY/MM/lis-testNNN.png
  // (prefix match only — bare 'test-1' would also swallow writing task images)
  if (clean.includes('lis-test')) {
    const base = clean.split('/').pop();
    return `${MEDIA_BASE}/cognition/images/listening/${encodeURIComponent(base)}`;
  }

  // Writing images: /wp-content/uploads/YYYY/MM/X.png
  const imgMatch = clean.match(/^wp-content\/uploads\/\d{4}\/\d{2}\/(.+\.(png|webp|jpg|jpeg))$/);
  if (imgMatch) return `${MEDIA_BASE}/cognition/images/writing/${encodeURIComponent(imgMatch[1])}`;

  // Fallback: treat as writing/reading image by basename
  const base = clean.split('/').pop();
  if (/\.(png|webp|jpg|jpeg|gif)$/i.test(base)) {
    return `${MEDIA_BASE}/cognition/images/writing/${encodeURIComponent(base)}`;
  }

  return `${MEDIA_BASE}/${clean}`;
}
