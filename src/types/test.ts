import type { Booking, BookingStatus } from "./types";

// ลองใส่ status ผิดๆ ดู
const wrongStatus: BookingStatus = "cancelled"; // ตัวนี้ไม่มีใน union type ที่เราประกาศไว้

const testBooking: Booking = {
  id: "b001",
  customerId: "c001",
  tenantId: "t001",
  appointmentDate: "2026-09-15",
  totalPrice: 500,
  status: "pending",
  depositAmount: 0,
  qrCodeToken: "abc123",
  checkedInAt: null,
};

console.log(testBooking);