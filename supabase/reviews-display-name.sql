alter table public.reviews
add column if not exists user_name text;

update public.reviews
set user_name = profiles.full_name
from public.profiles
where reviews.user_id = profiles.id
  and coalesce(reviews.user_name, '') = '';

create index if not exists reviews_product_id_created_at_idx
on public.reviews (product_id, created_at desc);
