const PromotionStrip = require('../../model/promotionStripModel');

// Get all promotion strips
const getAllPromotionStrips = async (req, res) => {
  try {
    const promotionStrips = await PromotionStrip.find({ status: 'active' }).sort({ sortOrder: 1 });
    res.json(promotionStrips);
  } catch (error) {
    console.error('Get promotion strips error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get promotion strip by ID
const getPromotionStripById = async (req, res) => {
  try {
    const { id } = req.params;
    const promotionStrip = await PromotionStrip.findById(id);
    if (!promotionStrip) {
      return res.status(404).json({ message: 'Promotion strip not found' });
    }
    res.json(promotionStrip);
  } catch (error) {
    console.error('Get promotion strip error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new promotion strip
const createPromotionStrip = async (req, res) => {
  try {
    const { name, contentEnglish, contentArabic, sortOrder, status } = req.body;

    const newPromotionStrip = new PromotionStrip({
      name,
      contentEnglish,
      contentArabic,
      sortOrder,
      status: status || 'active'
    });

    const savedPromotionStrip = await newPromotionStrip.save();
    res.status(201).json(savedPromotionStrip);
  } catch (error) {
    console.error('Create promotion strip error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update promotion strip
const updatePromotionStrip = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedPromotionStrip = await PromotionStrip.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedPromotionStrip) {
      return res.status(404).json({ message: 'Promotion strip not found' });
    }
    res.json(updatedPromotionStrip);
  } catch (error) {
    console.error('Update promotion strip error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete promotion strip (soft delete by setting status to inactive)
const deletePromotionStrip = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPromotionStrip = await PromotionStrip.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedPromotionStrip) {
      return res.status(404).json({ message: 'Promotion strip not found' });
    }
    res.json({ message: 'Promotion strip deleted successfully' });
  } catch (error) {
    console.error('Delete promotion strip error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllPromotionStrips,
  getPromotionStripById,
  createPromotionStrip,
  updatePromotionStrip,
  deletePromotionStrip
};