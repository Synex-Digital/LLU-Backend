import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import expressAsyncHandler from 'express-async-handler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'pictures');

// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = `${Date.now()}-${file.originalname}`;
		cb(null, uniqueSuffix);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 1024 * 1024 * 5 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith('image/')) cb(null, true);
		else cb(new Error('Invalid file type, only images are allowed!'));
	},
});

//TODO: implement cleanup middleware
const uploadFile = expressAsyncHandler(async (req, res, next) => {
	upload.single('img')(req, res, function (err) {
		if (err instanceof multer.MulterError)
			throw new Error(`message: ${err.message}`);
		else if (err) throw new Error(`message: ${err.message}`);
		const fileRoute = path
			.join('pictures', req.file.filename)
			.replace(/\\/g, '/');
		req.filePath = `${req.protocol}://${req.get('host')}/${fileRoute}`;
		next();
	});
});

export { uploadFile, uploadDir };
