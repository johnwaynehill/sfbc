'use strict';

const { body, validationResult } = require('express-validator');

// ---------------------------------------------------------------------------
// Error handler — returns JSON for API calls, re-renders form otherwise
// ---------------------------------------------------------------------------
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const firstError = errors.array()[0].msg;

  // API / fetch requests → JSON
  const wantsJson =
    req.get('Accept')?.includes('application/json') ||
    req.is('application/json');

  if (wantsJson) {
    return res.status(400).json({ error: firstError });
  }

  // Form submissions → flash-style re-render (caller can override)
  return res.status(400).json({ error: firstError });
}

// ---------------------------------------------------------------------------
// Reusable chains
// ---------------------------------------------------------------------------

const emailChain = [
  body('email')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
];

const passwordChain = [
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

const displayNameChain = [
  body('display_name')
    .trim()
    .notEmpty().withMessage('Display name is required.')
    .isLength({ min: 1, max: 40 }).withMessage('Display name must be 1-40 characters.'),
];

const newPasswordChain = [
  body('new_password')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('confirm_password')
    .notEmpty().withMessage('Please confirm your password.')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
];

const socialLinksChain = [
  body('goodreads_url')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Goodreads URL is too long (max 500 characters).'),
  body('storygraph_url')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('StoryGraph URL is too long (max 500 characters).'),
  body('instagram_handle')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer(v => v.replace(/^@/, ''))
    .isLength({ max: 60 }).withMessage('Instagram handle is too long (max 60 characters).'),
  body('threads_handle')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer(v => v.replace(/^@/, ''))
    .isLength({ max: 60 }).withMessage('Threads handle is too long (max 60 characters).'),
];

const reviewChain = [
  body('grade')
    .trim()
    .notEmpty().withMessage('Grade is required.'),
  body('body')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 10000 }).withMessage('Review body is too long (max 10,000 characters).'),
];

const nominationChain = [
  body('title')
    .trim()
    .notEmpty().withMessage('Book title is required.')
    .isLength({ max: 300 }).withMessage('Book title is too long (max 300 characters).'),
  body('author')
    .trim()
    .notEmpty().withMessage('Author is required.')
    .isLength({ max: 200 }).withMessage('Author name is too long (max 200 characters).'),
  body('reason')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 280 }).withMessage('Nomination reason is too long (max 280 characters).'),
];

const meetingChain = [
  body('month_year')
    .trim()
    .notEmpty().withMessage('Month/year is required.')
    .isLength({ max: 20 }).withMessage('Month/year is too long.'),
  body('meetup_event_url')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Meetup URL is too long (max 500 characters).'),
  body('meeting_time')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('Meeting time is too long (max 100 characters).'),
  body('location_text')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 300 }).withMessage('Location text is too long (max 300 characters).'),
];

const meetingStatusChain = [
  body('status')
    .trim()
    .notEmpty().withMessage('New status is required.')
    .isIn(['upcoming', 'reading', 'nominations', 'voting', 'results'])
    .withMessage('Invalid meeting status.'),
];

const announcementChain = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ max: 200 }).withMessage('Title is too long (max 200 characters).'),
  body('type')
    .optional()
    .trim()
    .isIn(['info', 'warning', 'success']).withMessage('Type must be info, warning, or success.'),
  body('body')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Body is too long (max 1,000 characters).'),
  body('expires_at')
    .optional({ values: 'falsy' })
    .trim(),
];

// ---------------------------------------------------------------------------
// Emoji validation — allow actual emoji characters, reject HTML/scripts
// Matches Unicode emoji: emoticons, dingbats, symbols, pictographs, etc.
// ---------------------------------------------------------------------------
const EMOJI_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]+$/u;

const emojiChain = [
  body('emoji')
    .trim()
    .notEmpty().withMessage('Emoji is required.')
    .isLength({ max: 32 }).withMessage('Emoji is too long.')
    .custom((value) => {
      if (!EMOJI_RE.test(value)) {
        throw new Error('Invalid emoji character.');
      }
      return true;
    }),
];

// ---------------------------------------------------------------------------
// Reusable sanitized text chain — for replies, discussion questions, etc.
// Trims, strips zero-width characters, enforces length limits.
// Usage: sanitizeTextChain('body', { max: 2000, required: true })
// ---------------------------------------------------------------------------
function sanitizeTextChain(field, { max = 2000, required = true, label = 'Text' } = {}) {
  const chain = [
    body(field)
      .trim()
      .customSanitizer((value) => {
        if (!value) return value;
        // Strip zero-width characters (invisible control chars used for XSS tricks)
        return value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
      }),
  ];

  if (required) {
    chain[0] = chain[0]
      .notEmpty().withMessage(`${label} is required.`);
  } else {
    chain[0] = body(field)
      .optional({ values: 'falsy' })
      .trim()
      .customSanitizer((value) => {
        if (!value) return value;
        return value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
      });
  }

  chain.push(
    body(field)
      .optional({ values: 'falsy' })
      .isLength({ max }).withMessage(`${label} is too long (max ${max.toLocaleString()} characters).`)
  );

  return chain;
}

module.exports = {
  handleValidationErrors,
  emailChain,
  passwordChain,
  displayNameChain,
  newPasswordChain,
  socialLinksChain,
  reviewChain,
  nominationChain,
  meetingChain,
  meetingStatusChain,
  announcementChain,
  emojiChain,
  sanitizeTextChain,
};
