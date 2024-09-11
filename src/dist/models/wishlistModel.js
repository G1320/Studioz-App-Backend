import mongoose, { Schema } from 'mongoose';
const wishlistSchema = new Schema({
    name: { type: String, required: true },
    studios: [{ type: Schema.Types.ObjectId, ref: 'Studio' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [
        {
            idx: { type: Number, required: true },
            itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
        },
    ],
}, { timestamps: true });
const WishlistModel = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
export { WishlistModel };
