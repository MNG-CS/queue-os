-- Supabase ปกติ auto-grant สิทธิ์เหล่านี้ให้เอง แต่ raw migration ต้องทำเอง
grant usage on schema public to service_role;

grant select, insert, update, delete on
  tenants,
  vaccines,
  vaccine_schedules,
  customers,
  vaccine_prices,
  bookings,
  booking_items,
  conversation_states
to service_role;