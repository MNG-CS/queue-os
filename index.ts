import { getBookingById, getBookingsByTenant } from "./src/services/bookingService";

const single = getBookingById("b001");
console.log("Single booking:", single);

const notFound = getBookingById("b999");
console.log("Not found case:", notFound);

const tenantList = getBookingsByTenant("t001");
console.log("Tenant bookings:", tenantList);