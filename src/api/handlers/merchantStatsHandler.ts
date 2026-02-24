import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { UserModel } from '../../models/userModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

interface TopClient {
  id: string;
  name: string;
  totalSpent: number;
  bookingsCount: number;
  lastVisit: string;
  avatarUrl?: string;
}

interface StudioOccupancy {
  studioId: string;
  name: string;
  occupancy: number;
}

interface MerchantStatsResponse {
  totalRevenue: number;
  revenueNet: number;
  totalCouponDiscounts: number;
  conversionRate: number;
  totalBookings: number;
  avgPerBooking: number;
  newClients: number;
  trends: {
    totalRevenue: string;
    totalBookings: string;
    avgPerBooking: string;
    newClients: string;
  };
  isPositive: {
    totalRevenue: boolean;
    totalBookings: boolean;
    avgPerBooking: boolean;
    newClients: boolean;
  };
  quickStats: {
    avgSessionTime: number;
    occupancy: number;
    studios: StudioOccupancy[];
  };
  topClients: TopClient[];
  revenueByPeriod: {
    monthly: number[];
    weekly: number[];
    daily: number[];
  };
}

// --- Date utility functions (replacing dayjs) ---

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfHour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
}

function endOfHour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 59, 59, 999);
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function subtractHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() - hours);
  return result;
}

