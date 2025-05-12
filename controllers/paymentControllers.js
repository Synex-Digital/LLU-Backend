import Stripe from 'stripe';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { io } from '../index.js';

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = asyncHandler(async (req, res) => {
	const { currency, customerId, book_id, book_facility_id } = req.body;
	const { user_id } = req.user;
	if (
		(!currency && typeof currency !== 'string') ||
		(!customerId && typeof customerId !== 'string')
	) {
		res.status(400).json({
			message: 'Invalid or missing currency or customerId',
		});
		return;
	}
	if (!book_id && !book_facility_id) {
		res.status(400).json({
			message: 'Invalid or missing book_id or book_facility_id',
		});
		return;
	}
	if (book_id && book_facility_id) {
		res.status(400).json({
			message: 'Please provide either book_id or book_facility_id',
		});
		return;
	}
	if (typeof book_id !== 'number' && typeof book_facility_id !== 'number') {
		res.status(400).json({
			message: 'Invalid or missing book_id or book_facility_id',
		});
		return;
	}
	let book;
	if (book_facility_id) {
		[[book]] = await pool.query(
			`SELECT
				facility_id
			FROM
				book_facilities
			WHERE
				user_id = ?
			AND
				book_facility_id = ?`,
			[user_id, book_facility_id]
		);
	} else if (book_id) {
		[[book]] = await pool.query(
			`SELECT
				facility_id,
				trainer_id
			FROM
				books
			WHERE
				user_id = ?
			AND
				book_id = ?`,
			[user_id, book_id]
		);
	}
	if (!book) {
		res.status(400).json({
			message: 'User has not booked any facility',
		});
		return;
	}
	const [[facility]] = await pool.query(
		`SELECT
			f.facility_id,
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate,
			COALESCE(AVG(rf.rating), 0) AS avg_rating,
			fi.img
		FROM
			facilities f
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		WHERE 
			f.facility_id = ?
		GROUP BY
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate`,
		[book.facility_id]
	);
	let trainer;
	if (book?.trainer_id) {
		[[trainer]] = await pool.query(
			`SELECT
				t.trainer_id,
				u.first_name,
				u.last_name,
				t.hourly_rate
			FROM
				trainers t
			LEFT JOIN
				users u ON u.user_id = t.user_id
			WHERE 
				t.trainer_id = ?`,
			[book.trainer_id]
		);
	}
	let totalPrice = trainer
		? facility.hourly_rate + trainer.hourly_rate
		: facility.hourly_rate;
	const description = {
		user_id: user_id,
		facility_id: facility.facility_id,
		facility_amount: facility.hourly_rate,
		trainer_id: trainer ? trainer.trainer_id : null,
		trainer_amount: trainer ? trainer.hourly_rate : null,
		book_id: book_id ? book_id : book_facility_id,
	};
	let available;
	if (trainer?.trainer_id) {
		[[available]] = await pool.query(
			`SELECT
				*
			FROM
				payments
			WHERE
				book_id = ?
			AND
				status = 'pending'`,
			[book_id]
		);
	} else {
		[[available]] = await pool.query(
			`SELECT
				*
			FROM
				payments_facility
			WHERE
				book_id = ?
			AND
				status = 'pending'`,
			[book_id]
		);
	}
	if (!available && book_id) {
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO payments (total_amount, currency, status, book_id) VALUES (?, ?, ?, ?)`,
			[Math.round(totalPrice * 100), currency, 'pending', book_id]
		);
		if (affectedRows === 0) {
			res.status(400).json({
				message: 'Payment creation failed',
			});
			return;
		}
	} else if (!available && book_facility_id) {
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO payments_facility (total_amount, currency, status, book_id) VALUES (?, ?, ?, ?)`,
			[
				Math.round(totalPrice * 100),
				currency,
				'pending',
				book_facility_id,
			]
		);
		if (affectedRows === 0) {
			res.status(400).json({
				message: 'Payment creation failed',
			});
			return;
		}
	}
	const paymentIntent = await stripe.paymentIntents.create({
		amount: Math.round(totalPrice * 100),
		currency: currency,
		customer: customerId,
		description: JSON.stringify(description),
		automatic_payment_methods: { enabled: true },
	});

	const ephemeralKey = await stripe.ephemeralKeys.create(
		{ customer: customerId },
		{ apiVersion: '2023-10-16' }
	);

	res.status(200).json({
		data: {
			clientSecret: paymentIntent.client_secret,
			ephemeralKey: ephemeralKey.secret,
			customerId: customerId,
			publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
		},
	});
});

const handlePaymentWebhook = asyncHandler(async (req, res) => {
	console.log('Received webhook event:', req.body);
	const sig = req.headers['stripe-signature'];
	let event;

	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET
		);
	} catch (err) {
		console.error(`Webhook Error: ${err.message}`);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}
	console.log(event);
	let statusCode;
	switch (event.type) {
		case 'payment_intent.succeeded':
			console.log('PaymentIntent was successful!');
			const successPaymentIntent = event.data.object;
			statusCode = await handleSuccessfulPayment(successPaymentIntent);
			break;
		case 'payment_intent.canceled':
			console.log('PaymentIntent was canceled!');
			const canceledPaymentIntent = event.data.object;
			statusCode = await handleCanceledPayment(canceledPaymentIntent);
			break;
		default:
			console.log(`Unhandled event type ${event.type}`);
	}
	if (statusCode === 400) {
		res.status(statusCode).json({
			received: false,
		});
		console.log('End of webhook event handling');
		return;
	} else if (statusCode === 200) {
		res.status(statusCode).json({
			received: true,
		});
		console.log('End of webhook event handling');
		return;
	}
});

