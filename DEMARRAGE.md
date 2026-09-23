# DEMARRAGE — à lire en premier

Ce dossier est le projet complet et vérifié : socle applicatif, documentation, contexte Claude Code
et dépôt git déjà initialisé (branches `main` et `test`, un seul commit propre).

Ce fichier ne sert qu'une fois, à la mise en place. Ensuite, tout est dans `README.md` et
`CLAUDE.md`.

---

## 1. Créer le dépôt GitHub (chef de projet, une seule fois)

1. Sur GitHub, créez un dépôt **vide** : sans README, sans .gitignore, sans licence.
2. Dans un terminal, à la racine de ce dossier :

```powershell
git remote add origin https://github.com/<compte>/<depot>.git
git config user.name "<votre nom>"
git config user.email "<votre email>"
git commit --amend --reset-author --no-edit
git push -u origin main
git push -u origin test
```

3. Sur GitHub → **Settings → General** : mettez **`test`** comme branche par défaut, pour que les
   Pull Requests pointent vers elle automatiquement.
4. **Settings → Branches** : protégez `test` **et** `main` — Pull Request obligatoire, une
   relecture, contrôle CI vert avant fusion.
5. Ouvrez `.github/CODEOWNERS` et remplacez `@dev-a` et `@dev-b` par vos identifiants GitHub réels,
   puis committez cette modification.

## 2. Chaque développeur, sur sa machine (une seule fois)

Prérequis : Node.js 22 LTS, Git, VS Code avec l'extension Claude Code.

```powershell
git clone https://github.com/<compte>/<depot>.git pos-boutique
cd pos-boutique
npm install
powershell -ExecutionPolicy Bypass -File scripts\configurer-dev.ps1 A   # « B » pour l'autre
npm run dev
```

Le script crée `CLAUDE.local.md` (personnel, non versionné) : il charge automatiquement le brief et
le carnet du bon développeur dans Claude Code.

Comptes de démonstration : Patron `1234` (admin) · Kossi `5678` (gérant) · Afi `0000` (caissière).

## 3. Première session de travail

Dans VS Code, ouvrez Claude Code et tapez :

```
/reprendre
```

Claude doit répondre par un point en 5 lignes et proposer **A1.1** à Dev A, **B1** à Dev B.
Ensuite : `/tache A1.1` (ou `/tache B1`), lisez le plan proposé, donnez votre accord, laissez coder.

## 4. Le rythme

| Quand                | Quoi                                                                     |
|----------------------|--------------------------------------------------------------------------|
| Chaque matin         | `git switch test && git pull`, puis rebase de sa branche, puis `/reprendre` |
| Chaque soir          | `/verifier`, `/cloturer`, commit, `git push` — même si la tâche continue |
| Tâche terminée       | PR vers `test`, relue par l'autre le jour même, CI verte, fusion squash  |
| Chaque vendredi      | Test commun de `test`, PR `test` → `main`, tag `v0.<semaine>`            |

## 5. Commandes de pilotage (chef de projet)

Elles rendent compte et n'écrivent rien.

| Commande            | Réponse                                                               |
|---------------------|------------------------------------------------------------------------|
| `/plan`             | Plan complet : fait, en cours, à faire, par développeur, blocages     |
| `/tache-en-cours`   | Ce qui tourne des deux côtés et la prochaine action                   |
| `/taches-terminees` | Ce qui est terminé et **comment le tester** dans l'application        |
| `/tache-suivante`   | La prochaine tâche et si elle est démarrable                          |

## 6. Où lire quoi

| Besoin                                              | Fichier                        |
|-----------------------------------------------------|--------------------------------|
| Démarrage, architecture, workflow git               | `README.md`                    |
| Règles permanentes pour Claude Code                 | `CLAUDE.md`                    |
| Vision, périmètre, droits, exigences                | `docs/PROJET.md`               |
| Règles métier (calculs, flux, cas limites)          | `docs/REGLES_METIER.md`        |
| Écrans validés, design, textes                      | `docs/UI_UX.md`                |
| Tables, vues, triggers                              | `docs/MODELE_DONNEES.md`       |
| Décisions prises et en attente                      | `docs/DECISIONS.md`            |
| Scénario de recette avec chiffres attendus          | `docs/SCENARIO_REFERENCE.md`   |
| Avancement (source unique du pilotage)              | `docs/ETAT_AVANCEMENT.md`      |
| Tâches détaillées                                   | `docs/DEV_A_COMPTOIR.md`, `docs/DEV_B_BACKOFFICE.md` |
| Briefs et carnets Claude Code                       | `docs/claude/`                 |

## 7. Trois décisions à obtenir de la cliente

Elles sont notées dans `docs/DECISIONS.md` et attendent une réponse :

- **D-A1** politique de stock négatif — en attendant, on ne bloque jamais une vente ;
- **D-A2** page de codes de l'imprimante validée en Phase 0 — à reporter avant la tâche A3 ;
- **D-A3** plafond de remise du caissier — avant la tâche A5.

Ce fichier peut être supprimé une fois la mise en place terminée.
