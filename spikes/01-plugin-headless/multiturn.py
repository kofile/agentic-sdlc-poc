import subprocess,json,sys
SPIKE='/Users/evanstern/projects/kofile/agentic-sdlc-poc/spikes/01-plugin-headless'
PL='/Users/evanstern/projects/kofile/ai-coe-plugins/plugins/sdlc-pipeline-plugin'
p=subprocess.Popen(['claude','-p','--plugin-dir',PL,'--strict-mcp-config','--mcp-config',SPIKE+'/empty-mcp.json','--input-format','stream-json','--output-format','stream-json','--verbose','--max-turns','6','--max-budget-usd','0.6','--model','sonnet'],cwd=SPIKE+'/scratch',stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
out=open(SPIKE+'/raw/m1.out','w')
def send(t): p.stdin.write(json.dumps({"type":"user","message":{"role":"user","content":t}})+"\n"); p.stdin.flush()
SYS="Do not call any Atlassian/Jira/Confluence/GitHub or MCP tools. Read-only spike."
send("Use Skill sdlc-pipeline-plugin:run-pipeline. Pretend TEST-1 has a design page; reach the 'resume question' and ask it as plain text; stop. "+SYS)
results=0
for l in p.stdout:
    out.write(l); d=json.loads(l)
    if d['type']=='result':
        results+=1; print('result',results,d['num_turns'],d['total_cost_usd'],d['result'][:150].replace('\n',' '))
        if results==1: send("Answer: resume after the highest completed stage. State the option you took in one sentence and stop.")
        else: p.stdin.close()
p.wait(); print('exit',p.returncode)
