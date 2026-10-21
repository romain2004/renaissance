#!/usr/bin/env python3
"""Génère la partie Fashion du site à partir des fichiers fashion/seasons/*/season.json.

    python3 tools/build-fashion.py            # saisons publiées
    python3 tools/build-fashion.py --drafts   # + brouillons (aperçu local, noindex)

Pour chaque saison :
  1. convertit les images de originals/ en WebP 1000 px et 2000 px (ffmpeg pour lire,
     tourner et redimensionner, cwebp pour encoder), seulement si elles sont nouvelles
     ou modifiées ;
  2. génère fashion/<saison>/index.html à partir de tools/templates/season.html.
Puis régénère fashion/index.html (tools/templates/fashion-index.html) et sitemap.xml.

Bibliothèque standard uniquement. Mode d'emploi : fashion/AJOUTER-UNE-SAISON.md
"""

import html
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FASHION = ROOT / 'fashion'
SEASONS_DIR = FASHION / 'seasons'
TEMPLATES = ROOT / 'tools' / 'templates'
SITEMAP = ROOT / 'sitemap.xml'
SITE_URL = 'https://www.romainmaulave.com'

WIDTHS = (1000, 2000)              # tailles générées (jamais d'agrandissement)
MAX_BYTES_2000 = 400_000           # objectif de poids pour la version 2000 px
QUALITIES = (80, 74, 68, 62, 56)   # essayées dans l'ordre jusqu'à passer sous l'objectif
QUALITY_1000 = 78
SOURCE_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'}

MONTHS = {
    'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
           'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July',
           'August', 'September', 'October', 'November', 'December'],
}

warnings = []
stats = {'converted': 0, 'cached': 0}


def warn(season, msg):
    warnings.append(f'[{season}] {msg}')


# ── Outils texte ────────────────────────────────────────────────────────────
def esc(s):
    return html.escape(str(s), quote=True)


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def bi(value):
    """Accepte "texte" ou {"fr": ..., "en": ...} et renvoie (fr, en)."""
    if isinstance(value, dict):
        fr = value.get('fr') or value.get('en') or ''
        return fr, value.get('en') or fr
    return value or '', value or ''


def t(fr, en, tag='span', cls='', extra=''):
    """Élément bilingue au format du site : data-fr / data-en, texte FR par défaut."""
    c = f' class="{cls}"' if cls else ''
    return f'<{tag}{c}{extra} data-fr="{esc(fr)}" data-en="{esc(en)}">{esc(fr)}</{tag}>'


def month_label(date, lang):
    y, m = date.split('-')[:2]
    name = MONTHS[lang][int(m) - 1]
    return f'{name.capitalize() if lang == "fr" else name} {y}'


def is_placeholder(s):
    return not s or '[à compléter]' in s or s.strip() in ('...', '…')


def fill(template, values):
    out = template
    for k, v in values.items():
        out = out.replace('{{' + k + '}}', v)
    left = re.findall(r'\{\{\s*[a-z_]+\s*\}\}', out)
    if left:
        raise SystemExit(f'Gabarit : variables non remplies {sorted(set(left))}')
    return out


# ── Images ──────────────────────────────────────────────────────────────────
def check_tools():
    missing = [x for x in ('ffmpeg', 'ffprobe', 'cwebp') if not shutil.which(x)]
    if missing:
        raise SystemExit('Outils manquants : ' + ', '.join(missing)
                         + '  (brew install ffmpeg webp)')


