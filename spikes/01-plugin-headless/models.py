import json,sys
for l in open(sys.argv[1]):
    d=json.loads(l)
    if d['type']=='assistant' and d.get('parent_tool_use_id'):
        print('  subagent msg model:',d['message']['model'])
    if d['type']=='result': print('  modelUsage keys:',list(d['modelUsage']), 'cost',d['total_cost_usd'])
