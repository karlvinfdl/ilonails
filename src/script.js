/* =========================================================
   ILONAILS – SCRIPT GLOBAL
   ========================================================= */

import {
  getPrestations,
  addPrestation,
  updatePrestation,
  listenClients,
  addClient,
  getCreneauxPris,
  reserverCreneau,
  libererCreneau,
  listenRendezvous,
  getRendezvousByClient,
  addRendezvous,
  updateRendezvous,
  deleteRendezvous,
  getMessagesByClient,
  addMessage,
  markMessageRead,
  loginAdmin,
  logoutAdmin,
  onAdminAuthChange,
  signInAsVisitor,
} from "./firebase.js";

/* =========================================================
   1) PRESTATIONS (fallback si Firestore est vide)
   ========================================================= */

const FALLBACK_PRESTATIONS = [
  { nom: "Pose gel classique", description: "Pose gel sur ongles naturels, couleur au choix.", prix: "35 €", duree: 45 },
  { nom: "Pose gel french", description: "Pose gel effet french manucure.", prix: "40 €", duree: 60 },
  { nom: "Remplissage gel", description: "Entretien de votre pose gel existante.", prix: "30 €", duree: 45 },
  { nom: "Nail art", description: "Décoration personnalisée, par ongle.", prix: "à partir de 3 €", duree: 15 },
  { nom: "Manucure simple", description: "Soin des mains, limage et pose de vernis.", prix: "20 €", duree: 30 },
  { nom: "Pédicure", description: "Soin complet des pieds.", prix: "35 €", duree: 45 },
];

const SWATCH_ICON = `<svg viewBox="0 0 34 34" fill="none"><path d="M11 24c1-9 3-15 6-15s5 6 6 15" stroke="#C98B72" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="17" cy="8" r="2.4" fill="#C98B72"/></svg>`;

// Horaires par jour (0 = dimanche ... 6 = samedi), [heure ouverture, heure fermeture[.
const HORAIRES_PAR_JOUR = {
  0: null,
  1: null,
  2: [9, 18],
  3: [9, 18],
  4: [9, 18],
  5: [9, 18],
  6: [9, 17],
};
const INTERVALLE_MINUTES = 30;

// Empêche un appel Firestore de bloquer indéfiniment l'interface (peut
// arriver tant que la vraie configuration Firebase n'est pas renseignée).
function withTimeout(promise, ms, fallback) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timeout]);
}


/* =========================================================
   2) ANNÉE FOOTER
   ========================================================= */

const yearElement = document.getElementById("year");
if (yearElement) yearElement.textContent = new Date().getFullYear();


/* =========================================================
   3) PRESTATIONS PUBLIQUES (index.html)
   ========================================================= */

const servicesContainer = document.getElementById("services-container");
let prestationsPubliquesCache = [];

function renderPrestationsPubliques(prestations) {
  servicesContainer.innerHTML = "";
  prestations.forEach((p) => {
    const card = document.createElement("div");
    card.classList.add("swatch");
    card.innerHTML = `
      ${SWATCH_ICON}
      <h3>${p.nom}</h3>
      <p>${p.description || ""}</p>
      <div class="price">${p.prix}</div>
    `;
    servicesContainer.appendChild(card);
  });
}

if (servicesContainer) {
  withTimeout(getPrestations(), 6000, FALLBACK_PRESTATIONS)
    .then((prestations) => {
      renderPrestationsPubliques(prestations.length ? prestations : FALLBACK_PRESTATIONS);
    })
    .catch((error) => {
      console.error("Erreur chargement des prestations :", error);
      renderPrestationsPubliques(FALLBACK_PRESTATIONS);
    });
}


/* =========================================================
   4) MENU MOBILE
   ========================================================= */

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
}

// Apparition en fondu des sections au scroll (site public).
const revealEls = document.querySelectorAll(".reveal");
if (revealEls.length && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("visible"));
}


/* =========================================================
   5) PRISE DE RENDEZ-VOUS (pages/rendez-vous.html)
   ========================================================= */

const rdvForm = document.getElementById("rdvForm");
const prestationSelect = document.getElementById("prestation");
const dateInput = document.getElementById("date");
const dateNote = document.getElementById("dateNote");
const slotsContainer = document.getElementById("slotsContainer");
const heureChoisieInput = document.getElementById("heureChoisie");