def exif_orientation(path):
    """Lit l'orientation EXIF d'un JPEG (1 = normale). ffmpeg ne l'applique pas aux photos."""
    if path.suffix.lower() not in ('.jpg', '.jpeg'):
        return 1
    try:
        with open(path, 'rb') as f:
            if f.read(2) != b'\xff\xd8':
                return 1
            while True:
                marker, size = struct.unpack('>2sH', f.read(4))
                if marker == b'\xff\xe1':
                    data = f.read(size - 2)
                    if data[:6] != b'Exif\x00\x00':
                        return 1
                    tiff = data[6:]
                    endian = '<' if tiff[:2] == b'II' else '>'
                    ifd = struct.unpack(endian + 'I', tiff[4:8])[0]
                    count = struct.unpack(endian + 'H', tiff[ifd:ifd + 2])[0]
                    for i in range(count):
                        e = ifd + 2 + i * 12
                        tag, _, _, val = struct.unpack(endian + 'HHI4s', tiff[e:e + 12])
                        if tag == 0x0112:
                            return struct.unpack(endian + 'H', val[:2])[0]
                    return 1
                if marker[0] != 0xFF or marker[1] in (0xDA, 0xD9):
                    return 1
                f.seek(size - 2, 1)
    except (OSError, struct.error):
        return 1


ROTATE = {2: 'hflip', 3: 'hflip,vflip', 4: 'vflip', 5: 'transpose=0',
          6: 'transpose=1', 7: 'transpose=3', 8: 'transpose=2'}


def probe_size(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                          '-show_entries', 'stream=width,height', '-of', 'csv=p=0', str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(x) for x in out.split(',')[:2])
    return w, h


def encode(src, dst, width, orient, max_bytes=None, quality=None):
    vf = ','.join(filter(None, [ROTATE.get(orient), f"scale='min({width},iw)':-2:flags=lanczos"]))
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / 'frame.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vf', vf,
                        '-frames:v', '1', str(png)], check=True)
        for q in ([quality] if quality else QUALITIES):
            subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-metadata', 'none',
                            str(png), '-o', str(dst)], check=True)
            if not max_bytes or dst.stat().st_size <= max_bytes:
                break


def process_images(slug, season_dir, out_dir, files):
    """Convertit les images utilisées. Renvoie {fichier: {w, h, stem}}."""
    originals = season_dir / 'originals'
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    info = {}
    for name in files:
        src = originals / name
        if not src.exists():
            if name in manifest:          # original absent mais déjà converti : on garde
                info[name] = manifest[name]
            else:
                warn(slug, f'image manquante : originals/{name}')
            continue
        st = src.stat()
        stem = slugify(src.stem)
        key = f'{st.st_size}-{st.st_mtime_ns}'
        cached = manifest.get(name)
        outs = [out_dir / f'{stem}-{w}.webp' for w in WIDTHS]
        if cached and cached.get('key') == key and all(o.exists() for o in outs):
            info[name] = cached
            stats['cached'] += 1
            continue
        orient = exif_orientation(src)
        w, h = probe_size(src)
        if orient in (5, 6, 7, 8):
            w, h = h, w
        encode(src, outs[0], WIDTHS[0], orient, quality=QUALITY_1000)
        encode(src, outs[1], WIDTHS[1], orient, max_bytes=MAX_BYTES_2000)
        if outs[1].stat().st_size > MAX_BYTES_2000:
            warn(slug, f'{name} : {outs[1].stat().st_size // 1000} Ko en 2000 px (objectif 400 Ko)')
        info[name] = manifest[name] = {'key': key, 'w': w, 'h': h, 'stem': stem}
        stats['converted'] += 1
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    return info


# ── Données ─────────────────────────────────────────────────────────────────
def load_seasons(include_drafts):
    seasons = []
    for path in sorted(SEASONS_DIR.glob('*/season.json')):
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            raise SystemExit(f'{path}: JSON invalide ({e})')
        slug = data.get('slug') or path.parent.name
        if slug != path.parent.name:
            warn(slug, f'"slug" ({slug}) différent du dossier ({path.parent.name}) : le dossier fait foi')
            slug = path.parent.name
        if not re.fullmatch(r'\d{4}-\d{2}', data.get('date', '')):
            raise SystemExit(f'{path}: "date" doit être au format AAAA-MM')
        data['slug'] = slug
        data['_dir'] = path.parent
        if data.get('draft') and not include_drafts:
            print(f'  · {slug} : brouillon, ignorée (ajoutez --drafts pour l\'aperçu)')
            continue
        seasons.append(data)
    seasons.sort(key=lambda s: s['date'])   # du plus ancien au plus récent
    return seasons


