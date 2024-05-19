const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, required: true },
    avatar: { type: String }, // URL to user's avatar
    password: { type: String, select: false },
    picture: { type: String },
    sub: { type: String, required: true, unique: true },
    updated_at: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    studios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'studio' }],
    wishlists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'wishlist' }], // Array of wishlist references
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'item' }], // Array of item references
  },
  { timestamps: true }
);

const UserModel = mongoose.model('user', userSchema);

module.exports = { UserModel };
