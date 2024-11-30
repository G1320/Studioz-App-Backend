// routes/ordersRoutes.js
import express from "express";
import { createOrder, captureOrder } from "../handlers/PPorderHandlerSDK.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { cart } = req.body;
    console.log('Received cart: ', cart);
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order", details: error.message });
}
});

router.post("/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order", details: error.message });
}
});

export default router;
