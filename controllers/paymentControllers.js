import Stripe from 'stripe';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = asyncHandler(async (req, res) => {
	const { amount, currency, customerId, facility_id, trainer_id } = req.body;
	const { user_id } = req.user;
	const paymentIntent = await stripe.paymentIntents.create({
		amount: amount,
		currency: currency,
		customer: customerId,
		description: 'Payment for your order',
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

export { createPaymentIntent, createCustomer };
