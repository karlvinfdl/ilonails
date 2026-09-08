# 💅 Ilonails

Site vitrine + prise de rendez-vous en ligne pour **Ilonails**, institut de prothésie ongulaire situé au 28 Avenue de la Libération, **Trieux (54170)**.

Développé en **HTML / CSS / JavaScript natif** avec **Vite**, ce projet permet aux clientes de réserver un créneau en ligne (prestation, date, heure disponible), et à l'institut de gérer ses rendez-vous, clients et prestations via un panneau d'administration dédié.

---

## 🚀 Fonctionnalités

### 💻 Côté client
- Page d'accueil (thème crème / terracotta)
- Présentation des prestations (chargées depuis Firestore, avec liste de secours si vide)
- Prise de rendez-vous par créneau : choix de la prestation, de la date, puis d'un horaire libre (créneaux de 30 min générés selon les horaires d'ouverture)
- Confirmation automatique par WhatsApp

### 🔐 Côté administrateur
- Connexion sécurisée par **Firebase Authentication** (email / mot de passe) — aucun code en dur côté client
- Gestion des rendez-vous : statut (en attente / confirmé / terminé / annulé), notification WhatsApp au client en un clic
- Fiche client avec historique des rendez-vous et messagerie
- Gestion des prestations affichées sur le site public
- Toutes les collections Firestore (`clients`, `rendezvous`, `messages`) protégées par des **Security Rules** réservant la lecture/écriture à l'admin authentifié

---

## 🛠️ Stack technique

| Technologie | Usage |
|------------|-------|
| **HTML5 / CSS3** | Structure et design responsive |
| **JavaScript (ES Modules)** | Logique client |
| **Vite** | Bundler + optimisation |
| **Firebase Authentication** | Connexion admin sécurisée |
| **Firebase Firestore** | Stockage des clients, rendez-vous, créneaux, messages, prestations |
| **Firestore Security Rules** | Contrôle d'accès côté serveur |
| **WhatsApp API** | Confirmations et notifications |
