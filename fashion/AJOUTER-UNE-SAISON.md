# Ajouter une saison Fashion

Compter moins d'une heure, sans écrire de HTML. Tout se passe dans un seul fichier, `season.json`, puis une commande génère les pages.

Pour un futur Claude Code : lis ce fichier, puis `tools/build-fashion.py`. Ne modifie jamais à la main `fashion/index.html` ni `fashion/<saison>/index.html` : ce sont des fichiers générés.

## 1. Créer le dossier de la saison

Le nom du dossier, c'est l'année, le mois, puis la ville ou l'événement, par exemple `2027-02-nyfw` ou `2027-03-pfw`.

```
fashion/seasons/2027-02-nyfw/
├── season.json      la description de la saison
└── originals/       tes exports JPEG
```

Le plus simple : copie le dossier d'une saison existante, renomme-le, puis vide `originals/`.

`originals/` n'est **jamais publié** : git l'ignore (voir `.gitignore`). Garde une copie de tes exports ailleurs, sur ton disque ou dans ton cloud.

## 2. Déposer les photos

- Exporte tes photos en JPEG, en pleine qualité. Le script réduit lui-même la taille et le poids.
- Place-les dans `originals/`.
- Range-les dans un sous-dossier par marque, par exemple `originals/public-serv-ce/`, puis écris le chemin dans `season.json` : `"file": "public-serv-ce/USA01263.jpg"`. Les noms de fichiers sont libres.

## 3. Remplir `season.json`

```json
{
  "slug": "2027-02-nyfw",
  "title": { "fr": "New York Fashion Week", "en": "New York Fashion Week" },
  "seasonCode": "FW27",
  "showHousesOnCard": false,
  "city": "New York",
  "date": "2027-02",
  "draft": true,
  "intro": { "fr": "Une phrase, pas plus.", "en": "One sentence, no more." },
  "cover": "ouverture.jpg",
  "cover_alt": { "fr": "Ce qu'on voit sur l'image", "en": "What the image shows" },
  "series": [
    {
      "brand": "Public Service",
      "designer": "[à compléter]",
      "show": { "fr": "Défilé automne-hiver 2027", "en": "Fall/Winter 2027 show" },
      "images": [
        { "file": "ps-01.jpg",
          "alt": { "fr": "Mannequin en manteau noir", "en": "Model in a black coat" },
          "credit": "Mannequin : Prénom Nom" }
      ]
    }
  ],
  "backstage": []
}
```

| Champ | À quoi il sert |
| --- | --- |
| `slug` | Le nom du dossier. L'adresse de la page sera `/fashion/<slug>/`. |
| `title`, `seasonCode`, `city`, `date` | La carte de la saison (accueil Fashion) et l'ouverture de sa page affichent en petit « `title` · `seasonCode` » (« New York Fashion Week · FW27 »), puis en gros le mois et l'année venant de `date` (`AAAA-MM`) : « Février 2027 », l'année en orange. La collection en toutes lettres s'écrit dans le `show` de chaque série (« Automne-hiver 2027 »). La saison la plus récente porte automatiquement l'étiquette « Dernière saison ». |
| `showHousesOnCard` | Facultatif, `false` par défaut. `true` affiche la liste des maisons de la saison sous la date, sur sa carte de l'accueil Fashion. Sinon la carte ne montre que l'image, la ligne « New York Fashion Week · code » et la date. |
| `draft` | `true` : la saison reste cachée (pas sur l'accueil Fashion, pas dans le sitemap, jamais envoyée sur git). Passe à `false` pour la publier. |
| `intro` | Une phrase d'introduction au maximum. Laisse `""` pour ne rien afficher. |
| `cover`, `cover_alt` | L'image d'ouverture en plein écran (une bannière : **toujours une photo horizontale**), et sa description. |
| `card`, `card_alt` | Facultatifs. La photo de la carte de la saison sur l'accueil Fashion : **une photo verticale** (la carte est verticale). Sans ce champ, c'est la première photo verticale de la saison. |
| `share_position` | Facultatif. L'image de partage (LinkedIn, WhatsApp…) est la couverture recadrée en 1200 × 630, générée dans `images/share/fashion-<saison>.jpg`. Ce nombre règle le cadrage vertical : `0` garde le haut, `1` le bas (par défaut `0.2` pour une photo verticale, `0.5` sinon). |
| `home_hero`, `home_hero_alt` | Facultatifs. La photo plein écran en haut de l'accueil Fashion, quand c'est la dernière saison. Mets-y une photo horizontale ; sans ce champ, c'est la couverture. |
| `series` | Une entrée par marque, dans l'ordre d'affichage. |
| `designer` | Le créateur. Utile pour GFC, qui présente plusieurs créateurs : fais une série par créateur, avec la même marque. `[à compléter]` le masque sur le site. |
| `show` | La collection (et le nom du défilé s'il en a un), en FR et en EN : « Printemps-été 2027 · « The Rest Is Noise » ». |
| `venue`, `day` | Facultatifs. Le lieu et le jour du défilé, affichés en petit sous la collection : « Arte Museum, Chelsea · New York · 13 septembre 2026 ». Sans eux, seuls la ville et le mois s'affichent. |
| `images` | Les images de la série, dans l'ordre voulu. `alt` décrit l'image en FR et en EN. `credit` est facultatif (mannequin, stylisme…). `layout` est facultatif pour une photo verticale : `"solo"` (seule, en grand) ou `"detail"` (plus petite, décalée, avec de l'air autour). |
| `backstage` | Des images hors podium (coulisses, public, ambiance), avec le même format que `images`. Laisse `[]` s'il n'y en a pas. |
| `backstage_title` | Le titre de cette section, par exemple `{ "fr": "Dans la salle", "en": "In the room" }`. Par défaut : « Coulisses / Backstage ». |

Tout ce qui contient `[à compléter]` reste caché sur le site, et le script te le rappelle à la fin.

## 4. Générer

À la racine du dépôt :

```
python3 tools/build-fashion.py --drafts
```

`--drafts` génère aussi les brouillons, pour les regarder en local. Pour ouvrir le site en local :

```
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000/fashion/2027-02-nyfw/.

Le script :
- convertit chaque photo en WebP 1000 px et 2000 px (moins de 400 Ko environ en 2000 px), et ne reconvertit que les photos nouvelles ou modifiées ;
- choisit la mise en page selon l'orientation de chaque photo : un paysage en pleine largeur, deux portraits qui se suivent côte à côte, un portrait isolé seul et centré (ou en « détail » avec `"layout": "detail"`) ; aucune photo n'est plus haute que l'écran ;
- masque une série qui n'a pas encore de photos (elle réapparaît dès que tu en ajoutes) ;
- génère la page de la saison, l'accueil Fashion (dernière saison, liste des saisons, liste des maisons) et le `sitemap.xml` ;
- affiche à la fin un résumé avec les avertissements : image manquante, `alt` vide, marque sans images, champs `[à compléter]`.

Il faut `ffmpeg` et `cwebp`. S'ils manquent : `brew install ffmpeg webp`.

## 5. Publier

1. Dans `season.json`, passe `"draft": false`.
2. Relance `python3 tools/build-fashion.py`.
3. Vérifie la page à 375, 768 et 1440 px de large.
4. Fais un commit, puis pousse.

## Changer le design

- Une page de saison : `tools/templates/season.html`.
- L'accueil Fashion : `tools/templates/fashion-index.html`.
- Les styles : `fashion/css/seasons.css`.
- La langue et la lightbox : `fashion/js/seasons.js`.

Après une modification, relance le script : toutes les pages sont régénérées.
