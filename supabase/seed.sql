-- BookNest hair/beauty seed data for Blissart.
-- Run this after creating a Supabase Auth user. It attaches Blissart to the
-- newest Auth user in the project, which is usually the account you just made.

do $$
declare
  v_owner_id uuid;
  v_owner_email text;
  v_business_id uuid;
  v_cat_id uuid;
  v_svc_id uuid;
begin
  select id, email into v_owner_id, v_owner_email
  from auth.users
  order by created_at desc
  limit 1;

  if v_owner_id is null then
    raise exception 'No Supabase Auth user found. Sign up as a business owner first, then run this seed.';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (v_owner_id, 'Blissart Owner', v_owner_email, 'business_owner')
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        email = excluded.email,
        role = 'business_owner';

  insert into public.businesses (
    owner_id,
    name,
    slug,
    description,
    phone,
    email,
    address,
    bank_name,
    bank_account_name,
    bank_account_number
  )
  values (
    v_owner_id,
    'Blissart',
    'blissart',
    'Hair and beauty booking powered by BookNest.',
    '+1 555 0100',
    'bookings@example.com',
    '123 Beauty Lane',
    'Your Bank',
    'Blissart',
    '0000000000'
  )
  on conflict (slug) do update
    set owner_id = excluded.owner_id,
        name = excluded.name
  returning id into v_business_id;

  insert into public.availability (business_id, day_of_week, start_time, end_time)
  select v_business_id, day, '09:00'::time, '18:00'::time
  from generate_series(1, 6) as day
  on conflict do nothing;

  if exists (select 1 from public.service_categories sc where sc.business_id = v_business_id) then
    raise notice 'Blissart already has service categories. Skipping catalog seed to avoid duplicates.';
    return;
  end if;

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Human Hair Boho Braids', 1)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, description, duration_minutes, deposit_required, deposit_amount, display_order)
  values (v_business_id, v_cat_id, 'Human Hair Boho Braids', 'Choose bob, butt, or thigh length.', 240, true, 25, 1)
  returning id into v_svc_id;
  insert into public.service_options (business_id, service_id, name, price, duration_minutes, display_order)
  values
    (v_business_id, v_svc_id, 'Bob Length', 50, 180, 1),
    (v_business_id, v_svc_id, 'Butt Length', 90, 240, 2),
    (v_business_id, v_svc_id, 'Thigh Length', 125, 300, 3);
  insert into public.service_addons (business_id, service_id, name, price_type, price, duration_minutes)
  values (v_business_id, v_svc_id, 'Curly Ends', 'varies', null, 30);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Human Hair Boho Locs', 2)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes, deposit_required, deposit_amount)
  values (v_business_id, v_cat_id, 'Human Hair Boho Locs + Retwist', 250, 300, true, 50);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Kids Styles', 3)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Kids Styles', 70, 120);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Knotless + French Curl', 4)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, duration_minutes, deposit_required, deposit_amount)
  values (v_business_id, v_cat_id, 'Knotless + French Curl', 240, true, 40)
  returning id into v_svc_id;
  insert into public.service_options (business_id, service_id, name, price, duration_minutes, display_order)
  values
    (v_business_id, v_svc_id, 'Small', 170, 360, 1),
    (v_business_id, v_svc_id, 'Smedium', 150, 300, 2),
    (v_business_id, v_svc_id, 'Medium', 125, 240, 3),
    (v_business_id, v_svc_id, 'Jumbo', 90, 180, 4);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Loc Services', 5)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Re-twist Locs', 200, 180);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Men''s Natural Hair Styles / Cornrows', 6)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, duration_minutes)
  values (v_business_id, v_cat_id, 'Men''s Natural Hair Styles / Cornrows', 120)
  returning id into v_svc_id;
  insert into public.service_options (business_id, service_id, name, price, duration_minutes, display_order)
  values
    (v_business_id, v_svc_id, '4 Braids', 60, 90, 1),
    (v_business_id, v_svc_id, '6 Braids', 50, 90, 2),
    (v_business_id, v_svc_id, '10 Braids', 70, 120, 3),
    (v_business_id, v_svc_id, '12 Braids and More', 90, 150, 4);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Take Down / Removal Services', 7)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Washing, Deep Conditioning, Blow Dry', 30, 90);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Touch Up Services', 8)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, price_type, duration_minutes)
  values
    (v_business_id, v_cat_id, 'Retwists', 'varies', 90),
    (v_business_id, v_cat_id, 'Half Cornrows', 'varies', 90),
    (v_business_id, v_cat_id, 'Hair Trims', 'varies', 45);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Tribal / Fulani + Stitch Braids', 9)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Tribal / Fulani + Stitch Braids', 125, 240);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Twists', 10)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Twists', 90, 180);

  insert into public.service_categories (business_id, name, display_order)
  values (v_business_id, 'Weave Styles', 11)
  returning id into v_cat_id;
  insert into public.services (business_id, category_id, name, base_price, duration_minutes)
  values (v_business_id, v_cat_id, 'Weave Styles', 75, 150);
end $$;
