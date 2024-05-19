const mongoose = require('mongoose');

const studioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: false },
  maxOccupancy: { type: Number, required: false },
  isSmokingAllowed: { type: Boolean, required: false },
  city: { type: String, required: true },
  address: { type: String, required: false },
  isWheelchairAccessible: { type: Boolean, required: false },
  imgUrl: { type: String, required: false },
  isSelfService: { type: Boolean, required: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  isFeatured: { type: Boolean, required: false },
  category: { type: String, required: false },
  subCategory: { type: String, required: false },

  items: [
    {
      idx: { type: Number, required: true },
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'item' },
      studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'studio' },
      studioImgUrl: { type: String, required: false },
    },
  ],
});

const StudioModel = mongoose.model('studio', studioSchema);

module.exports = { StudioModel };
