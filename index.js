import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import passport from 'passport';
import session from 'express-session';
import { Server } from 'socket.io';
import { authRouter } from './routes/authRoutes.js';
import { mailerMiddleware } from './middleware/mailerMiddleware.js';
import { athleteRouter } from './routes/athleteRoutes.js';
import { facilitatorRouter } from './routes/facilitatorRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { socketInitialize } from './realtime/socket.js';
import { exec } from 'child_process';
import { trainerRouter } from './routes/trainerRoutes.js';
import { parentRouter } from './routes/parentRouter.js';
import { handlePaymentWebhook } from './controllers/paymentControllers.js';

dotenv.config();
const app = express();

app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: true,
	})
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());

app.post(
	'/payment_webhook',
	express.raw({ type: 'application/json' }),
	handlePaymentWebhook
);

app.use(mailerMiddleware);
app.use(express.json());

app.use('/auth', authRouter);
app.use('/api/athlete', athleteRouter);
app.use('/api/facilitator', facilitatorRouter);
app.use('/api/trainer', trainerRouter);
app.use('/api/user', userRouter);
app.use('/api/parent', parentRouter);

//! remove after testing
app.get('/', async (req, res) => {
	res.status(200).json({
		message: 'Connected!!',
	});
});

app.post('/webhook', (req, res) => {
	const githubEvent = req.headers['x-github-event'];
	if (githubEvent === 'push') {
		exec('./run.sh', (error, stdout, stderr) => {
			if (error) {
				return res.status(500).json({
					message: 'Internal server error. Script execution failed.',
				});
			}
			return res.status(200).json({
				message: 'push event received, script executed successfully.',
			});
		});
	} else {
		return res.status(200).json({
			message:
				'Webhook received but no action taken for this event type.',
		});
	}
});

app.use(notFound);
app.use(errorHandler);

const port = process.env.SERVER_PORT || 8080;
const server = app.listen(port, () => {
	console.log('Server is running on ' + port);
	console.log(`Listening on http://localhost:${port}/`);
	console.log(`Production link: http://3.142.144.94:3000/`);
});

//! modify after using
const io = new Server(server, {
	pingTimeout: 60000,
	cors: {
		origin: true, //* change after deployment
	},
});

io.on('connection', socketInitialize);

export { io };
