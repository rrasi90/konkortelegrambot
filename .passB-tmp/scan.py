import json,glob,io,os,sys
sys.stdout.reconfigure(encoding='utf-8')
corpus={}
files=glob.glob('src/data/*.ts')+glob.glob('content/learning-courses/*.json')
SKIP=('examArchive','chapterAuthoredQuestions','yearlyKonkorExams')
for f in files:
    if any(x in f for x in SKIP): continue
    corpus[f]=io.open(f,encoding='utf-8',errors='replace').read()
def hits(t):
    out=[]
    for f,c in corpus.items():
        n=c.count(t)
        if n: out.append(f'{os.path.basename(f)}:{n}')
    return out
for t in json.load(io.open('C:/Star/konkortelegrambot/.passB-tmp/terms.json',encoding='utf-8')):
    print(t,'|',', '.join(hits(t)) or 'NONE')
