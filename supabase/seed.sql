insert into projects(id,code,name,sector,region,work_type,currency,area_m2,owner) values
 ('10000000-0000-0000-0000-000000000001','SCH-01','Harbour School','Education','Auckland','New build','NZD',1000,'Mia'),
 ('10000000-0000-0000-0000-000000000002','SCH-02','Kauri School','Education','Auckland','New build','NZD',1200,'Tane'),
 ('10000000-0000-0000-0000-000000000003','SCH-03','Estuary School','Education','Auckland','New build','NZD',900,'Mia'),
 ('10000000-0000-0000-0000-000000000004','AUD-01','Southern School','Education','Sydney','New build','AUD',1000,'Alex') on conflict do nothing;
insert into plans(id,project_id,ref,revision,base_date,index_series,price_index,source,scope,assumptions,exclusions,uncertainty_pct,contingency_pct,due_date,author) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','HARBOUR-1',1,current_date-30,'Demo Auckland series',110,'Fictional cost plan H1','Classroom block','Normal ground','Land and GST',15,10,current_date+10,'Mia'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','KAURI-1',1,current_date-60,'Demo Auckland series',100,'Fictional cost plan K1','Classroom block','Normal ground','Land and GST',15,10,current_date+10,'Tane'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','ESTUARY-1',1,current_date-450,'Demo Auckland series',90,'','Classroom block','','Land and GST',20,15,current_date-4,'Mia'),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','SOUTHERN-1',1,current_date-40,'Demo Sydney series',100,'Fictional cost plan S1','Classroom block','Normal ground','Land and GST',15,10,current_date+10,'Alex') on conflict do nothing;
insert into cost_lines(plan_id,code,description,quantity,unit,rate,amount)
 select p.id,x.code,x.description,j.area_m2,'m2',x.rate,round(j.area_m2*x.rate,2)
 from plans p join projects j on j.id=p.project_id
 cross join (values ('01','Substructure',300.0000),('02','Superstructure',1500.0000),('03','Services',700.0000)) x(code,description,rate)
 where p.status='draft' and p.ref in ('HARBOUR-1','KAURI-1','ESTUARY-1','SOUTHERN-1') on conflict do nothing;
update plans set status='approved',reviewed_by='Aroha',reviewed_at=now(),decision_note='Fictional demo peer review'
 where ref in ('HARBOUR-1','KAURI-1','SOUTHERN-1') and status='draft';
insert into tenders(plan_id,supplier,line_code,amount,source,received_date) values
 ('20000000-0000-0000-0000-000000000001','Demo tender A','01',310000,'Fictional tender A',current_date-2),
 ('20000000-0000-0000-0000-000000000001','Demo tender A','02',1550000,'Fictional tender A',current_date-2),
 ('20000000-0000-0000-0000-000000000001','Demo tender A','03',710000,'Fictional tender A',current_date-2),
 ('20000000-0000-0000-0000-000000000001','Demo tender B','01',290000,'Fictional incomplete tender B',current_date-2) on conflict do nothing;
