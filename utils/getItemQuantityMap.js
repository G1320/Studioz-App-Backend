const getItemQuantityMap = (cartItems) => {
  return cartItems?.reduce((map, item) => {
    map.set(item._id, map.has(item._id) ? map.get(item._id) + 1 : 1);
    return map;
  }, new Map());
};

module.exports = getItemQuantityMap;
