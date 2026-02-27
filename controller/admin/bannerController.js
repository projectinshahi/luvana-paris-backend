const Banner = require('../../model/bannerModel');

// Get all banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ sortOrder: 1 });
    res.json(banners);
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get banner by ID
const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json(banner);
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new banner
const createBanner = async (req, res) => {
  try {
    const { name, titleEnglish, titleArabic, descriptionEnglish, descriptionArabic, imageUrlEnglish, imageUrlArabic, sortOrder, status } = req.body;

    const newBanner = new Banner({
      name,
      titleEnglish,
      titleArabic,
      descriptionEnglish,
      descriptionArabic,
      imageUrlEnglish,
      imageUrlArabic,
      sortOrder,
      status: status || 'active'
    });

    const savedBanner = await newBanner.save();
    res.status(201).json(savedBanner);
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update banner
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedBanner = await Banner.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedBanner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json(updatedBanner);
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete banner (soft delete by setting status to inactive)
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBanner = await Banner.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedBanner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner
};