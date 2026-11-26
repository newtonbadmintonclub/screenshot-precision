create table if not exists public.inventory_loans (
 id uuid primary key default gen_random_uuid(), loan_code text not null unique,
 borrower_name text not null, borrower_type text not null default 'other' check(borrower_type in ('member','staff','other')),
 borrower_contact text not null default '', purpose text not null default '', borrowed_at timestamptz not null default now(),
 due_at date, status text not null default 'open' check(status in ('open','partial_returned','returned')),
 notes text not null default '', actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.inventory_loan_items (
 id uuid primary key default gen_random_uuid(), loan_id uuid not null references public.inventory_loans(id) on delete restrict,
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 quantity_borrowed integer not null check(quantity_borrowed>0),
 quantity_returned integer not null default 0 check(quantity_returned>=0 and quantity_returned<=quantity_borrowed),
 condition_on_return text check(condition_on_return is null or condition_on_return in ('baik','perlu_perbaikan','rusak')),
 return_notes text not null default '', created_at timestamptz not null default now()
);
create index if not exists inventory_loans_status_due_idx on public.inventory_loans(status,due_at);
create index if not exists inventory_loans_created_idx on public.inventory_loans(created_at desc);
create index if not exists inventory_loan_items_loan_idx on public.inventory_loan_items(loan_id);
create index if not exists inventory_loan_items_item_idx on public.inventory_loan_items(item_id);
alter table public.inventory_loans enable row level security;
alter table public.inventory_loan_items enable row level security;
create policy "Admins read inventory loans" on public.inventory_loans for select to authenticated using(public.has_role((select auth.uid()),'admin'::public.app_role));
create policy "Admins insert inventory loans" on public.inventory_loans for insert to authenticated with check(actor_id=(select auth.uid()) and public.has_role((select auth.uid()),'admin'::public.app_role));
create policy "Admins update inventory loans" on public.inventory_loans for update to authenticated using(public.has_role((select auth.uid()),'admin'::public.app_role)) with check(public.has_role((select auth.uid()),'admin'::public.app_role));
create policy "Admins read inventory loan items" on public.inventory_loan_items for select to authenticated using(public.has_role((select auth.uid()),'admin'::public.app_role));
create policy "Admins insert inventory loan items" on public.inventory_loan_items for insert to authenticated with check(public.has_role((select auth.uid()),'admin'::public.app_role));
create policy "Admins update inventory loan items" on public.inventory_loan_items for update to authenticated using(public.has_role((select auth.uid()),'admin'::public.app_role)) with check(public.has_role((select auth.uid()),'admin'::public.app_role));
grant select,insert,update on public.inventory_loans to authenticated;
grant select,insert,update on public.inventory_loan_items to authenticated;
create or replace function public.inventory_create_loan(p_borrower_name text,p_borrower_type text,p_borrower_contact text,p_purpose text,p_due_at date,p_notes text,p_items jsonb)
returns public.inventory_loans language plpgsql security invoker set search_path='' as $function$
declare v_loan public.inventory_loans; v_line jsonb; v_item_id uuid; v_qty integer; v_previous integer; v_new integer; v_code text;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Akses Admin diperlukan' using errcode='42501'; end if;
 if length(trim(coalesce(p_borrower_name,'')))=0 then raise exception 'Nama peminjam wajib diisi'; end if;
 if p_borrower_type not in ('member','staff','other') then raise exception 'Jenis peminjam tidak valid'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Minimal satu barang wajib dipilih'; end if;
 if exists(select 1 from (select value->>'item_id' item_id from jsonb_array_elements(p_items)) x group by item_id having count(*)>1) then raise exception 'Barang duplikat dalam transaksi'; end if;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_item_id:=(v_line->>'item_id')::uuid; v_qty:=(v_line->>'quantity')::integer;
  if v_qty<=0 then raise exception 'Jumlah pinjaman harus lebih dari nol'; end if;
  perform 1 from public.inventory_items where id=v_item_id and is_active=true and quantity>=v_qty for update;
  if not found then raise exception 'Barang tidak tersedia atau stok tidak mencukupi'; end if;
 end loop;
 v_code:='LOAN-'||to_char(clock_timestamp(),'YYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 insert into public.inventory_loans(loan_code,borrower_name,borrower_type,borrower_contact,purpose,due_at,notes,actor_id)
 values(v_code,trim(p_borrower_name),p_borrower_type,coalesce(trim(p_borrower_contact),''),coalesce(trim(p_purpose),''),p_due_at,coalesce(trim(p_notes),''),auth.uid()) returning * into v_loan;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_item_id:=(v_line->>'item_id')::uuid; v_qty:=(v_line->>'quantity')::integer;
  update public.inventory_items set quantity=quantity-v_qty,updated_at=now() where id=v_item_id and is_active=true and quantity>=v_qty returning quantity+v_qty,quantity into v_previous,v_new;
  if not found then raise exception 'Stok berubah; transaksi dibatalkan'; end if;
  insert into public.inventory_loan_items(loan_id,item_id,quantity_borrowed) values(v_loan.id,v_item_id,v_qty);
  insert into public.inventory_movements(item_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,reference,actor_id) values(v_item_id,'stock_out',-v_qty,v_previous,v_new,'Peminjaman inventaris',v_code,auth.uid());
 end loop; return v_loan;
end; $function$;
create or replace function public.inventory_return_loan_item(p_loan_item_id uuid,p_quantity integer,p_condition text,p_notes text default '')
returns public.inventory_loan_items language plpgsql security invoker set search_path='' as $function$
declare v_line public.inventory_loan_items; v_loan public.inventory_loans; v_item public.inventory_items; v_previous integer; v_new integer;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Akses Admin diperlukan' using errcode='42501'; end if;
 if p_quantity<=0 then raise exception 'Jumlah pengembalian harus lebih dari nol'; end if;
 if p_condition not in ('baik','perlu_perbaikan','rusak') then raise exception 'Kondisi barang tidak valid'; end if;
 select * into v_line from public.inventory_loan_items where id=p_loan_item_id for update;
 if not found then raise exception 'Detail peminjaman tidak ditemukan'; end if;
 select * into v_loan from public.inventory_loans where id=v_line.loan_id for update;
 if v_loan.status='returned' or v_line.quantity_returned+p_quantity>v_line.quantity_borrowed then raise exception 'Jumlah pengembalian melebihi sisa pinjaman'; end if;
 select * into v_item from public.inventory_items where id=v_line.item_id for update;
 if not found then raise exception 'Barang inventaris tidak ditemukan'; end if;
 update public.inventory_items set quantity=quantity+p_quantity,condition_status=case when p_condition='rusak' then 'rusak' when p_condition='perlu_perbaikan' and condition_status<>'rusak' then 'perlu_perbaikan' else condition_status end,updated_at=now() where id=v_item.id returning quantity-p_quantity,quantity into v_previous,v_new;
 update public.inventory_loan_items set quantity_returned=quantity_returned+p_quantity,condition_on_return=p_condition,return_notes=coalesce(return_notes,'')||case when length(trim(coalesce(p_notes,'')))>0 then case when return_notes='' then '' else E'\n' end||trim(p_notes) else '' end where id=p_loan_item_id returning * into v_line;
 insert into public.inventory_movements(item_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,reference,actor_id) values(v_item.id,'stock_in',p_quantity,v_previous,v_new,'Pengembalian inventaris ('||p_condition||')',v_loan.loan_code,auth.uid());
 if not exists(select 1 from public.inventory_loan_items where loan_id=v_loan.id and quantity_returned<quantity_borrowed) then update public.inventory_loans set status='returned',updated_at=now() where id=v_loan.id; else update public.inventory_loans set status='partial_returned',updated_at=now() where id=v_loan.id; end if;
 return v_line;
end; $function$;
revoke all on function public.inventory_create_loan(text,text,text,text,date,text,jsonb) from public,anon;
revoke all on function public.inventory_return_loan_item(uuid,integer,text,text) from public,anon;
grant execute on function public.inventory_create_loan(text,text,text,text,date,text,jsonb) to authenticated;
grant execute on function public.inventory_return_loan_item(uuid,integer,text,text) to authenticated;

create index if not exists inventory_loans_actor_idx on public.inventory_loans(actor_id);