if (rdvForm) {
  let prestationsDispo = [];

  withTimeout(getPrestations(), 6000, FALLBACK_PRESTATIONS)
    .then((prestations) => {
      prestationsDispo = prestations.length ? prestations : FALLBACK_PRESTATIONS;
      prestationSelect.innerHTML = prestationsDispo
        .map((p, i) => `<option value="${i}">${p.nom} — ${p.prix}</option>`)
        .join("");
    })
    .catch(() => {
      prestationsDispo = FALLBACK_PRESTATIONS;
      prestationSelect.innerHTML = prestationsDispo
        .map((p, i) => `<option value="${i}">${p.nom} — ${p.prix}</option>`)
        .join("");
    });

  dateInput.min = toLocalDateStr(new Date());

  function genererCreneauxJour(dateStr) {
    const jour = new Date(dateStr + "T12:00:00").getDay();
    const horaires = HORAIRES_PAR_JOUR[jour];
    if (!horaires) return [];

    const [debut, fin] = horaires;
    const creneaux = [];
    for (let minutes = debut * 60; minutes < fin * 60; minutes += INTERVALLE_MINUTES) {
      const h = String(Math.floor(minutes / 60)).padStart(2, "0");
      const m = String(minutes % 60).padStart(2, "0");
      creneaux.push(`${h}:${m}`);
    }
    return creneaux;
  }

  async function afficherCreneaux() {
    heureChoisieInput.value = "";
    const dateStr = dateInput.value;
    if (!dateStr) return;

    const creneauxJour = genererCreneauxJour(dateStr);
    if (!creneauxJour.length) {
      dateNote.textContent = "Fermé ce jour-là — merci de choisir une autre date.";
      slotsContainer.innerHTML = "";
      return;
    }
    dateNote.textContent = "";

    slotsContainer.innerHTML = `<p class="note">Chargement des créneaux...</p>`;
    let pris = [];
    try {
      pris = await withTimeout(getCreneauxPris(dateStr), 6000, []);
    } catch (error) {
      console.error("Erreur chargement des créneaux :", error);
    }

    slotsContainer.innerHTML = creneauxJour
      .map(
        (h) => `<button type="button" class="slot-btn" data-heure="${h}" ${pris.includes(h) ? "disabled" : ""}>${h}</button>`
      )
      .join("");

    slotsContainer.querySelectorAll(".slot-btn:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        slotsContainer.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        heureChoisieInput.value = btn.dataset.heure;
      });
    });
  }

  dateInput.addEventListener("change", afficherCreneaux);

  rdvForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!heureChoisieInput.value) {
      alert("Merci de choisir un créneau horaire disponible.");
      return;
    }

    const waWindow = window.open("about:blank", "_blank");

    const nom = document.getElementById("nom").value.trim();
    const tel = document.getElementById("tel").value.trim();
    const email = document.getElementById("email").value.trim();
    const prestation = prestationsDispo[Number(prestationSelect.value)];
    const date = dateInput.value;
    const heure = heureChoisieInput.value;

    try {
      await signInAsVisitor();

      const clientId = await addClient({ nom, telephone: tel, email });
      await reserverCreneau(date, heure);
      await addRendezvous({
        client_id: clientId,
        prestation_nom: prestation.nom,
        prestation_prix: prestation.prix,
        date,
        heure,
        statut: "en_attente",
      });

      const waUrl =
        "https://wa.me/596696114806?text=" +
        encodeURIComponent(
          `Bonjour, je souhaite un rendez-vous :\nNom: ${nom}\nPrestation: ${prestation.nom}\nLe ${date} à ${heure}\n\n(Vous pouvez joindre ici une photo de la pose souhaitée.)`
        );

      if (waWindow) {
        waWindow.location.href = waUrl;
      } else {
        window.open(waUrl, "_blank");
      }

      alert("Votre demande de rendez-vous a été envoyée !");
      rdvForm.reset();
      slotsContainer.innerHTML = `<p class="note">Choisissez d'abord une date.</p>`;
    } catch (error) {
      console.error("Erreur lors de la prise de rendez-vous :", error);
      if (waWindow) waWindow.close();
      alert("Une erreur est survenue, merci de réessayer.");
    }
  });
}


/* =========================================================
   6) ADMIN — AUTHENTIFICATION
   ========================================================= */

