import mongoose, { Schema } from 'mongoose';
const itemSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: false },
    category: { type: String, required: false },
    subcategory: { type: String, required: false },
    price: { type: Number, required: false },
    imgUrl: { type: String, required: false },
    idx: { type: Number, required: false },
    inStock: { type: Boolean, required: true },
    studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
    studioName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
const ItemModel = mongoose.models.Item || mongoose.model('Item', itemSchema);
export { ItemModel };