def season_files(s):
    files = [s['cover']] if s.get('cover') else []
    for group in s.get('series', []) + ([{'images': s['backstage']}] if s.get('backstage') else []):
        files += [im['file'] for im in group.get('images', [])]
    return list(dict.fromkeys(files))


def season_title(s):
    fr, en = bi(s['title'])
    return f'{fr} · {s["season"]}', f'{en} · {s["season"]}'


def series_id(serie):
    return slugify(' '.join(filter(None, [serie.get('brand'), None if is_placeholder(serie.get('designer', '')) else serie.get('designer')])))


def series_ids(s):
    """Ancres uniques par saison (deux séries GFC au créateur inconnu ne doivent pas se confondre)."""
    ids, seen = [], {}
    for serie in s.get('series', []):
        base = series_id(serie) or 'serie'
        seen[base] = seen.get(base, 0) + 1
        ids.append(base if seen[base] == 1 else f'{base}-{seen[base]}')
    return ids


def count_todo(s):
    def walk(v):
        if isinstance(v, dict):
            return sum(walk(x) for k, x in v.items() if not k.startswith('_'))
        if isinstance(v, list):
            return sum(walk(x) for x in v)
        return 1 if isinstance(v, str) and '[à compléter]' in v else 0
    return walk(s)


# ── Rendu HTML ──────────────────────────────────────────────────────────────
def img_tag(slug_path, meta, alt, sizes, lazy=True, cls='', extra=''):
    stem, w = meta['stem'], meta['w']
    candidates = {}
    for x in WIDTHS:                      # une photo plus petite que 2000 px n'est pas agrandie
        candidates.setdefault(min(w, x), f'{slug_path}{stem}-{x}.webp')
    srcset = ', '.join(f'{u} {cw}w' for cw, u in sorted(candidates.items()))
    h1000 = round(meta['h'] * min(w, 1000) / w)
    fr, en = alt
    loading = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    c = f' class="{cls}"' if cls else ''
    return (f'<img{c} src="{slug_path}{stem}-1000.webp" srcset="{srcset}" sizes="{sizes}" '
            f'width="{min(w, 1000)}" height="{h1000}" alt="{esc(fr)}" data-alt-fr="{esc(fr)}" '
            f'data-alt-en="{esc(en)}"{loading}{extra} />')


def layout_rows(images, info):
    """Rythme magazine : paysage = pleine largeur ; deux portraits = paire ; portrait isolé = détail.
    Jamais deux paires de suite, pour garder de l'alternance."""
    imgs = [im for im in images if im['file'] in info]
    rows, i, last = [], 0, None
    while i < len(imgs):
        m = info[imgs[i]['file']]
        portrait = m['h'] > m['w']
        nxt = imgs[i + 1] if i + 1 < len(imgs) else None
        nxt_portrait = nxt and info[nxt['file']]['h'] > info[nxt['file']]['w']
        if not portrait:
            rows.append(('full', [imgs[i]])); i += 1
        elif nxt_portrait and last != 'pair':
            rows.append(('pair', [imgs[i], nxt])); i += 2
        else:
            rows.append(('detail', [imgs[i]])); i += 1
        last = rows[-1][0]
    return rows


SIZES = {'full': '100vw', 'pair': '(max-width: 700px) 100vw, 50vw', 'detail': '(max-width: 700px) 100vw, 46vw'}


