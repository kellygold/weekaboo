#!/usr/bin/env python3
"""Explicit maintainer update only; app builds/runtime never contact this service.
Download one consistent tzurl/IANA release, validate paths/version, then replace the
bundled JSON atomically. Run node scripts/verify-timezone-data.mjs before using it.
"""
import argparse, concurrent.futures, hashlib, io, json, pathlib, re, tarfile, urllib.request
from html.parser import HTMLParser
BASE = 'https://www.tzurl.org/zoneinfo/'
ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = None
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'a': self.links += [value for key,value in attrs if key == 'href']
def get(path):
    cached = CACHE/path if CACHE else None
    if cached and cached.exists(): return cached.read_text()
    with urllib.request.urlopen(BASE + path, timeout=30) as response:
        if response.url != BASE + path: raise ValueError('Unexpected data redirect')
        data=response.read(1_000_001)
        if len(data)>1_000_000: raise ValueError('Unexpected large timezone response')
        text=data.decode('utf-8')
        if cached: cached.parent.mkdir(parents=True,exist_ok=True); cached.write_text(text)
        return text
def main():
    global CACHE
    parser=argparse.ArgumentParser();parser.add_argument('--version', required=True);args=parser.parse_args()
    if not re.fullmatch(r'20\d\d[a-z]',args.version): raise ValueError('Explicit IANA release required')
    CACHE=ROOT/'output/tzurl-cache'/args.version
    pending=['index.html']; visited=set(); zones=set()
    while pending:
        path=pending.pop()
        if path in visited:continue
        visited.add(path)
        if len(visited)>100:raise ValueError('Unexpected index tree')
        page=Links();page.feed(get(path)); parent=path.removesuffix('index.html')
        for href in page.links:
            if not re.fullmatch(r'[A-Za-z0-9_+.-]+(?:/[A-Za-z0-9_+.-]+)*', href) or '..' in href: raise ValueError('Unsafe data path')
            child=parent+href
            if child.endswith('/index.html'):pending.append(child)
            elif not child.endswith('.html'):zones.add(child)
    if not 300<=len(zones)<=1000:raise ValueError(f'Unexpected zone count: {len(zones)}')
    def load(zone):
        text=get(zone).replace('\r\n','\n')
        name=zone.removesuffix('.ics')
        if f'Olson {args.version}//EN' not in text or f'\nTZID:{name}\n' not in text or text.count('BEGIN:VTIMEZONE')!=1 or not text.rstrip().endswith('END:VCALENDAR'):raise ValueError(f'Unexpected timezone/version: {zone}')
        return name,text
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: data=dict(pool.map(load,sorted(zones)))
    # Versioned upstream source supplies aliases and the public-domain notice.
    # Read named members in memory; never extract archive paths to disk.
    url=f'https://data.iana.org/time-zones/releases/tzdata{args.version}.tar.gz'
    with urllib.request.urlopen(url,timeout=30) as response:
        archive=response.read(2_000_001)
        if response.url!=url or len(archive)>2_000_000:raise ValueError('Unexpected IANA archive')
    aliases={}
    with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
        def member(name):
            item=tar.getmember(name)
            if not item.isfile() or item.size>2_000_000:raise ValueError('Unexpected IANA member')
            return tar.extractfile(item).read().decode('utf-8')
        if member('version').strip()!=args.version:raise ValueError('IANA release mismatch')
        for name in ['africa','antarctica','asia','australasia','europe','northamerica','southamerica','etcetera','backward']:
            for line in member(name).splitlines():
                fields=line.split('#',1)[0].split()
                if fields and fields[0]=='Link':aliases[fields[2]]=fields[1]
        notice=member('LICENSE')
    for alias in aliases:
        target=aliases[alias];seen={alias}
        while target in aliases:
            if target in seen:raise ValueError('Circular timezone alias')
            seen.add(target);target=aliases[target]
        if target not in data:raise ValueError(f'Missing timezone target: {target}')
        aliases[alias]=target
    bundle={'version':args.version,'source':BASE,'ianaSource':url,'ianaSha256':hashlib.sha256(archive).hexdigest(),'aliases':aliases,'zones':data}
    encoded=(json.dumps(bundle,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
    target=ROOT/'src/engine/data/vtimezones.json';target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_suffix('.tmp');temporary.write_bytes(encoded);temporary.replace(target)
    (ROOT/'licenses/IANA-timezone-data.txt').write_text(notice)
    print(json.dumps({'version':args.version,'zones':len(data),'bytes':len(encoded),'sha256':hashlib.sha256(encoded).hexdigest()}))
if __name__=='__main__':main()
