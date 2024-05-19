const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  studio: { type: mongoose.Schema.Types.ObjectId, ref: 'studio' },
  name: { type: String, required: true },
  description: { type: String, required: false },
  category: { type: String, required: false },
  subcategory: { type: String, required: false },
  price: { type: Number, required: false },
  imgUrl: { type: String, required: false },
  idx: { type: Number, required: false },
  inStock: { type: Boolean, required: true },
  studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'studio' },
  studioName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ItemModel = mongoose.model('item', itemSchema);

module.exports = { ItemModel };
