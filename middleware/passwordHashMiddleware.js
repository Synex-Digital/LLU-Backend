import bcrypt from 'bcryptjs';
import expressAsyncHandler from 'express-async-handler';

const passwordHash = expressAsyncHandler(async (req, res, next) => {
	const { password } = req.body;
	if (!password) {
		res.status(400).json({
			message: 'Password is missing',
		});
		return;
	}
	const salt = await bcrypt.genSalt(parseInt(process.env.SALT_ITR));
	req.hash = await bcrypt.hash(password, salt);
	next();
});

const passwordCompare = expressAsyncHandler(async (req, res, next) => {
	const { password } = req.body;
	if (!password) {
		res.status(400).json({
			message: 'Password is missing',
		});
		return;
	}
	req.verified = await bcrypt.compare(password, req.user.password);
	next();
});

export { passwordHash, passwordCompare };
