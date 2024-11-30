// routes/ordersRoutes.js
import express from "express";
import { createOrder, capturePayment } from "../handlers/PPorderHandlerAPI.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { cart } = req.body;
    const jsonResponse = await createOrder(cart);
    res.status(200).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order", details: error.message });
}
});

router.post("/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    console.log('orderID: ', orderID);
    const  jsonResponse  = await capturePayment(orderID);
    res.status(200).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order", details: error.message });
}
});

export default router;
