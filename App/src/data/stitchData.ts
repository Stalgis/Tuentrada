import type { Event } from "../lib/types";

export type MetricPoint = {
  label: string;
  value: number;
};

export type HighlightItem = {
  id: string;
  label: string;
  detail: string;
  value: string;
  tone: "primary" | "success" | "warning";
};

export type ExecutiveEvent = {
  id: string;
  title: string;
  venue: string;
  revenue: number;
  sold: number;
  status: "active" | "trending" | "private";
  imageUrl: string;
};

export type InventorySlice = {
  label: string;
  value: number;
  tone: "primary" | "secondary" | "warning";
};

export type VenueSector = {
  id: string;
  rank: number;
  name: string;
  revenue: number;
  occupancy: number;
  capacity: number;
  tone: "primary" | "secondary" | "warning";
};

export const dashboardHero = {
  title: "Tickets sold",
  value: 14282,
  delta: "+12% vs last week",
};

export const dashboardSecondary = [
  { id: "revenue", label: "Revenue", value: 412800000, type: "currency" as const },
  { id: "checkins", label: "Check-ins", value: 82, type: "percent" as const },
];

export const dailySales: MetricPoint[] = [
  { label: "Mon", value: 26 },
  { label: "Tue", value: 34 },
  { label: "Wed", value: 29 },
  { label: "Thu", value: 42 },
  { label: "Fri", value: 58 },
  { label: "Sat", value: 51 },
  { label: "Sun", value: 36 },
];

export const inventoryProgress = [
  { id: "ga", label: "GA Pass", value: 76, tone: "primary" as const },
  { id: "vip", label: "VIP Elite", value: 42, tone: "warning" as const },
  { id: "eb", label: "Early Bird", value: 92, tone: "success" as const },
];

export const recentHighlights: HighlightItem[] = [
  {
    id: "sale",
    label: "New sale",
    detail: "VIP Lounge",
    value: "+ARS 420k",
    tone: "primary",
  },
  {
    id: "sold-out",
    label: "Sold out",
    detail: "Terrace Sunset",
    value: "100%",
    tone: "success",
  },
  {
    id: "payout",
    label: "Payout",
    detail: "Processed today",
    value: "ARS 3.2M",
    tone: "warning",
  },
];

export const executiveSnapshot = {
  revenue: 1429850000,
  growthLabel: "+12.4%",
  goalProgress: 78,
  ticketsSold: 48200,
  newMembers: 1204,
};

export const executiveTopEvents: ExecutiveEvent[] = [
  {
    id: "evt-midnight",
    title: "Midnight Pulse",
    venue: "Movistar Arena",
    revenue: 352400000,
    sold: 91,
    status: "active",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900",
  },
  {
    id: "evt-sunset",
    title: "Sunset District",
    venue: "Hipodromo Palermo",
    revenue: 294100000,
    sold: 84,
    status: "trending",
    imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900",
  },
  {
    id: "evt-acoustic",
    title: "Acoustic Room",
    venue: "Teatro Vorterix",
    revenue: 128700000,
    sold: 56,
    status: "private",
    imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900",
  },
];

export const forecastSeries: MetricPoint[] = [
  { label: "Jul", value: 28 },
  { label: "Aug", value: 36 },
  { label: "Sep", value: 34 },
  { label: "Oct", value: 48 },
  { label: "Nov", value: 61 },
  { label: "Dec", value: 67 },
];

export const inventoryMix: InventorySlice[] = [
  { label: "VIP Access", value: 28, tone: "warning" },
  { label: "General", value: 49, tone: "primary" },
  { label: "Reserved", value: 23, tone: "secondary" },
];

export const analyticsActivity: HighlightItem[] = [
  {
    id: "transfer",
    label: "Transfer cleared",
    detail: "Mastercard",
    value: "ARS 760k",
    tone: "primary",
  },
  {
    id: "refund",
    label: "Refund closed",
    detail: "Early Bird",
    value: "ARS 82k",
    tone: "warning",
  },
  {
    id: "checkin",
    label: "Check-ins",
    detail: "Main Deck",
    value: "1.2k",
    tone: "success",
  },
];

export const venueSectors: VenueSector[] = [
  {
    id: "vip-lounge",
    rank: 1,
    name: "VIP Lounge",
    revenue: 42800000,
    occupancy: 94,
    capacity: 450,
    tone: "warning",
  },
  {
    id: "main-deck",
    rank: 2,
    name: "Main Deck",
    revenue: 36100000,
    occupancy: 88,
    capacity: 1800,
    tone: "primary",
  },
  {
    id: "terrace",
    rank: 3,
    name: "Terrace",
    revenue: 17400000,
    occupancy: 64,
    capacity: 620,
    tone: "secondary",
  },
  {
    id: "gallery-bar",
    rank: 4,
    name: "Gallery Bar",
    revenue: 9200000,
    occupancy: 48,
    capacity: 260,
    tone: "primary",
  },
];

export const eventsFeed: Event[] = [
  {
    id: "midnight-pulse",
    name: "Midnight Pulse",
    venue: "Movistar Arena",
    city: "Buenos Aires",
    dateISO: "2026-04-16T21:00:00-03:00",
    status: "on_sale",
    ticketsSold: 12420,
    ticketsAvailable: 13600,
    ticketPriceARS: 42000,
    imageUrl: "https://images.unsplash.com/photo-1503095396549-807759245b35?w=900",
  },
  {
    id: "sunset-district",
    name: "Sunset District",
    venue: "Hipodromo Palermo",
    city: "Buenos Aires",
    dateISO: "2026-04-21T19:30:00-03:00",
    status: "on_sale",
    ticketsSold: 9320,
    ticketsAvailable: 11100,
    ticketPriceARS: 36000,
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900",
  },
  {
    id: "acoustic-room",
    name: "Acoustic Room",
    venue: "Teatro Vorterix",
    city: "Buenos Aires",
    dateISO: "2026-05-02T20:30:00-03:00",
    status: "sold_out",
    ticketsSold: 2600,
    ticketsAvailable: 2600,
    ticketPriceARS: 28000,
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900",
  },
  {
    id: "club-aurora",
    name: "Club Aurora",
    venue: "C Complejo Art Media",
    city: "Buenos Aires",
    dateISO: "2026-05-10T23:30:00-03:00",
    status: "on_sale",
    ticketsSold: 4100,
    ticketsAvailable: 6200,
    ticketPriceARS: 19000,
    imageUrl: "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?w=900",
  },
];

export const eventVelocity: Record<string, number> = {
  "midnight-pulse": 91,
  "sunset-district": 84,
  "acoustic-room": 100,
  "club-aurora": 66,
};
