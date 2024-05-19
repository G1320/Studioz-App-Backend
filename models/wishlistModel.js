const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    studios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'studio' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    items: [
      {
        idx: { type: Number, required: true },
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'item' },
      },
    ],
  },
  { timestamps: true }
);

const WishlistModel = mongoose.model('wishlist', wishlistSchema);

module.exports = { WishlistModel };
