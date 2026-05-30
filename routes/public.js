'use strict';

const router = require('express').Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const db = require('../db');
const { emailChain, sanitizeTextChain, handleValidationErrors } = require('../middleware/validate');
const waitlistService = require('../services/waitlist');
const emailService = require('../services/email');
const { slugify, bookPath } = require('../utils/slug');
const { formatMonthYear } = require('../utils/format');
const { requireMember } = require('../middleware/auth');
const { enrichBookMetadata } = require('../services/books');
const { renderMarkdown } = require('../utils/markdown');
const { buildGradeGradient, gradeToPercent } = require('../utils/gradeGradient');
const { timeAgo } = require('../utils/format');
const meetingsService = require('../services/meetings');
const picksService = require('../services/monthly-picks');
const reactionsService = require('../services/reactions');
const repliesService = require('../services/replies');
const analytics = require('../services/analytics');
const announcementsService = require('../services/announcements');
const activityService = require('../services/activity');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a cover image URL for a book row.
 * Covers are stored locally in public/img/covers/ via scripts/fetch-covers.js.
 */
function getCoverUrl(book) {
  return book.cover_url || null;
}

/**
 * Cache grade_weights once so we don't query every request.
 */
let _gradeWeights = null;
function getGradeWeights() {
  if (!_gradeWeights) {
    _gradeWeights = db.prepare('SELECT grade, weight FROM grade_weights ORDER BY weight DESC').all();
  }
  return _gradeWeights;
}

/**
 * Convert a numeric weight to its closest letter grade.
 */
function weightToGrade(weight) {
  if (weight == null) return null;
  const grades = getGradeWeights();
  let closest = grades[0];
  let minDiff = Math.abs(weight - closest.weight);
  for (const g of grades) {
    const diff = Math.abs(weight - g.weight);
    if (diff < minDiff) {
      minDiff = diff;
      closest = g;
    }
  }
  return closest.grade;
}

// ---------------------------------------------------------------------------
// GET / — Home page
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  // Current pick: prefer the nearest active (non-results) pick,
  // fall back to the most recent completed one
  const currentMeeting = picksService.getHero();

  // Enrich with first event data (meeting_time, location_text, meetup_event_url)
  if (currentMeeting && currentMeeting.id) {
    const event = picksService.getFirstEvent(currentMeeting.id);
    if (event) {
      if (!currentMeeting.meeting_time) currentMeeting.meeting_time = event.meeting_time;
      if (!currentMeeting.location_text) currentMeeting.location_text = event.location_text;
      if (!currentMeeting.meetup_event_url) currentMeeting.meetup_event_url = event.meetup_event_url;
    }
  }

  // Last 6 finished books (skip the current one)
  const recentBooks = picksService.getRecentPicks(6, currentMeeting ? currentMeeting.id : null);

  const totalBooks = picksService.countCompleted();
  const totalMembers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totalReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;

  // Active participation meeting (nominations or voting) — may or may not have a book
  const activeMeeting = db.prepare(`
    SELECT id, month_year, status
    FROM meetings
    WHERE status IN ('nominations', 'voting')
    ORDER BY month_year ASC
    LIMIT 1
  `).get() || null;

  // Upcoming meetings (status = 'upcoming', ordered by month_year ASC)
  const upcomingMeetings = meetingsService.getUpcoming().map(m => {
    // Enrich with full book data if a winner is set
    if (m.winning_book_id) {
      const book = db.prepare('SELECT title, author, cover_url, author_slug, title_slug FROM books WHERE id = ?').get(m.winning_book_id);
      if (book) Object.assign(m, book);
    }
    return m;
  });

  // Parse subjects JSON for hero display
  let heroSubjects = [];
  if (currentMeeting && currentMeeting.subjects) {
    try { heroSubjects = JSON.parse(currentMeeting.subjects); } catch { /* ignore */ }
  }

  // Active announcements (max 3, non-expired)
  const announcements = announcementsService.getActive();

  // Recent activity feed
  const activity = activityService.getRecentActivity(15);

  res.render('home', {
    pageTitle: 'Home',
    currentMeeting,
    activeMeeting,
    recentBooks,
    upcomingMeetings,
    totalBooks,
    totalMembers,
    totalReviews,
    heroSubjects,
    announcements,
    activity,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
    timeAgo,
  });
});

// ---------------------------------------------------------------------------
// GET /history — All past books
// ---------------------------------------------------------------------------
router.get('/history', (req, res) => {
  const books = picksService.getHistory();

  res.render('history', {
    pageTitle: 'History',
    books,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
  });
});

