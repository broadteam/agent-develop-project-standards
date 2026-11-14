'use strict';
const fs=require('node:fs');
const {TextDecoder}=require('node:util');
const {createHash}=require('node:crypto');
const SETS=new Set(['reason_codes','permitted_actions','prohibited_actions','user_decisions_needed']);
const ENUMS={
 packet_schema_validation:['valid','invalid','unsupported'],
 protocol_compatibility:['compatible','unsupported','incompatible','unknown'],
 freshness:['current','stale','conflict','unknown'],
 applicability:['applicable','not_applicable','not_configured','unknown'],
 identity_state:['resolved','provisional','ambiguous','conflict','unknown'],
 path_identity_state:['unique','ambiguous','conflict','unknown'],
 fingerprint_coverage:['complete','partial','unknown'],
 observation_consistency:['stable','changed_during_capture','unknown'],
 recovery_mode:['normal','restricted','blocked']
};
const PROFILES={
 'packet-only':{version:'0.1.0',sha:'a44342ea0007981a786784af61c44e36f101548b',profiles:['packet_only'],caps:['read_packet_bytes','validate_packet_schema','inspect_packet_fields']},
 'provider-stub':{version:'0.1.0',sha:'7784c321f69e5f812b2bca22184ca13335c985e1',profiles:['provider_stub'],caps:['resolve_synthetic_provider_identity','inject_provider_response_classes']},
 'local-git-contract':{version:'0.1.0',sha:'b0fc0273870f4591e5a53a51db7d189c012c826c',profiles:['local_git','local_git_submodule','fault_injection'],caps:['create_disposable_repository','read_git_head','read_git_index','read_porcelain_v2_status','inject_disposable_worktree_events']}
};
function scalar(s){if(typeof s!=='string')throw Error('string required');for(let i=0;i<s.length;i++){let c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){let n=s.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))throw Error('unpaired surrogate')}else if(c>=0xdc00&&c<=0xdfff)throw Error('unpaired surrogate')}return s}
function cmp(a,b){return Buffer.compare(Buffer.from(scalar(a)),Buffer.from(scalar(b)))}
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort(cmp).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v)}
function parseBytes(bytes){
 let s;try{s=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw Error('invalid UTF-8')}
 let i=0;const ws=()=>{while(i<s.length&&/[ \t\r\n]/.test(s[i]))i++};
 function string(){let a=i;if(s[i++]!=='"')throw Error('expected string');while(i<s.length){let c=s[i++];if(c==='"')return scalar(JSON.parse(s.slice(a,i)));if(c==='\\')i++;else if(c.charCodeAt(0)<32)throw Error('control character')}throw Error('unterminated string')}
 function value(){ws();let c=s[i];if(c==='"')return string();if(c==='{'){i++;ws();let o=Object.create(null);if(s[i]==='}'){i++;return o}while(true){ws();let k=string();if(Object.hasOwn(o,k))throw Error('duplicate object member');ws();if(s[i++]!==':')throw Error('colon expected');o[k]=value();ws();let q=s[i++];if(q==='}')break;if(q!==',')throw Error('object separator expected')}return o}if(c==='['){i++;ws();let a=[];if(s[i]===']'){i++;return a}while(true){a.push(value());ws();let q=s[i++];if(q===']')break;if(q!==',')throw Error('array separator expected')}return a}let m=/^(true|false|null)(?![A-Za-z0-9_])/.exec(s.slice(i));if(m){i+=m[0].length;return m[0]==='true'?true:m[0]==='false'?false:null}m=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(s.slice(i));if(m){i+=m[0].length;return Number(m[0])}throw Error('JSON value expected')}
 let x=value();ws();if(i!==s.length)throw Error('trailing JSON data');return x
}
function read(p){return parseBytes(fs.readFileSync(p))}
function projection(c){
 const e=c.expected;
 function rows(items,key){
  const seen=new Set();
  return items.map(r=>{
   if(!r||typeof r[key]!=='string')throw Error('expected projection row key missing');
   scalar(r[key]);
   if(seen.has(r[key]))throw Error('duplicate expected projection key');
   seen.add(r[key]);
   return {[key]:r[key],fields:Object.keys(r).filter(k=>k!==key).sort(cmp)};
  }).sort((a,b)=>cmp(a[key],b[key]));
 }
 return {packet_fields:['packet_schema_validation','protocol_compatibility'],claims:rows(e.claims,'claim_ref'),recovery:rows(e.recovery,'operation_scope')};
}
function reconcile(c,o){if(o.contract!=='scp-synthetic-observation-package'||o.source!=='independent-test-vector')throw Error('synthetic observation package required');if(o.fixture_id!==c.fixture_id)throw Error('observation fixture_id mismatch');if(stable(c.stimulus.events.map(x=>x.sequence))!==stable(o.executed_event_sequences))throw Error('event sequence mismatch');if(stable(c.companion_observations)!==stable(o.records))throw Error('observation mismatch');let p=c.environment.capability_profile,profile=PROFILES[p.profile_id],cap=o.capability_observation;if(!profile||profile.version!==p.profile_version||profile.sha!==p.profile_blob_sha)throw Error('profile pin mismatch');if(c.environment.profiles.some(x=>!profile.profiles.includes(x)))throw Error('unsupported declared profile');if(!cap||typeof cap!=='object'||Array.isArray(cap)||cap.source!=='synthetic_profile_fixture'||!Array.isArray(cap.available_capabilities)||cap.available_capabilities.some(x=>typeof x!=='string')||new Set(cap.available_capabilities).size!==cap.available_capabilities.length||stable([...cap.available_capabilities].sort(cmp))!==stable([...profile.caps].sort(cmp)))throw Error('synthetic capability mismatch');return{source:'synthetic_fixture_vector',executed_event_sequences:o.executed_event_sequences,records:o.records,capability_observation:cap}}
function request(c,o,ctxSha,obsBytes){return{contract:'scp-client-evaluation-request',request_version:'0.1.0',fixture_id:c.fixture_id,deterministic_clock:c.environment.clock,inputs:{packet:c.target.packet,packet_schema:c.target.packet_schema,source_repository_revision:c.target.repository_revision,capability_profile:c.environment.capability_profile,driver:c.setup.driver,context_blob_sha:ctxSha},declared_profiles:c.environment.profiles,observation_package:reconcile(c,o),observation_package_sha256:'sha-256:'+createHash('sha256').update(obsBytes).digest('hex'),projection:projection(c)}}
function norm(raw,proj){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('response object required');
 for(let k of Object.keys(raw))if(!['packet_schema_validation','protocol_compatibility','claims','recovery'].includes(k))throw Error('unknown core field');
 if(!Array.isArray(raw.claims)||!Array.isArray(raw.recovery))throw Error('claims/recovery arrays required');
 let out={contract:'scp-fixture-normalized-result',result_version:'0.1.0'};
 function field(k,v){if(v===null)throw Error('null invalid');if(SETS.has(k)){if(!Array.isArray(v)||new Set(v).size!==v.length)throw Error('invalid/duplicate set');for(let x of v){scalar(x);if(k==='reason_codes'&&!/^scp\.fixture\.[a-z0-9][a-z0-9._-]*$/.test(x))throw Error('invalid reason code');if((k==='permitted_actions'||k==='prohibited_actions')&&!/^[a-z][a-z0-9._:-]*$/.test(x))throw Error('invalid action identifier');if(k==='user_decisions_needed'&&x.length===0)throw Error('empty user decision')}return [...v].sort(cmp)}if(!ENUMS[k]||!ENUMS[k].includes(v))throw Error('unsupported enum '+k);return scalar(v)}
 for(let k of proj.packet_fields)if(Object.hasOwn(raw,k))out[k]=field(k,raw[k]);
 function rows(items,key,defs){let seen=new Set(),map=new Map(defs.map(x=>[x[key],new Set(x.fields)]));return items.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r)||typeof r[key]!=='string')throw Error('row key missing');scalar(r[key]);if(seen.has(r[key]))throw Error('duplicate row key');seen.add(r[key]);let allowed=map.get(r[key]);if(!allowed)throw Error('row outside projection');if(Object.keys(r).length===1)return null;for(let k of Object.keys(r))if(k!==key&&!allowed.has(k))throw Error('field outside projection');let z={[key]:r[key]};for(let k of Object.keys(r).filter(x=>x!==key).sort(cmp))z[k]=field(k,r[k]);return z}).filter(Boolean).sort((a,b)=>cmp(a[key],b[key]))}
 out.claims=rows(raw.claims,'claim_ref',proj.claims);out.recovery=rows(raw.recovery,'operation_scope',proj.recovery);return out
}
module.exports={read,parseBytes,stable,cmp,projection,reconcile,request,norm};
