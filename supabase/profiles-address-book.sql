alter table public.profiles
add column if not exists address_book jsonb not null default '[]'::jsonb;

update public.profiles
set address_book = jsonb_build_array(
  jsonb_build_object(
    'id', 'primary-address',
    'label', 'Primary',
    'recipient', coalesce(full_name, ''),
    'phone', '',
    'address', address,
    'is_primary', true
  )
)
where coalesce(trim(address), '') <> ''
  and (
    address_book is null
    or address_book = '[]'::jsonb
  );
