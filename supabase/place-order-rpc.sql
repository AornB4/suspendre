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

create or replace function public.place_order(
  items_input jsonb,
  customer_name_input text default null,
  customer_email_input text default null,
  payment_method_input text default 'paypal',
  payment_status_input text default 'paid',
  status_input text default 'processing'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_order_id uuid;
  order_total numeric(10,2) := 0;
  requested_item record;
  product_row record;
begin
  if current_user_id is null then
    raise exception 'You must be logged in to place an order.';
  end if;

  if items_input is null or jsonb_typeof(items_input) <> 'array' or jsonb_array_length(items_input) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  insert into public.orders (
    user_id,
    status,
    payment_method,
    payment_status,
    total_amount,
    customer_name_snapshot,
    customer_email_snapshot
  )
  values (
    current_user_id,
    coalesce(status_input, 'processing'),
    coalesce(payment_method_input, 'paypal'),
    coalesce(payment_status_input, 'paid'),
    0,
    nullif(customer_name_input, ''),
    nullif(customer_email_input, '')
  )
  returning id into created_order_id;

  for requested_item in
    select
      (value ->> 'product_id')::uuid as product_id,
      (value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(items_input)
  loop
    if requested_item.product_id is null or requested_item.quantity is null or requested_item.quantity <= 0 then
      raise exception 'One or more cart items are invalid.';
    end if;

    select
      id,
      name,
      price,
      stock,
      active
    into product_row
    from public.products
    where id = requested_item.product_id
    for update;

    if not found or product_row.active is not true then
      raise exception 'One or more products are no longer available.';
    end if;

    if product_row.stock < requested_item.quantity then
      raise exception '% is no longer available in the requested quantity.', product_row.name;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      unit_price,
      quantity,
      subtotal
    )
    values (
      created_order_id,
      product_row.id,
      product_row.name,
      product_row.price,
      requested_item.quantity,
      product_row.price * requested_item.quantity
    );

    update public.products
    set stock = stock - requested_item.quantity
    where id = product_row.id;

    order_total := order_total + (product_row.price * requested_item.quantity);
  end loop;

  update public.orders
  set total_amount = order_total
  where id = created_order_id;

  return created_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, text, text, text, text, text) from public;
grant execute on function public.place_order(jsonb, text, text, text, text, text) to authenticated;
