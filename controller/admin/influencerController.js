const Influencer = require('../../model/influencerModel');

// Get all influencers
const getAllInfluencers = async (req, res) => {
  try {
    const influencers = await Influencer.find()
      .populate('product', 'nameEnglish nameArabic')
      .populate('variant', 'nameEnglish nameArabic color')
      .sort({ sortOrder: 1 });
    res.json(influencers);
  } catch (error) {
    console.error('Get influencers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get influencer by ID
const getInfluencerById = async (req, res) => {
  try {
    const { id } = req.params;
    const influencer = await Influencer.findById(id)
      .populate('product', 'nameEnglish nameArabic')
      .populate('variant', 'nameEnglish nameArabic color');
    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }
    res.json(influencer);
  } catch (error) {
    console.error('Get influencer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new influencer
const createInfluencer = async (req, res) => {
  try {
    const { 
      titleEnglish, 
      titleArabic, 
      product, 
      variant, 
      videoUrl, 
      sortOrder, 
      status 
    } = req.body;

    // Validation
    if (!titleEnglish || !titleArabic || !videoUrl) {
      return res.status(400).json({ 
        message: 'Required fields: titleEnglish, titleArabic, videoUrl' 
      });
    }

    const newInfluencer = new Influencer({
      titleEnglish,
      titleArabic,
      product,
      variant,
      videoUrl,
      sortOrder: sortOrder || 0,
      status: status || 'active'
    });

    const savedInfluencer = await newInfluencer.save();
    const populatedInfluencer = await Influencer.findById(savedInfluencer._id)
      .populate('product', 'nameEnglish nameArabic')
      .populate('variant', 'nameEnglish nameArabic color');
    res.status(201).json(populatedInfluencer);
  } catch (error) {
    console.error('Create influencer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update influencer
const updateInfluencer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedInfluencer = await Influencer.findByIdAndUpdate(id, updates, { new: true })
      .populate('product', 'nameEnglish nameArabic')
      .populate('variant', 'nameEnglish nameArabic color');
    if (!updatedInfluencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }
    res.json(updatedInfluencer);
  } catch (error) {
    console.error('Update influencer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete influencer (soft delete by setting status to inactive)
const deleteInfluencer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedInfluencer = await Influencer.findByIdAndUpdate(
      id, 
      { status: 'inactive' }, 
      { new: true }
    );
    if (!deletedInfluencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }
    res.json({ message: 'Influencer deleted successfully' });
  } catch (error) {
    console.error('Delete influencer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllInfluencers,
  getInfluencerById,
  createInfluencer,
  updateInfluencer,
  deleteInfluencer
};
