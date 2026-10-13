"""Minimal cross-agent hook adapter. Run with: python hook.py claude stop
Reads event payload from stdin; stores metadata only, not prompt content.
"""
import json, sys, os, datetime, pathlib
ALLOWED_AGENTS={'claude','codex'}
ALLOWED_KINDS={'completed','attention','failed'}
def main():
    agent=sys.argv[1] if len(sys.argv)>1 else ''
    kind=sys.argv[2] if len(sys.argv)>2 else ''
    if agent not in ALLOWED_AGENTS or kind not in ALLOWED_KINDS:
        print('Usage: python hook.py claude|codex completed|attention|failed',file=sys.stderr)
        return 2
    try: payload=json.load(sys.stdin)
    except (ValueError,EOFError):payload={}
    if not isinstance(payload,dict):payload={}
    location=payload.get('cwd') or os.getcwd()
    project=pathlib.Path(str(location)).name[:80]
    event={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'agent':agent,'kind':kind,'project':project}
    folder=pathlib.Path.home()/'.agentpilot';folder.mkdir(exist_ok=True)
    with (folder/'events.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(event)+'\n')
    return 0
if __name__=='__main__':sys.exit(main())
