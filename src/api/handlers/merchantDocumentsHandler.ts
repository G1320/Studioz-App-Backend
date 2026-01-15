import { Request } from 'express';
import { InvoiceModel, IInvoice } from '../../models/invoiceModel.js';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

type DocStatus = 'paid' | 'pending' | 'overdue' | 'draft';
type DocType = 'invoice' | 'credit_note' | 'receipt' | 'contract';

interface MerchantDocument {
  id: string;
  externalId: string;
  number: string;
  type: DocType;
  studioId?: string;
  studioName: string;
  amount: number;
  currency: string;
  date: string;
  dueDate: string;
  status: DocStatus;
  customerName: string;
  customerEmail?: string;
  documentUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

interface DocumentsStats {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  totalDocs: number;
}

interface MerchantDocumentsResponse {
  documents: MerchantDocument[];
  stats: DocumentsStats;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// --- Date utility functions (replacing dayjs) ---

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Map Green Invoice document type codes to readable types
 */
function mapDocumentType(typeCode: string): DocType {
  const typeMap: Record<string, DocType> = {
    '300': 'invoice',      // Invoice + Receipt
    '305': 'invoice',      // Tax Invoice
    '320': 'receipt',      // Receipt
    '330': 'credit_note',  // Credit Note
    '400': 'contract'      // Quote/Contract
  };
  return typeMap[typeCode] || 'invoice';
}

/**
 * Map invoice status to document status
 */
function mapDocumentStatus(invoice: IInvoice): DocStatus {
  const status = invoice.status?.toLowerCase();
  const rawData = invoice.rawData;

  // Check if paid from rawData
  if (rawData?.payment?.length > 0 || status === 'paid' || status === 'closed') {
    return 'paid';
  }

  // Check if draft
  if (status === 'draft' || status === 'open') {
    return 'draft';
  }

  // Check if overdue
  if (invoice.issuedDate) {
    const dueDate = addDays(new Date(invoice.issuedDate), 14); // Default 14 days payment terms
    if (new Date() > dueDate && status !== 'paid') {
      return 'overdue';
    }
  }

  return 'pending';
}

/**
 * Generate document number from invoice data
 */
function generateDocNumber(invoice: IInvoice): string {
  const type = mapDocumentType(invoice.documentType);
  const prefix = type === 'invoice' ? 'INV' : type === 'receipt' ? 'REC' : type === 'credit_note' ? 'CN' : 'CTR';

  // Use external ID or generate from date
  if (invoice.rawData?.number) {
    return invoice.rawData.number;
  }

  const year = invoice.issuedDate ? new Date(invoice.issuedDate).getFullYear() : new Date().getFullYear();
  const seq = invoice.externalId?.slice(-4) || '0001';

  return `${prefix}-${year}-${seq}`;
}

/**
 * Get merchant documents (invoices) for dashboard
 */
export const getMerchantDocuments = handleRequest(async (req: Request): Promise<MerchantDocumentsResponse> => {
  const userId = req.query.userId as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as string;
  const studioId = req.query.studioId as string;
  const search = req.query.search as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  // Get user's studios
  const userStudios = await StudioModel.find({ createdBy: userId });

  if (userStudios.length === 0) {
    return {
      documents: [],
      stats: { totalRevenue: 0, pendingAmount: 0, overdueAmount: 0, totalDocs: 0 },
      pagination: { total: 0, page, limit, pages: 0 }
    };
  }

  const studioIds = userStudios.map(s => s._id);

  // Find reservations for these studios to get related order IDs
  const studioReservations = await ReservationModel.find({
    studioId: { $in: studioIds },
    orderId: { $exists: true, $ne: null }
  }).select('orderId studioId studioName');

  const orderIds = studioReservations.map(r => r.orderId).filter(Boolean);
  const reservationStudioMap = new Map(
    studioReservations.map(r => [r.orderId, { studioId: r.studioId?.toString(), studioName: r.studioName }])
  );

  // Build query for invoices
  // Include invoices related to orders OR invoices created by user directly
  const studioNames = userStudios.map(s =>
    typeof s.name === 'object' ? (s.name.he || s.name.en) : s.name
  ).filter(Boolean);

  const queryConditions: any[] = [];

  // Add order-related conditions if there are orders
  if (orderIds.length > 0) {
    queryConditions.push(
      { 'relatedEntity.type': 'PAYOUT', 'rawData.description': { $regex: new RegExp(orderIds.join('|'), 'i') } },
      { 'relatedEntity.type': 'ORDER', 'relatedEntity.id': { $in: orderIds } },
      { 'rawData.remarks': { $regex: new RegExp(orderIds.join('|'), 'i') } }
    );
  }

  // Also include invoices that don't have a related entity (manually created)
  // These are identified by having no relatedEntity or by matching studio names
  queryConditions.push(
    { relatedEntity: { $exists: false } },
    { 'relatedEntity.type': { $exists: false } }
  );

  const query: any = {
    $or: queryConditions
  };

  // Date range filter
  if (startDate || endDate) {
    query.issuedDate = {};
    if (startDate) {
      query.issuedDate.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of day (23:59:59.999) to include all invoices from that day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.issuedDate.$lte = endOfDay;
    }
  }

  // Get all invoices first for stats calculation
  const allInvoices = await InvoiceModel.find(query).sort({ issuedDate: -1 });

  // Default studio info for invoices without a related order
  const defaultStudio = userStudios[0];
  const defaultStudioName = defaultStudio
    ? (typeof defaultStudio.name === 'object'
        ? ((defaultStudio.name as any).he || (defaultStudio.name as any).en || 'Studio')
        : (defaultStudio.name || 'Studio'))
    : 'Studio';
  const defaultStudioId = defaultStudio?._id?.toString();

  // Map to merchant documents
  let merchantDocuments: MerchantDocument[] = allInvoices.map(invoice => {
    // Try to find related studio from reservation
    let studioInfo = { studioId: defaultStudioId, studioName: defaultStudioName };

    // Check rawData for order ID
    const remarks = invoice.rawData?.remarks || '';
    const description = invoice.rawData?.income?.[0]?.description || '';

    for (const [orderId, info] of reservationStudioMap.entries()) {
      if (orderId && (remarks.includes(orderId) || description.includes(orderId))) {
        studioInfo = {
          studioId: info.studioId,
          studioName: typeof info.studioName === 'object'
            ? ((info.studioName as any).he || (info.studioName as any).en || defaultStudioName)
            : (info.studioName || defaultStudioName)
        };
        break;
      }
    }

    const docStatus = mapDocumentStatus(invoice);
    const issuedDate = invoice.issuedDate || new Date();
    const dueDate = addDays(new Date(issuedDate), 14);

    return {
      id: (invoice._id as any).toString(),
      externalId: invoice.externalId,
      number: generateDocNumber(invoice),
      type: mapDocumentType(invoice.documentType),
      studioId: studioInfo.studioId,
      studioName: studioInfo.studioName,
      amount: invoice.amount || 0,
      currency: invoice.currency || 'ILS',
      date: formatDateYYYYMMDD(new Date(issuedDate)),
      dueDate: formatDateYYYYMMDD(dueDate),
      status: docStatus,
      customerName: invoice.customerName || 'Unknown',
      customerEmail: invoice.customerEmail,
      documentUrl: invoice.documentUrl,
      relatedEntityType: invoice.relatedEntity?.type,
      relatedEntityId: invoice.relatedEntity?.id?.toString()
    };
  });

  // Apply filters
  if (status && status !== 'all') {
    merchantDocuments = merchantDocuments.filter(d => d.status === status);
  }

  if (studioId && studioId !== 'all') {
    merchantDocuments = merchantDocuments.filter(d => d.studioId === studioId);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    merchantDocuments = merchantDocuments.filter(d =>
      d.number.toLowerCase().includes(searchLower) ||
      d.customerName.toLowerCase().includes(searchLower) ||
      d.studioName.toLowerCase().includes(searchLower)
    );
  }

  // Calculate stats from all documents (before pagination)
  const stats: DocumentsStats = {
    totalRevenue: merchantDocuments.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0),
    pendingAmount: merchantDocuments.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0),
    overdueAmount: merchantDocuments.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.amount, 0),
    totalDocs: merchantDocuments.length
  };

