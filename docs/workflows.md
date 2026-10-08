# Workflows d'usage

Ce document décrit les situations de travail réelles du vendeur, et comment
l'application y répond. Pour chaque workflow :

- **Étapes** : ce que fait le vendeur ;
- **Dans l'application** : le parcours actuel, écran par écran ;
- **Manques** : ce qui ralentit ou bloque le workflow aujourd'hui.

Tous les formulaires (facture, client, article, sortie de stock) s'ouvrent sur
une page à part : plein écran sur mobile, boutons collés en bas, et le bouton
retour du téléphone annule. Seules les confirmations (paiement, rappel,
suppression) restent des fenêtres.

Vocabulaire :

| Terme métier | Dans l'application |
|---|---|
| Pré-commande | Facture en **brouillon** |
| Valider la commande | **Émettre** la facture (numéro attribué, stock décompté) |
| Reçu / quittance | PDF d'une facture **payée** : « Acquittée … le … », sans échéance ni QR-bill |
| N° de référence | **Numéro de facture** (`2610051` : date AAMMJJ + n° du jour, chiffres seulement) : message TWINT et information du QR-bill |

---

## 1. Créer une pré-commande (par téléphone, sur mobile)

Le client appelle ; le vendeur saisit la commande sur son téléphone, puis la
prépare au magasin.

**Étapes**

1. Répondre à l'appel.
2. Ouvrir l'application.
3. Rechercher le client.
4. Créer la fiche client si elle n'existe pas.
5. Ajouter une pré-commande avec les articles demandés.
6. Rentrer au magasin.
7. Préparer la commande, puis la valider.
8. Le client vient la chercher.

**Dans l'application**

- 3–4. Menu → *Clients* → recherche par nom, e-mail ou **numéro de téléphone**,
  écrit de n'importe quelle façon (`079 123 45 67`, `+41791234567`, ou seulement
  la fin). Dans toutes les listes, la recherche part dès 3 caractères, ou tout de
  suite avec Entrée. Sinon *Nouveau client* → *Enregistrer & créer une facture* : la fiche
  est créée et la nouvelle facture s'ouvre directement. Pour une société, son nom
  va dans *Nom ou raison sociale*, sans prénom ; une personne de contact
  (« Par Mme … ») va dans le complément d'adresse.
- 5. Fiche client → *Nouvelle facture* → *Ajouter un article…* : chaque article
  choisi (à la souris, ou au clavier avec les flèches et Entrée) s'ajoute à la
  facture, ou augmente sa quantité s'il y est déjà ; *+ Ligne de texte libre* pour
  une ligne hors stock → *Enregistrer* (brouillon).
- 7. *Factures* → onglet *Brouillon* → *Modifier* → ajuster les quantités →
  *Émettre & Imprimer*, ou *Payer & Imprimer* si le client paie en espèces au retrait.

**Manques**

- La recherche par téléphone ne trouve que les clients dont le numéro est
  saisi sur la fiche.

## 2. Servir un client au magasin

**Étapes**

1. Ouvrir l'application.
2. Ajouter les articles choisis par le client.
3. Préparer la marchandise.
4. Valider la commande et imprimer :
   - le **reçu** si le client paie tout de suite ;
   - la **facture** (avec QR-bill) sinon.
5. Si le client a payé, imprimer une copie papier pour la comptabilité.
6. Le client part avec la marchandise.

**Dans l'application**

- 2. *Clients* → fiche → *Nouvelle facture* → *Ajouter un article…*, un article après l'autre.
- 4. Choisir le mode de paiement :
  - *Espèces* → *Payer & Imprimer* : la facture est émise, marquée payée
    aujourd'hui, et le reçu se télécharge ;
  - *TWINT* ou *Virement (IBAN)* → *Émettre & Imprimer* : la facture se télécharge.
- 5. Imprimer le PDF une deuxième fois.

**Manques**

- Une facture exige un **client** : un client de passage oblige à créer une
  fiche, ou à utiliser une fiche générique « Client comptoir » à créer soi-même.
- Dans le formulaire, *Payer & Imprimer* n'existe que pour les espèces : un client
  qui paie sur place par **TWINT** passe par *Émettre & Imprimer*, puis *Payer* →
  *Payer & Imprimer* dans la liste.

## 3. Recevoir un paiement TWINT

**Étapes**