const adminPanel = document.getElementById("admin-panel");
const authBox = document.getElementById("auth-container");
const authError = document.getElementById("authError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminUserLabel = document.getElementById("adminUserLabel");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    authError.style.display = "none";

    try {
      await loginAdmin(email, password);
    } catch (error) {
      console.error("Erreur de connexion admin :", error);
      authError.textContent = "Email ou mot de passe incorrect.";
      authError.style.display = "block";
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => logoutAdmin());
}

if (adminPanel && authBox) {
  onAdminAuthChange((user) => {
    if (user && !user.isAnonymous) {
      authBox.style.display = "none";
      adminPanel.style.display = "flex";
      if (adminUserLabel) adminUserLabel.textContent = user.email || "Institut";
      initAdminData();
    } else {
      authBox.style.display = "flex";
      adminPanel.style.display = "none";
      stopAdminListeners();
    }
  });
}


/* =========================================================
   7) ADMIN — NAVIGATION (sidebar + mobile)
   ========================================================= */

const sideNavButtons = document.querySelectorAll(".side-nav button[data-view]");
const adminViews = document.querySelectorAll(".admin-view");
const topbarTitle = document.getElementById("topbarTitle");
const sidebar = document.getElementById("sidebar");
const scrim = document.getElementById("scrim");
const adminMenuToggle = document.getElementById("menuToggle");

const VIEW_TITLES = {
  dashboard: "Tableau de bord",
  rendezvous: "Rendez-vous",
  prestations: "Prestations",
  clients: "Clients",
  messages: "Messages",
};

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (scrim) scrim.classList.remove("open");
}

function activateView(view) {
  sideNavButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  adminViews.forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (topbarTitle) topbarTitle.textContent = VIEW_TITLES[view] || view;
  closeSidebar();
}

sideNavButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateView(btn.dataset.view));
});

if (adminMenuToggle && sidebar && scrim) {
  adminMenuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    scrim.classList.add("open");
  });
  scrim.addEventListener("click", closeSidebar);
}


/* =========================================================
   8) ADMIN — DONNÉES (clients / rendez-vous / prestations / messages)
   ========================================================= */

let clientsCache = [];
let rdvCache = [];
let prestationsCache = [];
let unsubscribeClients = null;
let unsubscribeRendezvous = null;

function clientNom(clientId) {
  const client = clientsCache.find((c) => c.id === clientId);
  return client ? client.nom : "Client supprimé";
}

function statutLabel(statut) {
  return { en_attente: "En attente", confirme: "Confirmé", termine: "Terminé", annule: "Annulé" }[statut] || statut;
}

function statutPill(statut) {
  return `<span class="status-pill ${statut}">${statutLabel(statut)}</span>`;
}

async function initAdminData() {
  await loadPrestations();
  stopAdminListeners();

  // Écoute en temps réel : toute réservation faite par une cliente (ou
  // modification faite par l'admin depuis un autre appareil) apparaît
  // immédiatement, sans avoir à recharger la page.
  unsubscribeClients = listenClients(
    (clients) => {
      clientsCache = clients;
      renderClients();
      renderRendezvous();
      renderDashboard();
      renderCalendar();
    },
    () => {
      clientsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Erreur de chargement des clients. Rechargez la page.</td></tr>`;
    }
  );

  unsubscribeRendezvous = listenRendezvous(
    (rdvs) => {
      rdvCache = rdvs;
      renderRendezvous();
      renderDashboard();
      renderCalendar();
    },
    () => {
      rdvTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Erreur de chargement des rendez-vous. Rechargez la page.</td></tr>`;
    }
  );
}

function stopAdminListeners() {
  if (unsubscribeClients) {
    unsubscribeClients();
    unsubscribeClients = null;
  }
  if (unsubscribeRendezvous) {
    unsubscribeRendezvous();
    unsubscribeRendezvous = null;
  }
}

/* ---------- Clients ---------- */

const rdvClientSelect = document.getElementById("rdvClientSelect");
const clientsTableBody = document.getElementById("clientsTableBody");
const messagesClientList = document.getElementById("messagesClientList");

