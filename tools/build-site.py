#!/usr/bin/env python3
"""Insère les éléments communs à tout le site (partials/) dans chaque page, puis régénère Fashion.

    python3 tools/build-site.py

Chaque page contient trois paires de marqueurs ; tout ce qui se trouve entre eux est remplacé :
    <!-- site:head --> … <!-- /site:head -->         polices, css/site.css, écran de chargement
    <!-- site:header --> … <!-- /site:header -->     écran de chargement + en-tête + menu mobile
    <!-- site:scripts --> … <!-- /site:scripts -->   js/site.js
Pour modifier l'en-tête de tout le site : partials/header.html, css/site.css, js/site.js.
Les pages Fashion sont générées : leurs marqueurs sont dans tools/templates/.
"""

import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    'index.html',
    'riviera/index.html',
    'riviera/business/index.html',
    'contact/index.html',
    'tools/templates/fashion-index.html',
    'tools/templates/season.html',
]


def version(rel):
    return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]


def main():
    parts = {name: (ROOT / 'partials' / f'{name}.html').read_text(encoding='utf-8').strip()
             for name in ('head', 'header', 'scripts')}
    parts['head'] = parts['head'].replace('{{v_site_css}}', version('css/site.css'))
    parts['scripts'] = parts['scripts'].replace('{{v_site_js}}', version('js/site.js'))
    for rel in PAGES:
        path = ROOT / rel
        if not path.exists():
            print(f'  ! {rel} introuvable')
            continue
        html = path.read_text(encoding='utf-8')
        for name, content in parts.items():
            pattern = re.compile(rf'(<!-- site:{name} -->).*?(<!-- /site:{name} -->)', re.S)
            if not pattern.search(html):
                sys.exit(f'{rel} : marqueurs <!-- site:{name} --> manquants')
            html = pattern.sub(lambda m: f'{m.group(1)}\n  {content}\n  {m.group(2)}', html)
        path.write_text(html, encoding='utf-8')
        print(f'  ✓ {rel}')
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'build-fashion.py')], check=True)


if __name__ == '__main__':
    main()
