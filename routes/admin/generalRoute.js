const express = require('express');
const router = express.Router();
const multer = require('multer');
const generalController = require('../../controller/admin/generalController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// Apply admin auth middleware
// router.use(adminAuthMiddleware);

// Upload single image
router.post('/upload-image', upload.single('image'), generalController.uploadImage);

// Upload multiple images
router.post('/upload-images', upload.array('images', 10), generalController.uploadMultipleImages);

// Delete image from Cloudinary
router.delete('/delete-image', generalController.deleteImage);

module.exports = router;