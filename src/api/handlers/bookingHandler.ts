import { Request } from 'express';

// import { BookingModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

const createBooking = handleRequest(async (req: Request) => {
    // const item = new ItemModel(req.body);
    
    // await item.save();
    
    const userId = req.params.userId;
    console.log('studioId: ', userId);

    const itemId = req.body
    console.log('itemId: ', itemId);
    // if (!studioId) throw new ExpressError('studio ID not provided', 400);
    
    // const itemId = item._id;
    // if (!itemId) throw new ExpressError('item ID not provided', 400);
    
    // const studio = await StudioModel.findById(studioId);
    // if (!studio) throw new ExpressError('studio not found', 404);
    // if (!studio.items) studio.items = [];
    
    // if (!item) throw new ExpressError('item not found', 404);
    
    // item.updatedAt = new Date();
    
    // if (!item.studioId) item.studioId = studioId;
    // if (studio.coverImage) item.studioImgUrl = studio.coverImage;
    
    // await item.save();
    
    // if (studio.items.length > 31) throw new ExpressError('Oops, Studio is full!', 400);
    // if (studio.items.some((studioItem: StudioItem) => studioItem.itemId.toString() === item._id.toString())) {
    //     throw new ExpressError('Studio already includes this item!', 400);
    // }
    
    // studio.items.push({
    //     idx: studio.items.length,
    //     itemId: item._id,
    //     studioId,
    //     studioName: item.studioName
    // });
    // await studio.save();
    
    // return item;
}
)

export default {
    createBooking,
}