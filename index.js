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
import { uploadDir } from './middleware/uploadMiddleware.js';
import { userRouter } from './routes/userRoutes.js';
import { socketInitialize } from './realtime/socket.js';
import { exec } from 'child_process';

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
app.use(express.json());
app.use('/pictures', express.static(uploadDir));
app.use(mailerMiddleware);

app.use('/auth', authRouter);
app.use('/api/athlete', athleteRouter);
app.use('/api/facilitator', facilitatorRouter);
app.use('/api/user', userRouter);

//! remove after testing
app.get('/', (req, res) => {
	res.status(200).json({
		message: 'Connected!!',
	});
});

app.use(notFound);
app.use(errorHandler);

app.post('/webhook', (req, res) => {
	const githubEvent = req.headers['x-github-event'];

	if (githubEvent === 'push') {
		console.log('Received a push event from GitHub.');
		exec('./run.sh', (error, stdout, stderr) => {
			if (error) {
				console.error(`Error executing script: ${error}`);
				return res.status(500).send('Internal server error');
			}
			console.log(`Script output: ${stdout}`);
			res.status(200).send('Webhook received and script executed.');
		});
	} else {
		res.status(200).send('Webhook received but no action taken.');
	}
});

const port = process.env.SERVER_PORT || 8080;
const server = app.listen(port, () => {
	console.log('Server is running on ' + port);
	console.log(`Listening on http://localhost:${port}/`);
	console.log(`Production link: http://18.188.214.41:3000/`);
});

//! modify after using
const io = new Server(server, {
	pingTimeout: 60000,
	cors: {
		origin: true, //* change after deployment
	},
});

io.on('connection', socketInitialize);
