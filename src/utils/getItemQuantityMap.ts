
const getItemQuantityMap = (cart: string[]): Map<string, number> => {
  const quantityMap = new Map<string, number>();
  cart.forEach((itemId) => {
    const id = itemId.toString();
    quantityMap.set(id, (quantityMap.get(id) || 0) + 1);
  });
  return quantityMap;
};

export default getItemQuantityMap;