const cloudinary = require('cloudinary').v2;
const { findImageReferences } = require('../../utils/imageReferences');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'df0jugmxr',
  api_key: process.env.CLOUDINARY_API_KEY || '876349442238177',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'VIevf7rpePqh1deA1lZroa0xntI'
});

// Send an in-memory file straight to Cloudinary — no temp file on disk.
const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto'
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

// Identify an image by its leading bytes rather than by the MIME type the
// browser attached — that label depends on the uploading machine's OS and is
// blank or wrong for HEIC/AVIF/WebP on many installs. Covers every format
// Cloudinary stores and, after its on-upload conversion, browsers can render.
const SUPPORTED_FORMATS = 'JPEG, PNG, GIF, WebP, AVIF, HEIC/HEIF, BMP, TIFF or SVG';

const detectImageFormat = (buf) => {
  if (!buf || buf.length < 12) return null;
  const hex = (n) => buf.subarray(0, n).toString('hex');
  const ascii = (a, b) => buf.subarray(a, b).toString('latin1');

  if (hex(3) === 'ffd8ff') return 'jpeg';
  if (hex(8) === '89504e470d0a1a0a') return 'png';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(0, 2) === 'BM') return 'bmp';
  if (hex(4) === '49492a00' || hex(4) === '4d4d002a') return 'tiff';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (/^avi[fs]/.test(brand)) return 'avif';
    if (/^(hei[cxms]|hev[cx]|mif1|msf1)/.test(brand)) return 'heic';
  }
  // SVG is text: tolerate a BOM, XML prolog, comments or a doctype before <svg.
  const head = buf.subarray(0, 1024).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg';
  return null;
};

const unsupportedFile = (name) => ({
  message: `${name ? `"${name}" is not` : 'That file is not'} a supported image. Please upload ${SUPPORTED_FORMATS}.`
});

const toImagePayload = (result) => ({
  url: result.secure_url,
  publicId: result.public_id,
  width: result.width,
  height: result.height,
  size: result.bytes,
  format: result.format
});

// Upload image to Cloudinary
const uploadImage = async (req, res) => {
  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    if (!detectImageFormat(req.file.buffer)) {
      return res.status(400).json(unsupportedFile(req.file.originalname));
    }

    // Get optional folder parameter
    const { folder = 'luvana' } = req.query;

    const result = await uploadBuffer(req.file.buffer, folder);

    res.json({
      message: 'Image uploaded successfully',
      image: toImagePayload(result)
    });
  } catch (error) {
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

    const rejected = req.files.find(file => !detectImageFormat(file.buffer));
    if (rejected) {
      return res.status(400).json(unsupportedFile(rejected.originalname));
    }

    const { folder = 'luvana' } = req.query;

    // Upload all files in parallel
    const images = await Promise.all(
      req.files.map(file => uploadBuffer(file.buffer, folder).then(toImagePayload))
    );

    res.json({
      message: `${images.length} images uploaded successfully`,
      images
    });
  } catch (error) {
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

    // Never delete an image a saved record still shows. Forms used to delete before
    // saving; when the save then failed, the record kept pointing at an image that no
    // longer existed, and every resized copy of it (all the storefront requests) 404'd.
    const usedBy = await findImageReferences(publicId);
    if (usedBy.length > 0) {
      return res.status(409).json({ message: 'This image is still in use, so it was not deleted.', usedBy });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    // "not found" means it is already gone, which is what the caller wants
    if (result.result === 'ok' || result.result === 'not found') {
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
  deleteImage,
  detectImageFormat
};