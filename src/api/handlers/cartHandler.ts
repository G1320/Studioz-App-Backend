import { Request } from 'express';
import { UserModel } from '../../models/userModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import  getItemQuantityMap  from '../../utils/getItemQuantityMap.js';
import CartItem from '../../types/cartItem.js';


const addItemToCart = handleRequest(async (req: Request) => {
  const { userId, itemId } = req.params;
  const { bookingDate } = req.body;

  if (!userId || !itemId) throw new ExpressError('User ID or Item ID not provided', 400);
  if (!bookingDate) throw new ExpressError('Booking date is required', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  if (!user.cart || !user.cart.items) {
    user.cart = { items: [] };
  }  // Check if the item with the same itemId and bookingDate already exists in the cart
  const existingCartItem = user.cart?.items?.find(
    (cartItem: CartItem) => cartItem.itemId.toString() === itemId 
    );
    

    if (existingCartItem) {
      // If the item exists, increment the quantity
      existingCartItem.quantity = (existingCartItem.quantity || 0) + 1;
  
      // Recalculate total for the existing item based on new quantity
      existingCartItem.total = (existingCartItem.price || 0 ) * existingCartItem.quantity;
    } else {
      // If it's a new item, add it to the cart with an initial quantity of 1
      user.cart?.items?.push({
        name: item.name,
        price: item.price,
        total: item.price,  
        itemId: item._id,
        quantity: 1,
        bookingDate: bookingDate,
        studioName: item.studioName,
        studioId: item.studioId,
      });
    }
      await user.save();

  return user.cart;
});



const addItemsToCart = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const { items } = req.body;
  if (!Array.isArray(items)) throw new ExpressError('Invalid items data', 400);

  if (!user.cart) user.cart = { items: [] };

  items.forEach((item) => user.cart?.items.push(item.itemId));

  await user.save();

  return user.cart;
});


const removeItemFromCart = handleRequest(async (req: Request) => {
  const { userId, itemId } = req.params;

  if (!userId || !itemId) throw new ExpressError('User ID or Item ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  if (!user.cart) throw new ExpressError('Cart is empty', 404);

  // Find the index of the item in the cart using string comparison
  const itemIndex = user.cart.items.findIndex((cartItem: CartItem) => cartItem.itemId.toString() === itemId);

  if (itemIndex === -1) throw new ExpressError('Item not found in the cart', 404);

  const cartItem: CartItem = user.cart.items[itemIndex];

  if (cartItem.quantity && cartItem.quantity > 1) {
    // Decrease the quantity by 1
    cartItem.quantity -= 1;
    // Recalculate total for the existing item based on new quantity
    cartItem.total = (cartItem.price || 0) * cartItem.quantity;
  } else {
    // If quantity is 1, remove the item from the cart
    user.cart.items.splice(itemIndex, 1);
  }

  await user.save();

  return user.cart;
});



const removeItemsFromCart = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const { items } = req.body;
  if (!Array.isArray(items)) throw new ExpressError('Invalid items data', 400);

  if (!user.cart) user.cart = { items: [] };

  const quantityMap = getItemQuantityMap(user.cart.items.map((cartItem:CartItem) => cartItem.itemId.toString()));

  items.forEach((itemId) => {
    if (!user.cart?.items.some((cartItem:CartItem) => cartItem.itemId === itemId)) {
      throw new ExpressError(`Item ${itemId} not found in the cart`, 404);
    }

    const itemIndex = user.cart.items.findIndex((cartItem:CartItem) => cartItem.itemId === itemId);
    if (itemIndex === -1) throw new ExpressError(`Item ${itemId} not found in the cart`, 404);

    const currentItemQuantity = quantityMap.get(itemId) || 0;
    
    if (typeof currentItemQuantity === 'number' && currentItemQuantity > 1) {
      user.cart.items.splice(itemIndex, 1); 
    } else {
      user.cart.items.splice(itemIndex, 1);
    }
  });

  await user.save();

  return items;
});

const getUserCart = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  if (!user.cart) user.cart = { items: [] };;

  return user.cart;
});

const deleteUserCart = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);


  user.cart = { items: [] };;
  await user.save();

  return ;
});

const updateUserCart = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const { cart } = req.body;
  if (!Array.isArray(cart.items)) throw new ExpressError('Invalid cart data', 400);
  if (!user.cart) user.cart = { items: [] };
  
  user.cart = {
    items: cart.items, 
  };  await user.save();

  return user.cart;
});

const checkout = handleRequest(async (req: Request) => {});

export default {
  addItemToCart,
  addItemsToCart,
  removeItemFromCart,
  removeItemsFromCart,
  getUserCart,
  deleteUserCart,
  updateUserCart,
  checkout,
};
