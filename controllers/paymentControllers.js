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

// Add this new webhook endpoint
const handlePaymentWebhook = asyncHandler(async (req, res) => {
	console.log('Received webhook event:', req.body);
	const sig = req.headers['stripe-signature'];
	let event;

	try {
		// Verify the webhook signature
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET
		);
	} catch (err) {
		console.error(`Webhook Error: ${err.message}`);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	// Handle the event
	switch (event.type) {
		case 'payment_intent.succeeded':
			const paymentIntent = event.data.object;
			await handleSuccessfulPayment(paymentIntent);
			break;
		// You can add more event types here if needed
		default:
			console.log(`Unhandled event type ${event.type}`);
	}

	res.status(200).json({ received: true });
});

// Function to handle successful payments
const handleSuccessfulPayment = async (paymentIntent) => {
	try {
		// Add your custom logic here
		console.log('Payment successful:', paymentIntent.id);
		console.log('Amount:', paymentIntent.amount);
		console.log('Customer:', paymentIntent.customer);

		// Example actions you might want to take:
		// 1. Update your database
		// 2. Send a confirmation email
		// 3. Update user account status
		// 4. Log the transaction

		// Example:
		/*
		await database.updateTransaction({
			paymentIntentId: paymentIntent.id,
			status: 'completed',
			amount: paymentIntent.amount
		});
		await sendConfirmationEmail(paymentIntent.customer);
		*/
	} catch (error) {
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