// ---------------------------------------------------------------------------
// GET /about — About the club
// ---------------------------------------------------------------------------
router.get('/about', (req, res) => {
  const totalBooks = picksService.countCompleted();
  const totalMembers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totalReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;

  res.render('about', {
    pageTitle: 'About',
    totalBooks,
    totalMembers,
    totalReviews,
  });
});

// ---------------------------------------------------------------------------
// GET /changelog — What's New
// ---------------------------------------------------------------------------
const changelogData = require('../content/changelog.json');

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatChangelogDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const mi = parseInt(m, 10) - 1;
  return `${MONTH_NAMES_LONG[mi]} ${parseInt(d, 10)}, ${y}`;
}

router.get('/changelog', (req, res) => {
  res.render('changelog', {
    pageTitle: "What's New",
    releases: changelogData,
    formatChangelogDate,
  });
});

// ---------------------------------------------------------------------------
// GET /profile — User profile page
// ---------------------------------------------------------------------------
router.get('/profile', requireMember, (req, res) => {
  const profileUser = db.prepare(
    'SELECT id, email, display_name, avatar_style, user_slug, username, goodreads_url, storygraph_url, instagram_handle, threads_handle, password_hash FROM users WHERE id = ?'
  ).get(req.user.id);

  res.render('profile', {
    pageTitle: 'Profile',
    profileUser: {
      ...profileUser,
      hasPassword: !!profileUser.password_hash,
      password_hash: undefined, // never expose hash to template
    },
    pageScript: '/js/profile.js',
  });
});

// ---------------------------------------------------------------------------
// GET /members — Member directory
// ---------------------------------------------------------------------------
router.get('/members', requireMember, (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.display_name, u.avatar_style, u.user_slug, u.username, u.email, u.created_at,
           COUNT(r.id) AS review_count
    FROM users u
    LEFT JOIN reviews r ON r.user_id = u.id
    GROUP BY u.id
    ORDER BY u.display_name COLLATE NOCASE ASC
  `).all();

  res.render('members', {
    pageTitle: 'Members',
    members,
  });
});

// ---------------------------------------------------------------------------
// GET /members/:slug — Public member profile
// ---------------------------------------------------------------------------
router.get('/members/:slug', requireMember, (req, res) => {
  const member = db.prepare(`
    SELECT id, display_name, email, avatar_style, user_slug, username,
           goodreads_url, storygraph_url, instagram_handle, threads_handle,
           created_at
    FROM users
    WHERE username = ? OR user_slug = ?
  `).get(req.params.slug, req.params.slug);

  if (!member) {
    return res.status(404).render('error', {
      pageTitle: 'Member Not Found',
      errorCode: 404,
      errorMessage: 'This member profile does not exist.',
    });
  }

  // Reading stats
  const stats = db.prepare(`
    SELECT COUNT(r.id) AS review_count,
           AVG(gw.weight) AS avg_weight
    FROM reviews r
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.user_id = ?
  `).get(member.id);

  const avgGrade = stats.avg_weight != null ? weightToGrade(stats.avg_weight) : null;

  // Their reviews with book info
  const reviews = db.prepare(`
    SELECT r.id, r.grade, r.body_markdown, r.created_at, r.updated_at,
           b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
           gw.weight
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(member.id);

  // Emoji reactions for this member's reviews
  const memberReviewIds = reviews.map(r => r.id);
  const reactionCounts = reactionsService.getReactionCountsBatch(memberReviewIds);
  const userReactions = req.session && req.session.userId
    ? reactionsService.getUserReactionsBatch(memberReviewIds, req.session.userId)
    : new Map();

  res.render('member-profile', {
    pageTitle: member.display_name || 'Member Profile',
    member,
    stats: { ...stats, avgGrade },
    reviews,
    reactionCounts,
    userReactions,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
    renderMarkdown,
  });
});

