import multer from 'multer';
import multerS3 from 'multer-s3';
import AWS from 'aws-sdk';
import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: process.env.AWS_S3_BUCKET_NAME,
		acl: 'public-read',
		key: (req, file, cb) => {
			const uniqueSuffix = `${Date.now()}-${file.originalname}`;
			cb(null, uniqueSuffix);
		},
	}),
	limits: { fileSize: 1024 * 1024 * 5 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith('image/')) cb(null, true);
		else cb(new Error('Invalid file type, only images are allowed!'));
	},
});

const uploadFile = expressAsyncHandler(async (req, res, next) => {
	upload.single('img')(req, res, function (err) {
		if (err instanceof multer.MulterError)
			throw new Error(`message: ${err.message}`);
		else if (err) throw new Error(`message: ${err.message}`);

		req.filePath = req.file.location;
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

		req.filePaths = req.files.map((file) => file.location);
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

	s3.deleteObject(
		{
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: img.split('/').pop(),
		},
		(err) => {
			if (err) {
				return res.status(500).json({
					message: 'Error deleting file from S3',
				});
			}
			next();
		}
	);
});

export { uploadFile, uploadMultiple, deleteFile };
