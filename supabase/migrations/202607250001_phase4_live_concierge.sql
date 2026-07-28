begin;

create extension if not exists citext with schema extensions;
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists public.tenant_demo_configs (
  tenant_id text primary key,
  display_name text not null,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  role text not null check (role in ('viewer', 'presenter', 'administrator')),
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.invited_users (
  email extensions.citext primary key,
  invited_by uuid references auth.users(id),
  tenant_ids text[] not null check (cardinality(tenant_ids) > 0),
  role text not null check (role in ('viewer', 'presenter', 'administrator')),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  google_email text not null,
  gmail_label_id text,
  calendar_id text,
  status text not null check (status in ('connected', 'limited', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  user_id uuid references auth.users(id),
  provider text not null check (provider in ('openai', 'elevenlabs', 'google', 'deterministic')),
  model text,
  capability text not null,
  input_tokens bigint,
  output_tokens bigint,
  duration_seconds integer,
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  provider_cost_usd numeric(12,6),
  session_id text,
  occurred_at timestamptz not null default now()
);

create index if not exists ai_usage_ledger_time_provider_idx
  on private.ai_usage_ledger (occurred_at desc, provider);
create index if not exists ai_usage_ledger_tenant_idx
  on private.ai_usage_ledger (tenant_id, occurred_at desc);

create table if not exists private.action_confirmations (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null,
  tenant_id text not null,
  user_id uuid not null references auth.users(id),
  role text not null,
  tool_name text not null,
  nonce_hash text not null unique,
  payload_hash text not null,
  destination text not null,
  outcome text not null check (outcome in ('confirmed', 'rejected', 'expired', 'failed', 'completed')),
  occurred_at timestamptz not null default now()
);

create table if not exists private.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  user_id uuid references auth.users(id),
  event_type text not null,
  entity_type text,
  entity_id text,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function private.prevent_immutable_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'immutable audit records cannot be changed';
end;
$$;

drop trigger if exists action_confirmations_immutable on private.action_confirmations;
create trigger action_confirmations_immutable
before update or delete on private.action_confirmations
for each row execute function private.prevent_immutable_mutation();

drop trigger if exists security_audit_events_immutable on private.security_audit_events;
create trigger security_audit_events_immutable
before update or delete on private.security_audit_events
for each row execute function private.prevent_immutable_mutation();

alter table public.tenant_demo_configs enable row level security;
alter table public.tenant_assignments enable row level security;
alter table public.user_profiles enable row level security;
alter table private.invited_users enable row level security;
alter table private.google_connections enable row level security;
alter table private.ai_usage_ledger enable row level security;
alter table private.action_confirmations enable row level security;
alter table private.security_audit_events enable row level security;

drop policy if exists tenant_demo_configs_assigned_read on public.tenant_demo_configs;
create policy tenant_demo_configs_assigned_read
on public.tenant_demo_configs
for select
to authenticated
using (
  tenant_id in (
    select jsonb_array_elements_text(
      coalesce(auth.jwt() -> 'app_metadata' -> 'tenant_ids', '[]'::jsonb)
    )
  )
);

drop policy if exists tenant_assignments_own_read on public.tenant_assignments;
create policy tenant_assignments_own_read
on public.tenant_assignments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_profiles_own_read on public.user_profiles;
create policy user_profiles_own_read
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_profiles_own_update on public.user_profiles;
create policy user_profiles_own_update
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.tenant_demo_configs (tenant_id, display_name, configuration)
values
  ('org-y12-demo', 'Y-12 Credit Union Demonstration Environment', '{"fictional": true, "personalized": true}'::jsonb),
  ('org-catalyst-community-demo', 'Catalyst Community Credit Union', '{"fictional": true, "personalized": false}'::jsonb)
on conflict (tenant_id) do update
set display_name = excluded.display_name,
    configuration = excluded.configuration,
    updated_at = now();

commit;
