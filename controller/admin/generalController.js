const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'df0jugmxr',
  api_key: process.env.CLOUDINARY_API_KEY || '876349442238177',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'VIevf7rpePqh1deA1lZroa0xntI'
});

// Upload image to Cloudinary
const uploadImage = async (req, res) => {
  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Get optional folder parameter
    const { folder = 'luvana' } = req.query;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto'
    });

    // Delete the temporary file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Image uploaded successfully',
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        size: result.bytes,
        format: result.format
      }
    });
  } catch (error) {
    // Delete the temporary file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Upload multiple images
const uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const { folder = 'luvana' } = req.query;
    const uploadedImages = [];

    // Upload all files in parallel
    const uploadPromises = req.files.map(file =>
      cloudinary.uploader.upload(file.path, {
        folder: folder,
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto'
      })
        .then(result => {
          // Delete temporary file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            size: result.bytes,
            format: result.format
          };
        })
        .catch(err => {
          // Delete temporary file on error
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          throw err;
        })
    );

    const images = await Promise.all(uploadPromises);

    res.json({
      message: `${images.length} images uploaded successfully`,
      images
    });
  } catch (error) {
    // Clean up remaining files
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    console.error('Multiple image upload error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Delete image from Cloudinary
const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ message: 'Public ID is required' });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(400).json({ message: 'Failed to delete image' });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  deleteImage
};