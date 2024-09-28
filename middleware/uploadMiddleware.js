import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'pictures');

//TODO have to fix this before production
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

const uploadMultiple = expressAsyncHandler(async (req, res, next) => {
	upload.array('img', 10)(req, res, function (err) {
		if (err instanceof multer.MulterError) {
			throw new Error(`message: ${err.message}`);
		} else if (err) {
			throw new Error(`message: ${err.message}`);
		}
		const fileRoutes = req.files.map((file) => {
			const fileRoute = path
				.join('pictures', file.filename)
				.replace(/\\/g, '/');
			return `${req.protocol}://${req.get('host')}/${fileRoute}`;
		});

		req.filePaths = fileRoutes;
		next();
	});
});

const deleteFile = expressAsyncHandler(async (req, res, next) => {
	const { facility_img_id } = req.params;
	if (!facility_img_id) {
		return res.status(400).json({
			message: 'Facility img id is missing',
		});
	}
	const [[{ img }]] = await pool.query(
		`SELECT img FROM facility_img WHERE facility_img_id = ?`,
		[facility_img_id]
	);
	if (!img) {
		return res.status(400).json({
			message: 'There is no facility by this facility_id',
		});
	}
	const fileName = path.basename(img);
	const fullFilePath = path.join(uploadDir, fileName);

	fs.unlink(fullFilePath, (err) => {
		if (err) {
			if (err.code === 'ENOENT') {
				res.status(400).json({
					message: 'File not found',
				});
				return;
			} else {
				throw new Error('Error deleting file');
			}
		} else {
			next();
		}
	});
});

export { uploadFile, uploadDir, uploadMultiple, deleteFile };
