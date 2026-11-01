"""
Dessine l'icône de l'application (B-P5) : la boutique du menu, blanche sur le bleu commerce
(jeton --primaire de ui/styles.css). Produit build/icon.ico (16 à 256 px), lu par electron-builder.

    python scripts/generer_icone.py

À relancer seulement si l'icône change ; à remplacer par le logo de la cliente s'il en fournit un.
"""
from pathlib import Path
from PIL import Image, ImageDraw

PRIMAIRE = (0x1F, 0x5F, 0xBF, 255)
BLANC = (255, 255, 255, 255)
T = 1024  # dessin en grand, réduit ensuite : traits nets à toutes les tailles


def dessiner() -> Image.Image:
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((32, 32, T - 32, T - 32), radius=200, fill=PRIMAIRE)
    e = 58  # épaisseur du trait
    # Store : bord du toit, puis trois festons.
    d.line([(190, 400), (250, 220), (774, 220), (834, 400)], fill=BLANC, width=e, joint='curve')
    for i in range(3):
        x0 = 190 + i * 215
        d.arc((x0, 290, x0 + 215, 510), start=0, end=180, fill=BLANC, width=e)
    # Murs et porte.
    d.line([(250, 500), (250, 820), (774, 820), (774, 500)], fill=BLANC, width=e, joint='curve')
    d.line([(440, 820), (440, 640), (584, 640), (584, 820)], fill=BLANC, width=e, joint='curve')
    return img


def main() -> None:
    sortie = Path(__file__).resolve().parent.parent / 'build' / 'icon.ico'
    sortie.parent.mkdir(exist_ok=True)
    tailles = [(n, n) for n in (16, 24, 32, 48, 64, 128, 256)]
    dessiner().resize((256, 256), Image.LANCZOS).save(sortie, sizes=tailles)
    print(sortie)


if __name__ == '__main__':
    main()
