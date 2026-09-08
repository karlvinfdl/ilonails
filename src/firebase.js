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
  orderBy,
  query,
  where,
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

export async function getClients() {
  const snapshot = await getDocs(clientsCol);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

export async function getRendezvous() {
  const snapshot = await getDocs(query(rendezvousCol, orderBy("date", "asc"), orderBy("heure", "asc")));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

/* =========================================================
   MESSAGES
   ========================================================= */

export async function getMessagesByClient(clientId) {
  const snapshot = await getDocs(
    query(messagesCol, where("client_id", "==", clientId), orderBy("date", "asc"))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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
