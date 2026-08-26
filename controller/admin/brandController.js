const Brand = require('../../model/brandModel');

// Get all brands
const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json(brands);
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get brand by ID
const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.json(brand);
  } catch (error) {
    console.error('Get brand error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new brand
const createBrand = async (req, res) => {
  try {
    const { 
      nameEnglish, 
      nameArabic, 
      descriptionEnglish, 
      descriptionArabic, 
      logoUrlEnglish, 
      logoUrlArabic,
      logoPublicIdEnglish,
      logoPublicIdArabic,
      brandImageEnglish,
      brandMobileImageEnglish,
      brandImageArabic,
      brandMobileImageArabic,
      brandImagePublicIdEnglish,
      brandMobileImagePublicIdEnglish,
      brandImagePublicIdArabic,
      brandMobileImagePublicIdArabic,
      status 
    } = req.body;

    const newBrand = new Brand({
      nameEnglish,
      nameArabic,
      descriptionEnglish,
      descriptionArabic,
      logoUrlEnglish,
      logoUrlArabic,
      logoPublicIdEnglish,
      logoPublicIdArabic,
      brandImageEnglish,
      brandMobileImageEnglish,
      brandImageArabic,
      brandMobileImageArabic,
      brandImagePublicIdEnglish,
      brandMobileImagePublicIdEnglish,
      brandImagePublicIdArabic,
      brandMobileImagePublicIdArabic,
      status: status || 'active'
    });

    const savedBrand = await newBrand.save();
    res.status(201).json(savedBrand);
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update brand
const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedBrand = await Brand.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedBrand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.json(updatedBrand);
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete brand (soft delete by setting status to inactive)
const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBrand = await Brand.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
};