import crypto from 'crypto';
const generateOTP = (length = 4) => {
	return crypto.randomInt(1000, 9999).toString();
};

export { generateOTP };
