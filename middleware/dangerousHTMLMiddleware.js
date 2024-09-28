import expressAsyncHandler from 'express-async-handler';
import sanitizeHtml from 'sanitize-html';

const sanitizeInput = expressAsyncHandler((req, res, next) => {
	const { content } = req.body;
	if (!content) {
		res.status(400).json({
			message: 'Content is missing',
		});
		return;
	}
	req.body.content = sanitizeHtml(content, {
		allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
		allowedAttributes: {
			a: ['href', 'target'],
		},
	});
	next();
});

export { sanitizeInput };