function renderClients() {
  rdvClientSelect.innerHTML = '<option value="">— Nouveau client —</option>';
  clientsCache.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nom;
    rdvClientSelect.appendChild(opt);
  });

  clientsTableBody.innerHTML = clientsCache.length
    ? clientsCache
        .map(
          (c) => `
        <tr>
          <td>${c.nom}</td>
          <td>${c.telephone}</td>
          <td>${c.email || "—"}</td>
          <td class="row-actions"><button data-client-id="${c.id}">Voir</button></td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;">Aucun client</td></tr>`;

  clientsTableBody.querySelectorAll("button[data-client-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activateView("messages");
      openClientThread(btn.dataset.clientId);
    });
  });

  messagesClientList.innerHTML = clientsCache.length
    ? clientsCache
        .map(
          (c) => `
        <button class="msg-item" data-client-id="${c.id}">
          <div class="name">${c.nom}</div>
          <div class="sub">${c.telephone}</div>
        </button>`
        )
        .join("")
    : `<div class="msg-detail-empty">Aucun client</div>`;

  messagesClientList.querySelectorAll("button[data-client-id]").forEach((btn) => {
    btn.addEventListener("click", () => openClientThread(btn.dataset.clientId));
    if (btn.dataset.clientId === currentClientId) btn.classList.add("active");
  });
}

/* ---------- Fil de messages d'un client ---------- */

const messagesEmpty = document.getElementById("messagesEmpty");
const messagesDetail = document.getElementById("messagesDetail");
const messagesClientName = document.getElementById("messagesClientName");
const messagesClientInfo = document.getElementById("messagesClientInfo");
const messagesHistoryBody = document.getElementById("messagesHistoryBody");
const messagesThread = document.getElementById("messagesThread");
const replyForm = document.getElementById("replyForm");

let currentClientId = null;

async function openClientThread(clientId) {
  currentClientId = clientId;
  const client = clientsCache.find((c) => c.id === clientId);
  if (!client) return;

  messagesClientList.querySelectorAll(".msg-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.clientId === clientId);
  });

  messagesEmpty.style.display = "none";
  messagesDetail.style.display = "flex";
  messagesClientName.textContent = client.nom;
  messagesClientInfo.textContent = `${client.telephone}${client.email ? " — " + client.email : ""}`;

  const rdvs = await getRendezvousByClient(clientId);
  messagesHistoryBody.innerHTML = rdvs.length
    ? rdvs
        .map(
          (r) => `
        <tr>
          <td>${r.prestation_nom}</td>
          <td>${r.date}</td>
          <td>${r.heure}</td>
          <td>${statutPill(r.statut)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;">Aucun rendez-vous</td></tr>`;

  const messages = await getMessagesByClient(clientId);
  messagesThread.innerHTML =
    messages
      .map((m) => {
        const isClient = m.sens === "client_vers_institut";
        const date = m.date && m.date.toDate ? m.date.toDate().toLocaleString("fr-FR") : "";
        return `
        <div class="bubble ${isClient ? "in" : "out"}">
          ${m.contenu}
          <time>${date}</time>
        </div>`;
      })
      .join("") || `<p class="note">Aucun message.</p>`;

  await Promise.all(
    messages.filter((m) => m.sens === "client_vers_institut" && !m.lu).map((m) => markMessageRead(m.id))
  );
}

if (replyForm) {
  replyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentClientId) return;

    const contenu = document.getElementById("replyContenu").value.trim();
    if (!contenu) return;

    await addMessage({
      client_id: currentClientId,
      contenu,
      sens: "institut_vers_client",
      lu: true,
    });

    document.getElementById("replyContenu").value = "";
    openClientThread(currentClientId);
  });
}

/* ---------- Rendez-vous ---------- */

const rdvTableBody = document.getElementById("rdvTableBody");
const filterStatut = document.getElementById("filterStatut");
const newRdvBtn = document.getElementById("newRdvBtn");
const rdvAdminForm = document.getElementById("rdvAdminForm");
const rdvFormWrap = document.getElementById("rdvFormWrap");
const cancelRdvBtn = document.getElementById("cancelRdvBtn");
const newClientFields = document.getElementById("newClientFields");
const rdvPrestationSelect = document.getElementById("rdvPrestation");
const dashboardTableBody = document.getElementById("dashboardTableBody");
const statEnAttente = document.getElementById("statEnAttente");
const statAujourdhui = document.getElementById("statAujourdhui");
const statAVenir = document.getElementById("statAVenir");
const statTerminesMois = document.getElementById("statTerminesMois");

