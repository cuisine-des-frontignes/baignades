from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
LIEUX = ROOT / "lieux"
SORTIE = ROOT / "data" / "baignades.geojson"

CRITERES = [
    "beaute",
    "fraicheur",
    "tranquillite",
    "baignabilite",
    "facilite_acces",
    "compatibilite_enfants",
]

REQUIS = ["nom", "latitude", "longitude", *CRITERES]


def lire_entete_et_commentaire(path: Path):
    texte = path.read_text(encoding="utf-8")
    lignes = texte.splitlines()

    if not lignes or lignes[0].strip() != "---":
        raise ValueError(f"{path.name} : la fiche doit commencer par ---")

    try:
        fin = next(i for i, ligne in enumerate(lignes[1:], start=1) if ligne.strip() == "---")
    except StopIteration:
        raise ValueError(f"{path.name} : second --- introuvable")

    entete = {}
    for numero, ligne in enumerate(lignes[1:fin], start=2):
        ligne = ligne.strip()
        if not ligne:
            continue
        if ":" not in ligne:
            raise ValueError(f"{path.name}, ligne {numero} : ':' manquant")
        cle, valeur = ligne.split(":", 1)
        entete[cle.strip()] = valeur.strip()

    commentaire = "\n".join(lignes[fin + 1:]).strip()
    return entete, commentaire


def est_brouillon(entete):
    # Une fiche est un brouillon si un champ nécessaire existe mais reste vide,
    # ou s'il manque. Elle n'empêche donc pas la génération du site.
    return any(not entete.get(cle, "").strip() for cle in REQUIS)


def compiler_fiche(path: Path, entete, commentaire):
    notes = {}
    for critere in CRITERES:
        try:
            note = int(entete[critere])
        except ValueError:
            raise ValueError(f"{path.name} : {critere} doit être un entier de 1 à 4")
        if note not in (1, 2, 3, 4):
            raise ValueError(f"{path.name} : {critere} doit être compris entre 1 et 4")
        notes[critere] = note

    try:
        latitude = float(entete["latitude"].replace(",", "."))
        longitude = float(entete["longitude"].replace(",", "."))
    except ValueError:
        raise ValueError(f"{path.name} : latitude ou longitude invalide")

    return {
        "type": "Feature",
        "properties": {
            "id": path.stem,
            "nom": entete["nom"],
            **notes,
            "commentaire": commentaire,
        },
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude],
        },
    }


def main():
    fiches = sorted(LIEUX.glob("*.md"))
    if not fiches:
        raise SystemExit("Aucune fiche .md trouvée dans le dossier lieux/")

    features = []
    brouillons = []

    for path in fiches:
        entete, commentaire = lire_entete_et_commentaire(path)
        if est_brouillon(entete):
            brouillons.append(path.name)
            continue
        features.append(compiler_fiche(path, entete, commentaire))

    geojson = {
        "type": "FeatureCollection",
        "name": "Baignades des Pyrénées centrales",
        "features": features,
    }

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(geojson, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(features)} fiche(s) complète(s) compilée(s) dans {SORTIE.relative_to(ROOT)}")
    if brouillons:
        print(f"{len(brouillons)} brouillon(s) ignoré(s) :")
        for nom in brouillons:
            print(f"  - {nom}")


if __name__ == "__main__":
    main()
