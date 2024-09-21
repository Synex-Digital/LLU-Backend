import { Router } from 'express';
import passport from 'passport';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import {
	authLoginFailure,
	authLoginSuccess,
	authLogout,
	authRequestOTP,
	authOTPVerify,
	authResetPassword,
	authOTPSuccess,
	authRegister,
	specifiedRegister,
	authValidates,
	authLogin,
	authCheckRefreshToken,
} from '../controllers/authControllers.js';
import {
	passwordCompare,
	passwordHash,
} from '../middleware/passwordHashMiddleware.js';

const authRouter = Router();

authRouter
	.route('/google')
	.get(passport.authenticate('google', { scope: ['email', 'profile'] }));

authRouter.route('/google/callback').get(
	passport.authenticate('google', {
		successRedirect: '/auth/google/success',
		failureRedirect: '/auth/google/failure',
	})
);

authRouter.route('/google/success').get(isLoggedIn, authLoginSuccess);

authRouter.route('/google/failure').get(authLoginFailure);

authRouter.route('/logout').post(authLogout);

authRouter.route('/request_OTP').get(authRequestOTP);

authRouter.route('/verify_OTP').post(authOTPVerify, authOTPSuccess);

authRouter.route('/register').post(passwordHash, authRegister);

authRouter.route('/login').post(authValidates, passwordCompare, authLogin);

authRouter.route('/token').post(authCheckRefreshToken);

//TODO: have to create session login

authRouter
	.route('/reset_password')
	.post(authOTPVerify, passwordHash, authResetPassword);

authRouter.route('/register_special_user/:user_id').post(specifiedRegister);

export { authRouter };
