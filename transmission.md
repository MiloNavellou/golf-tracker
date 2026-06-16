# 📋 Transmission — Projet "Mon Golf Tracker"

> Document de passation pour reprendre le projet. Dernière mise à jour : 16/06/2026.
> **✅ La gestion des parcours est terminée et testée.** L'app est de nouveau dans un état fonctionnel cohérent. Cache service worker : `golf-tracker-v5`.

---

## 1. Objectif du projet

Application web de suivi de progression au golf, centrée sur le parcours de **Saint-Grégoire** (9 trous), où l'utilisateur débute le golf. Elle doit :

- Permettre de saisir ses coups trou par trou via une **carte interactive** du parcours (clic sur une pastille de trou → fiche de saisie : nombre de coups, clubs utilisés, notes).
- Suivre la progression (statistiques, historique des parties).
- Être installable comme une vraie app (**PWA**) sur iPhone et PC.
- Sauvegarder les données dans le cloud, **privées par utilisateur** (connexion par email).
- Fonctionnalités ludiques et souvenirs : badges automatiques, photo "à la BeReal" au départ d'une partie.
- Gérer **plusieurs parcours** (St-Grégoire = principal avec carte ; autres parcours = saisie en liste).

---

## 2. Architecture technique

- **Front** : un seul fichier `index.html` (HTML + CSS + JS inline). Tout est dedans, y compris les 3 images du parcours encodées en base64.
- **Backend** : **Supabase** (PostgreSQL + Auth email + Storage pour les photos).
- **Hébergement** : **Vercel**, connecté à **GitHub** (push → redéploiement auto).
- **PWA** : `manifest.json` + `sw.js` (service worker) + 2 icônes PNG.
- Pas de framework JS, pas de build : du vanilla JS, modifiable directement.

### Identifiants Supabase (déjà intégrés dans `index.html`)
- URL projet : `https://nzfxtlgflidtqggylmnx.supabase.co`
- Clé publique : `sb_publishable_H5Vwg-2xLyDfrQ40tUvBqQ_c7wJ3WeO` (clé publishable, destinée au front — la sécurité repose sur les politiques RLS, pas sur le secret de la clé)

---

## 3. Fichiers du projet

Tous dans le dossier `golf_pwa/` :

| Fichier | Rôle | État |
|---|---|---|
| `index.html` | L'app complète (UI + logique + images base64) | **En cours de modification** (cassé, voir §6) |
| `manifest.json` | Config PWA (nom, icônes, couleurs) | Stable |
| `sw.js` | Service worker (hors-ligne + cache). Cache nommé `golf-tracker-v4` | Stable |
| `icon-192.png` / `icon-512.png` | Icônes de l'app | Stable |
| `GUIDE_DEPLOIEMENT.html` | Guide de déploiement Supabase + Vercel/Netlify | Stable |
| `transmission.md` | Ce document | — |

> **Important sur le service worker** : à chaque déploiement d'une nouvelle version, **incrémenter `CACHE_NAME`** dans `sw.js` (`golf-tracker-v4` → `v5`...) sinon les utilisateurs gardent l'ancienne version en cache. Sur iPhone, fermer/rouvrir l'app deux fois pour récupérer la MAJ.

---

## 4. Tables Supabase (toutes avec RLS "chacun ne voit que ses données")

- **`rounds`** : parties terminées. Colonnes : `id`, `created_at`, `user_id`, `course`, `course_id`, `date`, `holes` (jsonb), `total`, `photo_path`.
- **`badges`** : badges débloqués. Colonnes : `id`, `user_id`, `badge_key`, `unlocked_at`, contrainte `unique(user_id, badge_key)`.
- **`courses`** : parcours personnalisés ajoutés par l'utilisateur. Colonnes : `id`, `created_at`, `user_id`, `name`, `city`, `holes` (int, défaut 9), `par` (nullable). **← table créée récemment, pas encore exploitée par le code (voir §6).**
- **Storage** : bucket privé **`souvenirs`** pour les photos, avec policies upload/read/delete par utilisateur (photos rangées dans un dossier `{user_id}/`).

---

## 5. Ce qui a été construit (chronologie) et TESTÉ ✅

Toutes ces fonctionnalités sont **en production et fonctionnelles** (état déployé avant la refonte en cours) :

