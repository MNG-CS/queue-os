-- Extensions
create extension if not exists pgcrypto;

-- ============================================================
-- Global master data (no RLS — shared catalog across all tenants)
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  deposit_required boolean not null default false,
  deposit_percent numeric(5,2) not null default 0,
  cancellation_window_hours int not null default 24,
  created_at timestamptz not null default now()
);

create table vaccines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table vaccine_schedules (
  id uuid primary key default gen_random_uuid(),
  vaccine_id uuid not null references vaccines(id) on delete cascade,
  age_condition text not null,
  dose_number int not null,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Tenant-scoped data (RLS enabled)
-- ============================================================

create table vaccine_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vaccine_id uuid not null references vaccines(id) on delete cascade,
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, vaccine_id)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  appointment_date date not null,
  total_price numeric(10,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending','confirmed','paid','completed','no_show')),
  deposit_amount numeric(10,2) not null default 0,
  qr_code_token text unique,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  vaccine_id uuid not null references vaccines(id) on delete restrict,
  price_at_booking numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- Edge Functions use the service_role key (bypasses RLS) —
-- these policies protect direct client access (LIFF app using anon key)
-- ============================================================

alter table vaccine_prices enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;

-- Tenant-aware policies (checked via app.tenant_id session setting)
create policy tenant_isolation_vaccine_prices on vaccine_prices
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_bookings on bookings
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_booking_items on booking_items
  using (
    booking_id in (
      select id from bookings
      where tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- Indexes for common lookups
create index idx_vaccine_prices_tenant on vaccine_prices(tenant_id);
create index idx_bookings_tenant on bookings(tenant_id);
create index idx_bookings_customer on bookings(customer_id);
create index idx_booking_items_booking on booking_items(booking_id);