function renderRendezvous() {
  const statut = filterStatut.value;
  const rows = statut ? rdvCache.filter((r) => r.statut === statut) : rdvCache;

  rdvTableBody.innerHTML = rows.length
    ? rows
        .map(
          (r) => `
        <tr>
          <td>${clientNom(r.client_id)}</td>
          <td>${r.prestation_nom}</td>
          <td>${r.date}</td>
          <td>${r.heure}</td>
          <td>${statutPill(r.statut)}</td>
          <td class="row-actions">
            <button data-edit-id="${r.id}">Modifier</button>
            <button data-notify-id="${r.id}">Notifier</button>
            <button data-delete-id="${r.id}">Supprimer</button>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;">Aucun rendez-vous</td></tr>`;

  rdvTableBody.querySelectorAll("button[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editRendezvous(btn.dataset.editId));
  });

  rdvTableBody.querySelectorAll("button[data-notify-id]").forEach((btn) => {
    btn.addEventListener("click", () => notifyClient(btn.dataset.notifyId));
  });

  rdvTableBody.querySelectorAll("button[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => supprimerRendezvous(btn.dataset.deleteId));
  });
}

async function supprimerRendezvous(id) {
  const rdv = rdvCache.find((r) => r.id === id);
  if (!rdv) return;

  if (!confirm(`Supprimer définitivement le rendez-vous de ${clientNom(rdv.client_id)} (${rdv.date} ${rdv.heure}) ?`)) {
    return;
  }

  await deleteRendezvous(id);
  await libererCreneau(rdv.date, rdv.heure).catch(() => {});
}

function renderDashboard() {
  if (!statEnAttente) return;

  const today = toLocalDateStr(new Date());
  const now = new Date();
  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const enAttente = rdvCache.filter((r) => r.statut === "en_attente");
  const aujourdhui = rdvCache.filter((r) => r.statut === "confirme" && r.date === today);
  const aVenir = rdvCache.filter((r) => r.statut === "confirme" && r.date > today);
  const terminesMois = rdvCache.filter((r) => r.statut === "termine" && isCurrentMonth(r.date));

  statEnAttente.textContent = enAttente.length;
  statAujourdhui.textContent = aujourdhui.length;
  statAVenir.textContent = aVenir.length;
  statTerminesMois.textContent = terminesMois.length;

  const upcoming = rdvCache.filter((r) => r.statut === "en_attente" || r.statut === "confirme").slice(0, 6);
  dashboardTableBody.innerHTML = upcoming.length
    ? upcoming
        .map(
          (r) => `
        <tr>
          <td>${clientNom(r.client_id)}</td>
          <td>${r.prestation_nom}</td>
          <td>${r.date}</td>
          <td>${r.heure}</td>
          <td>${statutPill(r.statut)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;">Aucun rendez-vous</td></tr>`;
}

if (filterStatut) filterStatut.addEventListener("change", renderRendezvous);

/* ---------- Planning calendrier (vue semaine) ---------- */

const calGrid = document.getElementById("calGrid");
const weekLabel = document.getElementById("weekLabel");
const weekPrevBtn = document.getElementById("weekPrev");
const weekNextBtn = document.getElementById("weekNext");

const CAL_JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]; // index JS getDay() 1..6
const CAL_HEURES = [9, 10, 11, 12, 13, 14, 15, 16, 17];
let weekOffset = 0;

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekMonday(offset) {
  const now = new Date();
  const jour = now.getDay() === 0 ? 7 : now.getDay(); // dimanche -> 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (jour - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function renderCalendar() {
  if (!calGrid) return;

  const monday = getWeekMonday(weekOffset);
  const weekDates = CAL_JOURS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  weekLabel.textContent = `${fmt(weekDates[0])} – ${fmt(weekDates[5])}`;

  let html = `<div class="head-cell"></div>`;
  weekDates.forEach((d, i) => {
    const ferme = !HORAIRES_PAR_JOUR[d.getDay()];
    html += `<div class="head-cell ${ferme ? "closed" : ""}">${CAL_JOURS[i]} ${d.getDate()}</div>`;
  });

  CAL_HEURES.forEach((h) => {
    html += `<div class="time-cell">${h}h</div>`;
    weekDates.forEach((d) => {
      const ferme = !HORAIRES_PAR_JOUR[d.getDay()];
      const dateStr = toLocalDateStr(d);
      const rdvs = rdvCache.filter((r) => r.date === dateStr && parseInt(r.heure.split(":")[0], 10) === h);

      const blocs = rdvs
        .map(
          (r) => `
          <div class="appt ${r.statut}" data-rdv-id="${r.id}">
            <span>${clientNom(r.client_id)}</span>
            <span class="t">${r.heure} · ${r.prestation_nom}</span>
          </div>`
        )
        .join("");

      html += `<div class="day-cell ${ferme ? "closed" : ""}">${blocs}</div>`;
    });
  });

  calGrid.innerHTML = html;

  calGrid.querySelectorAll(".appt").forEach((el) => {
    el.addEventListener("click", () => {
      activateView("rendezvous");
      editRendezvous(el.dataset.rdvId);
    });
  });
}