// ---------------------------------------------------------------------------
// GET /books/:authorSlug/:titleSlug — Book detail
// ---------------------------------------------------------------------------
router.get('/books/:authorSlug/:titleSlug', async (req, res) => {
  let book = db.prepare(`
    SELECT b.*, mp.month_year, mp.status AS meeting_status,
           (mp.vote_results_json IS NOT NULL) AS has_vote_data
    FROM books b
    LEFT JOIN monthly_picks mp ON mp.book_id = b.id
    WHERE b.author_slug = ? AND b.title_slug = ?
    ORDER BY mp.month_year DESC
    LIMIT 1
  `).get(req.params.authorSlug, req.params.titleSlug);

  if (!book) {
    return res.status(404).render('error', {
      pageTitle: 'Not Found',
      errorCode: 404,
      errorMessage: 'Book not found.',
    });
  }

  // Attach event data (meeting_time, location, meetup URL) from events table
  const pick = picksService.getPickForBook(book.id);
  if (pick) {
    const pickRow = picksService.getByMonthYear(book.month_year);
    if (pickRow) {
      const event = picksService.getFirstEvent(pickRow.id);
      if (event) {
        book.meeting_time = event.meeting_time;
        book.location_text = event.location_text;
        book.meetup_event_url = event.meetup_event_url;
      }
    }
  }

  // Lazy-enrich metadata if key fields are missing
  if (book.description == null || book.publisher == null || book.page_count == null) {
    try {
      const enriched = await enrichBookMetadata(book.id);
      if (enriched) {
        // Re-fetch with pick join to keep all fields
        book = db.prepare(`
          SELECT b.*, mp.month_year, mp.status AS meeting_status,
                 (mp.vote_results_json IS NOT NULL) AS has_vote_data
          FROM books b
          LEFT JOIN monthly_picks mp ON mp.book_id = b.id
          WHERE b.id = ?
          ORDER BY mp.month_year DESC
          LIMIT 1
        `).get(book.id) || book;
        // Re-attach event data
        if (pick) {
          const pickRow = picksService.getByMonthYear(book.month_year);
          if (pickRow) {
            const event = picksService.getFirstEvent(pickRow.id);
            if (event) {
              book.meeting_time = event.meeting_time;
              book.location_text = event.location_text;
              book.meetup_event_url = event.meetup_event_url;
            }
          }
        }
      }
    } catch (err) {
      // Enrichment failure is non-fatal
      console.error('Book enrichment error:', err.message);
    }
  }

  // Parse subjects JSON
  let subjects = [];
  if (book.subjects) {
    try {
      subjects = JSON.parse(book.subjects);
    } catch { /* ignore */ }
  }

  // Reviews with display names
  const reviews = db.prepare(`
    SELECT r.id, r.grade, r.body_markdown, r.has_spoilers, r.did_finish,
           r.created_at, r.updated_at,
           r.user_id, u.display_name, u.avatar_style, u.user_slug, u.username, u.email,
           gw.weight
    FROM reviews r
    JOIN grade_weights gw ON gw.grade = r.grade
    JOIN users u ON u.id = r.user_id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(book.id);

  // Check if current user already has a review for this book
  const userId = req.session && req.session.userId ? req.session.userId : null;
  const userReview = userId
    ? reviews.find(r => r.user_id === userId)
    : null;

  // Emoji reactions — batch-fetch counts + user's own reactions
  const reviewIds = reviews.map(r => r.id);
  const reactionCounts = reactionsService.getReactionCountsBatch(reviewIds);
  const userReactions = userId
    ? reactionsService.getUserReactionsBatch(reviewIds, userId)
    : new Map();

  // Replies — batch-fetch for all reviews
  const repliesMap = repliesService.getRepliesBatch(reviewIds);

  // Grade stats
  let avgWeight = null;
  let avgGrade = null;
  const gradeDistribution = [];

  if (reviews.length > 0) {
    avgWeight = reviews.reduce((sum, r) => sum + r.weight, 0) / reviews.length;
    avgGrade = weightToGrade(avgWeight);

    // Build distribution: count per grade
    const counts = {};
    for (const r of reviews) {
      counts[r.grade] = (counts[r.grade] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    const allGrades = getGradeWeights();
    for (const g of allGrades) {
      const count = counts[g.grade] || 0;
      if (count > 0) {
        gradeDistribution.push({
          grade: g.grade,
          count,
          pct: Math.round((count / maxCount) * 100),
        });
      }
    }
  }

  // Pre-compute gradient strip values for the template
  const gradeGradient = buildGradeGradient(gradeDistribution);
  const avgGradePercent = avgGrade ? gradeToPercent(avgGrade) : null;

  // Featured review for pull-quote — pick the review with the most reactions,
  // falling back to the first non-spoiler review with enough body text
  let featuredReview = null;
  if (reviews.length >= 3) {
    const candidates = reviews.filter(r => !r.has_spoilers && r.body_markdown && r.body_markdown.length >= 80);
    if (candidates.length > 0) {
      // Score by total reaction count
      featuredReview = candidates.reduce((best, r) => {
        const rReactions = reactionCounts.get(r.id) || [];
        const total = rReactions.reduce((s, rx) => s + rx.count, 0);
        const bestReactions = reactionCounts.get(best.id) || [];
        const bestTotal = bestReactions.reduce((s, rx) => s + rx.count, 0);
        return total > bestTotal ? r : best;
      }, candidates[0]);
    }
  }

  // Book-to-book navigation (prev/next by month)
  const adjacentPicks = picksService.getAdjacentPicks(book.month_year);

  // Site settings
  const libraryRow = db.prepare("SELECT value FROM site_settings WHERE key = 'library_url'").get();

  // Track the view with the user's distinct id (or _client_id cookie for anon).
  // Use a non-meeting-scoped id so book funnels work across visits.
  const viewerId = req.session?.userId || req.cookies?._client_id || 'anonymous';
  analytics.track(viewerId, 'book_viewed', {
    bookId: book.id,
    title: book.title,
    author: book.author,
    monthYear: book.month_year,
    isClubPick: !!book.month_year,
  });

  res.render('book-detail', {
    pageTitle: `${book.title} by ${book.author}`,
    book,
    subjects,
    reviews,
    userReview,
    avgGrade,
    gradeDistribution,
    gradeGradient,
    avgGradePercent,
    reactionCounts,
    userReactions,
    repliesMap,
    featuredReview,
    prevBook: adjacentPicks.prev,
    nextBook: adjacentPicks.next,
    getCoverUrl,
    formatMonthYear,
    bookPath,
    renderMarkdown,
    libraryUrl: libraryRow ? libraryRow.value : '',
  });
});

// ---------------------------------------------------------------------------
// Invite join page
// GET /join/:code
// ---------------------------------------------------------------------------
router.get('/join/:code', (req, res) => {
  const { code } = req.params;
  const invite = db.prepare(
    `SELECT i.*, u.display_name AS inviter_name
     FROM invites i JOIN users u ON u.id = i.invited_by
     WHERE i.code = ?`
  ).get(code);

  if (!invite || invite.use_count >= invite.max_uses) {
    res.locals.layout = 'layouts/app-shell';
    return res.render('login', {
      pageTitle: 'Invalid Invite',
      step: 'error',
      email: null,
      error: 'This invite link is invalid or has already been used.',
      invite: null,
    });
  }

  // Already logged in — redirect home
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }

  // Store invite code in session for attribution on registration
  req.session.inviteCode = code;

  res.locals.layout = 'layouts/app-shell';
  res.render('login', {
    pageTitle: "You're Invited!",
    step: 'form',
    email: null,
    error: null,
    invite: { inviterName: invite.inviter_name, code },
  });
});

// ---------------------------------------------------------------------------
// GET /landing — GatherBound platform landing page
// ---------------------------------------------------------------------------
router.get('/landing', (req, res) => {
  const totalBooks = picksService.countCompleted();
  const totalMembers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totalReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;
  // Total nominations across the club's full history (includes historically
  // seeded meetings whose nominees live in vote_results_json). See
  // picksService.countNominations.
  const totalNominations = picksService.countNominations();
  const totalReactions = db.prepare('SELECT COUNT(*) AS count FROM review_reactions').get().count;
  const totalReplies = db.prepare('SELECT COUNT(*) AS count FROM review_replies').get().count;
  const totalEngagement = totalReactions + totalReplies;

  // Grab recent book covers for the social proof section
  const recentBooks = db.prepare(`
    SELECT b.title, b.cover_url
    FROM monthly_picks mp
    JOIN books b ON b.id = mp.book_id
    WHERE mp.status = 'results' AND b.cover_url IS NOT NULL
    ORDER BY mp.created_at DESC
    LIMIT 8
  `).all();

  // Live-product showcase: two real previews inside the "peek inside" mockups,
  // pulled from the DB so they stay truthful and never go stale.
  //   • Home preview  → the currently-reading book (or latest pick)
  //   • Archive preview → a well-reviewed completed book so the demo always
  //     shows real grades + a real member review (the currently-reading book
  //     often has no reviews yet). Pinned to Ubik, with a data-driven fallback.
  const gradeAndReview = (bookId) => {
    const avgRow = db.prepare(`
      SELECT AVG(gw.weight) AS avg_weight, COUNT(*) AS cnt
      FROM reviews r
      JOIN grade_weights gw ON gw.grade = r.grade
      WHERE r.book_id = ?
    `).get(bookId);

    // A clean, positive pull-quote: substantial, no spoiler markup (||…||).
    const reviewRow = db.prepare(`
      SELECT r.grade, r.body_markdown, u.display_name AS reviewer
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN grade_weights gw ON gw.grade = r.grade
      WHERE r.book_id = ?
        AND r.body_markdown IS NOT NULL
        AND length(r.body_markdown) BETWEEN 60 AND 280
        AND instr(r.body_markdown, '||') = 0
      ORDER BY gw.weight DESC, length(r.body_markdown) DESC
      LIMIT 1
    `).get(bookId);

    let reviewText = null;
    if (reviewRow && reviewRow.body_markdown) {
      // Strip light markdown for a plain-text pull quote.
      reviewText = reviewRow.body_markdown
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/[_`>#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (reviewText.length > 160) reviewText = reviewText.slice(0, 157).trimEnd() + '…';
    }

    return {
      avgGrade: avgRow && avgRow.cnt > 0 ? weightToGrade(avgRow.avg_weight) : null,
      reviewCount: avgRow ? avgRow.cnt : 0,
      reviewText,
      reviewGrade: reviewRow ? reviewRow.grade : null,
      reviewer: reviewRow ? reviewRow.reviewer : null,
    };
  };

  const home = picksService.getHero();

  // Archive preview: Ubik (well-reviewed); fall back to the most-reviewed
  // completed pick if Ubik isn't present.
  let archive = db.prepare(`
    SELECT b.id AS book_id, b.title, b.author, b.cover_url
    FROM monthly_picks mp
    JOIN books b ON b.id = mp.book_id
    WHERE mp.status = 'results' AND b.cover_url IS NOT NULL
      AND b.author_slug = 'philip-k-dick' AND b.title_slug = 'ubik'
    LIMIT 1
  `).get();
  if (!archive) {
    archive = db.prepare(`
      SELECT b.id AS book_id, b.title, b.author, b.cover_url, COUNT(rv.id) AS rc
      FROM monthly_picks mp
      JOIN books b ON b.id = mp.book_id
      JOIN reviews rv ON rv.book_id = b.id
      WHERE mp.status = 'results' AND b.cover_url IS NOT NULL
      GROUP BY b.id
      ORDER BY rc DESC
      LIMIT 1
    `).get();
  }

  let showcase = null;
  if (home && home.cover_url && archive && archive.cover_url) {
    showcase = {
      home: {
        title: home.title,
        author: home.author,
        cover_url: home.cover_url,
        label: home.status === 'reading' ? 'Currently Reading' : formatMonthYear(home.month_year),
        recentCovers: recentBooks.filter((b) => b.cover_url).slice(0, 5),
      },
      archive: {
        title: archive.title,
        author: archive.author,
        cover_url: archive.cover_url,
        href: bookPath(archive.title, archive.author),
        ...gradeAndReview(archive.book_id),
      },
    };
  }

  res.render('landing', {
    layout: 'layouts/landing-shell',
    pageTitle: 'The digital home for in-person book clubs',
    totalBooks,
    totalMembers,
    totalReviews,
    totalNominations,
    totalEngagement,
    recentBooks,
    showcase,
  });
});