def render_series(s, serie, info, index, sid):
    slug = s['slug']
    brand = serie.get('brand') or ''
    designer = serie.get('designer') or ''
    show_fr, show_en = bi(serie.get('show', ''))
    caption_parts = [brand] + ([] if is_placeholder(designer) else [designer])
    rows_html, side = [], 'left'
    for kind, ims in layout_rows(serie['images'], info):
        figs = []
        for im in ims:
            alt = bi(im.get('alt', ''))
            if is_placeholder(alt[0]) or is_placeholder(alt[1]):
                warn(slug, f'alt vide ou à compléter : {im["file"]}')
            credit = im.get('credit', '')
            caption = ' · '.join(caption_parts + ([] if is_placeholder(credit) else [credit]))
            meta = info[im['file']]
            extra = (f' data-full="images/{meta["stem"]}-2000.webp" data-caption="{esc(caption)}"')
            figs.append(f'<figure class="ss-item">{img_tag("images/", meta, alt, SIZES[kind], extra=extra)}</figure>')
        cls = f'ss-row ss-row--{kind}' + (f' ss-row--{side}' if kind == 'detail' else '')
        if kind == 'detail':
            side = 'right' if side == 'left' else 'left'
        rows_html.append(f'<div class="{cls} reveal">{"".join(figs)}</div>')
    city = s.get('city', '')
    credits = [brand] + ([] if is_placeholder(designer) else [designer])
    cred_fr = ' · '.join(credits + [x for x in (show_fr, city, s['season']) if x])
    cred_en = ' · '.join(credits + [x for x in (show_en, city, s['season']) if x])
    designer_html = '' if is_placeholder(designer) else f'<p class="ss-series__designer">{esc(designer)}</p>'
    meta_fr = ' · '.join(x for x in (show_fr, city, month_label(s['date'], 'fr')) if x)
    meta_en = ' · '.join(x for x in (show_en, city, month_label(s['date'], 'en')) if x)
    return f'''
  <section class="ss-series" id="{sid}">
    <header class="ss-series__head reveal">
      <span class="ss-series__num">{index:02d}</span>
      <div>
        <h2 class="ss-series__brand">{esc(brand)}</h2>
        {designer_html}
        {t(meta_fr, meta_en, 'p', 'ss-series__meta')}
      </div>
    </header>
    {"".join(rows_html)}
    {t(cred_fr, cred_en, 'p', 'ss-credits')}
  </section>'''


def render_backstage(s, info):
    ims = s.get('backstage') or []
    if not ims:
        return ''
    rows = []
    for kind, group in layout_rows(ims, info):
        figs = []
        for im in group:
            meta = info[im['file']]
            alt = bi(im.get('alt', ''))
            if is_placeholder(alt[0]):
                warn(s['slug'], f'alt vide ou à compléter : {im["file"]}')
            cap = im.get('credit', '')
            extra = f' data-full="images/{meta["stem"]}-2000.webp" data-caption="{esc("" if is_placeholder(cap) else cap)}"'
            figs.append(f'<figure class="ss-item">{img_tag("images/", meta, alt, SIZES[kind], extra=extra)}</figure>')
        rows.append(f'<div class="ss-row ss-row--{kind}{" ss-row--left" if kind == "detail" else ""} reveal">{"".join(figs)}</div>')
    return f'''
  <section class="ss-series ss-series--backstage" id="coulisses">
    <header class="ss-series__head reveal">
      <span class="ss-series__num">—</span>
      <div>{t(*bi(s.get("backstage_title") or {"fr": "Coulisses", "en": "Backstage"}), "h2", "ss-series__brand")}</div>
    </header>
    {"".join(rows)}
  </section>'''


def season_nav(prev_s, next_s):
    def link(s, cls, fr, en):
        if not s:
            return f'<span class="ss-pager__link ss-pager__link--{cls} is-empty"></span>'
        tf, te = season_title(s)
        return (f'<a class="ss-pager__link ss-pager__link--{cls}" href="../{s["slug"]}/">'
                f'{t(fr, en, "span", "label")}<span class="ss-pager__title" data-fr="{esc(tf)}" '
                f'data-en="{esc(te)}">{esc(tf)}</span></a>')
    return (link(prev_s, 'prev', '← Saison précédente', '← Previous season')
            + f'<a class="ss-pager__back" href="../">{t("Toutes les saisons", "All seasons")}</a>'
            + link(next_s, 'next', 'Saison suivante →', 'Next season →'))


