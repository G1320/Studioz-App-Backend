import { Types } from 'mongoose';

export default interface StudioItem {
    idx: number;
    itemId: Types.ObjectId;
    studioId: Types.ObjectId;
    studioName: string;
    studioImgUrl?: string;
}