1. Ouvrir l'application.
2. Rechercher le client, ou la facture avec le n° de référence (message TWINT).
3. Valider le paiement, ajuster la date si besoin, imprimer une copie pour la
   comptabilité.

**Dans l'application**

- 2. *Factures* → recherche (numéro, client ou article) → onglet *Émise*.
- 3. *Payer* sur la ligne → fenêtre *Enregistrer le paiement* : date (aujourd'hui
  par défaut, pas dans le futur) et mode de paiement (celui prévu sur la facture,
  à corriger au besoin) → *Payer & Imprimer* télécharge le reçu pour la
  comptabilité. La même fenêtre s'ouvre depuis la fiche client.

**Manques**

Aucun.

## 4. Recevoir un paiement e-banking

**Étapes**

1. Ouvrir l'application.
2. Rechercher la facture avec le n° de référence (communication du virement).
3. Valider le paiement, ajuster la date si besoin, imprimer une copie pour la
   comptabilité.

**Dans l'application**

Même parcours que le paiement TWINT. Le QR-bill n'a pas de référence
structurée (`NON`) : le numéro de facture figure dans l'*information
supplémentaire*, que la banque reporte dans la communication du virement.

**Manques**

- Pas de rapprochement automatique (import d'un relevé bancaire camt.054) : chaque
  paiement se valide à la main.

## 5. Contrôle trimestriel

**Étapes**

1. Ouvrir l'application.
2. Aller dans *Articles*.
3. Choisir la période (année, trimestre).
4. Relever, par article, les ventes, le stock et les sorties de la période.

**Dans l'application**

*Articles* → *Ventes* : année → trimestre. Les colonnes *Vendus* et *Sorties*
suivent la période choisie ; *Stock* est le stock **actuel**.

*Exporter CSV* télécharge tous les articles actifs de la période choisie, sans
tenir compte de la recherche (`articles-2025-Q2.csv`) : prix, TVA propre à
l'article (vide s'il suit le taux de l'entreprise), stock, vendus et sorties. Avec
*Afficher les archivés*, il exporte les articles archivés
(`articles-archived-2025-Q2.csv`).

**Manques**

- Le stock affiché est celui d'aujourd'hui, pas celui de **fin de période** : un
  contrôle fait en retard ne donne pas le bon chiffre.

## 6. Ajouter un article

**Étapes**

1. Ouvrir l'application.
2. Aller dans *Articles*.
3. Ajouter l'article avec son stock initial.

**Dans l'application**

*Articles* → *Nouvel article* → nom, prix, TVA, quantité en stock.

**Manques**

Aucun.

## 7. Inventaire (vérification du stock)

**Étapes**

1. Compter le stock de chaque article.
2. Ouvrir l'application.
3. Retrouver chaque article et corriger son stock.

**Dans l'application**

*Articles* → *Inventaire* : la colonne *Stock* devient un champ par article. Saisir
la quantité comptée ; elle remplace le stock en quittant le champ (Tab, Entrée), et
une coche ✓ marque les articles déjà comptés. Le mode est désactivé sur la liste
des articles archivés.

La correction ne laisse volontairement pas de trace : seul le nouveau stock compte.

**Manques**

Aucun.

## 8. Envoyer des rappels

**Étapes**

1. Aller dans le tableau de bord.
2. Retrouver les factures en retard.
3. Imprimer les rappels.

**Dans l'application**

*Tableau de bord* → carte *Factures en retard* (de la plus ancienne à la plus
récente, avec les jours de retard et les rappels déjà envoyés) → cloche
*Créer un rappel* → *Créer & imprimer*.

- Le rappel est **enregistré** (1er, 2e…) avec sa date et un nouveau délai : la
  date du rappel + le *délai de rappel* des paramètres (10 jours par défaut).
- Son PDF reprend la facture, titrée « Rappel » ou « 2e rappel », avec la date du
  rappel, le nouveau délai, un court texte et le même QR-bill.
- Seule la cloche crée un rappel : l'icône PDF à côté, ou la liste des rappels
  dans le détail de la facture, le réimprime sans en créer un nouveau.
- La même cloche figure sur les factures en retard de la liste des factures et
  de la fiche client.

**Manques**

Aucun.

## 9. Enregistrer une sortie de stock

Des articles quittent le stock sans être facturés : dégustation, lot offert,
bouteille cassée.

**Étapes**

1. Ouvrir l'application.
2. Noter l'article, la quantité et le motif.

**Dans l'application**

*Sorties de stock* → *Nouvelle sortie* → article, cherché en tapant une partie de son
nom comme dans une facture (son stock est affiché ; ✕ pour en choisir un autre), date,
quantité, motif (*Dégustation*, *Promotion / cadeau*, *Perte / casse*, *Autre*)
et une note. Le stock diminue aussitôt ; la sortie apparaît dans la colonne
*Sorties* des articles, sur la période choisie.

Une sortie ne se modifie pas : en cas d'erreur, on la supprime (le stock revient)
et on la saisit à nouveau.

Les articles offerts sur une facture y apparaissent aussi, en *Promotion /
cadeau*, avec un lien vers leur facture : ceux-là ne se suppriment pas ici, mais
en annulant la facture (workflow 12).

**Manques**

Aucun.

## 10. Configurer l'entreprise

À la première connexion, le profil de l'entreprise est vide.

**Étapes**

1. Saisir l'adresse, l'IBAN et, si besoin, le numéro TWINT, la TVA et les délais.

**Dans l'application**

*Paramètres* : tant que l'adresse ou l'IBAN manquent, un bandeau le rappelle
(*Compléter*) et aucune facture ne peut être émise. Le taux de TVA par défaut
s'applique aux articles sans taux propre ; vide, l'entreprise n'est pas assujettie.
Le numéro TWINT ajoute au PDF un bloc « Payer avec TWINT ».

**Manques**

Aucun.

## 11. Annuler une facture

**Étapes**

1. Retrouver la facture.
2. L'annuler.

**Dans l'application**

*Factures* (ou la fiche client) → icône *Annuler la facture* sur la ligne, immédiate,
sans confirmation :

- une facture **émise** reste dans la liste, annulée, avec son numéro ; ses
  articles reviennent dans le stock ;
- un **brouillon** annulé peut ensuite être supprimé (*Supprimer le brouillon
  annulé*) : il n'avait pas de numéro. Une facture émise ne se supprime jamais.

**Manques**

Aucun.

## 12. Faire une facture pour un professionnel (Café)

Un café commande par quantité : on lui fait un prix, et on lui offre une partie
de la commande (par exemple une bouteille par carton de 12).

**Étapes**

1. Ajouter les articles commandés.
2. Adapter le prix des articles pour le prix de quantité.
3. Offrir une partie de la commande.
4. Valider la commande : les articles offerts sortent du stock comme une
   promotion, pas comme une vente.

**Dans l'application**

- 1. *Clients* → fiche → *Nouvelle facture* → les articles, un après l'autre.
- 2. Le prix de chaque ligne se modifie dans l'éditeur (virgule ou point) ; il ne
  vaut que pour cette facture : le prix de l'article ne change pas.
- 3. Sur la ligne de l'article, l'icône cadeau (*Offrir*) ajoute juste en dessous
  une ligne *Offert* du même article, à 1, et reste enfoncée ; un nouveau clic
  (*Ne plus offrir*) la retire. La quantité offerte se saisit sur la ligne
  *Offert* ; son prix (0.00) et sa TVA (aucune) ne se modifient pas. Le ✕ d'une
  ligne offerte ne retire que le cadeau ; celui de l'article vendu retire aussi
  ses lignes offertes. Le PDF l'imprime sur une ligne à part, « Pinot Noir (offert) »,
  à 0.00 : le total n'en tient pas compte.
- Pour changer l'ordre des lignes, on glisse une ligne par sa poignée (à gauche) ;
  ses lignes offertes juste en dessous la suivent : le cadeau reste sous son
  article, sur la facture comme sur le PDF. Au clavier, les flèches ↑ ↓ sur la
  poignée font de même.
- 4. À l'émission, les articles offerts quittent le stock avec les autres, mais
  ne comptent pas dans *Vendus* : ils deviennent une sortie de stock
  *Promotion / cadeau*, datée du jour, avec un lien vers la facture (colonne
  *Sorties* des articles).

Cette sortie suit sa facture : elle ne se supprime pas depuis *Sorties de stock*
(le lien *Facture …* remplace le bouton de suppression). Annuler la facture la
retire, et le stock revient. Un cadeau saisi par erreur sur une facture émise se
corrige comme toute erreur : annuler la facture et la refaire.

**Manques**

Aucun.
