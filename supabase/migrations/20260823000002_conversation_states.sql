create table conversation_states (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  state text not null default 'idle',
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Internal table used only by the Edge Function (service_role) — no RLS/client access needed