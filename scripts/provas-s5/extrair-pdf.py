"""Converte o XML do Poppler em palavras/linhas com coordenadas; sem dependências."""
import json
import sys
import xml.etree.ElementTree as ET

ns = {'x': 'http://www.w3.org/1999/xhtml'}
pages = []
for page in ET.parse(sys.argv[1]).findall('.//x:page', ns):
    lines = []
    for line in page.findall('.//x:line', ns):
        words = [{**{k: float(v) for k, v in word.attrib.items()}, 'text': word.text or ''}
                 for word in line.findall('x:word', ns)]
        lines.append({**{k: float(v) for k, v in line.attrib.items()},
                      'text': ' '.join(w['text'] for w in words), 'words': words})
    pages.append({**{k: float(v) for k, v in page.attrib.items()}, 'lines': lines})
print(json.dumps(pages, ensure_ascii=False))
