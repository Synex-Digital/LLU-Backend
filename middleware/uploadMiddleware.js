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
	const { height, width } = req.body;
	const imageName = generateRandomString();

	const fileBuffer = await sharp(file.buffer)
		.resize({
			height: height || 1920,
			width: width || 1080,
			fit: 'contain',
		})
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
		if (err instanceof multer.MulterError)
			throw new Error(`message: ${err.message}`);
		else if (err) throw new Error(`message: ${err.message}`);
		next();
	});
});

const uploadMultipleToS3 = expressAsyncHandler(async (req, res, next) => {
	const filePaths = [];
	const { height, width } = req.body;
	await Promise.all(
		req.files.map(async (file) => {
			const imageName = generateRandomString();

			const fileBuffer = await sharp(file.buffer)
				.resize({
					height: height || 1920,
					width: width || 1080,
					fit: 'contain',
				})
				.toBuffer();

			filePaths.push(imageName);
			await s3Client.send(
				new PutObjectCommand({
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Body: fileBuffer,
					Key: imageName,
					ContentType: file.mimetype,
				})
			);
		})
	);
	req.filePaths = filePaths;
	next();
});

const deleteFile = expressAsyncHandler(async (req, res) => {
	await s3Client.send(
		new DeleteObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: req.fileName,
		})
	);
	res.status(200).json({
		message: 'Successfully deleted facility image',
	});
});

export {
	uploadFile,
	uploadToS3,
	uploadMultiple,
	uploadMultipleToS3,
	deleteFile,
};
