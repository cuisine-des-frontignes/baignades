from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent

LIEUX = ROOT / "lieux"
PROSPECTIVE = ROOT / "prospective"

SORTIE_LIEUX = ROOT / "data" / "baignades.geojson"
SORTIE_PROSPECTIVE = ROOT / "data" / "prospective.geojson"

CRITERES = [
    "beaute",
    "fraicheur",
    "tranquillite",
    "baignabilite",
    "facilite_acces",
    "compatibilite_enfants",
]

REQUIS_LIEUX = ["nom", "latitude", "longitude", *CRITERES]
REQUIS_PROSPECTIVE = ["nom", "latitude", "longitude"]


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


def est_brouillon(entete, requis):
    return any(not entete.get(cle, "").strip() for cle in requis)


def lire_coordonnees(path: Path, entete):
    try:
        latitude = float(entete["latitude"].replace(",", "."))
        longitude = float(entete["longitude"].replace(",", "."))
    except ValueError:
        raise ValueError(f"{path.name} : latitude ou longitude invalide")
    return latitude, longitude


def compiler_lieu_connu(path: Path, entete, commentaire):
    notes = {}
    for critere in CRITERES:
        try:
            note = int(entete[critere])
        except ValueError:
            raise ValueError(f"{path.name} : {critere} doit être un entier de 1 à 4")
        if note not in (1, 2, 3, 4):
            raise ValueError(f"{path.name} : {critere} doit être compris entre 1 et 4")
        notes[critere] = note

    latitude, longitude = lire_coordonnees(path, entete)

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


def compiler_lieu_prospectif(path: Path, entete, commentaire):
    latitude, longitude = lire_coordonnees(path, entete)

    return {
        "type": "Feature",
        "properties": {
            "id": path.stem,
            "nom": entete["nom"],
            "commentaire": commentaire,
        },
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude],
        },
    }


def compiler_collection(dossier, sortie, nom_collection, requis, compilateur):
    fiches = sorted(dossier.glob("*.md"))
    features = []
    brouillons = []

    for path in fiches:
        entete, commentaire = lire_entete_et_commentaire(path)
        if est_brouillon(entete, requis):
            brouillons.append(path.name)
            continue
        features.append(compilateur(path, entete, commentaire))

    geojson = {
        "type": "FeatureCollection",
        "name": nom_collection,
        "features": features,
    }

    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(geojson, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(features)} fiche(s) compilée(s) dans {sortie.relative_to(ROOT)}")
    if brouillons:
        print(f"{len(brouillons)} brouillon(s) ignoré(s) dans {dossier.name}/ :")
        for nom in brouillons:
            print(f"  - {nom}")


def main():
    if not LIEUX.exists():
        raise SystemExit("Dossier lieux/ introuvable")

    compiler_collection(
        LIEUX,
        SORTIE_LIEUX,
        "Baignades et promenades de rivières et de lacs",
        REQUIS_LIEUX,
        compiler_lieu_connu,
    )

    PROSPECTIVE.mkdir(exist_ok=True)
    compiler_collection(
        PROSPECTIVE,
        SORTIE_PROSPECTIVE,
        "Prospective",
        REQUIS_PROSPECTIVE,
        compiler_lieu_prospectif,
    )


if __name__ == "__main__":
    main()
