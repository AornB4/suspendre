alter table public.orders
add column if not exists customer_name_snapshot text,
add column if not exists customer_email_snapshot text;

update public.orders
set customer_name_snapshot = profiles.full_name
from public.profiles
where orders.user_id = profiles.id
  and coalesce(orders.customer_name_snapshot, '') = '';

create index if not exists orders_user_id_created_at_idx
on public.orders (user_id, created_at desc);
