// =============================================================
// QUEUE-OS — Core Type Definitions
// Week 1 checkpoint: types covering every core entity in the schema
// (see Notion > Architecture & Data Model for the full ERD)
// =============================================================
//
// Naming convention:
//   Postgres / Supabase columns → snake_case (e.g. deposit_required)
//   TypeScript fields           → camelCase  (e.g. depositRequired)
//   Mapping happens at the data-access layer (Supabase client / Edge Function),
//   not here. These types describe the *application-side* shape.

// -------------------------------------------------------------
// TENANTS (clinics) — global config lives here per clinic
// -------------------------------------------------------------
export interface Tenant {
  id: string;
  name: string;
  address: string;
  depositRequired: boolean;
  depositPercent: number; // 0–100
  cancellationWindowHours: number; // e.g. 24
}

// -------------------------------------------------------------
// VACCINES + VACCINE_SCHEDULES — global master data
// (not tenant-scoped — shared catalog across all clinics)
// -------------------------------------------------------------
export interface Vaccine {
  id: string;
  name: string;
  description: string;
}

export interface VaccineSchedule {
  id: string;
  vaccineId: string; // FK -> Vaccine.id
  ageCondition: string; // e.g. "2 months", "4 months"
  doseNumber: number;
}

// -------------------------------------------------------------
// BOOKING STATUS — union type, not an interface
// Rule of thumb: object shape -> interface, fixed set of values -> type union
// -------------------------------------------------------------
export type BookingStatus =
  | "pending" // จองแล้ว รอวันนัด
  | "confirmed" // คลินิกรับทราบแล้ว
  | "paid" // ชำระที่คลินิกแล้ว
  | "completed" // ฉีดเสร็จแล้ว
  | "no_show"; // ไม่มาตามนัด

// -------------------------------------------------------------
// CUSTOMERS
// -------------------------------------------------------------
export interface Customer {
  id: string;
  lineUserId: string; // from LINE Login
  name: string;
}

// -------------------------------------------------------------
// VACCINE_PRICES — tenant-scoped (RLS applies)
// Same vaccine can have different prices at different clinics
// -------------------------------------------------------------
export interface VaccinePrice {
  id: string;
  tenantId: string; // FK -> Tenant.id
  vaccineId: string; // FK -> Vaccine.id
  price: number;
}

// -------------------------------------------------------------
// BOOKINGS — tenant-scoped (RLS applies)
// -------------------------------------------------------------
export interface Booking {
  id: string;
  customerId: string; // FK -> Customer.id
  tenantId: string; // FK -> Tenant.id
  appointmentDate: string; // ISO date string, e.g. "2026-09-15"
  totalPrice: number;
  status: BookingStatus;
  depositAmount: number; // snapshot at booking time
  qrCodeToken: string; // unique, generated at confirmation
  checkedInAt: string | null; // null until QR is scanned at the clinic
}

// -------------------------------------------------------------
// BOOKING_ITEMS — the cart lines inside a booking
// -------------------------------------------------------------
export interface BookingItem {
  id: string;
  bookingId: string; // FK -> Booking.id
  vaccineId: string; // FK -> Vaccine.id
  priceAtBooking: number; // snapshot, NOT live VaccinePrice.price
}

// -------------------------------------------------------------
// GENERIC API RESPONSE WRAPPER
// <T> is a placeholder filled in at the call site, e.g.:
//   ApiResponse<Booking>    -> single booking response
//   ApiResponse<Booking[]>  -> list of bookings response
// One generic type instead of writing a new wrapper for every entity.
// -------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
