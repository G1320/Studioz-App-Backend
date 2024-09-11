import mongoose, { Schema } from 'mongoose';
const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, required: true },
    avatar: { type: String },
    password: { type: String, select: false },
    picture: { type: String },
    sub: { type: String, required: true, unique: true },
    updatedAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    studios: [{ type: Schema.Types.ObjectId, ref: 'Studio' }],
    wishlists: [{ type: Schema.Types.ObjectId, ref: 'Wishlist' }],
    cart: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
}, { timestamps: true });
const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export { UserModel };
