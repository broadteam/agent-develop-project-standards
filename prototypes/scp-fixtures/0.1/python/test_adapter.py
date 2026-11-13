"""Tests for the independent Python fixture adapter prototype."""
import copy,hashlib,json,os,unittest
from pathlib import Path
from adapter import read_json,parse_bytes,request,norm,projection,stable
from oracle import evaluate
ROOT=Path(__file__).resolve().parents[1]; F=ROOT/"fixtures"
NAMES=["credentialed-project-repository","identity-source-reference-unresolvable","fingerprint-path-set-mismatch"]
PINS=["37ea051aae40443abfe425c59e46282962bac9fe","9c42e9626e484a2b0c830a845097467450dfcd47","542c5c6748fc5056c1fb4a080d9e2a4f8995789e"]
COUNTS=[12,15,13]
OUT=Path(os.environ.get("SCP_PROTO_OUTPUT_DIR",ROOT/"artifacts"))
def blobsha(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def write(n,v):OUT.mkdir(parents=True,exist_ok=True);(OUT/n).write_text(stable(v)+"\n",encoding="utf-8")
class PrototypeTests(unittest.TestCase):
 def test_three_pinned_contexts_and_byte_artifacts(self):
  total=0
  for i,n in enumerate(NAMES):
   cb=(F/"context"/(n+".json")).read_bytes();c=parse_bytes(cb)
   self.assertEqual(blobsha(cb),PINS[i])
   ob=(F/"observations"/(n+".json")).read_bytes();o=parse_bytes(ob)
   raw=read_json(F/"client-output"/(n+".json"));q=request(c,o,PINS[i],ob)
   qt=stable(q)
   for k in ['"expected"','"assertions"','"oracle"','"context_path"']:self.assertNotIn(k,qt)
   self.assertEqual(q["inputs"]["packet"]["blob_sha"],c["target"]["packet"]["blob_sha"])
   z=norm(raw,q["projection"]);report=evaluate(c,z)
   self.assertEqual(report["conformance_outcome"],"conformant")
   self.assertEqual(len(report["assertions"]),COUNTS[i])
   self.assertEqual(report["assertion_counts"]["passed"],COUNTS[i])
   write("request-"+n+".json",q);write("normalized-"+n+".json",z);write("oracle-"+n+".json",report)
   total+=len(report["assertions"])
   rev=copy.deepcopy(raw);rev["claims"].reverse();rev["recovery"].reverse()
   for row in rev["claims"]+rev["recovery"]:
    for f in ("reason_codes","permitted_actions","prohibited_actions","user_decisions_needed"):
     if isinstance(row.get(f),list):row[f].reverse()
   self.assertEqual(stable(norm(rev,q["projection"])),stable(z))
  self.assertEqual(total,40)
  write("summary.json",{"fixtures":3,"assertions_checked":total,"status":"synthetic-prototype-only"})
 def test_adversarial_cases(self):
  with self.assertRaisesRegex(ValueError,"duplicate object member"):parse_bytes(b'{"a":1,"a":2}')
  with self.assertRaisesRegex(ValueError,"invalid UTF-8"):parse_bytes(b'{"a":\xff}')
  with self.assertRaisesRegex(ValueError,"unpaired surrogate"):parse_bytes(b'{"a":"\\ud800"}')
  proto=parse_bytes(b'{"__proto__":{"polluted":true},"safe":1}')
  self.assertEqual(proto["safe"],1);self.assertIn("__proto__",proto)
  n=NAMES[1];c=read_json(F/"context"/(n+".json"));o=read_json(F/"observations"/(n+".json"));ob=(F/"observations"/(n+".json")).read_bytes();raw=read_json(F/"client-output"/(n+".json"));q=request(c,o,PINS[1],ob)
  duplicate_expected=copy.deepcopy(c);duplicate_expected["expected"]["claims"].append(copy.deepcopy(duplicate_expected["expected"]["claims"][0]))
  with self.assertRaisesRegex(ValueError,"duplicate expected projection key"):projection(duplicate_expected)
  duplicate_expected=copy.deepcopy(c);duplicate_expected["expected"]["recovery"].append(copy.deepcopy(duplicate_expected["expected"]["recovery"][0]))
  with self.assertRaisesRegex(ValueError,"duplicate expected projection key"):projection(duplicate_expected)
  missing=copy.deepcopy(raw);del missing["claims"][0]["freshness"]
  self.assertEqual(evaluate(c,norm(missing,q["projection"]))["conformance_outcome"],"inconclusive")
  bad=copy.deepcopy(raw);bad["claims"][0]["freshness"]=None
  with self.assertRaisesRegex(ValueError,"null invalid"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["claims"].append(copy.deepcopy(bad["claims"][0]))
  with self.assertRaisesRegex(ValueError,"duplicate row key"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["extra_core_field"]=True
  with self.assertRaisesRegex(ValueError,"unknown core field"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);row=next(x for x in bad["claims"] if "reason_codes" in x);row["reason_codes"].append(row["reason_codes"][0])
  with self.assertRaisesRegex(ValueError,"invalid/duplicate set"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["claims"].append({"claim_ref":"outside.scope","freshness":"unknown"})
  with self.assertRaisesRegex(ValueError,"row outside projection"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["claims"]=[{"claim_ref":c["expected"]["claims"][0]["claim_ref"]}]
  omitted=norm(bad,q["projection"])
  self.assertFalse(any(x["claim_ref"]==c["expected"]["claims"][0]["claim_ref"] for x in omitted["claims"]))
  self.assertEqual(evaluate(c,omitted)["conformance_outcome"],"inconclusive")
  bad=copy.deepcopy(raw);next(x for x in bad["claims"] if x["claim_ref"].endswith("checkout"))["identity_state"]="maybe"
  with self.assertRaisesRegex(ValueError,"unsupported enum"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["claims"][0]["reason_codes"]=["scp.fixture.Bad-Code"]
  with self.assertRaisesRegex(ValueError,"invalid reason code"):norm(bad,q["projection"])
  bad=copy.deepcopy(raw);bad["recovery"][0]["permitted_actions"]=["BadAction"]
  with self.assertRaisesRegex(ValueError,"invalid set member"):norm(bad,q["projection"])
  decision_context=copy.deepcopy(c);decision_context["expected"]["recovery"][0]["user_decisions_needed"]=["Confirm repository ownership","确认仓库归属"]
  decision_projection=projection(decision_context);decision_raw=copy.deepcopy(raw)
  decision_raw["recovery"][0]["user_decisions_needed"]=["确认仓库归属","Confirm repository ownership"]
  decision_normalized=norm(decision_raw,decision_projection)
  self.assertEqual(decision_normalized["recovery"][0]["user_decisions_needed"],ordered(["Confirm repository ownership","确认仓库归属"]))
  decision_raw["recovery"][0]["user_decisions_needed"]=[""]
  with self.assertRaisesRegex(ValueError,"empty user decision"):norm(decision_raw,decision_projection)
  obad=copy.deepcopy(o);obad["executed_event_sequences"]=[]
  with self.assertRaisesRegex(ValueError,"event sequence mismatch"):request(c,obad,PINS[1],ob)
  obad=copy.deepcopy(o);obad["records"]=[]
  with self.assertRaisesRegex(ValueError,"observation mismatch"):request(c,obad,PINS[1],ob)
  obad=copy.deepcopy(o);obad["capability_observation"]["available_capabilities"]=[]
  with self.assertRaisesRegex(ValueError,"capability mismatch"):request(c,obad,PINS[1],ob)
  obad=copy.deepcopy(o);obad["capability_observation"]["available_capabilities"].append(obad["capability_observation"]["available_capabilities"][0])
  with self.assertRaisesRegex(ValueError,"capability mismatch"):request(c,obad,PINS[1],ob)
  obad=copy.deepcopy(o);obad["capability_observation"]="not-an-object"
  with self.assertRaisesRegex(ValueError,"capability mismatch"):request(c,obad,PINS[1],ob)
  bad=copy.deepcopy(raw);next(x for x in bad["claims"] if x["claim_ref"].endswith("checkout"))["identity_state"]="resolved"
  self.assertEqual(evaluate(c,norm(bad,q["projection"]))["conformance_outcome"],"non_conformant")
  nr=evaluate(c,None,False);self.assertEqual(nr["conformance_outcome"],"not_run");self.assertEqual(nr["assertion_counts"]["not_run"],15)
  empty=copy.deepcopy(c);empty["expected"]["claims"]=[{"claim_ref":"synthetic.empty.set","applicability":"applicable"}];empty["expected"]["recovery"]=[{"operation_scope":"synthetic.empty.scope","recovery_mode":"restricted","permitted_actions":[],"prohibited_actions":[]}]
  p=projection(empty);rawempty={"packet_schema_validation":"valid","protocol_compatibility":"compatible","claims":[{"claim_ref":"synthetic.empty.set","applicability":"applicable"}],"recovery":[{"operation_scope":"synthetic.empty.scope","recovery_mode":"restricted","permitted_actions":[],"prohibited_actions":[]}]}
  self.assertEqual(evaluate(empty,norm(rawempty,p))["conformance_outcome"],"conformant")
  del rawempty["recovery"][0]["permitted_actions"]
  self.assertEqual(evaluate(empty,norm(rawempty,p))["conformance_outcome"],"inconclusive")
  empty["expected"]["claims"]=[{"claim_ref":"caf\u00e9","freshness":"unknown"}];empty["expected"]["recovery"]=[];p=projection(empty)
  with self.assertRaisesRegex(ValueError,"row outside projection"):
   norm({"packet_schema_validation":"valid","protocol_compatibility":"compatible","claims":[{"claim_ref":"cafe\u0301","freshness":"unknown"}],"recovery":[]},p)
if __name__=="__main__":unittest.main(verbosity=2)
