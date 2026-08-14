# Baignades des Pyrénées centrales

Le site est alimenté par un fichier Markdown par lieu, dans le dossier `lieux/`.
Le fichier `data/baignades.geojson` est généré automatiquement et ne doit normalement pas être modifié à la main.

## Modifier un lieu

Ouvrir son fichier dans `lieux/`, modifier les notes ou le commentaire, puis exécuter :

```bash
python construire.py
```

Sous Windows, si `python` n'est pas reconnu :

```bash
py construire.py
```

Ensuite, lancer ou laisser tourner le serveur local :

```bash
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000` et actualiser la page.

## Format d'une fiche

```markdown
---
nom: Nom du lieu
latitude: 42.000000
longitude: 0.000000
beaute: 1
fraicheur: 1
tranquillite: 1
baignabilite: 1
facilite_acces: 1
compatibilite_enfants: 1
---

Le commentaire est du texte libre.

Il peut contenir plusieurs paragraphes.
```

Chaque note doit être comprise entre 1 et 4. Le nom du fichier sert d'identifiant technique.
Le score total utilisé pour colorer les pins est calculé par le site, mais n'est jamais affiché.

## Brouillons de fiches

Une fiche peut conserver des coordonnées ou des notes vides pendant sa préparation.
`construire.py` l'ignore alors simplement et continue à générer la carte avec les fiches complètes.
Dès que latitude, longitude et les six notes sont renseignées, elle apparaît automatiquement au prochain lancement de `python construire.py`.
