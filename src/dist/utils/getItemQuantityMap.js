const getItemQuantityMap = (cart) => {
    const quantityMap = new Map();
    cart.forEach((itemId) => {
        const id = itemId.toString();
        quantityMap.set(id, (quantityMap.get(id) || 0) + 1);
    });
    return quantityMap;
};
export default getItemQuantityMap;
