import json,glob,io,os,sys,re
sys.stdout.reconfigure(encoding='utf-8')
corpus={}
files=glob.glob('src/data/*.ts')+glob.glob('content/learning-courses/*.json')
SKIP=('examArchive','chapterAuthoredQuestions','yearlyKonkorExams')
for f in files:
    if any(x in f for x in SKIP): continue
    corpus[f]=io.open(f,encoding='utf-8',errors='replace').read()
W=int(os.environ.get('W','170'))
for t in json.load(io.open('C:/Star/konkortelegrambot/.passB-tmp/terms.json',encoding='utf-8')):
    print('####',t)
    n=0
    for f,c in corpus.items():
        for m in re.finditer(re.escape(t),c):
            s=max(0,m.start()-W); e=min(len(c),m.end()+W)
            print(f'-- {os.path.basename(f)}')
            print(c[s:e].replace('\n',' '))
            n+=1
            if n>=int(os.environ.get('MAX','4')): break
        if n>=int(os.environ.get('MAX','4')): break
