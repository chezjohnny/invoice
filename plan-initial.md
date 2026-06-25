# Invoices

Je veux construire une application pour gérer des factures initialement pour un marchand de vins, mais doit pouvoir s'appliquer à n'importe quel type de buisness (PME). Cette application devra s'intégrer dans le site web du marchand.

### But

Développer une application fonctionnelle et performante. Elle me permettra d'apprendre les nouveaux concepts angular et peut-être de nouveaux framework python (je connais bien flask).

## Technologies
Le code doit être minimal et des tests unitaires seront mis en place avec au minimum les tests complets du backend et des stores. Les outils de qualités lint, format, etc. doivent être configurés.

Le projet sera sous git et testé automatiquement sur github avec github action.

### Backend

En python avec uv et pytest pour les tests. A choisir le framework web et la technologie de stockage des données. La taille des données correspond à une petite ou moyenne entreprise.

### Frontend

En angular 22 avec rxjs signal store, vite pour les tests qui utilisent les derniers concepts (signals, signal form, resources et une configuration agent IA). Reste à choisir le framework css et widget. L'application est écrite en anglais, mais l'interface doit supporter plusieurs langues initialement (anglais et français). Elle doit pouvoir être développée sans backend (les services http doivent pouvoir être configurés dans app.config pour replacer les appels backend par des mock locaux).


## Workflows

### Login

Le marchand se connecte avec son login password. Il arrive sur une page avec dashboard qui résume le nombre de factures ouvertes (non payées) avec un champ de recherche pour pouvoir rechercher un client. Il aura un menu pour éditer son profil et une entrée pour gérer les articles.

### Gestion d'articles

Le marchand est connecté. Il choisit dans le menu la gestion des articles. A une page avec un champ de filtrage avec la liste des articles les plus récents, chaque article a des buttons: editer, archiver. Il y a un boutton ajouter au sommet de la liste.

### Gestion de client

Comme la gestion d'article.

### Gestion des commandes
Comme la gestion d'article, mais avec une facette qui permet de filtrer par status.

### Ajout d'une commande

Le marchand recherche un client, affiche le client avec ses commandes passées triées par la plus récente en premier. Il peut rajouter une commande avec un formulaire. Le status est par défaut: commandé. Une fois la commande faite il peut changer le status facilement et prévisualiser et imprimer la facture. La facture doit supporter un code QR de facture suisse.

## Resources identifiées

### Profil utilisateur
Champs:
- username
- email
- password
- addresse de l'entreprise
- logo
- taux de la tva

### Clients
- prénom + nom
- rue
- code postal
- ville
- pays (default: Suisse)
- email
- téléphones
    - description
    - numéro

### Articles
- nom
- description
- quantité en stock
- prix unitaire
- image d'illustration

### Commandes

- date
- client
- articles
- remise
- status: commandé, livré, payé

Les clients, articles et commandes ont tous une date de modification et de création.