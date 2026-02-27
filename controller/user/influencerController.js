const Influencer = require('../../model/influencerModel');

// Get all active influencers for users
const getInfluencers = async (req, res) => {
  try {
    const influencers = await Influencer.find({ status: 'active' })
      .populate('product', 'nameEnglish nameArabic imageUrlEnglish imageUrlArabic')
      .populate('variant', 'nameEnglish nameArabic color price mrp imageUrlEnglish imageUrlArabic')
      .sort({ sortOrder: 1 })
      .select('titleEnglish titleArabic product variant videoUrl');

    res.json({
      influencers
    });
  } catch (error) {
    console.error('Get influencers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getInfluencers
};
