import { Router } from 'express';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, bucketName, bucketUrl } from '../config/storage.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  },
});

// Upload album art image
router.post(
  '/image/upload',
  authenticate,
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    const userId = req.user!.id;
    const fileExt = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${fileExt}`;
    const key = `images/${userId}/${filename}`;

    try {
      // Upload to S3/MinIO
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl: 'public, max-age=31536000',
        })
      );

      // Return the URL
      const imageUrl = `${bucketUrl}/api/media/image/${userId}/${filename}`;

      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename,
        },
      });
    } catch (error) {
      console.error('Image upload error:', error);
      throw new AppError('Failed to upload image', 500);
    }
  })
);

// Serve images from S3/MinIO
router.get(
  '/image/:userId/:filename',
  asyncHandler(async (req, res) => {
    const { userId, filename } = req.params;
    const key = `images/${userId}/${filename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);

      res.set({
        'Content-Type': response.ContentType || 'image/jpeg',
        'Content-Length': response.ContentLength,
        'Cache-Control': 'public, max-age=31536000',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });

      if (response.Body) {
        // @ts-ignore
        response.Body.pipe(res);
      } else {
        throw new AppError('Image not found', 404);
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new AppError('Image not found', 404);
      }
      throw error;
    }
  })
);

// Serve audio files from S3/MinIO
// Note: No authentication required since HTML audio elements can't send auth headers
// Security is provided by the obscure file path (UUID-based)
router.get(
  '/audio/:userId/:filename',
  asyncHandler(async (req, res) => {
    const { userId, filename } = req.params;

    const key = `audio/${userId}/${filename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);

      // Set appropriate headers
      res.set({
        'Content-Type': response.ContentType || 'audio/mpeg',
        'Content-Length': response.ContentLength,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
        'Cross-Origin-Resource-Policy': 'cross-origin', // Allow cross-origin access
      });

      // Handle range requests for audio seeking
      const range = req.headers.range;
      if (range && response.ContentLength) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : response.ContentLength - 1;
        const chunksize = end - start + 1;

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${response.ContentLength}`,
          'Content-Length': chunksize,
        });
      }

      // Stream the file
      if (response.Body) {
        // @ts-ignore - Body is a readable stream
        response.Body.pipe(res);
      } else {
        throw new AppError('File not found', 404);
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new AppError('Audio file not found', 404);
      }
      throw error;
    }
  })
);

export default router;
