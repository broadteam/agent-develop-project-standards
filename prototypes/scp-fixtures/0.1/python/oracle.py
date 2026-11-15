"""Independent Python Oracle evaluator; standard library only."""
from adapter import stable,ordered
SETS={"reason_codes","permitted_actions","prohibited_actions","user_decisions_needed"}
def _rows(items,key):
 out={}
 for r in items or []:
  if not isinstance(r,dict) or not isinstance(r.get(key),str) or r[key] in out: raise ValueError("invalid/duplicate actual row key")
  out[r[key]]=r
 return out
def evaluate(c,actual,started=True):
 actual=actual or {};claims=_rows(actual.get("claims",[]),"claim_ref");recovery=_rows(actual.get("recovery",[]),"operation_scope");a=[]
 def add(kind,ref,field,expected,row):
  present=row is not None and field in row
  if not started:out="not_run"
  elif not present:out="inconclusive"
  else:
   x=ordered(expected) if field in SETS else expected
   y=ordered(row[field]) if field in SETS else row[field]
   out="passed" if stable(x)==stable(y) else "failed"
  r={"subject_kind":kind}
  if ref is not None:r["subject_ref"]=ref
  r.update({"field":field,"outcome":out});a.append(r)
 for f in ("packet_schema_validation","protocol_compatibility"):add("packet",None,f,c["expected"][f],actual)
 for r in c["expected"]["claims"]:
  for f in ordered([x for x in r if x!="claim_ref"]):add("claim",r["claim_ref"],f,r[f],claims.get(r["claim_ref"]))
 for r in c["expected"]["recovery"]:
  for f in ordered([x for x in r if x!="operation_scope"]):add("recovery",r["operation_scope"],f,r[f],recovery.get(r["operation_scope"]))
 rank={"packet":0,"claim":1,"recovery":2}
 a.sort(key=lambda x:(rank[x["subject_kind"]],(x.get("subject_ref") or "").encode(),x["field"].encode()))
 counts={"passed":0,"failed":0,"inconclusive":0,"not_run":0}
 for x in a:counts[x["outcome"]]+=1
 overall="not_run" if not started else "non_conformant" if counts["failed"] else "inconclusive" if counts["inconclusive"] or counts["not_run"] else "conformant"
 return {"conformance_outcome":overall,"assertion_counts":counts,"assertions":a}