function diffInDays(date1: Date, date2: Date): number {
  const diffTime = date1.getTime() - date2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function parseBookingDate(dateStr: string): Date {
  // Parse DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get merchant statistics for dashboard
 * Aggregates reservation data for the user's studios
 */
export const getMerchantStats = handleRequest(async (req: Request): Promise<MerchantStatsResponse> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  // Get user's studios
  const userStudios = await StudioModel.find({ createdBy: userId });

  if (userStudios.length === 0) {
    // Return empty stats if user has no studios
    return getEmptyStats();
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);

  // Date ranges - use provided dates or default to current/previous month
  const now = new Date();
  
  // If date range is provided, use it for "current period"
  const currentPeriodStart = startDateParam 
    ? startOfDay(new Date(startDateParam))
    : startOfMonth(now);
  const currentPeriodEnd = endDateParam 
    ? endOfDay(new Date(endDateParam))
    : endOfDay(now);
  
  // Calculate the previous period with same duration for comparison
  const periodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
  const prevPeriodEnd = new Date(currentPeriodStart.getTime() - 1); // Day before current period starts
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  // Get all reservations for user's studios
  const allReservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ]
  }).sort({ createdAt: -1 });

  // Filter by time periods
  const getTimestamp = (res: any): Date => {
    if (res.createdAt) return new Date(res.createdAt);
    return parseBookingDate(res.bookingDate);
  };

  const thisMonthReservations = allReservations.filter(res => {
    const ts = getTimestamp(res);
    return ts >= currentPeriodStart && ts <= currentPeriodEnd;
  });

  const lastMonthReservations = allReservations.filter(res => {
    const ts = getTimestamp(res);
    return ts >= prevPeriodStart && ts <= prevPeriodEnd;
  });

  // Calculate metrics for a set of reservations
  const calculateMetrics = (resList: typeof allReservations) => {
    const totalRevenue = resList.reduce((sum, res) => sum + (res.totalPrice || 0), 0);

    const confirmedReservations = resList.filter(res => res.status === 'confirmed');
    const confirmedRevenue = confirmedReservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    const confirmedCount = confirmedReservations.length;

    const avgPerBooking = confirmedCount > 0 ? Math.round(confirmedRevenue / confirmedCount) : 0;

    const uniqueCustomers = new Set(
      resList.map(res => (res.customerId || res.userId)?.toString()).filter(Boolean)
    ).size;

    return { totalRevenue, totalBookings: resList.length, avgPerBooking, newClients: uniqueCustomers };
  };

  const currentMetrics = calculateMetrics(thisMonthReservations);
  const prevMetrics = calculateMetrics(lastMonthReservations);

  // Calculate trends
  const calculateTrend = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff > 0 ? '+' : ''}${Math.round(diff)}%`;
  };

  const trends = {
    totalRevenue: calculateTrend(currentMetrics.totalRevenue, prevMetrics.totalRevenue),
    totalBookings: calculateTrend(currentMetrics.totalBookings, prevMetrics.totalBookings),
    avgPerBooking: calculateTrend(currentMetrics.avgPerBooking, prevMetrics.avgPerBooking),
    newClients: calculateTrend(currentMetrics.newClients, prevMetrics.newClients)
  };

  const isPositive = {
    totalRevenue: currentMetrics.totalRevenue >= prevMetrics.totalRevenue,
    totalBookings: currentMetrics.totalBookings >= prevMetrics.totalBookings,
    avgPerBooking: currentMetrics.avgPerBooking >= prevMetrics.avgPerBooking,
    newClients: currentMetrics.newClients >= prevMetrics.newClients
  };

  // Quick stats calculations
  const totalDuration = thisMonthReservations.reduce((acc, res) => {
    return acc + (res.timeSlots?.length || 0);
  }, 0);

  const avgSessionTime = thisMonthReservations.length > 0
    ? Math.round((totalDuration / thisMonthReservations.length) * 10) / 10
    : 0;

  // Occupancy calculation (12 operational hours * 30 days)
  const operationalHoursPerMonth = 12 * 30;
  const totalCapacity = userStudios.length * operationalHoursPerMonth;
  const occupancy = totalCapacity > 0 ? Math.round((totalDuration / totalCapacity) * 100) : 0;

  // Per-studio occupancy
  const studioOccupancy: StudioOccupancy[] = userStudios.slice(0, 3).map(studio => {
    const studioItemIds = studio.items?.map(i => i.itemId.toString()) || [];
    const studioRes = thisMonthReservations.filter(r =>
      r.studioId?.toString() === studio._id.toString() ||
      studioItemIds.includes(r.itemId?.toString())
    );
    const studioDuration = studioRes.reduce((acc, r) => acc + (r.timeSlots?.length || 0), 0);

    return {
      studioId: studio._id.toString(),
      name: typeof studio.name === 'object' ? (studio.name.he || studio.name.en || '') : studio.name,
      occupancy: operationalHoursPerMonth > 0 ? Math.round((studioDuration / operationalHoursPerMonth) * 100) : 0
    };
  });

  // Top clients calculation
  const clientMap = new Map<string, {
    totalSpent: number;
    bookingsCount: number;
    lastVisit: Date;
    name?: string;
  }>();

  for (const res of allReservations) {
    const clientId = (res.customerId || res.userId)?.toString();
    if (!clientId) continue;

    const existing = clientMap.get(clientId) || {
      totalSpent: 0,
      bookingsCount: 0,
      lastVisit: new Date(0),
      name: res.customerName
    };

    existing.totalSpent += res.totalPrice || 0;
    existing.bookingsCount += 1;

    const resDate = res.createdAt ? new Date(res.createdAt) : parseBookingDate(res.bookingDate);
    if (resDate > existing.lastVisit) {
      existing.lastVisit = resDate;
      if (res.customerName) existing.name = res.customerName;
    }

    clientMap.set(clientId, existing);
  }

  // Sort by total spent and get top 5
  const sortedClients = Array.from(clientMap.entries())
    .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
    .slice(0, 5);

  // Fetch user details for top clients
  const topClientIds = sortedClients.map(([id]) => id);
  const clientUsers = await UserModel.find({ _id: { $in: topClientIds } }).select('name picture avatar');
  const userMap = new Map(clientUsers.map(u => [u._id.toString(), u]));

  const topClients: TopClient[] = sortedClients.map(([id, data]) => {
    const user = userMap.get(id);
    return {
      id,
      name: user?.name || data.name || 'Unknown',
      totalSpent: data.totalSpent,
      bookingsCount: data.bookingsCount,
      lastVisit: formatLastVisit(data.lastVisit),
      avatarUrl: (user as any)?.picture || (user as any)?.avatar
    };
  });

  // Revenue by period (for charts)
  const revenueByPeriod = calculateRevenueByPeriod(allReservations, now);

  // Net revenue and coupon totals (current period)
  const totalCouponDiscounts = thisMonthReservations.reduce(
    (sum, r) => sum + (r.couponDiscount || 0),
    0
  );
  const revenueNet = currentMetrics.totalRevenue - totalCouponDiscounts;

  // Conversion rate: confirmed / (confirmed + cancelled)
  const confirmedCount = thisMonthReservations.filter(r => r.status === 'confirmed').length;
  const cancelledCount = thisMonthReservations.filter(r => r.status === 'cancelled').length;
  const conversionRate =
    confirmedCount + cancelledCount > 0
      ? Math.round((confirmedCount / (confirmedCount + cancelledCount)) * 100)
      : 100;

  return {
    ...currentMetrics,
    revenueNet,
    totalCouponDiscounts,
    conversionRate,
    trends,
    isPositive,
    quickStats: {
      avgSessionTime,
      occupancy,
      studios: studioOccupancy
    },
    topClients,
    revenueByPeriod
  };
});

/**
 * Format last visit date to human-readable string
 */
function formatLastVisit(date: Date): string {
  const now = new Date();
  const daysDiff = diffInDays(now, date);

  if (daysDiff === 0) return 'היום';
  if (daysDiff === 1) return 'אתמול';
  if (daysDiff === 2) return 'לפני יומיים';
  if (daysDiff < 7) return `לפני ${daysDiff} ימים`;

  return formatDate(date);
}

/**
 * Calculate revenue grouped by period for charts
 */
function calculateRevenueByPeriod(reservations: any[], now: Date) {
  // Monthly - last 12 months
  const monthly: number[] = Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const monthStart = startOfMonth(subtractMonths(now, 11 - i));
    const monthEnd = endOfMonth(subtractMonths(now, 11 - i));

    const monthRevenue = reservations
      .filter(r => {
        const ts = r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate);
        return ts >= monthStart && ts <= monthEnd && r.status === 'confirmed';
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    monthly[i] = monthRevenue;
  }

  // Weekly - last 7 days
  const weekly: number[] = Array(7).fill(0);
  for (let i = 0; i < 7; i++) {
    const dayStart = startOfDay(subtractDays(now, 6 - i));
    const dayEnd = endOfDay(subtractDays(now, 6 - i));

    const dayRevenue = reservations
      .filter(r => {
        const ts = r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate);
        return ts >= dayStart && ts <= dayEnd && r.status === 'confirmed';
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    weekly[i] = dayRevenue;
  }

  // Daily - last 24 hours (by hour)
  const daily: number[] = Array(24).fill(0);
  for (let i = 0; i < 24; i++) {
    const hourStart = startOfHour(subtractHours(now, 23 - i));
    const hourEnd = endOfHour(subtractHours(now, 23 - i));

    const hourRevenue = reservations
      .filter(r => {
        if (!r.createdAt) return false;
        const ts = new Date(r.createdAt);
        return ts >= hourStart && ts <= hourEnd && r.status === 'confirmed';
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    daily[i] = hourRevenue;
  }

  return { monthly, weekly, daily };
}

/**
 * Return empty stats structure
 */
function getEmptyStats(): MerchantStatsResponse {
  return {
    totalRevenue: 0,
    revenueNet: 0,
    totalCouponDiscounts: 0,
    conversionRate: 100,
    totalBookings: 0,
    avgPerBooking: 0,
    newClients: 0,
    trends: {
      totalRevenue: '0%',
      totalBookings: '0%',
      avgPerBooking: '0%',
      newClients: '0%'
    },
    isPositive: {
      totalRevenue: true,
      totalBookings: true,
      avgPerBooking: true,
      newClients: true
    },
    quickStats: {
      avgSessionTime: 0,
      occupancy: 0,
      studios: []
    },
    topClients: [],
    revenueByPeriod: {
      monthly: Array(12).fill(0),
      weekly: Array(7).fill(0),
      daily: Array(24).fill(0)
    }
  };
}

// ============================================================
// ADDITIONAL ANALYTICS ENDPOINTS
// ============================================================

interface TimeSlotAnalytics {
  slot: string;
  bookings: number;
  revenue: number;
  percentage: number;
}

interface DayAnalytics {
  day: string;
  dayIndex: number;
  bookings: number;
  revenue: number;
  percentage: number;
}

interface CancellationStats {
  totalCancelled: number;
  cancellationRate: number;
  cancelledRevenue: number;
  topCancellationReasons: { reason: string; count: number }[];
  cancellationsByDay: number[];
  trend: string;
  isPositive: boolean;
}

interface RepeatCustomerStats {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  avgBookingsPerRepeat: number;
  repeatCustomerRevenue: number;
  revenuePercentage: number;
  topRepeatCustomers: {
    id: string;
    name: string;
    bookings: number;
    totalSpent: number;
    lastVisit: string;
  }[];
}

/**
 * Get popular time slots analysis
 * Shows which time slots are most frequently booked
 */
export const getPopularTimeSlots = handleRequest(async (req: Request) => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return { timeSlots: [], byDay: [] };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);

  const now = new Date();
  const currentPeriodStart = startDateParam
    ? startOfDay(new Date(startDateParam))
    : startOfMonth(now);
  const currentPeriodEnd = endDateParam
    ? endOfDay(new Date(endDateParam))
    : endOfDay(now);

  const reservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed',
    createdAt: { $gte: currentPeriodStart, $lte: currentPeriodEnd }
  });

  // Analyze time slots
  const slotCounts = new Map<string, { bookings: number; revenue: number }>();
  const dayCounts = new Map<number, { bookings: number; revenue: number }>();

  for (const res of reservations) {
    const bookingDate = parseBookingDate(res.bookingDate);
    const dayOfWeek = bookingDate.getDay();

    // Count by day of week
    const dayData = dayCounts.get(dayOfWeek) || { bookings: 0, revenue: 0 };
    dayData.bookings += 1;
    dayData.revenue += res.totalPrice || 0;
    dayCounts.set(dayOfWeek, dayData);

    // Count by time slot
    for (const slot of res.timeSlots || []) {
      const slotData = slotCounts.get(slot) || { bookings: 0, revenue: 0 };
      slotData.bookings += 1;
      slotData.revenue += (res.totalPrice || 0) / (res.timeSlots?.length || 1);
      slotCounts.set(slot, slotData);
    }
  }

  const totalBookings = reservations.length;

  // Convert to sorted arrays
  const timeSlots: TimeSlotAnalytics[] = Array.from(slotCounts.entries())
    .map(([slot, data]) => ({
      slot,
      bookings: data.bookings,
      revenue: Math.round(data.revenue),
      percentage: totalBookings > 0 ? Math.round((data.bookings / totalBookings) * 100) : 0
    }))
    .sort((a, b) => b.bookings - a.bookings);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay: DayAnalytics[] = Array.from(dayCounts.entries())
    .map(([dayIndex, data]) => ({
      day: dayNames[dayIndex],
      dayIndex,
      bookings: data.bookings,
      revenue: Math.round(data.revenue),
      percentage: totalBookings > 0 ? Math.round((data.bookings / totalBookings) * 100) : 0
    }))
    .sort((a, b) => b.bookings - a.bookings);

  return { timeSlots, byDay };
});

/**
 * Get cancellation statistics
 * Shows cancellation rate and trends
 */
export const getCancellationStats = handleRequest(async (req: Request): Promise<CancellationStats> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return {
      totalCancelled: 0,
      cancellationRate: 0,
      cancelledRevenue: 0,
      topCancellationReasons: [],
      cancellationsByDay: Array(7).fill(0),
      trend: '0%',
      isPositive: true
    };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);

  const now = new Date();
  const currentPeriodStart = startDateParam
    ? startOfDay(new Date(startDateParam))
    : startOfMonth(now);
  const currentPeriodEnd = endDateParam
    ? endOfDay(new Date(endDateParam))
    : endOfDay(now);

  // Previous period for trend comparison
  const periodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
  const prevPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  const allReservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    createdAt: { $gte: prevPeriodStart, $lte: currentPeriodEnd }
  });

  const currentReservations = allReservations.filter(r => {
    const ts = new Date(r.createdAt as Date);
    return ts >= currentPeriodStart && ts <= currentPeriodEnd;
  });

  const prevReservations = allReservations.filter(r => {
    const ts = new Date(r.createdAt as Date);
    return ts >= prevPeriodStart && ts <= prevPeriodEnd;
  });

  const currentCancelled = currentReservations.filter(r => r.status === 'cancelled');
  const prevCancelled = prevReservations.filter(r => r.status === 'cancelled');

  const currentRate = currentReservations.length > 0
    ? (currentCancelled.length / currentReservations.length) * 100
    : 0;
  const prevRate = prevReservations.length > 0
    ? (prevCancelled.length / prevReservations.length) * 100
    : 0;

  // Cancellations by day of week
  const cancellationsByDay = Array(7).fill(0);
  for (const res of currentCancelled) {
    const bookingDate = parseBookingDate(res.bookingDate);
    cancellationsByDay[bookingDate.getDay()]++;
  }

  // Calculate trend
  const trendDiff = currentRate - prevRate;
  const trend = `${trendDiff > 0 ? '+' : ''}${Math.round(trendDiff * 10) / 10}%`;

  return {
    totalCancelled: currentCancelled.length,
    cancellationRate: Math.round(currentRate * 10) / 10,
    cancelledRevenue: currentCancelled.reduce((sum, r) => sum + (r.totalPrice || 0), 0),
    topCancellationReasons: [], // Could be extended with cancellation reason tracking
    cancellationsByDay,
    trend,
    isPositive: trendDiff <= 0 // Lower cancellation rate is positive
  };
});

/**
 * Get repeat customer statistics
 * Shows customer loyalty metrics
 */
export const getRepeatCustomerStats = handleRequest(async (req: Request): Promise<RepeatCustomerStats> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return {
      totalCustomers: 0,
      repeatCustomers: 0,
      repeatRate: 0,
      avgBookingsPerRepeat: 0,
      repeatCustomerRevenue: 0,
      revenuePercentage: 0,
      topRepeatCustomers: []
    };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);

  const now = new Date();
  const currentPeriodStart = startDateParam
    ? startOfDay(new Date(startDateParam))
    : subtractMonths(now, 12); // Default to last 12 months for repeat analysis
  const currentPeriodEnd = endDateParam
    ? endOfDay(new Date(endDateParam))
    : endOfDay(now);

  const reservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed',
    createdAt: { $gte: currentPeriodStart, $lte: currentPeriodEnd }
  });

  // Group by customer
  const customerMap = new Map<string, {
    bookings: number;
    revenue: number;
    name: string;
    lastVisit: Date;
  }>();

  for (const res of reservations) {
    const customerId = (res.customerId || res.userId)?.toString();
    if (!customerId) continue;

    const existing = customerMap.get(customerId) || {
      bookings: 0,
      revenue: 0,
      name: res.customerName || 'Unknown',
      lastVisit: new Date(0)
    };

    existing.bookings += 1;
    existing.revenue += res.totalPrice || 0;

    const resDate = new Date(res.createdAt as Date);
    if (resDate > existing.lastVisit) {
      existing.lastVisit = resDate;
      if (res.customerName) existing.name = res.customerName;
    }

    customerMap.set(customerId, existing);
  }

  const totalCustomers = customerMap.size;
  const repeatCustomersList = Array.from(customerMap.entries())
    .filter(([, data]) => data.bookings > 1);

  const repeatCustomers = repeatCustomersList.length;
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

  const totalRepeatBookings = repeatCustomersList.reduce((sum, [, data]) => sum + data.bookings, 0);
  const avgBookingsPerRepeat = repeatCustomers > 0
    ? Math.round((totalRepeatBookings / repeatCustomers) * 10) / 10
    : 0;

  const repeatCustomerRevenue = repeatCustomersList.reduce((sum, [, data]) => sum + data.revenue, 0);
  const totalRevenue = reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  const revenuePercentage = totalRevenue > 0
    ? Math.round((repeatCustomerRevenue / totalRevenue) * 100)
    : 0;

  // Top repeat customers
  const topRepeatCustomers = repeatCustomersList
    .sort((a, b) => b[1].bookings - a[1].bookings)
    .slice(0, 5)
    .map(([id, data]) => ({
      id,
      name: data.name,
      bookings: data.bookings,
      totalSpent: data.revenue,
      lastVisit: formatLastVisit(data.lastVisit)
    }));

  return {
    totalCustomers,
    repeatCustomers,
    repeatRate,
    avgBookingsPerRepeat,
    repeatCustomerRevenue,
    revenuePercentage,
    topRepeatCustomers
  };
});

// --- Helper to get display name from translation object ---
function getStudioName(studio: { name?: string | { en?: string; he?: string } }): string {
  const name = studio.name;
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name.he || name.en || '';
}

function getItemName(item: { name?: string | { en?: string; he?: string } }): string {
  const name = item?.name;
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name.he || name.en || '';
}

// ============================================================
// PER-STUDIO ANALYTICS
// ============================================================

export interface StudioAnalyticsItem {
  itemId: string;
  name: string;
  bookings: number;
  revenue: number;
}

export interface StudioAnalyticsTopCustomer {
  id: string;
  name: string;
  totalSpent: number;
  bookingsCount: number;
}

export interface StudioAnalyticsRow {
  studioId: string;
  studioName: string;
  revenue: number;
  bookingCount: number;
  avgBookingValue: number;
  occupancy: number;
  topItems: StudioAnalyticsItem[];
  growthTrend: string;
  topCustomers: StudioAnalyticsTopCustomer[];
}

export const getStudioAnalytics = handleRequest(async (req: Request): Promise<{ studios: StudioAnalyticsRow[] }> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return { studios: [] };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);

  const currentPeriodStart = startDateParam
    ? startOfDay(new Date(startDateParam))
    : startOfMonth(new Date());
  const currentPeriodEnd = endDateParam
    ? endOfDay(new Date(endDateParam))
    : endOfDay(new Date());
  const periodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
  const prevPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  const allReservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ]
  });

  const operationalHoursPerMonth = 12 * 30;
  const items = await ItemModel.find({ _id: { $in: itemIds } }).select('name');
  const itemMap = new Map(items.map(i => [i._id.toString(), i]));

  const studios: StudioAnalyticsRow[] = [];

  for (const studio of userStudios) {
    const sid = studio._id.toString();
    const studioItemIds = studio.items?.map(i => i.itemId.toString()) || [];

    const currentRes = allReservations.filter(r => {
      const ts = r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate);
      const inStudio = r.studioId?.toString() === sid || studioItemIds.includes(r.itemId?.toString());
      return inStudio && ts >= currentPeriodStart && ts <= currentPeriodEnd;
    });
    const prevRes = allReservations.filter(r => {
      const ts = r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate);
      const inStudio = r.studioId?.toString() === sid || studioItemIds.includes(r.itemId?.toString());
      return inStudio && ts >= prevPeriodStart && ts <= prevPeriodEnd;
    });

    const confirmedCurrent = currentRes.filter(r => r.status === 'confirmed');
    const revenue = confirmedCurrent.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const bookingCount = confirmedCurrent.length;
    const avgBookingValue = bookingCount > 0 ? Math.round(revenue / bookingCount) : 0;

    const duration = confirmedCurrent.reduce((acc, r) => acc + (r.timeSlots?.length || 0), 0);
    const occupancy = Math.round((duration / operationalHoursPerMonth) * 100);

    // Top items by booking count
    const itemCounts = new Map<string, { bookings: number; revenue: number }>();
    for (const r of confirmedCurrent) {
      const iid = r.itemId?.toString();
      if (!iid) continue;
      const cur = itemCounts.get(iid) || { bookings: 0, revenue: 0 };
      cur.bookings += 1;
      cur.revenue += r.totalPrice || 0;
      itemCounts.set(iid, cur);
    }
    const topItems: StudioAnalyticsItem[] = Array.from(itemCounts.entries())
      .map(([itemId, data]) => ({
        itemId,
        name: getItemName(itemMap.get(itemId) || {}),
        bookings: data.bookings,
        revenue: Math.round(data.revenue)
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 3);

    // Top customers for this studio
    const customerMap = new Map<string, { totalSpent: number; bookingsCount: number; name: string }>();
    for (const r of confirmedCurrent) {
      const cid = (r.customerId || r.userId)?.toString();
      if (!cid) continue;
      const cur = customerMap.get(cid) || { totalSpent: 0, bookingsCount: 0, name: r.customerName || 'Unknown' };
      cur.totalSpent += r.totalPrice || 0;
      cur.bookingsCount += 1;
      if (r.customerName) cur.name = r.customerName;
      customerMap.set(cid, cur);
    }
    const topCustomers: StudioAnalyticsTopCustomer[] = Array.from(customerMap.entries())
      .map(([id, data]) => ({ id, name: data.name, totalSpent: data.totalSpent, bookingsCount: data.bookingsCount }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3);

    const prevRevenue = prevRes.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const growthTrend = prevRevenue === 0 ? (revenue > 0 ? '+100%' : '0%') : `${((revenue - prevRevenue) / prevRevenue) * 100 >= 0 ? '+' : ''}${Math.round(((revenue - prevRevenue) / prevRevenue) * 100)}%`;

    studios.push({
      studioId: sid,
      studioName: getStudioName(studio),
      revenue,
      bookingCount,
      avgBookingValue,
      occupancy,
      topItems,
      growthTrend,
      topCustomers
    });
  }

  return { studios };
});

// ============================================================
// PER-CUSTOMER ANALYTICS (paginated, sortable)
// ============================================================

export type ChurnRisk = 'low' | 'medium' | 'high';

export interface CustomerAnalyticsRow {
  customerId: string;
  customerName: string;
  avatarUrl?: string;
  lifetimeValue: number;
  bookingCount: number;
  avgSpendPerVisit: number;
  firstVisit: string;
  lastVisit: string;
  favoriteStudio: string;
  favoriteItem: string;
  visitFrequency: number;
  churnRisk: ChurnRisk;
}

export const getCustomerAnalytics = handleRequest(async (req: Request): Promise<{
  customers: CustomerAnalyticsRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const sortBy = (req.query.sortBy as string) || 'totalSpent';
  const search = (req.query.search as string)?.trim().toLowerCase();

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return { customers: [], total: 0, page, limit, pages: 0 };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);
  const studioNameMap = new Map(userStudios.map(s => [s._id.toString(), getStudioName(s)]));

  const periodStart = startDateParam ? startOfDay(new Date(startDateParam)) : subtractMonths(new Date(), 24);
  const periodEnd = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());

  const reservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed',
    createdAt: { $gte: periodStart, $lte: periodEnd }
  });

  const items = await ItemModel.find({ _id: { $in: itemIds } }).select('name');
  const itemNameMap = new Map(items.map(i => [i._id.toString(), getItemName(i)]));

  const customerMap = new Map<string, {
    totalSpent: number;
    bookings: number;
    firstVisit: Date;
    lastVisit: Date;
    name: string;
    studioCounts: Map<string, number>;
    itemCounts: Map<string, number>;
  }>();

  for (const r of reservations) {
    const cid = (r.customerId || r.userId)?.toString();
    if (!cid) continue;

    const cur = customerMap.get(cid) || {
      totalSpent: 0,
      bookings: 0,
      firstVisit: new Date(9999, 11, 31),
      lastVisit: new Date(0),
      name: r.customerName || 'Unknown',
      studioCounts: new Map(),
      itemCounts: new Map()
    };

    cur.totalSpent += r.totalPrice || 0;
    cur.bookings += 1;
    const resDate = new Date(r.createdAt as Date);
    if (resDate < cur.firstVisit) cur.firstVisit = resDate;
    if (resDate > cur.lastVisit) cur.lastVisit = resDate;
    if (r.customerName) cur.name = r.customerName;

    const sid = r.studioId?.toString();
    if (sid) cur.studioCounts.set(sid, (cur.studioCounts.get(sid) || 0) + 1);
    const iid = r.itemId?.toString();
    if (iid) cur.itemCounts.set(iid, (cur.itemCounts.get(iid) || 0) + 1);
    customerMap.set(cid, cur);
  }

  const monthsInPeriod = Math.max(1, diffInDays(periodEnd, periodStart) / 30);
  let allRows: CustomerAnalyticsRow[] = Array.from(customerMap.entries()).map(([customerId, data]) => {
    const favoriteStudioId = Array.from(data.studioCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoriteItemId = Array.from(data.itemCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const avgSpendPerVisit = data.bookings > 0 ? Math.round(data.totalSpent / data.bookings) : 0;
    const visitFrequency = Math.round((data.bookings / monthsInPeriod) * 100) / 100;

    const daysSinceLastVisit = diffInDays(new Date(), data.lastVisit);
    const avgDaysBetweenVisits = data.bookings > 1 ? diffInDays(data.lastVisit, data.firstVisit) / (data.bookings - 1) : 90;
    let churnRisk: ChurnRisk = 'low';
    if (daysSinceLastVisit > avgDaysBetweenVisits * 2) churnRisk = 'high';
    else if (daysSinceLastVisit > avgDaysBetweenVisits * 1.2) churnRisk = 'medium';

    return {
      customerId,
      customerName: data.name,
      avatarUrl: undefined,
      lifetimeValue: data.totalSpent,
      bookingCount: data.bookings,
      avgSpendPerVisit,
      firstVisit: formatDate(data.firstVisit),
      lastVisit: formatDate(data.lastVisit),
      favoriteStudio: favoriteStudioId ? studioNameMap.get(favoriteStudioId) || '' : '',
      favoriteItem: favoriteItemId ? itemNameMap.get(favoriteItemId) || '' : '',
      visitFrequency,
      churnRisk
    };
  });

  if (search) {
    allRows = allRows.filter(
      row => row.customerName.toLowerCase().includes(search)
    );
  }

  const total = allRows.length;
  const sortKey = sortBy === 'lastVisit' ? 'lastVisit' : sortBy === 'bookings' ? 'bookingCount' : 'lifetimeValue';
  allRows.sort((a, b) => {
    if (sortKey === 'lastVisit') return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
    return (b as any)[sortKey] - (a as any)[sortKey];
  });

  const start = (page - 1) * limit;
  const customers = allRows.slice(start, start + limit);

  const clientIds = customers.map(c => c.customerId);
  const users = await UserModel.find({ _id: { $in: clientIds } }).select('name picture avatar');
  const userMap = new Map(users.map(u => [u._id.toString(), u]));
  customers.forEach(c => {
    const u = userMap.get(c.customerId);
    if (u) {
      c.customerName = (u as any).name || c.customerName;
      c.avatarUrl = (u as any).picture || (u as any).avatar;
    }
  });

  return {
    customers,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1
  };
});

// ============================================================
// SINGLE CUSTOMER DETAIL
// ============================================================

export const getCustomerDetail = handleRequest(async (req: Request) => {
  const userId = req.query.userId as string;
  const { customerId } = req.params;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId || !customerId) {
    throw new ExpressError('User ID and customer ID are required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    throw new ExpressError('No studios found', 404);
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);
  const studioNameMap = new Map(userStudios.map(s => [s._id.toString(), getStudioName(s)]));
  const items = await ItemModel.find({ _id: { $in: itemIds } }).select('name');
  const itemNameMap = new Map(items.map(i => [i._id.toString(), getItemName(i)]));

  const periodStart = startDateParam ? startOfDay(new Date(startDateParam)) : subtractMonths(new Date(), 24);
  const periodEnd = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());

  const reservations = await ReservationModel.find({
    $and: [
      {
        $or: [
          { studioId: { $in: studioIds } },
          { itemId: { $in: itemIds } }
        ]
      },
      { $or: [{ customerId }, { userId: customerId }] },
      { createdAt: { $gte: periodStart, $lte: periodEnd } }
    ]
  }).sort({ createdAt: -1 });

  const bookingHistory = reservations.slice(0, 20).map(r => ({
    id: r._id.toString(),
    date: formatDate(r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate)),
    studioName: studioNameMap.get(r.studioId?.toString() || '') || '',
    itemName: itemNameMap.get(r.itemId?.toString() || '') || '',
    price: r.totalPrice || 0,
    status: r.status
  }));

  const confirmedRes = reservations.filter(r => r.status === 'confirmed');
  const monthlySpending: number[] = Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const monthStart = startOfMonth(subtractMonths(new Date(), 11 - i));
    const monthEnd = endOfMonth(subtractMonths(new Date(), 11 - i));
    monthlySpending[i] = confirmedRes
      .filter(r => {
        const ts = r.createdAt ? new Date(r.createdAt) : parseBookingDate(r.bookingDate);
        return ts >= monthStart && ts <= monthEnd;
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  }

  const slotCounts = new Map<string, number>();
  const dayCounts = new Map<number, number>();
  for (const r of confirmedRes) {
    for (const slot of r.timeSlots || []) {
      slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1);
    }
    const d = parseBookingDate(r.bookingDate).getDay();
    dayCounts.set(d, (dayCounts.get(d) || 0) + 1);
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const preferredTimeSlots = Array.from(slotCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slot]) => slot);
  const preferredDays = Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dayIndex]) => dayNames[dayIndex]);

  return {
    customerId,
    bookingHistory,
    spendingTrend: monthlySpending,
    preferredTimeSlots,
    preferredDays
  };
});

// ============================================================
// PROJECTED EARNINGS
// ============================================================

export interface ProjectionsResponse {
  confirmedUpcoming: number;
  projectedMonthly: number[]; // next 3 months
  monthlyActuals: number[];   // last 12 months
  projectedLine: number[];    // next 3 months (same as projectedMonthly, for chart)
  confidence: 'high' | 'medium' | 'low';
}

export const getProjections = handleRequest(async (req: Request): Promise<ProjectionsResponse> => {
  const userId = req.query.userId as string;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    return {
      confirmedUpcoming: 0,
      projectedMonthly: [0, 0, 0],
      monthlyActuals: Array(12).fill(0),
      projectedLine: [0, 0, 0],
      confidence: 'low'
    };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);
  const now = new Date();

  // Confirmed upcoming: future bookings, status confirmed (filter by parsed bookingDate in code)
  const today = startOfDay(now);
  const allFutureReservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed'
  });
  const futureReservations = allFutureReservations.filter(r => {
    const bookingDate = parseBookingDate(r.bookingDate);
    return bookingDate >= today;
  });
  const confirmedUpcoming = futureReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  // Last 12 months actuals
  const monthlyActuals: number[] = Array(12).fill(0);
  const allReservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed',
    createdAt: { $gte: startOfMonth(subtractMonths(now, 11)), $lte: endOfMonth(now) }
  });

  for (let i = 0; i < 12; i++) {
    const monthStart = startOfMonth(subtractMonths(now, 11 - i));
    const monthEnd = endOfMonth(subtractMonths(now, 11 - i));
    monthlyActuals[i] = allReservations
      .filter(r => {
        const ts = new Date(r.createdAt as Date);
        return ts >= monthStart && ts <= monthEnd;
      })
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  }

  const monthsWithData = monthlyActuals.filter(v => v > 0).length;
  const confidence: 'high' | 'medium' | 'low' = monthsWithData >= 6 ? 'high' : monthsWithData >= 3 ? 'medium' : 'low';

  const recentAvg = monthlyActuals.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const projectedMonthly = [recentAvg, recentAvg, recentAvg];
  const projectedLine = [...projectedMonthly];

  return {
    confirmedUpcoming,
    projectedMonthly,
    monthlyActuals,
    projectedLine,
    confidence
  };
});

// ============================================================
// REVENUE BREAKDOWN
// ============================================================

export interface RevenueBreakdownResponse {
  byStudio: { name: string; revenue: number; percentage: number }[];
  byItem: { name: string; studioName: string; revenue: number; bookings: number; percentage: number }[];
  byDayOfWeek: { day: string; dayIndex: number; revenue: number; bookings: number }[];
  byTimeOfDay: { hour: number; revenue: number; bookings: number }[];
  couponImpact: {
    totalDiscounts: number;
    avgDiscountPercent: number;
    bookingsWithCoupon: number;
    bookingsWithoutCoupon: number;
  };
}

export const getRevenueBreakdown = handleRequest(async (req: Request): Promise<RevenueBreakdownResponse> => {
  const userId = req.query.userId as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const userStudios = await StudioModel.find({ createdBy: userId });
  if (userStudios.length === 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      byStudio: [],
      byItem: [],
      byDayOfWeek: dayNames.map((day, i) => ({ day, dayIndex: i, revenue: 0, bookings: 0 })),
      byTimeOfDay: Array.from({ length: 24 }, (_, i) => ({ hour: i, revenue: 0, bookings: 0 })),
      couponImpact: { totalDiscounts: 0, avgDiscountPercent: 0, bookingsWithCoupon: 0, bookingsWithoutCoupon: 0 }
    };
  }

  const studioIds = userStudios.map(s => s._id);
  const itemIds = userStudios.flatMap(s => s.items?.map(i => i.itemId) || []);
  const studioNameMap = new Map(userStudios.map(s => [s._id.toString(), getStudioName(s)]));
  const items = await ItemModel.find({ _id: { $in: itemIds } }).select('name studioId');
  const itemMap = new Map(items.map(i => [i._id.toString(), i]));

  const periodStart = startDateParam ? startOfDay(new Date(startDateParam)) : startOfMonth(new Date());
  const periodEnd = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());

  const reservations = await ReservationModel.find({
    $or: [
      { studioId: { $in: studioIds } },
      { itemId: { $in: itemIds } }
    ],
    status: 'confirmed',
    createdAt: { $gte: periodStart, $lte: periodEnd }
  });

  const totalRevenue = reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  const byStudioMap = new Map<string, number>();
  const byItemMap = new Map<string, { revenue: number; bookings: number }>();
  const byDayMap = new Map<number, { revenue: number; bookings: number }>();
  const byHourMap = new Map<number, { revenue: number; bookings: number }>();
  let totalDiscounts = 0;
  let bookingsWithCoupon = 0;
  let discountSumPercent = 0;

  for (const r of reservations) {
    const rev = r.totalPrice || 0;
    const sid = r.studioId?.toString();
    if (sid) byStudioMap.set(sid, (byStudioMap.get(sid) || 0) + rev);

    const iid = r.itemId?.toString();
    if (iid) {
      const cur = byItemMap.get(iid) || { revenue: 0, bookings: 0 };
      cur.revenue += rev;
      cur.bookings += 1;
      byItemMap.set(iid, cur);
    }

    const bookingDate = parseBookingDate(r.bookingDate);
    const d = bookingDate.getDay();
    const dayCur = byDayMap.get(d) || { revenue: 0, bookings: 0 };
    dayCur.revenue += rev;
    dayCur.bookings += 1;
    byDayMap.set(d, dayCur);

    if (r.createdAt) {
      const h = new Date(r.createdAt).getHours();
      const hourCur = byHourMap.get(h) || { revenue: 0, bookings: 0 };
      hourCur.revenue += rev;
      hourCur.bookings += 1;
      byHourMap.set(h, hourCur);
    }

    if (r.couponDiscount && r.couponDiscount > 0) {
      bookingsWithCoupon += 1;
      totalDiscounts += r.couponDiscount;
      if (r.priceBeforeDiscount && r.priceBeforeDiscount > 0) {
        discountSumPercent += (r.couponDiscount / r.priceBeforeDiscount) * 100;
      }
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byStudio = Array.from(byStudioMap.entries()).map(([sid, revenue]) => ({
    name: studioNameMap.get(sid) || '',
    revenue,
    percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0
  }));

  const byItem = Array.from(byItemMap.entries()).map(([iid, data]) => {
    const item = itemMap.get(iid);
    const studioName = item?.studioId ? studioNameMap.get(item.studioId.toString()) || '' : '';
    return {
      name: getItemName(item || {}),
      studioName,
      revenue: data.revenue,
      bookings: data.bookings,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0
    };
  });

  const byDayOfWeek = dayNames.map((day, dayIndex) => {
    const data = byDayMap.get(dayIndex) || { revenue: 0, bookings: 0 };
    return { day, dayIndex, revenue: data.revenue, bookings: data.bookings };
  });

  const byTimeOfDay = Array.from({ length: 24 }, (_, hour) => {
    const data = byHourMap.get(hour) || { revenue: 0, bookings: 0 };
    return { hour, revenue: data.revenue, bookings: data.bookings };
  });

  const avgDiscountPercent = bookingsWithCoupon > 0 ? Math.round((discountSumPercent / bookingsWithCoupon) * 10) / 10 : 0;

  return {
    byStudio,
    byItem,
    byDayOfWeek,
    byTimeOfDay,
    couponImpact: {
      totalDiscounts,
      avgDiscountPercent,
      bookingsWithCoupon,
      bookingsWithoutCoupon: reservations.length - bookingsWithCoupon
    }
  };
});
