export default interface StudioItem {
  idx: number;
  itemId: string;
  studioId: string;
  studioName:{
    en: string;
    he?: string;
  }
  studioImgUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
  sellerId?: string;
  active?: boolean;
}
