const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userModel');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
      callbackURL: '/users/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Update last login
          user.lastlogin = new Date();
          await user.save();
          return done(null, user);
        }

        // Check if email already exists
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Link Google ID to existing user
          user.googleId = profile.id;
          user.profilePicture = profile.photos[0]?.value;
          user.lastlogin = new Date();
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          profilePicture: profile.photos[0]?.value,
          status: 'active',
          lastlogin: new Date(),
        });

        await user.save();
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;