// ---------------------------------------------------------------------------
// POST /waitlist — GatherBound waitlist signup (native form on /landing)
// ---------------------------------------------------------------------------
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) =>
    res.status(429).json({ error: 'Too many signups from this network. Please try again later.' }),
});

const waitlistValidators = [
  ...sanitizeTextChain('name', { max: 120, required: true, label: 'Name' }),
  ...emailChain,
  ...sanitizeTextChain('clubName', { max: 120, required: false, label: 'Club name' }),
  ...sanitizeTextChain('cityState', { max: 120, required: false, label: 'Location' }),
];

router.post('/waitlist', waitlistLimiter, waitlistValidators, handleValidationErrors, async (req, res) => {
  // Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
  if (req.body.website) {
    return res.json({ success: true });
  }

  const signup = {
    name: req.body.name,
    email: req.body.email, // trimmed + lowercased + validated by emailChain
    clubName: req.body.clubName || null,
    cityState: req.body.cityState || null,
  };

  const { created } = waitlistService.addSignup(signup);

  analytics.track(req.session && req.session.userId ? req.session.userId : 'anonymous', 'waitlist_signup', {
    isNew: created,
    hasClub: !!signup.clubName,
    hasLocation: !!signup.cityState,
  });

  // Notify the admin, but never fail the request on a mail error — the signup
  // is already persisted.
  if (created) {
    try {
      await emailService.sendWaitlistNotification(signup);
    } catch (err) {
      console.error('Waitlist notification failed:', err.message);
    }
  }

  res.json({ success: true });
});

module.exports = router;
