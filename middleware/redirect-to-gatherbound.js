'use strict';

/**
 * The club moved to GatherBound (gatherbound.club) in October 2026. With
 * REDIRECT_TO set (e.g. https://gatherbound.club/c/sf-scifi-fantasy), every
 * page of this app sends visitors to the same page there, so bookmarks, shared
 * links and old Meetup posts keep working. The data on the Fly volume is left
 * as it is, as a cold archive. Unset REDIRECT_TO to bring the old app back.
 *
 *   /history                       → <base>/history
 *   /books/le-guin/the-dispossessed → <base>/books/le-guin/the-dispossessed
 *   /vote/september-2026           → <base>/vote/2026-09   (new month format)
 *   /login, /auth/*                → https://gatherbound.club/sign-in
 *   anything else                  → <base> (the club home)
 *
 * Two paths are not redirected: /health, so Fly still sees the machine as
 * healthy, and /sw.js, which is answered with a service worker that removes
 * itself and its caches. A browser refuses a redirected service-worker script,
 * so without this an installed copy of the old app would keep serving its
 * cached pages.
 */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "september-2026" → "2026-09"; anything else is passed through unchanged. */
function newMonth(slug) {
  const m = /^([a-z]+)-(\d{4})$/.exec(slug || '');
  const i = m ? MONTHS.indexOf(m[1]) : -1;
  return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : slug;
}

/** Where an old path lives now, relative to the club's base URL (or absolute). */
function newPathFor(oldPath) {
  const p = (oldPath || '/').replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const [first, second, third] = parts;
  const enc = (s) => encodeURIComponent(s);

  if (p === '/' || p === '/landing') return '';
  if (first === 'login' || first === 'auth') return { absolute: '/sign-in' };
  if (first === 'admin') return '/admin';
  if (['about', 'history', 'members', 'my-reviews', 'changelog', 'profile'].includes(first)) {
    if (first === 'members' && second) return `/members/${enc(second)}`;
    return `/${first}`;
  }
  if (first === 'books' && second && third && !['search', 'search-multi'].includes(second)) {
    return `/books/${enc(second)}/${enc(third)}`;
  }
  if (['nominate', 'nominations', 'vote', 'results'].includes(first)) {
    return second ? `/${first}/${enc(newMonth(second))}` : `/${first}`;
  }
  if (first === 'join' && second) return `/join/${enc(second)}`;
  if (first === 'picks' || first === 'meetings') return '/history';
  return '';
}

const KILL_SWITCH_SW = `// The club moved to gatherbound.club: remove this app's offline copy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
`;

module.exports = function redirectToGatherbound(base) {
  const target = String(base).replace(/\/+$/, '');
  const origin = new URL(target).origin;
  return function redirect(req, res, next) {
    if (req.path === '/health') return next();
    if (req.path === '/sw.js') {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      return res.send(KILL_SWITCH_SW);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(410).type('text').send(`This club has moved to ${target}`);
    }
    const to = newPathFor(req.path);
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const url = typeof to === 'object' ? origin + to.absolute : target + to + (to.startsWith('/join/') ? query : '');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.redirect(301, url);
  };
};
module.exports.newPathFor = newPathFor;
module.exports.newMonth = newMonth;
