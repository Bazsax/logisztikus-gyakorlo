import json,glob,sys
qs=[];ids=set()
for f in sorted(glob.glob('data/bank/*.json')):
    for q in json.load(open(f)):
        assert q['id'] not in ids, q['id']; ids.add(q['id'])
        t=q['type']
        if t=='single': assert 0<=q['answer']<len(q['options'])
        if t=='multi': assert all(0<=a<len(q['options']) for a in q['answer']) and q['answer']
        if t=='group': assert all(0<=g<len(q['groups']) for _,g in q['items'])
        if t=='match': assert len(q['pairs'])>=2
        if t=='truefalse': assert all(isinstance(b,bool) for _,b in q['statements'])
        if t=='essay': assert q['keyPoints']
        qs.append(q)
json.dump(qs,open('data/theory.json','w'),ensure_ascii=False,separators=(',',':'))
from collections import Counter
print(len(qs), Counter(q['type'] for q in qs), Counter(q['topic'] for q in qs), Counter(q['source'] for q in qs))