1. **Carte interactive + saisie** — 3 vues de St-Grégoire (illustrée / épurée / photo aérienne), 9 pastilles de trous cliquables, fiche de saisie (compteur de coups, sélection multi-clubs, notes). Carte de score récap.
2. **Statistiques** — évolution des scores (Chart.js), moyenne par trou, clubs les plus utilisés.
3. **Historique** — parties terminées, détail par trou, suppression.
4. **PWA** — manifest + service worker + installation iPhone/PC + hors-ligne.
5. **Cloud + auth privée** — écran de connexion email/mot de passe, sync multi-appareils, RLS. Indicateur de sync ☁️/⏳/⚠️, bouton déconnexion. **La connexion a été testée et confirmée par l'utilisateur en production.**
6. **Onglet Défis (badges auto)** — 15 badges, déblocage automatique au `finishRound`, animation "Nouveau badge !", enregistrement avec date dans la table `badges`. Seuils de score : **60/55/50/45/40**.
7. **Refonte mobile de la carte** — carte en grand sur mobile, pastilles agrandies + zone tactile élargie, pinch-to-zoom, pan, double-tap pour réinitialiser, boutons +/−.
8. **Photo souvenir "BeReal"** — au démarrage d'une partie (optionnel) : capture caméra arrière puis avant (Safari ne permet pas les deux simultanément), aperçu en grand (valider/refaire), compression, upload dans Storage `souvenirs`, affichage dans les détails de l'historique + vue plein écran.

### Méthode de test utilisée
Comme il n'y a pas de navigateur dans l'environnement de dev, le JS est testé ainsi :
- **Vérification syntaxique** : extraction du `<script>` principal puis `node --check`.
- **Test runtime** : exécution du script via `eval` dans Node avec des **mocks** de `window`, `document`, `localStorage`, `navigator`, et du client **Supabase** (auth/from/storage). On appelle ensuite les fonctions clés et on vérifie les valeurs de retour.
- Les badges ont été validés avec un jeu de données simulé (les bons badges se débloquent). La logique `beatRecord` est correcte avec l'ordre réel (Supabase renvoie le plus récent en premier).

---

## 6. ✅ Gestion des parcours — TERMINÉE

Fonctionnalité finie et testée (runtime mocké). Détails de l'implémentation :

- `MAIN_COURSE` (St-Grégoire, avec carte) + `myCourses` (parcours perso chargés depuis la table `courses`).
- Helpers : `allCourses()`, `getCourseById(id)`, `holesCount(round)`, `holeNumbers(round)`, `roundHasMap(round)`.
- Data layer : `fetchCourses()` (branché dans `onLogin`), `insertCourse()`, `deleteCourseDb()`.
- **Sélecteur de parcours** repensé : St-Grégoire en tête (carte interactive), section "Mes parcours" (avec bouton 🗑️ par parcours), bouton **"＋ Ajouter un parcours"**.
- **Formulaire d'ajout** (modal `course-form-modal`) : nom (obligatoire), ville, 9/18 trous, par (**optionnel**).
- **Affichage dynamique** via `renderParcoursView()` : St-Grégoire → carte (`renderMap`) ; autres → **saisie en liste** (`renderHolesList`, gros boutons par trou). Le nombre de trous (9/18) est dynamique partout : `updateInfo`, `renderScorecard`, progression.
- **Badges de score** (`bestScore`) et **stats "moyenne par trou"** calés sur **St-Grégoire 9 trous uniquement** (cohérence des seuils 60/55/50/45/40).

### Vérifications faites
`node --check` OK, pas d'ID HTML dupliqué, test runtime : ajout de 2 parcours (un 18T, un 9T), partie St-Grégoire (9 trous + carte), partie Cicé 18 trous (liste, pas de carte), `bestScore` ignore bien un 70 joué sur 18 trous.

---

## 7. Idées / backlog pour la suite (non commencées)

- **Par de chaque trou** de St-Grégoire → afficher le score en +/− (ex. "+5"), colorer birdie/par/bogey. (Très demandé, gros impact motivation.)
- **Stats par club** (quel club le plus fiable / le plus utilisé) — la donnée existe déjà.
- **Mode practice** dédié (nombre de balles, club travaillé, cible) — l'utilisateur fait beaucoup de practice.
- **Upload d'une photo de carte** pour les parcours personnalisés (pour avoir une carte cliquable ailleurs qu'à St-Grégoire).
- Possibilité de **refaire/supprimer une photo souvenir** après coup, ou n'en prendre qu'une seule.

---

## 8. Conventions & pièges à connaître

- **Tout est dans `index.html`** : les images base64 rendent le fichier volumineux (~270 Ko). Pour éditer le JS, on extrait le `<script>`, on teste, on réinjecte.
- **La partie en cours (brouillon)** est stockée en **localStorage** (clé `golfDraft_{user_id}`), pas dans le cloud, jusqu'au `finishRound()` qui l'envoie dans `rounds`. La photo du brouillon est gardée en dataURL dans ce brouillon.
- **Le service worker n'intercepte jamais les appels Supabase** (`supabase.co` exclu) — ne pas casser cette exclusion, sinon données périmées / auth cassée.
- **Photos** : compressées en JPEG ~720×960 q0.78, rangées dans `souvenirs/{user_id}/{timestamp}.jpg`, affichées via **URL signées** (1h) car le bucket est privé.
- **Caméra** : ne fonctionne qu'en **HTTPS** (donc sur l'URL Vercel, pas en local), et nécessite l'autorisation iOS.
- **Évenhandness des seuils** : badges de score 60/55/50/45/40, calés sur 9 trous.
