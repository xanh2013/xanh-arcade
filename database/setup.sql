-- Run once on a dedicated Xanh Arcade Supabase project. No service key is needed by the app.
-- Private functions own currency mutations; public RPC wrappers run as the calling user.
begin;
create schema if not exists arcade_private;
revoke all on schema arcade_private from public, anon;
grant usage on schema arcade_private to authenticated;
create table public.xa_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 3 and 24),
 coins integer not null default 300 check(coins>=0),
 equipped jsonb not null default '{}'::jsonb,
 last_daily date,
 created_at timestamptz not null default now()
);
create table public.xa_catalog (
 id text primary key,
 slot text not null check(slot in ('runner','paddle','board','avatar','battle')),
 name text not null,
 description text not null,
 price integer not null check(price>0),
 variant text not null
);
create table public.xa_inventory (
 user_id uuid not null references public.xa_profiles(user_id) on delete cascade,
 item_id text not null references public.xa_catalog(id),
 bought_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
create index xa_inventory_item_idx on public.xa_inventory(item_id);
create table public.xa_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.xa_profiles(user_id) on delete cascade,
 amount integer not null,
 reason text not null,
 created_at timestamptz not null default now()
);
create index xa_ledger_user_idx on public.xa_ledger(user_id,created_at desc);
alter table public.xa_profiles enable row level security;
alter table public.xa_catalog enable row level security;
alter table public.xa_inventory enable row level security;
alter table public.xa_ledger enable row level security;
revoke all on public.xa_profiles,public.xa_catalog,public.xa_inventory,public.xa_ledger from anon,authenticated;
grant select on public.xa_catalog to anon,authenticated;
grant select on public.xa_profiles,public.xa_inventory,public.xa_ledger to authenticated;
create policy catalog_read on public.xa_catalog for select to anon,authenticated using(true);
create policy profile_owner on public.xa_profiles for select to authenticated using((select auth.uid())=user_id);
create policy inventory_owner on public.xa_inventory for select to authenticated using((select auth.uid())=user_id);
create policy ledger_owner on public.xa_ledger for select to authenticated using((select auth.uid())=user_id);
insert into public.xa_catalog(id,slot,name,description,price,variant) values
 ('battle-cobalt','battle','Chiến binh Cobalt','Giáp xanh thép cho Xanh Battle.',150,'cobalt'),
 ('battle-ember','battle','Chiến binh Hổ Phách','Giáp hổ phách cho Xanh Battle.',220,'ember'),
 ('robot-cobalt','runner','Robot Cobalt','Lớp giáp xanh thép cho Robot phiêu lưu.',120,'cobalt'),
 ('robot-forest','runner','Robot Kiểm Lâm','Lớp giáp xanh rừng, điểm nhấn màu ngà.',160,'forest'),
 ('paddle-copper','paddle','Thanh đỡ Đồng Đỏ','Chất liệu đồng cho Phá gạch quỹ đạo.',100,'copper'),
 ('board-slate','board','Bàn cờ Đá Xám','Bàn caro màu đá phiến, quân cờ tương phản.',180,'slate');

create function arcade_private.ensure_profile() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); n text;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select left(trim(regexp_replace(coalesce(raw_user_meta_data->>'nickname','Người chơi'),'[[:cntrl:]]','','g')),24) into n from auth.users where id=u;
 if n is null then raise exception 'AUTH_REQUIRED'; end if;
 if char_length(n)<3 then n:='Người chơi'; end if;
 insert into public.xa_profiles(user_id,nickname) values(u,n) on conflict do nothing;
 return u;
end; $$;
create function arcade_private.account() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; result jsonb;
begin
 u:=arcade_private.ensure_profile();
 select jsonb_build_object('nickname',p.nickname,'coins',p.coins,'equipped',p.equipped,
  'dailyAvailable',p.last_daily is distinct from (now() at time zone 'UTC')::date,
  'owned',coalesce((select jsonb_agg(i.item_id order by i.item_id) from public.xa_inventory i where i.user_id=u),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(t) from (select amount,reason,created_at from public.xa_ledger where user_id=u order by created_at desc,id desc limit 8)t),'[]'::jsonb)) into result
 from public.xa_profiles p where p.user_id=u;
 return result;
