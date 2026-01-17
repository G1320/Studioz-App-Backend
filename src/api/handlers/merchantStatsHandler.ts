import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { UserModel } from '../../models/userModel.js';
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

  return {
    ...currentMetrics,
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
