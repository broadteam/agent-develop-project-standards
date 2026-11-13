"""Independent Python fixture adapter prototype; standard library only."""
import hashlib
import json
import re

SETS={"reason_codes","permitted_actions","prohibited_actions","user_decisions_needed"}
ENUMS={
 "packet_schema_validation":{"valid","invalid","unsupported"},
 "protocol_compatibility":{"compatible","unsupported","incompatible","unknown"},
 "freshness":{"current","stale","conflict","unknown"},
 "applicability":{"applicable","not_applicable","not_configured","unknown"},
 "identity_state":{"resolved","provisional","ambiguous","conflict","unknown"},
 "path_identity_state":{"unique","ambiguous","conflict","unknown"},
 "fingerprint_coverage":{"complete","partial","unknown"},
 "observation_consistency":{"stable","changed_during_capture","unknown"},
 "recovery_mode":{"normal","restricted","blocked"},
}
PROFILES={
 "packet-only":("0.1.0","a44342ea0007981a786784af61c44e36f101548b",{"packet_only"},{"read_packet_bytes","validate_packet_schema","inspect_packet_fields"}),
 "provider-stub":("0.1.0","7784c321f69e5f812b2bca22184ca13335c985e1",{"provider_stub"},{"resolve_synthetic_provider_identity","inject_provider_response_classes"}),
 "local-git-contract":("0.1.0","b0fc0273870f4591e5a53a51db7d189c012c826c",{"local_git","local_git_submodule","fault_injection"},{"create_disposable_repository","read_git_head","read_git_index","read_porcelain_v2_status","inject_disposable_worktree_events"}),
}
def _pairs(pairs):
 out={}
 for k,v in pairs:
  if k in out: raise ValueError("duplicate object member")
  out[k]=v
 return out
def _constant(x): raise ValueError("invalid JSON constant")
def scalar(x):
 if not isinstance(x,str): raise ValueError("string required")
 try: x.encode("utf-8","strict")
 except UnicodeEncodeError as e: raise ValueError("unpaired surrogate") from e
 return x
def parse_bytes(data,label="JSON"):
 try: s=data.decode("utf-8","strict")
 except UnicodeDecodeError as e: raise ValueError(label+": invalid UTF-8") from e
 def walk(x):
  if isinstance(x,str): scalar(x)
  elif isinstance(x,list):
   for v in x: walk(v)
  elif isinstance(x,dict):
   for k,v in x.items(): scalar(k); walk(v)
 return_value=json.loads(s,object_pairs_hook=_pairs,parse_constant=_constant)
 walk(return_value); return return_value
def read_json(path):
 with open(path,"rb") as f:return parse_bytes(f.read(),str(path))
def stable(v): return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)
def ordered(xs): return sorted(xs,key=lambda x:x.encode("utf-8","strict"))
def projection(c):
 e=c["expected"]
 def rows(items,key):
  seen=set(); result=[]
  for r in items:
   if not isinstance(r,dict) or not isinstance(r.get(key),str): raise ValueError("expected projection row key missing")
   scalar(r[key])
   if r[key] in seen: raise ValueError("duplicate expected projection key")
   seen.add(r[key])
   result.append({key:r[key],"fields":ordered([k for k in r if k!=key])})
  return sorted(result,key=lambda r:r[key].encode("utf-8"))
 return {"packet_fields":["packet_schema_validation","protocol_compatibility"],"claims":rows(e["claims"],"claim_ref"),"recovery":rows(e["recovery"],"operation_scope")}
