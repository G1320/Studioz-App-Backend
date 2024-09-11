import mongoose, { Schema } from 'mongoose';
const studioSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: false },
    maxOccupancy: { type: Number, required: false },
    isSmokingAllowed: { type: Boolean, required: false },
    city: { type: String, required: true },
    address: { type: String, required: false },
    isWheelchairAccessible: { type: Boolean, required: false },
    coverImage: { type: String, required: false },
    galleryImages: [{ type: String, required: false }],
    galleryAudioFiles: [{ type: String, required: false }],
    coverAudioFile: { type: String, required: false },
    isSelfService: { type: Boolean, required: false },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isFeatured: { type: Boolean, required: false },
    subCategory: { type: String, required: false },
    items: [
        {
            idx: { type: Number, required: true },
            itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
            studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
            studioImgUrl: { type: String, required: false },
        },
    ],
});
const StudioModel = mongoose.models.Studio || mongoose.model('Studio', studioSchema);
export { StudioModel };
