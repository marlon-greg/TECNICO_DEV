// =======================================================
//  firebase.js — INTEGRAÇÃO FIREBASE
//  Auth com Google (domínios SENAI) + Firestore
// =======================================================

var FB = (function () {

  var auth     = null;
  var db       = null;
  var currentUser = null;
  var userRole    = null;

  var DOCENTE_DOMAIN = "@docente.senai.br";
  var ALUNO_DOMAINS  = ["@aluno.senai.br", "@edu.senai.br"];

  function init(onReady) {
    if (!window.FIREBASE_CONFIG) {
      console.warn("firebase-config.js não encontrado.");
      if (onReady) onReady(null);
      return;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    auth = firebase.auth();
    db   = firebase.firestore();

    auth.onAuthStateChanged(function (user) {
      if (user) {
        currentUser = user;
        userRole    = detectRole(user.email);
        if (!userRole) {
          // Email não autorizado
          auth.signOut();
          showLoginScreen("Email não autorizado. Use seu email SENAI institucional.");
          return;
        }
      } else {
        currentUser = null;
        userRole    = null;
      }
      if (onReady) onReady(user && userRole ? user : null);
    });
  }

  function detectRole(email) {
    if (!email) return null;
    if (email.endsWith(DOCENTE_DOMAIN)) return "docente";
    for (var i = 0; i < ALUNO_DOMAINS.length; i++) {
      if (email.endsWith(ALUNO_DOMAINS[i])) return "aluno";
    }
    return null;
  }

  function getUser()      { return currentUser; }
  function getRole()      { return userRole; }
  function isDocente()    { return userRole === "docente"; }
  function isAluno()      { return userRole === "aluno"; }
  function isAuthorized() { return !!userRole; }

  // ── AUTH ──────────────────────────────────────────────

  function loginGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  }

  function logout() {
    return auth.signOut().then(function () {
      window.location.reload();
    });
  }

  // ── TELA DE LOGIN ─────────────────────────────────────

  function showLoginScreen(erroMsg) {
    document.body.innerHTML =
      '<div style="font-family:system-ui,sans-serif;min-height:100vh;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;background:#f5f5f0;padding:2rem">' +
        '<div style="background:#fff;border-radius:12px;padding:2.5rem 2rem;max-width:360px;width:100%;' +
        'box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center">' +
          '<div style="background:#c8102e;color:#fff;font-weight:700;padding:.4rem .9rem;' +
          'border-radius:4px;display:inline-block;margin-bottom:1.5rem;letter-spacing:.04em">SENAI</div>' +
          '<h2 style="font-size:1.1rem;font-weight:600;color:#1a1a2e;margin-bottom:.4rem">' +
            'Portal — Técnico em Desenvolvimento de Sistemas' +
          '</h2>' +
          '<p style="font-size:.82rem;color:#999;margin-bottom:1.8rem">' +
            'Faça login com seu email institucional SENAI' +
          '</p>' +
          (erroMsg ? '<p style="font-size:.78rem;color:#c8102e;background:#fff5f5;border:1px solid #fcc;' +
            'padding:.5rem .8rem;border-radius:6px;margin-bottom:1rem">' + erroMsg + '</p>' : '') +
          '<button onclick="FB.loginGoogle()" style="width:100%;padding:.75rem;border:1px solid #ddd;' +
          'border-radius:8px;background:#fff;cursor:pointer;font-size:.88rem;font-weight:500;' +
          'color:#333;display:flex;align-items:center;justify-content:center;gap:.6rem;' +
          'transition:background .2s" onmouseover="this.style.background=\'#f5f5f5\'" ' +
          'onmouseout="this.style.background=\'#fff\'">' +
            '<svg width="18" height="18" viewBox="0 0 48 48">' +
              '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
              '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
              '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
              '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
            '</svg>' +
            'Entrar com Google (SENAI)' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  // ── FIRESTORE: AULAS ──────────────────────────────────

  function docAulas(semId, matId) {
    return db.collection("aulas").doc(semId + "_" + matId);
  }

  function getAulas(semId, matId) {
    return docAulas(semId, matId).get().then(function (snap) {
      return snap.exists ? (snap.data().lista || []) : [];
    });
  }

  function saveAulas(semId, matId, aulas) {
    return docAulas(semId, matId).set({
      lista: aulas,
      updatedAt: new Date().toISOString()
    });
  }

  function onAulas(semId, matId, callback) {
    return docAulas(semId, matId).onSnapshot(function (snap) {
      callback(snap.exists ? (snap.data().lista || []) : []);
    });
  }

  // ── FIRESTORE: MATERIAIS ──────────────────────────────

  function docMateriais(semId, matId) {
    return db.collection("materiais").doc(semId + "_" + matId);
  }

  function getMateriais(semId, matId) {
    return docMateriais(semId, matId).get().then(function (snap) {
      return snap.exists ? (snap.data().lista || []) : [];
    });
  }

  function saveMateriais(semId, matId, lista) {
    return docMateriais(semId, matId).set({
      lista: lista,
      updatedAt: new Date().toISOString()
    });
  }

  // ── FIRESTORE: LINKS ──────────────────────────────────

  function getLinks() {
    return db.collection("links").doc("master").get().then(function (snap) {
      return snap.exists ? snap.data() : { token_global: "senai2026", links: [] };
    });
  }

  function saveLinks(data) {
    return db.collection("links").doc("master").set(data);
  }

  // ── FIRESTORE: CRONOGRAMA ────────────────────────────

  function getCronograma() {
    return db.collection("cronograma").doc("config").get().then(function (snap) {
      return snap.exists ? snap.data() : {};
    });
  }

  function saveCronograma(data) {
    return db.collection("cronograma").doc("config").set(data);
  }

  // ── FIRESTORE: CONFIG ─────────────────────────────────

  function getConfig() {
    return db.collection("config").doc("global").get().then(function (snap) {
      return snap.exists ? snap.data() : {};
    });
  }

  function saveConfig(data) {
    return db.collection("config").doc("global").set(data);
  }

  return {
    init           : init,
    loginGoogle    : loginGoogle,
    logout         : logout,
    showLoginScreen: showLoginScreen,
    getUser        : getUser,
    getRole        : getRole,
    isDocente      : isDocente,
    isAluno        : isAluno,
    isAuthorized   : isAuthorized,
    getAulas       : getAulas,
    saveAulas      : saveAulas,
    onAulas        : onAulas,
    getMateriais   : getMateriais,
    saveMateriais  : saveMateriais,
    getLinks       : getLinks,
    saveLinks      : saveLinks,
    getCronograma  : getCronograma,
    saveCronograma : saveCronograma,
    getConfig      : getConfig,
    saveConfig     : saveConfig
  };

})();