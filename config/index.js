require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  club: {
    name: process.env.CLUB_NAME || 'SF Fantasy & Sci-Fi Book Club',
    tagline: process.env.CLUB_TAGLINE || 'A San Francisco sci-fi & fantasy book club exploring worlds beyond.',
    meetupUrl: process.env.MEETUP_URL || 'https://www.meetup.com/san-francisco-fantasy-book-club/',
  },
};
