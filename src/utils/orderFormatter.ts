// utils/orderFormatter.ts
interface FormattedOrderDetails {
    id: string;
    customerName: string;
    orderDate: string;
    paymentStatus: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    total: number;
  }
  
  export const formatOrderDetails = (orderData: any): FormattedOrderDetails => {
    const items = orderData.purchase_units[0].items.map((item: any) => ({
      name: item.name,
      quantity: parseInt(item.quantity),
      price: parseFloat(item.unit_amount.value),
      total: parseFloat(item.unit_amount.value) * parseInt(item.quantity)
    }));
  
    return {
      id: orderData.id,
      items: items,
      total: parseFloat(orderData.purchase_units[0].amount.value),
      customerName: orderData.payer.name.given_name,
      orderDate: new Date(orderData.create_time).toLocaleDateString('he-IL'),
      paymentStatus: orderData.status
    };
  };