def head_meta(title_fr, title_en, desc_fr, desc_en, url, image):
    return (f'<title data-fr="{esc(title_fr)}" data-en="{esc(title_en)}">{esc(title_fr)}</title>\n'
            f'  <meta name="description" content="{esc(desc_fr)}" data-desc-fr="{esc(desc_fr)}" data-desc-en="{esc(desc_en)}" />\n'
            f'  <link rel="canonical" href="{url}" />\n'
            f'  <meta property="og:type" content="website" />\n'
            f'  <meta property="og:title" content="{esc(title_fr)}" />\n'
            f'  <meta property="og:description" content="{esc(desc_fr)}" />\n'
            f'  <meta property="og:url" content="{url}" />\n'
            + (f'  <meta property="og:image" content="{image}" />\n'
               f'  <meta name="twitter:card" content="summary_large_image" />\n' if image else ''))


def build_season(s, prev_s, next_s, info, template):
    slug = s['slug']
    out_dir = FASHION / slug
    tf, te = season_title(s)
    intro_fr, intro_en = bi(s.get('intro', ''))
    cover = info.get(s.get('cover', ''))
    if not cover:
        warn(slug, 'pas d\'image d\'ouverture ("cover")')
    url = f'{SITE_URL}/fashion/{slug}/'
    title_fr = f'{tf} — Romain Maulavé'
    title_en = f'{te} — Romain Maulavé'
    brands = ', '.join(dict.fromkeys(x.get('brand', '') for x in s.get('series', [])))
    desc_fr = f'{tf}, {month_label(s["date"], "fr").lower()}. Photographies de Romain Maulavé : {brands}.'
    desc_en = f'{te}, {month_label(s["date"], "en")}. Photographs by Romain Maulavé: {brands}.'
    cover_html = ''
    if cover:
        alt = bi(s.get('cover_alt') or {'fr': tf, 'en': te})
        cover_html = img_tag('images/', cover, alt, '100vw', lazy=False, cls='ss-opening__img')
    # numérotation continue : une série sans photos est ignorée (et signalée)
    series_html, n = '', 0
    for serie, sid in zip(s.get('series', []), series_ids(s)):
        if not serie.get('images'):
            warn(slug, f'« {serie.get("brand", "")} » n\'a aucune image : série masquée')
            continue
        n += 1
        series_html += render_series(s, serie, info, n, sid)
    tf_title, te_title = bi(s['title'])
    values = {
        'head_meta': head_meta(title_fr, title_en, desc_fr, desc_en, url,
                               f'{SITE_URL}/fashion/{slug}/images/{cover["stem"]}-2000.webp' if cover else ''),
        'robots': '<meta name="robots" content="noindex" />' if s.get('draft') else '',
        'preload': (f'<link rel="preload" as="image" href="images/{cover["stem"]}-1000.webp" '
                    f'imagesrcset="images/{cover["stem"]}-1000.webp 1000w, images/{cover["stem"]}-2000.webp 2000w" imagesizes="100vw" />') if cover else '',
        'cover': cover_html,
        'eyebrow': t(f'{s.get("city", "")} · {month_label(s["date"], "fr")}', f'{s.get("city", "")} · {month_label(s["date"], "en")}', 'span', 'label'),
        'title': t(tf_title, te_title, 'span', 'ss-opening__name'),
        'season': esc(s['season']),
        'intro': t(intro_fr, intro_en, 'p', 'ss-intro reveal') if intro_fr else '',
        'series': series_html,
        'backstage': render_backstage(s, info),
        'pager': season_nav(prev_s, next_s),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'index.html').write_text(fill(template, values), encoding='utf-8')
    # Un brouillon n'est jamais suivi par git (donc jamais publié) ; la protection
    # disparaît dès que la saison passe en "draft": false.
    guard = out_dir / '.gitignore'
    if s.get('draft'):
        guard.write_text('# Brouillon : aperçu local uniquement (voir season.json, "draft")\n*\n')
    elif guard.exists():
        guard.unlink()


