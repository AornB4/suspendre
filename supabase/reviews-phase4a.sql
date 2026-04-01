alter table public.reviews
add column if not exists verified_purchase boolean not null default false;

update public.reviews
set verified_purchase = exists (
  select 1
  from public.orders
  join public.order_items on order_items.order_id = orders.id
  where orders.user_id = reviews.user_id
    and order_items.product_id = reviews.product_id
    and orders.payment_status = 'paid'
);

create index if not exists reviews_product_id_created_at_rating_idx
on public.reviews (product_id, created_at desc, rating desc);
