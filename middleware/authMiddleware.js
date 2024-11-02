import jwt from 'jsonwebtoken';
import expressAsyncHandler from 'express-async-handler';
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';
import passport from 'passport';
import dotenv from 'dotenv';
import { verifyToken } from '../utilities/verifyToken.js';
import { pool } from '../config/db.js';

dotenv.config();
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL:
				process.env.NODE_ENV === 'production'
					? 'http://18.188.214.41:3000/auth/google/callback'
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
			req.user = await verifyToken(token);
			if (!req.user) {
				res.status(403).json({
					message: 'Invalid token',
				});
				return;
			}
			const [[blacklisted_token]] = await pool.query(
				`SELECT * FROM blacklisted_token WHERE access_token = ?`,
				[token]
			);
			if (blacklisted_token) {
				res.status(403).json({
					message: 'Blacklisted token',
				});
				return;
			}
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
