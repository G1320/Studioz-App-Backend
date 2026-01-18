import { InvoiceModel } from '../models/invoiceModel.js';

export const saveSumitInvoice = async (
  sumitData: any,
  context?: {
    customerName?: string;
    customerEmail?: string;
    description?: string;
    relatedEntity?: { type: 'ORDER' | 'SUBSCRIPTION' | 'RESERVATION' | 'PAYOUT'; id: any };
  }
) => {
  try {
     // Handle structure variations: sometimes it's passed as the whole Data object, sometimes just Payment
     const payment = sumitData.Payment || sumitData;
     
     if (!payment || !payment.ValidPayment) return;

     // Avoid duplicate saving if we already have this externalId
     const exists = await InvoiceModel.findOne({ externalId: payment.ID });
     if (exists) return;

     // DocumentDownloadURL is at the Data level per Sumit API docs
     const documentUrl = sumitData.DocumentDownloadURL || payment.DocumentURL || undefined;

     await InvoiceModel.create({
        externalId: payment.ID,
        provider: 'SUMIT',
        documentType: 'invoice_receipt', // Sumit usually sends Invoice Receipt
        amount: payment.Amount,
        currency: payment.Currency || 'ILS',
        issuedDate: new Date(),
        customerName: context?.customerName || payment.Customer?.Name,
        customerEmail: context?.customerEmail || payment.Customer?.EmailAddress,
        documentUrl,
        documentNumber: sumitData.DocumentNumber || undefined,
        relatedEntity: context?.relatedEntity,
        status: 'SENT',
        rawData: sumitData
     });
     
     console.log(`Saved Sumit invoice: ${payment.ID}, Document: ${sumitData.DocumentNumber || 'N/A'}`);
  } catch (error) {
    console.error('Failed to save Sumit invoice:', error);
  }
};
