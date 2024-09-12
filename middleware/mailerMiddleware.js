import dotenv from 'dotenv';
import expressAsyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';

dotenv.config();
const createMailTransporter = () => {
	return nodemailer.createTransport({
		host: process.env.MAILER_HOST,
		port: process.env.MAILER_PORT,
		secure: true,
		auth: {
			user: process.env.MAILER_USER,
			pass: process.env.MAILER_PASSWORD,
		},
	});
};

const mailerMiddleware = expressAsyncHandler((req, res, next) => {
	req.mailer = createMailTransporter();
	next();
});

export { mailerMiddleware };
