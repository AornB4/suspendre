create table if not exists public.back_in_stock_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  email_snapshot text,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.back_in_stock_requests enable row level security;

drop policy if exists "back_in_stock_select_own" on public.back_in_stock_requests;
create policy "back_in_stock_select_own"
on public.back_in_stock_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "back_in_stock_insert_own" on public.back_in_stock_requests;
create policy "back_in_stock_insert_own"
on public.back_in_stock_requests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "back_in_stock_delete_own" on public.back_in_stock_requests;
create policy "back_in_stock_delete_own"
on public.back_in_stock_requests
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "back_in_stock_admin_read_all" on public.back_in_stock_requests;
create policy "back_in_stock_admin_read_all"
on public.back_in_stock_requests
for select
to authenticated
using ((select private.is_admin()));

create index if not exists back_in_stock_requests_product_id_idx
on public.back_in_stock_requests (product_id, created_at desc);

create index if not exists back_in_stock_requests_user_id_idx
on public.back_in_stock_requests (user_id, created_at desc);
