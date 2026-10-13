"""AgentPilot hook adapter: persists metadata, never conversation content."""
import datetime, hashlib, json, os, pathlib, sys

ALLOWED_AGENTS = {"claude", "codex"}
ALLOWED_KINDS = {"completed", "attention", "failed", "interrupted", "session_started", "session_ended"}
CODEX_KINDS = {"Stop":"completed", "PermissionRequest":"attention", "Interrupt":"interrupted", "SessionStart":"session_started", "SessionEnd":"session_ended"}

def _text(value, limit=160):
    return str(value)[:limit] if isinstance(value, (str, int, float)) else ""

def parse_event(agent, requested_kind, payload, now=None):
    if not isinstance(payload, dict): payload = {}
    hook_name = _text(payload.get("hook_event_name"), 64)
    kind = CODEX_KINDS.get(hook_name, requested_kind) if agent == "codex" else requested_kind
    if agent not in ALLOWED_AGENTS or kind not in ALLOWED_KINDS:
        raise ValueError("unsupported agent or event kind")
    cwd = _text(payload.get("cwd"), 2048) or os.getcwd()
    project = pathlib.Path(cwd).name[:80] or "unknown"
    session_id, turn_id = _text(payload.get("session_id")), _text(payload.get("turn_id"))
    event = {"version":2, "id":"", "time":(now or datetime.datetime.now(datetime.timezone.utc)).isoformat(),
             "agent":agent, "kind":kind, "project":project, "source":"hook", "test":False}
    for key, value in (("sessionId",session_id), ("turnId",turn_id), ("model",_text(payload.get("model"),100)), ("hook",hook_name)):
        if value: event[key] = value
    identity = "|".join((agent, kind, session_id, turn_id, hook_name, project))
    event["id"] = hashlib.sha256(identity.encode()).hexdigest()[:24]
    return event

def append_event(event):
    base = pathlib.Path(os.environ.get("AGENTPILOT_DATA_DIR", pathlib.Path.home()/".agentpilot"))
    base.mkdir(parents=True, exist_ok=True); target = base/"events.jsonl"; ids = set()
    try:
        for line in target.read_text(encoding="utf-8").splitlines()[-500:]:
            try:
                item=json.loads(line)
                if isinstance(item,dict) and item.get("id"): ids.add(item["id"])
            except (ValueError,TypeError): pass
    except FileNotFoundError: pass
    if event["id"] in ids: return False
    with target.open("a",encoding="utf-8") as handle: handle.write(json.dumps(event,separators=(",",":"))+"\n")
    return True

def main():
    agent=sys.argv[1] if len(sys.argv)>1 else ""; requested=sys.argv[2] if len(sys.argv)>2 else "auto"
    try: payload=json.load(sys.stdin)
    except (ValueError,EOFError): payload={}
    try: append_event(parse_event(agent,requested,payload))
    except (ValueError,OSError) as error:
        print(f"AgentPilot hook error: {error}",file=sys.stderr); return 2
    return 0

if __name__=="__main__": sys.exit(main())
