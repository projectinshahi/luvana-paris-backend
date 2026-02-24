const PromotionStrip = require('../../model/promotionStripModel');

// Get all active promotion strips for users
const getActivePromotionStrips = async (req, res) => {
  try {
    const promotionStrips = await PromotionStrip.find({ status: 'active' })
      .select('name contentEnglish contentArabic sortOrder')
      .sort({ sortOrder: 1 });
    
    res.json({
      success: true,
      data: promotionStrips
    });
  } catch (error) {
    console.error('Get active promotion strips error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

module.exports = {
  getActivePromotionStrips
};
