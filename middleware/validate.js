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
};
