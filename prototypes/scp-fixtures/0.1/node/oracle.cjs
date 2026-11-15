'use strict';
const {stable,cmp}=require('./adapter.cjs');
const SETS=new Set(['reason_codes','permitted_actions','prohibited_actions','user_decisions_needed']);
function rows(list,key){let m=new Map();for(let r of list||[]){if(!r||typeof r[key]!=='string'||m.has(r[key]))throw Error('invalid/duplicate actual row key');m.set(r[key],r)}return m}
function evaluate(c,actual,started=true){
 actual=actual||{};let claims=rows(actual.claims,'claim_ref'),recovery=rows(actual.recovery,'operation_scope'),a=[];
 function add(kind,ref,field,expected,row){let present=!!row&&Object.hasOwn(row,field),out=!started?'not_run':!present?'inconclusive':stable(SETS.has(field)?[...expected].sort(cmp):expected)===stable(SETS.has(field)?[...row[field]].sort(cmp):row[field])?'passed':'failed';a.push({subject_kind:kind,...(ref===undefined?{}:{subject_ref:ref}),field,outcome:out})}
 for(let f of ['packet_schema_validation','protocol_compatibility'])add('packet',undefined,f,c.expected[f],actual);
 for(let r of c.expected.claims)for(let f of Object.keys(r).filter(k=>k!=='claim_ref').sort(cmp))add('claim',r.claim_ref,f,r[f],claims.get(r.claim_ref));
 for(let r of c.expected.recovery)for(let f of Object.keys(r).filter(k=>k!=='operation_scope').sort(cmp))add('recovery',r.operation_scope,f,r[f],recovery.get(r.operation_scope));
 let rank={packet:0,claim:1,recovery:2};a.sort((x,y)=>rank[x.subject_kind]-rank[y.subject_kind]||cmp(x.subject_ref||'',y.subject_ref||'')||cmp(x.field,y.field));
 let counts={passed:0,failed:0,inconclusive:0,not_run:0};for(let x of a)counts[x.outcome]++;
 return{conformance_outcome:!started?'not_run':counts.failed?'non_conformant':counts.inconclusive||counts.not_run?'inconclusive':'conformant',assertion_counts:counts,assertions:a}
}
module.exports={evaluate};
