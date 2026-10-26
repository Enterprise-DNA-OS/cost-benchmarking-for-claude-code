create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table projects (
 id uuid primary key default gen_random_uuid(), code text not null unique check(btrim(code)<>''), name text not null check(btrim(name)<>''),
 sector text not null, region text not null, work_type text not null, currency text not null check(currency in ('AUD','NZD','USD','GBP','EUR')),
 area_m2 numeric(16,4) not null check(area_m2>0), owner text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index project_code_ci on projects(lower(code));
create table plans (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), ref text not null unique,
 revision integer not null check(revision>0), base_date date not null, index_series text not null, price_index numeric(16,4) not null check(price_index>0),
 source text not null, scope text not null, assumptions text not null, exclusions text not null,
 uncertainty_pct numeric(6,2) not null check(uncertainty_pct between 0 and 100), contingency_pct numeric(6,2) not null check(contingency_pct between 0 and 100),
 due_date date not null, author text not null, status text not null default 'draft' check(status in ('draft','approved','changes')),
 reviewed_by text, reviewed_at timestamptz, decision_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,revision)
);
create unique index plan_ref_ci on plans(lower(ref));
create table cost_lines (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id), code text not null,
 description text not null, quantity numeric(16,4) not null check(quantity>0), unit text not null,
 rate numeric(16,4) not null check(rate>=0), amount numeric(18,2) not null check(amount>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(plan_id,code)
);
create table tenders (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id), supplier text not null,
 line_code text not null, amount numeric(18,2) not null check(amount>=0), source text not null, received_date date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(plan_id,line_code) references cost_lines(plan_id,code)
);
create unique index tender_line_ci on tenders(plan_id,lower(supplier),line_code);
create table journal (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), plan_id uuid references plans(id),
 actor text not null, event text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), digest text not null unique, plan_id uuid not null references plans(id), source text not null,
 row_count integer not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function protect_plan() returns trigger language plpgsql as $$ begin
 if old.status='approved' then raise exception 'Approved plans are immutable; create a new revision'; end if;
 return new;
end $$;
create trigger protect_plan before update or delete on plans for each row execute function protect_plan();
create function protect_lines() returns trigger language plpgsql as $$ declare plan_status text; begin
 select status into plan_status from plans where id=coalesce(new.plan_id,old.plan_id) for update;
 if plan_status='approved' then raise exception 'Approved plan lines are immutable'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_lines before insert or update or delete on cost_lines for each row execute function protect_lines();
create function append_only() returns trigger language plpgsql as $$ begin raise exception 'Append-only record'; end $$;
create trigger lines_append_only before update or delete on cost_lines for each row execute function append_only();
create trigger journal_immutable before update or delete on journal for each row execute function append_only();
create trigger imports_immutable before update or delete on imports for each row execute function append_only();
create trigger tenders_immutable before update or delete on tenders for each row execute function append_only();
-- Project comparison dimensions must not change under issued plans.
create trigger projects_immutable before update or delete on projects for each row execute function append_only();
do $$ declare t text; begin foreach t in array array['projects','plans','cost_lines','tenders','journal','imports'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
end loop; end $$;
create view plan_totals with (security_invoker=true) as
 select p.id,p.project_id,p.ref,p.revision,j.name as project,j.sector,j.region,j.work_type,j.currency,j.area_m2,j.owner,
 p.base_date,p.index_series,p.price_index,p.due_date,p.author,p.status,p.reviewed_by,
 count(l.id)::integer as line_count, coalesce(sum(l.amount),0)::numeric(18,2) as base_amount,
 round(coalesce(sum(l.amount),0)*p.contingency_pct/100,2) as contingency_amount,
 round(coalesce(sum(l.amount),0)*(1+p.contingency_pct/100),2) as total_amount,
 round(coalesce(sum(l.amount),0)*(1+p.contingency_pct/100)/j.area_m2,2) as rate_per_m2
 from plans p join projects j on j.id=p.project_id left join cost_lines l on l.plan_id=p.id group by p.id,j.id;
create view compliance_findings with (security_invoker=true) as
 select p.id as plan_id,p.ref,'source' as rule,'Missing cost evidence reference' as finding from plans p where btrim(source)=''
 union all select id,ref,'scope','Missing scope' from plans where btrim(scope)=''
 union all select id,ref,'assumptions','Missing assumptions' from plans where btrim(assumptions)=''
 union all select id,ref,'exclusions','Missing exclusions (state none explicitly)' from plans where btrim(exclusions)=''
 union all select p.id,p.ref,'lines','No cost lines' from plans p where not exists(select 1 from cost_lines l where l.plan_id=p.id)
 union all select id,ref,'future-base','Base date is in the future' from plans where base_date>current_date
 union all select id,ref,'index-source','Missing price index series and basis' from plans where btrim(index_series)=''
 union all select id,ref,'review','Independent review not recorded' from plans where status<>'approved';
create view attention_items with (security_invoker=true) as
 select id as plan_id,ref,owner,'Review overdue' as issue,due_date as due from plan_totals where status<>'approved' and due_date<current_date
 union all select id,ref,owner,'Benchmark older than 365 days',base_date+365 from plan_totals where base_date<current_date-365;
create view tender_summary with (security_invoker=true) as
 select p.id as plan_id,p.ref,min(t.supplier) as supplier,p.currency,count(t.id)::integer as priced_lines,p.line_count,
 sum(t.amount)::numeric(18,2) as tender_amount,p.base_amount,
 case when count(t.id)=p.line_count then (sum(t.amount)-p.base_amount)::numeric(18,2) end as variance_amount,
 case when count(t.id)=p.line_count then 'complete' else 'incomplete' end as coverage
 from plan_totals p join tenders t on t.plan_id=p.id group by p.id,p.ref,p.currency,p.line_count,p.base_amount,lower(t.supplier);
