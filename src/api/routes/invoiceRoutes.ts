// routes/invoiceRoutes.ts
import express from 'express';
import { createInvoice, getInvoice, CreateInvoiceData, fetchToken } from '../handlers/invoiceHandler.js';

const router = express.Router();

router.get('/token', async (req, res) => {
    try {
      const token = await fetchToken();
      console.log('token: ', token);
      res.status(200).json({ token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

router.post('/create', async (req, res) => {
  try {
    const invoiceData: CreateInvoiceData = req.body;
    const invoice = await createInvoice(invoiceData);
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoiceId: string = req.params.id;
    const invoice = await getInvoice(invoiceId);
    res.status(200).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