const handleCanceledPayment = async (paymentIntent) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const description = JSON.parse(paymentIntent.description);
		let affectedRows;
		if (description?.trainer_id) {
			[{ affectedRows }] = await connection.query(
				`DELETE FROM payments
				WHERE
					book_id = ?`,
				[description.book_id]
			);
			if (affectedRows === 0) {
				await connection.rollback();
				return 400;
			}
			[{ affectedRows }] = await connection.query(
				`DELETE FROM books
				WHERE
					book_id = ?`,
				[description.book_id]
			);
			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
		} else {
			[{ affectedRows }] = await connection.query(
				`DELETE FROM payments_facility
				WHERE
					book_id = ?`,
				[description.book_id]
			);
			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
			[{ affectedRows }] = await connection.query(
				`DELETE FROM book_facilities
				WHERE
					book_facility_id = ?`,
				[description.book_id]
			);
			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
		}
		await connection.commit();
		connection.release();
		return 200;
	} catch (error) {
		await connection.rollback();
		connection.release();
		console.error('Error handling canceled payment:', error);
		return 400;
	}
};

const handleSuccessfulPayment = async (paymentIntent) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		console.log(paymentIntent);
		const description = JSON.parse(paymentIntent.description);
		let affectedRows;
		console.log('Description:', description);
		if (description?.trainer_id) {
			[{ affectedRows }] = await connection.query(
				`UPDATE payments
				SET
					status = 'success',
					transaction_id = ?
				WHERE
					book_id = ?
				AND
					status = 'pending'`,
				[paymentIntent.id, description.book_id]
			);
			console.log('Update payments affected rows:', affectedRows);
			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
		} else {
			[{ affectedRows }] = await connection.query(
				`UPDATE payments_facility
				SET
					status = 'success',
					transaction_id = ?
				WHERE
					book_id = ?
				AND
					status = 'pending'`,
				[paymentIntent.id, description.book_id]
			);
			console.log(
				'Update payments_facility affected rows:',
				affectedRows
			);
			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
		}
		let [[{ first_name, socket_id, type, time, start_time, end_time }]] =
			await connection.query(
				`SELECT
				u.first_name,
				u.socket_id,
				u.type,
				b.time,
				b.start_time,
				b.end_time
			FROM
				books b
			LEFT JOIN
				users u ON b.user_id = u.user_id
			WHERE
				b.book_id = ?`,
				[description.book_id]
			);
		time = time.toISOString().split('T')[0];
		start_time = time + ' ' + start_time;
		end_time = time + ' ' + end_time;
		console.log('Book Info:', {
			time,
			first_name,
			start_time,
			end_time,
		});
		const [[{ name }]] = await connection.query(
			`SELECT
				name
			FROM
				facilities
			WHERE
				facility_id = ?`,
			[description.facility_id]
		);
		console.log('Facility Info:', {
			name,
		});
		let insertId;
		[{ affectedRows, insertId }] = await connection.query(
			`INSERT INTO facility_sessions (user_id, facility_id, name, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				description.user_id,
				description.facility_id,
				`${first_name} -> ${name}`,
				'upcoming',
				start_time,
				end_time,
			]
		);
		console.log('Insert facility_sessions affected rows:', affectedRows);
		if (affectedRows === 0) {
			await connection.rollback();
			connection.release();
			return 400;
		}
		if (description?.trainer_id) {
			[{ affectedRows }] = await connection.query(
				`INSERT INTO trainer_sessions (facility_sessions_id, trainer_id) VALUES (?, ?)`,
				[insertId, description.trainer_id]
			);
			console.log('Insert trainer_sessions affected rows:', affectedRows);

			if (affectedRows === 0) {
				await connection.rollback();
				connection.release();
				return 400;
			}
		}
		const notification = {
			title: 'Booking Confirmation',
			content: `Payment successful and session has been booked for ${time} from ${start_time} to ${end_time}`,
			time: new Date().toISOString().slice(0, 19).replace('T', ' '),
			read_status: 'no',
			redirect: `/api/${type}/session/${insertId}`,
		};

		const [
			{
				insertId: notificationInsertId,
				affectedRows: notificationAffectedRows,
			},
		] = await connection.query(
			`INSERT INTO notifications (user_id, title, content, time, read_status, redirect) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				description.user_id,
				notification.title,
				notification.content,
				notification.time,
				notification.read_status,
				notification.redirect,
			]
		);

		if (notificationAffectedRows === 0) {
			await connection.rollback();
			connection.release();
			return 400;
		}
		io.to(socket_id).emit('notification', {
			...notification,
			notification_id: notificationInsertId,
		});
		await connection.commit();
		connection.release();
		return 200;
	} catch (error) {
		await connection.rollback();
		connection.release();
		console.error('Error handling successful payment:', error);
		return 400;
	}
};

export { createPaymentIntent, handlePaymentWebhook };