  // Pagination
  const total = merchantDocuments.length;
  const pages = Math.ceil(total / limit);
  const paginatedDocs = merchantDocuments.slice((page - 1) * limit, page * limit);

  return {
    documents: paginatedDocs,
    stats,
    pagination: { total, page, limit, pages }
  };
});

/**
 * Get a single document by ID
 */
export const getMerchantDocument = handleRequest(async (req: Request) => {
  const { id } = req.params;

  if (!id) {
    throw new ExpressError('Document ID is required', 400);
  }

  const invoice = await InvoiceModel.findById(id);

  if (!invoice) {
    throw new ExpressError('Document not found', 404);
  }

  const docStatus = mapDocumentStatus(invoice);
  const issuedDate = invoice.issuedDate || new Date();
  const dueDate = addDays(new Date(issuedDate), 14);

  return {
    id: (invoice._id as any).toString(),
    externalId: invoice.externalId,
    number: generateDocNumber(invoice),
    type: mapDocumentType(invoice.documentType),
    amount: invoice.amount || 0,
    currency: invoice.currency || 'ILS',
    date: formatDateYYYYMMDD(new Date(issuedDate)),
    dueDate: formatDateYYYYMMDD(dueDate),
    status: docStatus,
    customerName: invoice.customerName || 'Unknown',
    customerEmail: invoice.customerEmail,
    documentUrl: invoice.documentUrl,
    relatedEntityType: invoice.relatedEntity?.type,
    relatedEntityId: invoice.relatedEntity?.id?.toString(),
    rawData: invoice.rawData
  };
});