if (weekPrevBtn) weekPrevBtn.addEventListener("click", () => { weekOffset -= 1; renderCalendar(); });
if (weekNextBtn) weekNextBtn.addEventListener("click", () => { weekOffset += 1; renderCalendar(); });

function resetRdvForm() {
  rdvAdminForm.reset();
  document.getElementById("rdvId").value = "";
  document.getElementById("rdvDate").value = toLocalDateStr(new Date());
  newClientFields.style.display = "block";
}

if (newRdvBtn) {
  newRdvBtn.addEventListener("click", () => {
    resetRdvForm();
    rdvFormWrap.style.display = "block";
  });
}

if (cancelRdvBtn) {
  cancelRdvBtn.addEventListener("click", () => {
    rdvFormWrap.style.display = "none";
  });
}

if (rdvClientSelect) {
  rdvClientSelect.addEventListener("change", () => {
    newClientFields.style.display = rdvClientSelect.value ? "none" : "block";
  });
}

function editRendezvous(id) {
  const rdv = rdvCache.find((r) => r.id === id);
  if (!rdv) return;

  document.getElementById("rdvId").value = rdv.id;
  rdvClientSelect.value = rdv.client_id;
  newClientFields.style.display = "none";

  const idx = prestationsCache.findIndex((p) => p.nom === rdv.prestation_nom);
  rdvPrestationSelect.value = idx >= 0 ? idx : 0;

  document.getElementById("rdvDate").value = rdv.date;
  document.getElementById("rdvHeure").value = rdv.heure;
  document.getElementById("rdvStatut").value = rdv.statut;

  rdvFormWrap.style.display = "block";
  rdvFormWrap.scrollIntoView({ behavior: "smooth" });
}

if (rdvAdminForm) {
  rdvAdminForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let clientId = rdvClientSelect.value;

    if (!clientId) {
      const nom = document.getElementById("rdvClientNom").value.trim();
      const telephone = document.getElementById("rdvClientTel").value.trim();
      const email = document.getElementById("rdvClientEmail").value.trim();

      if (!nom || !telephone) {
        alert("Merci de renseigner le nom et le téléphone du nouveau client.");
        return;
      }

      clientId = await addClient({ nom, telephone, email });
    }

    const prestation = prestationsCache[Number(rdvPrestationSelect.value)] || {};
    const date = document.getElementById("rdvDate").value;
    const heure = document.getElementById("rdvHeure").value;

    const data = {
      client_id: clientId,
      prestation_nom: prestation.nom || "",
      prestation_prix: prestation.prix || "",
      date,
      heure,
      statut: document.getElementById("rdvStatut").value,
    };

    const rdvId = document.getElementById("rdvId").value;
    const ancien = rdvId ? rdvCache.find((r) => r.id === rdvId) : null;

    if (rdvId) {
      await updateRendezvous(rdvId, data);
      if (ancien && (ancien.date !== date || ancien.heure !== heure)) {
        await libererCreneau(ancien.date, ancien.heure).catch(() => {});
        await reserverCreneau(date, heure).catch(() => {});
      }
    } else {
      await addRendezvous(data);
      await reserverCreneau(date, heure).catch(() => {});
    }

    // Pas besoin de recharger manuellement : listenClients/listenRendezvous
    // (temps réel) répercutent ce changement tout seuls.
    rdvFormWrap.style.display = "none";
  });
}

