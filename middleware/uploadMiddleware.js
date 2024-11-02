import multer from 'multer';
import expressAsyncHandler from 'express-async-handler';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
} from '@aws-sdk/client-s3';
import { pool } from '../config/db.js';
import dotenv from 'dotenv';
import { generateRandomString } from '../utilities/generateRandomString.js';
import sharp from 'sharp';

dotenv.config();

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

const storage = multer.memoryStorage();
const upload = multer({
	storage,
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
		next();
	});
});

const uploadToS3 = expressAsyncHandler(async (req, res, next) => {
	const file = req.file;
	const imageName = generateRandomString();

	const fileBuffer = await sharp(file.buffer)
		.resize({ height: 1920, width: 1080, fit: 'contain' })
		.toBuffer();

	req.filePath = imageName;
	await s3Client.send(
		new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Body: fileBuffer,
			Key: imageName,
			ContentType: file.mimetype,
		})
	);
	next();
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

const uploadMultipleToS3 = expressAsyncHandler(async (req, res, next) => {});

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

export { uploadFile, uploadToS3, uploadMultiple, deleteFile };
