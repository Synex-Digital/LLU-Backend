import jwt from 'jsonwebtoken';
import expressAsyncHandler from 'express-async-handler';
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';
import passport from 'passport';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL:
				process.env.NODE_ENV === 'production'
					? 'https://linkandlevelup.vercel.app/auth/google/callback'
					: 'http://localhost:8080/auth/google/callback',
			passReqToCallback: true,
		},
		(request, accessToken, refreshToken, profile, done) => {
			return done(null, profile);
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

const isLoggedIn = expressAsyncHandler(async (req, res, next) => {
	req.user
		? next()
		: res.status(401).json({
				message: 'Lacks authentication credentials',
		  });
});

const protect = expressAsyncHandler(async (req, res, next) => {
	let token;
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith('Bearer')
	) {
		try {
			token = req.headers.authorization.split(' ')[1];
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const [[user]] = await pool.query(
				`SELECT * FROM users WHERE user_id = ?`,
				[decoded.id]
			);
			if (!user) {
				res.status(400).json({
					message: 'There is no user with this token credentials',
				});
				return;
			}
			req.user = user;
			next();
		} catch (error) {
			throw new Error('Failed to authorize token');
		}
	}
	if (!token) {
		res.status(401).json({
			message: 'Token is missing',
		});
		return;
	}
});

export { protect, isLoggedIn };
