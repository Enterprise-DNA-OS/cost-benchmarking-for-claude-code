#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,table,record,writeOut} from './lib/render.mjs';

export const usage={
 help:'Show this command list',projects:'List projects',
 'add-project':'--code --name --sector --region --work-type --currency --area --owner',
 plans:'List plan revisions',
 'add-plan':'PROJECT --ref --base-date --index-series --index --source --scope --assumptions --exclusions --uncertainty --contingency --due --actor',
 'cost-plan':'PLAN: header, cost lines and total',
 'add-line':'PLAN --code --description --quantity --unit --rate [--amount] --actor',
 review:'PLAN --decision=approved|changes --note --actor',
 benchmark:'PLAN: latest approved comparable plans, rebased to its index',
 'rate-review':'List old benchmark plans and missing source records',
 'tender-add':'PLAN --supplier --code --amount --source --date --actor',
 'tender-reconcile':'PLAN: complete and incomplete tender comparisons',
 'plan-compare':'PLAN PLAN: added, removed and changed elements',
 attention:'Overdue reviews and stale benchmarks',compliance:'Cost prediction record checks',
 log:'PROJECT --note --actor',history:'PROJECT: recorded changes and notes',
 import:'uniphi FILE.csv --project=PROJECT plus add-plan fields [--dry-run]',
 export:'--out=FILE.json: all records, refuses overwrite',
 'weekly-review':'Write local HTML from plans, attention and compliance',
 'draft-cost-report':'PLAN: local cost prediction report for professional review',
 insights:'Ten questions answered from the records'
};
export function parseArgs(args){const pos=[],opts={};for(const a of args){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Duplicate option ${k}`);opts[k]=i<0?true:a.slice(i+1);}else pos.push(a);}return {pos,opts};}
const required=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(`Required: ${label}`);return v.trim();};
export function decimal(v,label,{positive=false,max=1e11,places=4}={}){const s=required(v,label);if(!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(s)||!Number.isFinite(Number(s))||Number(s)>max||(positive&&Number(s)<=0))throw Error(`Invalid ${label}: use a ${positive?'positive':'nonnegative'} decimal, at most ${places} places`);return s;}
export function date(v,label){const s=required(v,label);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error(`Invalid ${label}: YYYY-MM-DD`);return s;}
const today=()=>new Date().toISOString().slice(0,10);
export async function resolve(db,type,value){const name=required(value,type);const config={projects:['code','name'],plans:['ref','ref']}[type];if(!config)throw Error('Invalid resolver');
 const rows=await db.query(`select * from ${type} where lower(${config[0]})=lower($1) or lower(${config[1]})=lower($1) or id::text ilike $2 order by ${config[0]}`,[name,name.replace(/[\\%_]/g,'\\$&')+'%']);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${type}:\n${rows.map(r=>`${r.id} ${r[config[0]]} ${r[config[1]]}`).join('\n')}`:`No ${type} matching ${name}`);return rows[0];}
