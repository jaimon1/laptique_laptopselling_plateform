import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userSchema.js';
import dotenv from 'dotenv';
dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
        ? `${process.env.PRODUCTION_URL}/auth/google/callback`
        : 'http://localhost:3003/auth/google/callback'
},

    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });
            if (user) {
                
                if (user.isBlocked) {
                    return done(null, false, { message: 'Your account has been blocked by the administrator.' });
                }
                return done(null, user)
            } else {

                user = await User.findOne({ email: profile.emails[0].value });
                if (user) {
                    // Check if user is blocked
                    if (user.isBlocked) {
                        return done(null, false, { message: 'Your account has been blocked by the administrator.' });
                    }
                    user.googleId = profile.id;
                    await user.save();
                    return done(null, user);
                } else {
                    user = new User({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id
                    });
                    await user.save();
                    return done(null, user);
                }
            }

        } catch (error) {
            return done(error, null)
        }
    }
))

passport.serializeUser((user, done) => {

    done(null, user.id)

})

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        })
})

export default passport;