/* ---------- Notifier un client par WhatsApp ---------- */

const STATUT_MESSAGES = {
  en_attente: (client, r) =>
    `Bonjour ${client.nom}, votre demande de rendez-vous pour "${r.prestation_nom}" le ${r.date} à ${r.heure} est bien reçue chez Ilonails, en attente de confirmation.`,
  confirme: (client, r) =>
    `Bonjour ${client.nom}, votre rendez-vous "${r.prestation_nom}" est confirmé le ${r.date} à ${r.heure} chez Ilonails, 28 Avenue de la Libération, Trieux.`,
  termine: (client, r) => `Bonjour ${client.nom}, merci pour votre visite chez Ilonails !`,
  annule: (client, r) =>
    `Bonjour ${client.nom}, votre rendez-vous du ${r.date} à ${r.heure} a été annulé. N'hésitez pas à reprendre un créneau quand vous le souhaitez.`,
};

// Convertit un numéro en format international pour wa.me. Si le numéro
// contient déjà un indicatif (+33, +596...), il est simplement nettoyé.
// Sinon, on suppose la France métropolitaine (+33) par défaut.
function toWhatsAppNumber(telephone) {
  const raw = (telephone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits;
  return digits.startsWith("0") ? "33" + digits.slice(1) : digits;
}

async function notifyClient(rdvId) {
  const rdv = rdvCache.find((r) => r.id === rdvId);
  if (!rdv) return;

  const client = clientsCache.find((c) => c.id === rdv.client_id);
  if (!client) return alert("Client introuvable.");

  const buildMessage = STATUT_MESSAGES[rdv.statut];
  const texte = buildMessage
    ? buildMessage(client, rdv)
    : `Bonjour ${client.nom}, une mise à jour concernant votre rendez-vous du ${rdv.date}.`;

  window.open(`https://wa.me/${toWhatsAppNumber(client.telephone)}?text=${encodeURIComponent(texte)}`, "_blank");

  try {
    await addMessage({ client_id: client.id, contenu: texte, sens: "institut_vers_client", lu: true });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la notification :", error);
  }
}

/* ---------- Prestations ---------- */

const prestationsTableBody = document.getElementById("prestationsTableBody");
const prestationForm = document.getElementById("prestationForm");

async function loadPrestations() {
  prestationsCache = await getPrestations();

  rdvPrestationSelect.innerHTML = prestationsCache
    .map((p, i) => `<option value="${i}">${p.nom} — ${p.prix}</option>`)
    .join("");

  prestationsTableBody.innerHTML = prestationsCache.length
    ? prestationsCache
        .map(
          (p) => `
        <tr>
          <td>${p.nom}</td>
          <td>${p.description || "—"}</td>
          <td>${p.duree ? p.duree + " min" : "—"}</td>
          <td>${p.prix}</td>
          <td class="row-actions"><button data-prestation-id="${p.id}">Modifier</button></td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;">Aucune prestation, la liste par défaut est affichée sur le site.</td></tr>`;

  prestationsTableBody.querySelectorAll("button[data-prestation-id]").forEach((btn) => {
    btn.addEventListener("click", () => editPrestation(btn.dataset.prestationId));
  });
}

function editPrestation(id) {
  const prestation = prestationsCache.find((p) => p.id === id);
  if (!prestation) return;

  document.getElementById("prestationId").value = prestation.id;
  document.getElementById("prestationNom").value = prestation.nom;
  document.getElementById("prestationDescription").value = prestation.description || "";
  document.getElementById("prestationPrix").value = prestation.prix;
  document.getElementById("prestationDuree").value = prestation.duree || "";
  prestationForm.scrollIntoView({ behavior: "smooth" });
}

if (prestationForm) {
  prestationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      nom: document.getElementById("prestationNom").value.trim(),
      description: document.getElementById("prestationDescription").value.trim(),
      prix: document.getElementById("prestationPrix").value.trim(),
      duree: Number(document.getElementById("prestationDuree").value) || null,
    };

    const prestationId = document.getElementById("prestationId").value;
    if (prestationId) {
      await updatePrestation(prestationId, data);
    } else {
      await addPrestation(data);
    }

    prestationForm.reset();
    document.getElementById("prestationId").value = "";
    await loadPrestations();
  });
}

console.log("🚀 Ilonails — Script chargé et opérationnel !");
