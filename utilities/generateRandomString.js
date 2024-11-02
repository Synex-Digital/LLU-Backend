import crypto from 'crypto';

const generateRandomString = (bytes = 32) =>
	crypto.randomBytes(bytes).toString('hex');

export { generateRandomString };
