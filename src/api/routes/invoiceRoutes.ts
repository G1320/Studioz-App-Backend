// routes/invoiceRoutes.ts
import express from 'express';
import { createInvoice, getInvoice, CreateInvoiceData, fetchToken } from '../handlers/invoiceHandler.js';
import { InvoiceModel } from '../../models/invoiceModel.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, provider } = req.query;
    const query: any = {};
    if (provider) query.provider = provider;

    const invoices = await InvoiceModel.find(query)
      .sort({ issuedDate: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
      
    const total = await InvoiceModel.countDocuments(query);

    res.status(200).json({
        data: invoices,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

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
