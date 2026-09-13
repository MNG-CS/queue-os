import type { ApiResponse, Booking } from "../types/types";

// mock data — ข้อมูลจำลอง ยังไม่ต่อ Supabase จริง
const mockBookings: Booking[] = [
  {
    id: "b001",
    customerId: "c001",
    tenantId: "t001",
    appointmentDate: "2026-09-15",
    totalPrice: 500,
    status: "pending",
    depositAmount: 0,
    qrCodeToken: "abc123",
    checkedInAt: null,
  },
  {
    id: "b002",
    customerId: "c002",
    tenantId: "t001",
    appointmentDate: "2026-09-16",
    totalPrice: 800,
    status: "confirmed",
    depositAmount: 400,
    qrCodeToken: "xyz789",
    checkedInAt: null,
  },
];

// ฟังก์ชันจำลองการดึง booking ตัวเดียว — คืนค่าเป็น ApiResponse<Booking>
export function getBookingById(id: string): ApiResponse<Booking> {
  const found = mockBookings.find((b) => b.id === id);

  if (!found) {
    return { success: false, data: null, error: `ไม่พบ booking id: ${id}` };
  }

  return { success: true, data: found, error: null };
}

// ฟังก์ชันจำลองการดึง booking ทั้งหมดของ tenant — คืนค่าเป็น ApiResponse<Booking[]>
export function getBookingsByTenant(tenantId: string): ApiResponse<Booking[]> {
  const results = mockBookings.filter((b) => b.tenantId === tenantId);
  return { success: true, data: results, error: null };
}