end; $$;
create function arcade_private.purchase(p_item_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; balance integer; item public.xa_catalog%rowtype;
begin
 u:=arcade_private.ensure_profile();
 select coins into balance from public.xa_profiles where user_id=u for update;
 select * into item from public.xa_catalog where id=p_item_id;
 if not found then raise exception 'ITEM_NOT_FOUND'; end if;
 if exists(select 1 from public.xa_inventory where user_id=u and item_id=p_item_id) then return arcade_private.account(); end if;
 if balance<item.price then raise exception 'NOT_ENOUGH_COINS'; end if;
 update public.xa_profiles set coins=coins-item.price where user_id=u;
 insert into public.xa_inventory(user_id,item_id) values(u,p_item_id);
 insert into public.xa_ledger(user_id,amount,reason) values(u,-item.price,item.name);
 return arcade_private.account();
end; $$;
create function arcade_private.equip(p_item_id text,p_slot text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=arcade_private.ensure_profile();
 if p_slot not in ('runner','paddle','board','avatar','battle') or p_slot is null then raise exception 'INVALID_SLOT'; end if;
 perform 1 from public.xa_profiles where user_id=u for update;
 if p_item_id is null then
  update public.xa_profiles set equipped=equipped-p_slot where user_id=u;
 else
  if not exists(select 1 from public.xa_inventory i join public.xa_catalog c on c.id=i.item_id where i.user_id=u and c.id=p_item_id and c.slot=p_slot) then raise exception 'ITEM_NOT_OWNED'; end if;
  update public.xa_profiles set equipped=jsonb_set(equipped,array[p_slot],to_jsonb(p_item_id),true) where user_id=u;
 end if;
 return arcade_private.account();
end; $$;
create function arcade_private.daily() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; last_date date; today date:=(now() at time zone 'UTC')::date;
begin
 u:=arcade_private.ensure_profile();
 select last_daily into last_date from public.xa_profiles where user_id=u for update;
 if last_date=today then raise exception 'DAILY_ALREADY_CLAIMED'; end if;
 update public.xa_profiles set coins=coins+75,last_daily=today where user_id=u;
 insert into public.xa_ledger(user_id,amount,reason) values(u,75,'Quà hằng ngày');
 return arcade_private.account();
end; $$;
create function arcade_private.rename(p_nickname text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; n text:=trim(regexp_replace(p_nickname,'[[:cntrl:]]','','g'));
begin
 u:=arcade_private.ensure_profile();
 if n is null or char_length(n)<3 or char_length(n)>24 then raise exception 'INVALID_NICKNAME'; end if;
 update public.xa_profiles set nickname=n where user_id=u;
 return arcade_private.account();
end; $$;
revoke all on all functions in schema arcade_private from public,anon,authenticated;
grant execute on function arcade_private.account(),arcade_private.purchase(text),arcade_private.equip(text,text),arcade_private.daily(),arcade_private.rename(text) to authenticated;
create function public.xa_account() returns jsonb language sql security invoker set search_path='' as $$select arcade_private.account();$$;
create function public.xa_purchase(p_item_id text) returns jsonb language sql security invoker set search_path='' as $$select arcade_private.purchase(p_item_id);$$;
create function public.xa_equip(p_item_id text,p_slot text) returns jsonb language sql security invoker set search_path='' as $$select arcade_private.equip(p_item_id,p_slot);$$;
create function public.xa_daily() returns jsonb language sql security invoker set search_path='' as $$select arcade_private.daily();$$;
create function public.xa_rename(p_nickname text) returns jsonb language sql security invoker set search_path='' as $$select arcade_private.rename(p_nickname);$$;
revoke all on function public.xa_account(),public.xa_purchase(text),public.xa_equip(text,text),public.xa_daily(),public.xa_rename(text) from public,anon;
grant execute on function public.xa_account(),public.xa_purchase(text),public.xa_equip(text,text),public.xa_daily(),public.xa_rename(text) to authenticated;
commit;