def build_index(seasons, infos, template):
    published = [s for s in seasons if not s.get('draft')]
    if not published:
        warn('accueil', 'aucune saison publiée : fashion/index.html non régénéré')
        return
    latest = published[-1]
    li = infos[latest['slug']]
    cover = li.get(latest.get('cover', ''))
    tf, te = season_title(latest)
    lf, le = bi(latest['title'])

    # Hero
    hero_img = img_tag(f'{latest["slug"]}/images/', cover, bi(latest.get('cover_alt') or {'fr': tf, 'en': te}),
                       '100vw', lazy=False, cls='hero__bg-img') if cover else ''

    # Dernière saison : grande carte + 6 aperçus. La carte prend la 1re photo de la
    # 1re série (pas l'ouverture, déjà dans le hero) ; les aperçus prennent les suivantes.
    pool = []
    for sid, serie in zip(series_ids(latest), latest.get('series', [])):
        for im in serie.get('images', []):
            if im['file'] in li and im['file'] != latest.get('cover'):
                pool.append((sid, im))
    card_img = pool[0][1] if pool else None
    previews = pool[1:7]
    prev_html = ''.join(
        f'<a class="fx-latest__thumb" href="{latest["slug"]}/#{sid}">'
        f'{img_tag(latest["slug"] + "/images/", li[im["file"]], bi(im.get("alt", "")), "(max-width: 700px) 50vw, 16vw")}</a>'
        for sid, im in previews)
    meta_fr = f'{latest.get("city", "")} · {month_label(latest["date"], "fr")}'
    meta_en = f'{latest.get("city", "")} · {month_label(latest["date"], "en")}'
    houses_latest = ' · '.join(dict.fromkeys(x.get('brand', '') for x in latest.get('series', []) if x.get('images')))
    latest_card = (
        f'<a class="fx-latest__card reveal" href="{latest["slug"]}/">'
        + (img_tag(f'{latest["slug"]}/images/', li[card_img['file']], bi(card_img.get('alt', '')),
                   '(max-width: 900px) 100vw, 60vw') if card_img else '')
        + f'<span class="fx-latest__overlay">{t(meta_fr, meta_en, "span", "label")}'
        f'<span class="fx-latest__title" data-fr="{esc(lf)}<br>{esc(latest["season"])}" data-en="{esc(le)}<br>{esc(latest["season"])}">{esc(lf)}<br>{esc(latest["season"])}</span>'
        f'<span class="fx-latest__houses">{esc(houses_latest)}</span>'
        f'{t("Voir la saison →", "View the season →", "span", "fx-latest__cta")}</span></a>')

    # Saisons, la plus récente en premier
    cards = []
    for s in reversed(published):
        si = infos[s['slug']]
        c = si.get(s.get('cover', ''))
        sf, se = bi(s['title'])
        cards.append(
            f'<a class="fx-season reveal" href="{s["slug"]}/">'
            + (img_tag(f'{s["slug"]}/images/', c, bi(s.get('cover_alt') or {'fr': sf, 'en': se}),
                       '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw') if c else '<span class="fx-season__empty"></span>')
            + f'<span class="fx-season__body">{t(s.get("city", ""), s.get("city", ""), "span", "label")}'
            f'<span class="fx-season__title" data-fr="{esc(sf)} <span class=\'gold\'>{esc(s["season"])}</span>" '
            f'data-en="{esc(se)} <span class=\'gold\'>{esc(s["season"])}</span>">{esc(sf)} <span class="gold">{esc(s["season"])}</span></span>'
            f'<span class="fx-season__meta">{t(month_label(s["date"], "fr"), month_label(s["date"], "en"))}</span>'
            f'</span></a>')

    # Maisons : une ligne par marque et par saison (lien vers sa première série),
    # avec les créateurs connus quand une marque présente plusieurs créateurs (GFC)
    groups = {}
    for s in published:
        for sid, serie in zip(series_ids(s), s.get('series', [])):
            if not serie.get('images'):
                continue
            g = groups.setdefault((serie.get('brand', ''), s['slug']), {'season': s, 'sid': sid, 'designers': []})
            d = serie.get('designer', '')
            if not is_placeholder(d) and d not in g['designers']:
                g['designers'].append(d)
    rows = sorted(groups.items(), key=lambda kv: (kv[0][0].lower(), kv[1]['season']['date']))
    house_items = ''.join(
        f'<li><a class="fx-house" href="{g["season"]["slug"]}/#{g["sid"]}">'
        f'<span class="fx-house__brand">{esc(brand)}</span>'
        f'<span class="fx-house__designer">{esc(" · ".join(g["designers"]))}</span>'
        f'<span class="fx-house__season">{esc(g["season"]["season"])} · {esc(g["season"].get("city", ""))}</span></a></li>'
        for (brand, _), g in rows)

    url = f'{SITE_URL}/fashion/'
    values = {
        'head_meta': head_meta('Fashion — Romain Maulavé', 'Fashion — Romain Maulavé',
                               'Fashion Weeks photographiées par Romain Maulavé : une sélection par saison, défilé par défilé.',
                               'Fashion Weeks photographed by Romain Maulavé: a tight selection per season, show by show.',
                               url, f'{SITE_URL}/fashion/{latest["slug"]}/images/{cover["stem"]}-2000.webp' if cover else ''),
        'preload': (f'<link rel="preload" as="image" href="{latest["slug"]}/images/{cover["stem"]}-1000.webp" '
                    f'imagesrcset="{latest["slug"]}/images/{cover["stem"]}-1000.webp 1000w, {latest["slug"]}/images/{cover["stem"]}-2000.webp 2000w" imagesizes="100vw" />') if cover else '',
        'hero_img': hero_img,
        'hero_label': t(f'Dernière saison · {tf}', f'Latest season · {te}', 'span', 'label fx-hero__label'),
        'latest_url': f'{latest["slug"]}/',
        'latest_card': latest_card,
        'latest_previews': prev_html,
        'seasons': ''.join(cards),
        'houses': house_items,
    }
    (FASHION / 'index.html').write_text(fill(template, values), encoding='utf-8')


