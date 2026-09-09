// src/firebase.js

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Cette config est publique par nature (ce n'est pas un secret) — la
// sécurité réelle est assurée par firestore.rules, pas par ces clés.
const firebaseConfig = {
  apiKey: "AIzaSyCpWnFJEZIpogPAddTekFh0SviAPBQPI4I",
  authDomain: "ilonails.firebaseapp.com",
  projectId: "ilonails",
  storageBucket: "ilonails.firebasestorage.app",
  messagingSenderId: "132294476258",
  appId: "1:132294476258:web:8c2d58492bc08fc67279bb",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const prestationsCol = collection(db, "prestations");
const clientsCol = collection(db, "clients");
const rendezvousCol = collection(db, "rendezvous");
const messagesCol = collection(db, "messages");
const creneauxCol = collection(db, "creneaux");

/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

export async function loginAdmin(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutAdmin() {
  await signOut(auth);
}

export function onAdminAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Authentifie le visiteur anonymement avant l'envoi du formulaire de RDV
// public (nécessaire pour satisfaire les Security Rules côté serveur).
export async function signInAsVisitor() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

/* =========================================================
   PRESTATIONS
   ========================================================= */

export async function getPrestations() {
  const snapshot = await getDocs(prestationsCol);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPrestation(prestation) {
  const docRef = await addDoc(prestationsCol, prestation);
  return docRef.id;
}

export async function updatePrestation(id, data) {
  await updateDoc(doc(db, "prestations", id), data);
}

/* =========================================================
   CLIENTS
   ========================================================= */

// Écoute en temps réel, même principe que listenRendezvous : un nouveau
// client créé via le formulaire public apparaît immédiatement côté admin.
export function listenClients(callback, onError) {
  return onSnapshot(
    clientsCol,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error("Erreur d'écoute clients :", error);
      if (onError) onError(error);
    }
  );
}

export async function addClient(client) {
  const docRef = await addDoc(clientsCol, client);
  return docRef.id;
}

export async function updateClient(id, data) {
  await updateDoc(doc(db, "clients", id), data);
}

/* =========================================================
   CRÉNEAUX (disponibilité publique, sans donnée personnelle)
   ========================================================= */

function creneauId(date, heure) {
  return `${date}_${heure}`;
}

// Renvoie la liste des heures déjà réservées pour une date donnée.
export async function getCreneauxPris(date) {
  const q = query(creneauxCol, where("date", "==", date));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data().heure);
}

export async function reserverCreneau(date, heure) {
  await setDoc(doc(db, "creneaux", creneauId(date, heure)), { date, heure });
}

export async function libererCreneau(date, heure) {
  await deleteDoc(doc(db, "creneaux", creneauId(date, heure)));
}

/* =========================================================
   RENDEZ-VOUS
   ========================================================= */

// Écoute en temps réel : callback(rendezvousArray) est appelé immédiatement,
// puis à chaque changement (nouvelle réservation cliente, modification admin,
// etc.), sans qu'il soit nécessaire de recharger la page. Renvoie une
// fonction pour arrêter l'écoute (à appeler à la déconnexion admin).
// Pas de tri composé (date + heure) côté Firestore : ça nécessiterait un
// index composite à créer manuellement dans la console, et la requête
// échouerait silencieusement tant qu'il n'existe pas. On trie côté client
// à la place — aucun index particulier requis.
export function listenRendezvous(callback, onError) {
  return onSnapshot(
    rendezvousCol,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.date === b.date ? a.heure.localeCompare(b.heure) : a.date.localeCompare(b.date)));
      callback(list);
    },
    (error) => {
      console.error("Erreur d'écoute rendez-vous :", error);
      if (onError) onError(error);
    }
  );
}

export async function getRendezvousByClient(clientId) {
  const snapshot = await getDocs(query(rendezvousCol, where("client_id", "==", clientId)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addRendezvous(rdv) {
  const docRef = await addDoc(rendezvousCol, {
    ...rdv,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateRendezvous(id, data) {
  await updateDoc(doc(db, "rendezvous", id), data);
}

export async function deleteRendezvous(id) {
  await deleteDoc(doc(db, "rendezvous", id));
}

/* =========================================================
   MESSAGES
   ========================================================= */

// Tri fait côté client (pas de orderBy() combiné au where() ici) pour
// éviter de dépendre d'un index composite Firestore.
export async function getMessagesByClient(clientId) {
  const snapshot = await getDocs(query(messagesCol, where("client_id", "==", clientId)));
  const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  messages.sort((a, b) => (a.date?.toMillis?.() || 0) - (b.date?.toMillis?.() || 0));
  return messages;
}

export async function addMessage(message) {
  const docRef = await addDoc(messagesCol, {
    ...message,
    date: serverTimestamp(),
  });
  return docRef.id;
}

export async function markMessageRead(id) {
  await updateDoc(doc(db, "messages", id), { lu: true });
}
