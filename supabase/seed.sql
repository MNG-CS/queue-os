insert into tenants (id, name, address, deposit_required, deposit_percent, cancellation_window_hours)
values ('11111111-1111-1111-1111-111111111111', 'คลินิกทดสอบ Lat Phrao', 'ลาดพร้าว, กรุงเทพฯ', false, 0, 24);

insert into vaccines (id, name, description)
values ('22222222-2222-2222-2222-222222222222', 'วัคซีนไข้หวัดใหญ่', 'วัคซีนป้องกันไข้หวัดใหญ่ตามฤดูกาล');

insert into vaccine_schedules (vaccine_id, age_condition, dose_number)
values ('22222222-2222-2222-2222-222222222222', '18+ ปี', 1);

insert into vaccine_prices (tenant_id, vaccine_id, price)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 450.00);