def update_sitemap(published):
    xml = SITEMAP.read_text(encoding='utf-8')
    xml = re.sub(r'\s*<url>\s*<loc>[^<]*/fashion/\d{4}-\d{2}[^<]*</loc>\s*</url>', '', xml)
    block = ''.join(f'\n  <url>\n    <loc>{SITE_URL}/fashion/{s["slug"]}/</loc>\n  </url>'
                    for s in reversed(published))
    anchor = f'<loc>{SITE_URL}/fashion/</loc>\n  </url>'
    if anchor not in xml:
        warn('sitemap', '/fashion/ introuvable dans sitemap.xml : saisons non ajoutées')
        return
    SITEMAP.write_text(xml.replace(anchor, anchor + block), encoding='utf-8')


def main():
    include_drafts = '--drafts' in sys.argv
    check_tools()
    print('Fashion — génération')
    seasons = load_seasons(include_drafts)
    season_tpl = (TEMPLATES / 'season.html').read_text(encoding='utf-8')
    index_tpl = (TEMPLATES / 'fashion-index.html').read_text(encoding='utf-8')

    infos = {}
    for s in seasons:
        infos[s['slug']] = process_images(s['slug'], s['_dir'], FASHION / s['slug'] / 'images', season_files(s))

    # précédente / suivante : parmi les saisons publiées (les brouillons se relient aux publiées)
    published = [s for s in seasons if not s.get('draft')]
    for s in seasons:
        chain = published if not s.get('draft') else sorted(published + [s], key=lambda x: x['date'])
        i = chain.index(s)
        prev_s = chain[i - 1] if i > 0 else None
        next_s = chain[i + 1] if i + 1 < len(chain) else None
        build_season(s, prev_s, next_s, infos[s['slug']], season_tpl)
        n = sum(1 for f in season_files(s) if f in infos[s['slug']])
        todo = count_todo(s)
        if todo:
            warn(s['slug'], f'{todo} champ(s) « [à compléter] » (créateurs, mannequins…)')
        print(f'  ✓ {s["slug"]}{" (brouillon)" if s.get("draft") else ""} : {n} images')

    build_index(seasons, infos, index_tpl)
    update_sitemap(published)

    print(f'\nImages converties : {stats["converted"]} · déjà à jour : {stats["cached"]}')
    if warnings:
        print(f'\n{len(warnings)} avertissement(s) :')
        for w in warnings:
            print('  ! ' + w)
    else:
        print('Aucun avertissement.')


if __name__ == '__main__':
    main()
