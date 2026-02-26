# 🎮 The Glitch Kitchen - Guide de Déploiement Complet

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Configuration de la base de données](#configuration-de-la-base-de-données)
3. [Variables d'environnement](#variables-denvironnement)
4. [Déploiement avec Docker](#déploiement-avec-docker)
5. [Configuration Nginx (optionnel)](#configuration-nginx-optionnel)
6. [Initialisation du jeu](#initialisation-du-jeu)
7. [Mise à jour](#mise-à-jour)
8. [Dépannage](#dépannage)
9. [Sécurité et optimisation](#sécurité-et-optimisation)

---

## Prérequis

### Infrastructure
- **VPS ou serveur** avec au minimum :
  - 2 CPU cores
  - 4 GB RAM
  - 20 GB stockage
  - Ubuntu 20.04+ ou Debian 11+

### Logiciels requis
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git**

### Services externes
- **Compte Supabase** (gratuit) - https://supabase.com
- **Clé API Gemini** ou **OpenAI** (au moins une des deux)

---

## Configuration de la base de données

### 1. Créer un projet Supabase

1. Allez sur https://supabase.com et créez un compte
2. Créez un nouveau projet
3. Notez votre **Project URL** et **anon/public key**

### 2. Exécuter le schéma SQL

1. Dans votre projet Supabase, allez dans **SQL Editor**
2. Copiez **l'intégralité** du fichier `supabase_schema.sql`
3. Collez-le dans l'éditeur SQL
4. Cliquez sur **Run** pour exécuter le script

### 3. Vérifier les tables créées

Le script crée automatiquement :

**Tables principales :**
- `games` - Parties de jeu
- `brigades` - Équipes de joueurs
- `staff` - Codes Game Master
- `players` - Joueurs
- `recipe_tests` - Scores des recettes

**Tables de données :**
- `recipe_notes` - Notes de recette (10 étapes par brigade)
- `inventory` - Inventaire des fragments (15 slots par brigade)
- `game_logs` - Logs des événements

**Catalogues :**
- `catalog_roles` - Rôles disponibles (8 rôles)
- `catalog_missions` - Missions
- `catalog_contests` - Contests
- `catalog_recipe` - Recette de référence (10 étapes)
- `catalog_fragments` - Fragments de recette (60+ fragments)

**Index de performance :**
- Tous les index nécessaires pour supporter 40+ utilisateurs simultanés sont créés automatiquement

### 4. Activer Realtime (important)

1. Dans Supabase, allez dans **Database** → **Replication**
2. Activez la réplication pour toutes les tables listées ci-dessus
3. Cela permet les mises à jour en temps réel dans le jeu

---

## Variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```env
# Configuration Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_publique

# Clés API IA (au moins une des deux est requise)
GEMINI_API_KEY=votre_cle_gemini
OPENAI_API_KEY=votre_cle_openai
```

### Obtenir les clés API

**Gemini (recommandé - gratuit) :**
1. Allez sur https://makersuite.google.com/app/apikey
2. Créez une nouvelle clé API
3. Copiez la clé dans `.env.local`

**OpenAI (payant) :**
1. Allez sur https://platform.openai.com/api-keys
2. Créez une nouvelle clé API
3. Copiez la clé dans `.env.local`

⚠️ **Important** : Ne commitez JAMAIS le fichier `.env.local` dans Git !

---

## Déploiement avec Docker

### Option 1: Docker Compose (Recommandé)

1. **Cloner le dépôt** sur votre VPS :
```bash
git clone <url-de-votre-repo>
cd the-glitch-kitchen
```

2. **Créer le fichier `.env.local`** avec vos variables d'environnement (voir section précédente)

3. **Construire et démarrer le conteneur** :
```bash
docker-compose up -d --build
```

4. **Vérifier les logs** :
```bash
docker-compose logs -f
```

5. **Arrêter l'application** :
```bash
docker-compose down
```

L'application sera accessible sur `http://votre-ip:3000`

### Option 2: Docker seul

1. **Construire l'image** :
```bash
docker build -t the-glitch-kitchen .
```

2. **Lancer le conteneur** :
```bash
docker run -d \
  --name the-glitch-kitchen \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  the-glitch-kitchen
```

---

## Configuration Nginx (optionnel)

Pour utiliser un nom de domaine et SSL :

### 1. Installer Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Créer la configuration Nginx

Créez le fichier `/etc/nginx/sites-available/glitch-kitchen` :
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/glitch-kitchen /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Installer SSL avec Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

Votre site sera accessible sur `https://votre-domaine.com`

---

## Initialisation du jeu

### 1. Accéder à l'interface admin

1. Ouvrez votre navigateur et allez sur `http://votre-domaine.com/admin`
2. Vous accédez au panneau d'administration

### 2. Initialiser le catalogue

1. Dans l'onglet **CATALOG_ROLES**, cliquez sur **SEED_CATALOG**
2. Cela crée automatiquement :
   - 8 rôles avec leurs pouvoirs
   - 12 contests

### 3. Créer une partie

**Option A : Partie simple**

1. Dans l'onglet **GAMES_INSTANCES**, cliquez sur **NEW_GAME**
2. Remplissez :
   - **GAME_NAME** : Nom de votre événement
   - **BRIGADE_COUNT** : Nombre d'équipes (ex: 10)
   - **Durées des cycles** : Annonce (4 min), Contests (7 min), Temps libre (9 min)
3. Cliquez sur **DEPLOY_INSTANCE**

**Option B : Déploiement massif avec import Excel**

1. Cliquez sur **MASS_DEPLOY**
2. Configurez :
   - **NAME_PREFIX** : Préfixe des parties (ex: "Session")
   - **GAME_COUNT** : Nombre de parties à créer
   - **BRIGADES_PER_GAME** : Brigades par partie
3. Importez votre fichier Excel avec les colonnes :
   - `prenom`, `nom`, `email`, `junior`, `pool`, `brigade`, `role`
4. Cliquez sur **DEPLOY_ALL**

### 4. Importer les joueurs

1. Dans l'onglet **PLAYERS_MGMT**, cliquez sur **IMPORT_PLAYERS**
2. Sélectionnez la partie cible
3. Importez votre fichier Excel (colonnes : `prenom`, `nom`, `pool`, `brigade`, `role`)
4. Cliquez sur **DISTRIBUTE_ROLES**

**Les joueurs sont automatiquement répartis par pool/brigade !**

### 5. Récupérer les codes de connexion

**Codes brigades :**
- Onglet **BRIGADES_MGMT** : liste tous les codes de connexion des brigades
- Les joueurs utilisent ces codes sur la page d'accueil

**Code Game Master :**
- Visible dans l'onglet **GAMES_INSTANCES** (colonne STAFF CODE)
- Utilisez ce code pour accéder au tableau de bord GM : `/gm/[game_id]`

### 6. Lancer la partie

1. Dans **GAMES_INSTANCES**, cliquez sur l'icône ▶️ (Play) pour passer le statut à **active**
2. Les brigades peuvent maintenant jouer !

---

## Mise à jour

### Mettre à jour l'application

```bash
# 1. Récupérer les dernières modifications
git pull origin main

# 2. Reconstruire et redémarrer
docker-compose up -d --build
```

### Sauvegarder la base de données

Les données sont dans Supabase, elles sont automatiquement sauvegardées. Vous pouvez exporter manuellement :

1. Dans Supabase, allez dans **Database** → **Backups**
2. Téléchargez une sauvegarde

---

## Dépannage

### Problèmes courants

**L'application ne démarre pas**
```bash
# Vérifier le statut
docker-compose ps

# Voir les logs
docker-compose logs -f
```

**Erreur de connexion Supabase**
- Vérifiez que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont corrects
- Vérifiez que les tables sont créées dans Supabase
- Vérifiez que Realtime est activé

**Les mises à jour en temps réel ne fonctionnent pas**
- Allez dans Supabase → Database → Replication
- Activez la réplication pour toutes les tables

**Erreur "No API key found"**
- Vérifiez que `GEMINI_API_KEY` ou `OPENAI_API_KEY` est défini dans `.env.local`
- Redémarrez le conteneur après modification : `docker-compose restart`

### Commandes utiles

```bash
# Redémarrer l'application
docker-compose restart

# Voir les logs en temps réel
docker-compose logs -f --tail=100

# Reconstruire complètement
docker-compose down
docker-compose up -d --build

# Voir l'utilisation des ressources
docker stats the-glitch-kitchen
```

---

## Sécurité et optimisation

### Sécurité

**1. Configurer le pare-feu**
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**2. Protéger les variables d'environnement**
- Ne commitez JAMAIS `.env.local` dans Git
- Ajoutez `.env.local` dans `.gitignore` (déjà fait)

**3. Mises à jour régulières**
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Mettre à jour Docker
sudo apt install docker-ce docker-ce-cli containerd.io
```

### Optimisation des performances

**Pour 40+ utilisateurs simultanés :**

1. **Index de base de données** : Déjà créés automatiquement par `supabase_schema.sql`

2. **Connection pooling Supabase** :
   - Dans Supabase → Settings → Database
   - Activez "Connection pooling"
   - Utilisez le mode "Transaction"

3. **Monitoring des ressources** :
```bash
# Voir l'utilisation CPU/RAM
docker stats

# Logs avec rotation
docker-compose logs -f --tail=100
```

4. **Optimisation Docker** :
   - Le Dockerfile utilise déjà le mode production
   - Les dépendances sont optimisées
   - Le cache est configuré

### Monitoring

**Surveiller l'application :**
```bash
# Utilisation des ressources
docker stats the-glitch-kitchen

# Logs en temps réel
docker-compose logs -f

# Statut des conteneurs
docker-compose ps
```

**Métriques Supabase :**
- Allez dans votre projet Supabase → Reports
- Surveillez les requêtes, la latence, et l'utilisation

---

## 🎉 C'est prêt !

Votre instance de **The Glitch Kitchen** est maintenant déployée et prête à accueillir vos joueurs !

**Liens utiles :**
- Page d'accueil : `https://votre-domaine.com`
- Admin : `https://votre-domaine.com/admin`
- Game Master : `https://votre-domaine.com/gm/[game_id]`
- Staff : `https://votre-domaine.com/staff/[staff_code]`

**Support :**
- Documentation du jeu dans le README.md
- Issues GitHub pour les bugs

Bon jeu ! 🍳✨
