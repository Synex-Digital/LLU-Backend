import Stripe from 'stripe';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = asyncHandler(async (req, res) => {
	const { currency, customerId } = req.body;
	const { user_id } = req.user;
	let [[book]] = await pool.query(
		`SELECT
			facility_id,
			trainer_id
		FROM
			books
		WHERE
			user_id = ?`,
		[user_id]
	);
	if (!book) {
		[[book]] = await pool.query(
			`SELECT
				facility_id
			FROM
				book_facilities
			WHERE
				user_id = ?`,
			[user_id]
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
	totalPrice = totalPrice + totalPrice * process.env.INCENTIVE_PERCENTAGE;
	const description = {
		user_id: user_id,
		facility_id: facility.facility_id,
		facility_amount: facility.hourly_rate,
		trainer_id: trainer ? trainer.trainer_id : null,
		trainer_amount: trainer ? trainer.hourly_rate : null,
	};
	let available;
	if (trainer?.trainer_id) {
		[[available]] = await pool.query(
			`SELECT
				*
			FROM
				payments
			WHERE
				user_id = ?
			AND
				trainer_id = ?
			AND
				facility_id = ?
			AND
				status = 'pending'`,
			[user_id, trainer?.trainer_id, facility.facility_id]
		);
	} else {
		[[available]] = await pool.query(
			`SELECT
				*
			FROM
				payments_facility
			WHERE
				user_id = ?
			AND
				facility_id = ?
			AND
				status = 'pending'`,
			[user_id, facility.facility_id]
		);
	}
	if (!available) {
		let affectedRows;
		if (trainer?.trainer_id) {
			[{ affectedRows }] = await pool.query(
				`INSERT INTO payments (user_id, total_amount, currency, trainer_id, facility_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
				[
					user_id,
					totalPrice,
					currency,
					trainer.trainer_id,
					facility.facility_id,
					'pending',
				]
			);
		} else {
			[{ affectedRows }] = await pool.query(
				`INSERT INTO payments (user_id, total_amount, currency, facility_id, status) VALUES (?, ?, ?, ?, ?)`,
				[user_id, totalPrice, currency, facility.facility_id, 'pending']
			);
		}
		if (affectedRows === 0) {
			res.status(400).json({
				message: 'Payment creation failed',
			});
			return;
		}
	}
	const paymentIntent = await stripe.paymentIntents.create({
		amount: totalPrice * 100,
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

	switch (event.type) {
		case 'payment_intent.succeeded':
			const successPaymentIntent = event.data.object;
			await handleSuccessfulPayment(successPaymentIntent);
			break;
		case 'payment_intent.canceled':
			const canceledPaymentIntent = event.data.object;
			await handleCanceledPayment(canceledPaymentIntent);
			break;
		default:
			console.log(`Unhandled event type ${event.type}`);
	}

	res.status(200).json({ received: true });
});

const handleCanceledPayment = async (paymentIntent) => {};

const handleSuccessfulPayment = async (paymentIntent) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const description = JSON.parse(paymentIntent.description);
		if (description?.trainer_id) {
			await connection.query(
				`UPDATE payments
				SET status = 'success'
				WHERE
					user_id = ?
				AND
					trainer_id = ?
				AND
					facility_id = ?
				AND
					status = 'pending'`,
				[
					description.user_id,
					description.trainer_id,
					description.facility_id,
				]
			);
		} else {
			await connection.query(
				`UPDATE payments_facility
				SET status = 'success'
				WHERE
					user_id = ?
				AND
					facility_id = ?
				AND
					status = 'pending'`,
				[description.user_id, description.facility_id]
			);
		}
		await connection.query(
			`DELETE
			FROM
				books
			WHERE
				user_id = ?
			AND
				facility_id = ?`,
			[description.user_id, description.facility_id]
		);
		await connection.commit();
		connection.release();
	} catch (error) {
		await connection.rollback();
		connection.release();
		console.error('Error handling successful payment:', error);
		throw error;
	}
};

const createCustomer = asyncHandler(async (req, res) => {
	const { email } = req.body;
	const customer = await stripe.customers.create({
		email: email,
	});

	res.status(200).json({
		data: {
			customerId: customer.id,
		},
	});
});

export { createPaymentIntent, createCustomer, handlePaymentWebhook };
