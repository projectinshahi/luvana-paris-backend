const express = require('express');
const router = express.Router();
const multer = require('multer');
const generalController = require('../../controller/admin/generalController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB, matched by the admin panel's own check

// Files are held in memory and streamed straight to Cloudinary. Writing them to
// disk first needed an ./uploads directory that was never created (every upload
// failed with ENOENT) and would not survive a read-only or ephemeral filesystem.
//
// No MIME-type filter here. The Content-Type a browser attaches to a file is
// whatever that machine's OS has registered for the extension, so the same PNG
// arrives as image/png from one laptop and application/octet-stream from
// another, and HEIC/AVIF/WebP are often unlabelled on Windows. The controller
// identifies the file by its actual bytes instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Apply admin auth middleware
// router.use(adminAuthMiddleware);

// Refuse an oversize upload from its Content-Length, before a byte of the body
// is read. Through a proxy (the admin panel's /api rewrite) an early 413 sent
// mid-stream never reached the browser and the request hung until the proxy
// timed out; answering before consuming the body avoids that. multer's own
// limit below remains the hard backstop for chunked uploads.
router.use((req, res, next) => {
  const declared = Number(req.headers['content-length']);
  if (req.method === 'POST' && declared > MAX_FILE_SIZE * 1.05) {
    return res.status(413).json({
      message: `Image size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
    });
  }
  next();
});

// Upload single image
router.post('/upload-image', upload.single('image'), generalController.uploadImage);

// Upload multiple images
router.post('/upload-images', upload.array('images', 10), generalController.uploadMultipleImages);

// Delete image from Cloudinary
router.delete('/delete-image', generalController.deleteImage);

// multer rejections (too large, too many files, wrong field name) used to fall
// through to Express's HTML error page, which the admin panel cannot parse, so
// every failure surfaced as a bare "API request failed". Answer as JSON with a
// status and message the client can show.
router.use((err, req, res, next) => {
  req.resume(); // drain whatever multer stopped reading so the connection can complete
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? `Image size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
        : err.message
    });
  }
  next(err);
});

module.exports = router;