def reconcile(c,o):
 if o.get("contract")!="scp-synthetic-observation-package" or o.get("source")!="independent-test-vector": raise ValueError("synthetic observation package required")
 if stable([e["sequence"] for e in c["stimulus"]["events"]])!=stable(o.get("executed_event_sequences")): raise ValueError("event sequence mismatch")
 if stable(c["companion_observations"])!=stable(o.get("records")): raise ValueError("observation mismatch")
 p=c["environment"]["capability_profile"]; profile=PROFILES.get(p["profile_id"]); cap=o.get("capability_observation")
 if not profile or (p["profile_version"],p["profile_blob_sha"])!=profile[:2]: raise ValueError("profile pin mismatch")
 if not set(c["environment"]["profiles"]).issubset(profile[2]): raise ValueError("unsupported declared profile")
 caps=cap.get("available_capabilities") if isinstance(cap,dict) else None
 if not isinstance(cap,dict) or cap.get("source")!="synthetic_profile_fixture" or not isinstance(caps,list) or any(not isinstance(x,str) for x in caps) or len(caps)!=len(set(caps)) or set(caps)!=profile[3]: raise ValueError("capability mismatch")
 return {"source":"synthetic_fixture_vector","executed_event_sequences":o["executed_event_sequences"],"records":o["records"],"capability_observation":cap}
def request(c,o,context_sha,observation_bytes):
 q={"contract":"scp-client-evaluation-request","request_version":"0.1.0","fixture_id":c["fixture_id"],"deterministic_clock":c["environment"]["clock"],
 "inputs":{"packet":c["target"]["packet"],"packet_schema":c["target"]["packet_schema"],"source_repository_revision":c["target"]["repository_revision"],"capability_profile":c["environment"]["capability_profile"],"driver":c["setup"]["driver"],"context_blob_sha":context_sha},
 "declared_profiles":c["environment"]["profiles"],"observation_package":reconcile(c,o),"observation_package_sha256":"sha-256:"+hashlib.sha256(observation_bytes).hexdigest(),"projection":projection(c)}
 def scan(x):
  if isinstance(x,dict):
   for k,v in x.items():
    if k in {"expected","assertions","oracle","run_manifest","context_path"}: raise ValueError("request leaks oracle member")
    scan(v)
  elif isinstance(x,list):
   for v in x:scan(v)
 scan(q); return q
def norm(raw,proj):
 if not isinstance(raw,dict): raise ValueError("response object required")
 if set(raw)-{"packet_schema_validation","protocol_compatibility","claims","recovery"}: raise ValueError("unknown core field")
 if not isinstance(raw.get("claims"),list) or not isinstance(raw.get("recovery"),list): raise ValueError("claims/recovery arrays required")
 def field(k,v):
  if v is None: raise ValueError("null invalid")
  if k in SETS:
   if not isinstance(v,list) or any(not isinstance(x,str) for x in v) or len(set(v))!=len(v): raise ValueError("invalid/duplicate set")
   if k=="reason_codes" and any(re.fullmatch(r"scp\.fixture\.[a-z0-9][a-z0-9._-]*",x) is None for x in v): raise ValueError("invalid reason code")
   if k in {"permitted_actions","prohibited_actions"} and any(re.fullmatch(r"[a-z][a-z0-9._:-]*",x) is None for x in v): raise ValueError("invalid action identifier")
   if k=="user_decisions_needed" and any(not x for x in v): raise ValueError("empty user decision")
   return ordered(v)
  if not isinstance(v,str): raise ValueError("string enum required")
  scalar(v)
  if k not in ENUMS or v not in ENUMS[k]: raise ValueError("unsupported enum "+k)
  return v
 out={"contract":"scp-fixture-normalized-result","result_version":"0.1.0"}
 for k in proj["packet_fields"]:
  if k in raw:out[k]=field(k,raw[k])
 def rows(items,key,defs):
  allowed={r[key]:set(r["fields"]) for r in defs}; seen=set(); result=[]
  for r in items:
   if not isinstance(r,dict) or not isinstance(r.get(key),str): raise ValueError("row key missing")
   k=scalar(r[key])
   if k in seen:raise ValueError("duplicate row key")
   seen.add(k)
   if k not in allowed:raise ValueError("row outside projection")
   if len(r)==1:continue
   if set(r)-({key}|allowed[k]):raise ValueError("field outside projection")
   z={key:k}
   for f in ordered([x for x in r if x!=key]):z[f]=field(f,r[f])
   result.append(z)
  return sorted(result,key=lambda r:r[key].encode())
 out["claims"]=rows(raw["claims"],"claim_ref",proj["claims"])
 out["recovery"]=rows(raw["recovery"],"operation_scope",proj["recovery"])
 return out