async function tx(db,fn){await db.exec('BEGIN');try{const result=await fn();await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
const journal=(db,project,plan,actor,event,detail)=>db.query('insert into journal(project_id,plan_id,actor,event,detail) values($1,$2,$3,$4,$5)',[project,plan,required(actor,'actor'),event,JSON.stringify(detail)]);
function planFields(o){return {
 ref:required(o.ref,'ref'),base_date:date(o['base-date'],'base-date'),index_series:required(o['index-series'],'index-series'),price_index:decimal(o.index,'index',{positive:true}),
 source:required(o.source,'source'),scope:required(o.scope,'scope'),assumptions:required(o.assumptions,'assumptions'),exclusions:required(o.exclusions,'exclusions'),
 uncertainty_pct:decimal(o.uncertainty,'uncertainty',{max:100,places:2}),contingency_pct:decimal(o.contingency,'contingency',{max:100,places:2}),due_date:date(o.due,'due'),author:required(o.actor,'actor')};}
async function insertPlan(db,project,o){const p=planFields(o);if(p.base_date>today())throw Error('Base date cannot be in the future');await db.query('select id from projects where id=$1 for update',[project.id]);
 const r=await db.query('select coalesce(max(revision),0)+1 as revision from plans where project_id=$1',[project.id]);
 const keys=['project_id','revision',...Object.keys(p)];return (await db.query(`insert into plans(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,[project.id,r[0].revision,...Object.values(p)]))[0];}
async function insertLine(db,plan,o){const code=required(o.code,'code'),description=required(o.description,'description'),quantity=decimal(o.quantity,'quantity',{positive:true}),unit=required(o.unit,'unit'),rate=decimal(o.rate,'rate');
 const amount=o.amount===undefined?null:decimal(o.amount,'amount',{places:2});
 return (await db.query('insert into cost_lines(plan_id,code,description,quantity,unit,rate,amount) values($1,$2,$3,$4,$5,$6,coalesce($7::numeric,round($4::numeric*$6::numeric,2))) returning *',[plan.id,code,description,quantity,unit,rate,amount]))[0];}
async function planData(db,id){return {header:(await db.query('select p.*,j.name as project,j.currency,j.area_m2 from plans p join projects j on j.id=p.project_id where p.id=$1',[id]))[0],lines:await db.query('select code,description,quantity,unit,rate,amount from cost_lines where plan_id=$1 order by code',[id]),total:(await db.query('select * from plan_totals where id=$1',[id]))[0]};}
export async function benchmarks(db,id){return db.query(`with target as(select * from plan_totals where id=$1), ranked as(
 select c.*,row_number() over(partition by c.project_id order by c.revision desc) as rn from plan_totals c where c.status='approved')
 select c.ref,c.project,c.currency,c.base_date,c.area_m2,c.rate_per_m2 as original_rate,
 round(c.total_amount/c.area_m2*t.price_index/c.price_index,2) as rebased_rate,
 round((t.total_amount/t.area_m2)/(c.total_amount/c.area_m2*t.price_index/c.price_index)*100-100,2) as target_variance_pct
 from ranked c cross join target t where c.rn=1 and c.project_id<>t.project_id and c.sector=t.sector and c.region=t.region and c.work_type=t.work_type
 and c.currency=t.currency and c.index_series=t.index_series and c.base_date between current_date-365 and current_date and c.line_count>0 and c.total_amount>0
 order by c.ref`,[id]);}
const questions=[
 ['Which reviews are overdue?','select ref,owner,due from attention_items where issue=\'Review overdue\' order by due'],
 ['Which benchmark plans are older than a year?','select ref,owner,due from attention_items where issue like \'Benchmark%\' order by due'],
 ['Which cost plans lack source evidence?',"select ref,rule,finding from compliance_findings where rule='source'"],
 ['Which cost plans have missing assumptions?',"select ref,rule,finding from compliance_findings where rule='assumptions'"],
 ['Which tenders omit cost elements?',"select ref,supplier,priced_lines,line_count from tender_summary where coverage='incomplete'"],
 ['Which complete tenders exceed the base estimate?',"select ref,supplier,currency,variance_amount from tender_summary where coverage='complete' and variance_amount>0"],
 ['Which owners carry overdue reviews?',"select owner,count(*)::integer as overdue from attention_items where issue='Review overdue' group by owner"],
 ['Which cost plans are awaiting independent review?',"select ref,author,due_date from plans where status<>'approved' order by due_date"],
 ['Which projects have multiple cost plan revisions?',"select j.code,j.name,count(*)::integer as revisions from plans p join projects j on j.id=p.project_id group by j.id having count(*)>1"],
 ['Which comparison groups have fewer than two current approved projects?',"select sector,region,work_type,currency,index_series,count(distinct project_id)::integer as projects from plan_totals where status='approved' and base_date>=current_date-365 group by sector,region,work_type,currency,index_series having count(distinct project_id)<2"]
];
export const questionTexts=questions.map(x=>x[0]);

// UniPhi publishes hierarchical CodeN/DescriptionN headers, not a fixed number of levels.
// Parent totals are excluded. Exact leaf paths identify entries, so parents cannot be counted twice.
export function budgetRows(input){const rows=parseCsv(input);if(!rows.length)throw Error('Empty budget export');const headers=Object.keys(rows[0]);
 const levels=headers.filter(k=>/^Code\d+$/i.test(k)).map(k=>Number(k.match(/\d+/)[0])).sort((a,b)=>a-b);if(!levels.length||levels[0]!==1)throw Error('Missing Code1 header');
 for(let i=0;i<levels.length;i++)if(levels[i]!==i+1||!headers.some(h=>h.toLowerCase()===`description${levels[i]}`))throw Error('Code levels must be consecutive with DescriptionN headers');
 const context=[],nodes=[];for(const [idx,row]of rows.entries()){
  const supplied=levels.filter(n=>pick(row,`Code${n}`).trim());if(!supplied.length){if(pick(row,'Budget','Qty','Rate').trim())throw Error(`Row ${idx+2}: amount without a cost code`);continue;}
  const depth=Math.max(...supplied);for(const n of supplied){const code=pick(row,`Code${n}`).trim();if(code.includes('/'))throw Error('Slash in source code is ambiguous');if(context[n-1]!==code)context.length=n-1;context[n-1]=code;}
  context.length=depth;if(context.length!==depth||Array.from({length:depth},(_,i)=>context[i]).some(v=>!v))throw Error(`Row ${idx+2}: missing parent code`);
  const code=context.join('/'),description=required(pick(row,`Description${depth}`),`row ${idx+2} description`);
  if(nodes.some(n=>n.code===code))throw Error(`Duplicate cost path ${code}`);
  nodes.push({code,description,row,number:idx+2});
 }
 const leaves=nodes.filter(n=>!nodes.some(other=>other.code.startsWith(n.code+'/')));if(!leaves.length)throw Error('No leaf cost rows');
 return leaves.map(({code,description,row,number})=>{const budget=pick(row,'Budget').trim(),qty=pick(row,'Qty').trim(),unit=pick(row,'Unit').trim(),rate=pick(row,'Rate').trim();
  if(qty||unit||rate){if(!qty||!unit||!rate)throw Error(`Row ${number}: Qty, Unit and Rate must be supplied together`);return {code,description,quantity:decimal(qty,'Qty',{positive:true}),unit,rate:decimal(rate,'Rate'),...(budget!==''?{amount:decimal(budget,'Budget',{places:2})}:{})};}
  if(!budget)throw Error(`Row ${number}: need Budget or Qty/Unit/Rate`);const amount=decimal(budget,'Budget',{places:2});return {code,description,quantity:'1',unit:'item',rate:amount,amount};
 });}

export async function run(db,cmd,args=[],o={}){
 if(!(cmd in usage))throw Error(`Unknown command: ${cmd}`);
 if(cmd==='help')return Object.entries(usage).map(([command,arguments_])=>({command,arguments:arguments_}));
 if(cmd==='projects')return db.query('select code,name,sector,region,work_type,currency,area_m2,owner from projects order by code');
 if(cmd==='plans')return db.query('select ref,project,revision,currency,status,line_count,total_amount,rate_per_m2,due_date from plan_totals order by ref');
 if(cmd==='attention')return db.query('select ref,owner,issue,due from attention_items order by due,ref');
 if(cmd==='compliance')return db.query('select ref,rule,finding from compliance_findings order by ref,rule');
 if(cmd==='rate-review')return db.query("select ref,base_date,currency,index_series,price_index,status from plans p join projects j on j.id=p.project_id where base_date<current_date-365 or btrim(source)='' order by base_date");
 if(cmd==='insights'){const out=[];for(const [question,sql] of questions)out.push({question,rows:await db.query(sql)});return out;}
 if(cmd==='add-project')return tx(db,async()=>{const currency=required(o.currency,'currency').toUpperCase();const r=(await db.query('insert into projects(code,name,sector,region,work_type,currency,area_m2,owner) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[required(o.code,'code'),required(o.name,'name'),required(o.sector,'sector'),required(o.region,'region'),required(o['work-type'],'work-type'),currency,decimal(o.area,'area',{positive:true}),required(o.owner,'owner')]))[0];await journal(db,r.id,null,o.owner,'project-added',{code:r.code});return r;});
 if(cmd==='add-plan')return tx(db,async()=>{const j=await resolve(db,'projects',args[0]),p=await insertPlan(db,j,o);await journal(db,j.id,p.id,o.actor,'plan-added',{ref:p.ref});return p;});
 if(cmd==='cost-plan'){const p=await resolve(db,'plans',args[0]);return planData(db,p.id);}
 if(cmd==='add-line')return tx(db,async()=>{const p=await resolve(db,'plans',args[0]);const r=await insertLine(db,p,o);await journal(db,p.project_id,p.id,o.actor,'line-added',r);return r;});
 if(cmd==='review')return tx(db,async()=>{const p=await resolve(db,'plans',args[0]);await db.query('select id from plans where id=$1 for update',[p.id]);const actor=required(o.actor,'actor'),note=required(o.note,'note');if(!['approved','changes'].includes(o.decision))throw Error('Decision must be approved or changes');
  if(o.decision==='approved'){if(actor.toLowerCase()===p.author.trim().toLowerCase())throw Error('Independent reviewer must differ from author');const findings=await db.query("select finding from compliance_findings where plan_id=$1 and rule<>'review'",[p.id]);if(findings.length)throw Error('Record gaps: '+findings.map(r=>r.finding).join('; '));}
  const r=(await db.query('update plans set status=$2,reviewed_by=$3,reviewed_at=now(),decision_note=$4 where id=$1 returning *',[p.id,o.decision,actor,note]))[0];await journal(db,p.project_id,p.id,actor,'review',{decision:o.decision,note});return r;});
 if(cmd==='benchmark')return benchmarks(db,(await resolve(db,'plans',args[0])).id);
 if(cmd==='tender-add')return tx(db,async()=>{const p=await resolve(db,'plans',args[0]);const r=(await db.query('insert into tenders(plan_id,supplier,line_code,amount,source,received_date) values($1,$2,$3,$4,$5,$6) returning *',[p.id,required(o.supplier,'supplier'),required(o.code,'code'),decimal(o.amount,'amount',{places:2}),required(o.source,'source'),date(o.date,'date')]))[0];await journal(db,p.project_id,p.id,o.actor,'tender-added',r);return r;});
 if(cmd==='tender-reconcile')return db.query('select ref,supplier,currency,priced_lines,line_count,tender_amount,base_amount,variance_amount,coverage from tender_summary where plan_id=$1 order by supplier',[(await resolve(db,'plans',args[0])).id]);
 if(cmd==='plan-compare'){const a=await resolve(db,'plans',args[0]),b=await resolve(db,'plans',args[1]);if(a.project_id!==b.project_id)throw Error('Revision comparison requires the same project');return db.query(`select coalesce(a.code,b.code) as code,coalesce(a.description,b.description) as description,a.amount as before_amount,b.amount as after_amount,coalesce(b.amount,0)-coalesce(a.amount,0) as change_amount from (select * from cost_lines where plan_id=$1) a full join (select * from cost_lines where plan_id=$2) b using(code) order by code`,[a.id,b.id]);}
 if(cmd==='log')return tx(db,async()=>{const p=await resolve(db,'projects',args[0]);await journal(db,p.id,null,o.actor,'note',{note:required(o.note,'note')});return {recorded:true};});
 if(cmd==='history')return db.query('select actor,event,detail,created_at from journal where project_id=$1 order by created_at,id',[(await resolve(db,'projects',args[0])).id]);
 if(cmd==='import'){
  if(args[0]!=='uniphi')throw Error('Import supports uniphi');const content=fs.readFileSync(required(args[1],'CSV path'),'utf8'),lines=budgetRows(content),p=await resolve(db,'projects',o.project);const fields=planFields(o);
  const digest=createHash('sha256').update(JSON.stringify({content,project:p.id,fields})).digest('hex');const existing=await db.query('select plan_id,row_count from imports where digest=$1',[digest]);if(existing.length)return {unchanged:true,...existing[0]};
  if(o['dry-run'])return {dry_run:true,project:p.code,ref:fields.ref,leaf_rows:lines.length,lines};
  return tx(db,async()=>{const plan=await insertPlan(db,p,o);for(const row of lines)await insertLine(db,plan,row);await db.query('insert into imports(digest,plan_id,source,row_count) values($1,$2,$3,$4)',[digest,plan.id,fields.source,lines.length]);await journal(db,p.id,plan.id,o.actor,'import',{source:fields.source,digest,leaf_rows:lines.length});return {plan_id:plan.id,ref:plan.ref,leaf_rows:lines.length};});
 }
 if(cmd==='export'){const out=path.resolve(required(o.out,'out'));const data=await tx(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const result={format:'cost-benchmarking-v1',exported_at:new Date().toISOString()};for(const t of ['projects','plans','cost_lines','tenders','journal','imports'])result[t]=await db.query(`select * from ${t} order by id`);return result;});fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file:out,projects:data.projects.length,plans:data.plans.length};}
 if(cmd==='weekly-review'){const sections=[];for(const [title,c] of [['Cost plans','plans'],['Attention','attention'],['Compliance records','compliance']])sections.push({title,html:table(await run(db,c))});return {file:writeOut('drafts','weekly-review',page({title:'Weekly cost review',subtitle:'Internal draft. Figures retain their stated currency.',sections})),sent:false};}
 if(cmd==='draft-cost-report'){const p=await resolve(db,'plans',args[0]),d=await planData(db,p.id);const sections=[{title:'Basis and scope',html:record(d.header,['ref','project','status','currency','area_m2','base_date','source','scope','assumptions','exclusions','uncertainty_pct','contingency_pct','index_series','price_index','author','reviewed_by'])},{title:'Elemental estimate',html:table(d.lines)},{title:'Cost summary',html:table([d.total],['currency','base_amount','contingency_amount','total_amount','rate_per_m2'])},{title:'Comparable projects',note:'Same sector, region, work type, currency and index series. Current approved plans only. Index values are supplied by the operator.',html:table(await benchmarks(db,p.id))},{title:'Record findings',note:'Professional review is required. This draft is not a certification.',html:table(await db.query('select rule,finding from compliance_findings where plan_id=$1',[p.id]))}];return {file:writeOut('drafts',`cost-report-${p.id}`,page({title:'Draft cost prediction report',subtitle:p.ref,sections})),sent:false};}
}
export function human(result){if(Array.isArray(result)){if(!result.length)return '  (none)';if(result[0].question)return result.map(x=>`${x.question}\n${human(x.rows)}`).join('\n\n');return textTable(result,Object.keys(result[0]).map(key=>({key,label:key,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v})));}if(result&&typeof result==='object')return Object.entries(result).map(([k,v])=>`${k}:\n${v&&typeof v==='object'?human(Array.isArray(v)?v:[v]):String(v)}`).join('\n');return String(result);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{const {pos,opts}=parseArgs(process.argv.slice(2));const cmd=pos.shift()||(opts.help?'help':'help');db=await getDb();const result=await run(db,cmd,pos,opts);console.log(opts.json?JSON.stringify(result,null,2):human(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
