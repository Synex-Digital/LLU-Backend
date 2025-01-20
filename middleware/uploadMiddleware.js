import multer from 'multer';
import expressAsyncHandler from 'express-async-handler';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { generateRandomString } from '../utilities/generateRandomString.js';
import sharp from 'sharp';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
	upload.single('img')(req, res, (err) => {
		if (err instanceof multer.MulterError)
			throw new Error(`Multer Error: ${err.message}`);
		else if (err) throw new Error(`Error: ${err.message}`);
		if (!req.file) {
			res.status(400).json({
				message: 'No file uploaded. Please attach a file.',
			});
			return;
		}
		next();
	});
});

const uploadToS3 = expressAsyncHandler(async (req, res, next) => {
	const file = req.file;
	const { height, width } = req.body;
	const imageName = generateRandomString();
	const imageMetaData = await sharp(file.buffer).metadata();
	const fileBuffer = await sharp(file.buffer)
		.resize({
			height: height || imageMetaData.height,
			width: width || imageMetaData.width,
			fit: 'contain',
		})
		.toBuffer();
	const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}`;
	req.filePath = imageUrl;
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
	upload.array('img', 10)(req, res, (err) => {
		if (err instanceof multer.MulterError)
			throw new Error(`Multer Error: ${err.message}`);
		else if (err) throw new Error(`Error: ${err.message}`);
		if (!req.files || req.files.length === 0) {
			res.status(400).json({
				message: 'No files uploaded. Please attach at least one file.',
			});
			return;
		}
		next();
	});
});

const uploadMultipleToS3 = expressAsyncHandler(async (req, res, next) => {
	const filePaths = [];
	const { height, width } = req.body;
	await Promise.all(
		req.files.map(async (file) => {
			const imageName = generateRandomString();
			const imageMetaData = await sharp(file.buffer).metadata();
			const fileBuffer = await sharp(file.buffer)
				.resize({
					height: height || imageMetaData.height,
					width: width || imageMetaData.width,
					fit: 'contain',
				})
				.toBuffer();
			const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}`;
			filePaths.push(imageUrl);
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

const getObjectSignedUrl = async (key) => {
	const command = new GetObjectCommand({
		Bucket: process.env.AWS_S3_BUCKET_NAME,
		Key: key,
	});
	const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
	return url;
};

export {
	uploadFile,
	uploadToS3,
	uploadMultiple,
	uploadMultipleToS3,
	deleteFile,
	getObjectSignedUrl,
};
