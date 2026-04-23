// =======================================================
//  firebase.js — INTEGRAÇÃO FIREBASE
//  Auth com Google (domínios SENAI) + Firestore
// =======================================================

var FB = (function () {
  var auth = null;
  var db = null;
  var currentUser = null;
  var userRole = null;

  var DOCENTE_DOMAIN = "@docente.senai.br";
  var ALUNO_DOMAINS = ["@aluno.senai.br", "@edu.senai.br"];

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
    db = firebase.firestore();

    auth.onAuthStateChanged(function (user) {
      if (user) {
        currentUser = user;
        userRole = detectRole(user.email);
        console.log("Firebase Auth — email:", user.email, "role:", userRole);
        if (!userRole) {
          auth.signOut();
          showLoginScreen(
            "Email não autorizado. Use seu email SENAI institucional (@docente, @aluno ou @edu).",
          );
          return;
        }
        if (onReady) onReady(user);
      } else {
        currentUser = null;
        userRole = null;
        console.log("Firebase Auth — sem usuário logado.");
        if (onReady) onReady(null);
      }
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

  function getUser() {
    return currentUser;
  }
  function getRole() {
    return userRole;
  }
  function isDocente() {
    return userRole === "docente";
  }
  function isAluno() {
    return userRole === "aluno";
  }
  function isAuthorized() {
    return !!userRole;
  }

  // ── AUTH ──────────────────────────────────────────────

  function loginGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    auth
      .signInWithPopup(provider)
      .then(function (result) {
        var role = detectRole(result.user.email);
        if (!role) {
          auth.signOut();
          showLoginScreen(
            "Email não autorizado. Use seu email SENAI institucional.",
          );
          return;
        }
        // Login ok — recarrega para inicializar o portal corretamente
        window.location.reload();
      })
      .catch(function (err) {
        showLoginScreen("Erro ao fazer login: " + err.message);
      });
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
      "Portal — Técnico em Desenvolvimento de Sistemas" +
      "</h2>" +
      '<p style="font-size:.82rem;color:#999;margin-bottom:1.8rem">' +
      "Faça login com seu email institucional SENAI" +
      "</p>" +
      (erroMsg
        ? '<p style="font-size:.78rem;color:#c8102e;background:#fff5f5;border:1px solid #fcc;' +
          'padding:.5rem .8rem;border-radius:6px;margin-bottom:1rem">' +
          erroMsg +
          "</p>"
        : "") +
      '<button onclick="FB.loginGoogle()" style="width:100%;padding:.75rem;border:1px solid #ddd;' +
      "border-radius:8px;background:#fff;cursor:pointer;font-size:.88rem;font-weight:500;" +
      "color:#333;display:flex;align-items:center;justify-content:center;gap:.6rem;" +
      'transition:background .2s" onmouseover="this.style.background=\'#f5f5f5\'" ' +
      "onmouseout=\"this.style.background='#fff'\">" +
      '<svg width="18" height="18" viewBox="0 0 48 48">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      "</svg>" +
      "Entrar com Google (SENAI)" +
      "</button>" +
      "</div>" +
      "</div>";
  }

  // ── FIRESTORE: AULAS ──────────────────────────────────

  function docAulas(semId, matId) {
    return db.collection("aulas").doc(semId + "_" + matId);
  }

  function getAulas(semId, matId) {
    return docAulas(semId, matId)
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data().lista || [] : [];
      });
  }

  function saveAulas(semId, matId, aulas) {
    return docAulas(semId, matId).set({
      lista: aulas,
      updatedAt: new Date().toISOString(),
    });
  }

  function onAulas(semId, matId, callback) {
    return docAulas(semId, matId).onSnapshot(function (snap) {
      callback(snap.exists ? snap.data().lista || [] : []);
    });
  }

  // ── FIRESTORE: MATERIAIS ──────────────────────────────

  function docMateriais(semId, matId) {
    return db.collection("materiais").doc(semId + "_" + matId);
  }

  function getMateriais(semId, matId) {
    return docMateriais(semId, matId)
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data().lista || [] : [];
      });
  }

  function saveMateriais(semId, matId, lista) {
    return docMateriais(semId, matId).set({
      lista: lista,
      updatedAt: new Date().toISOString(),
    });
  }

  // ── FIRESTORE: LINKS ──────────────────────────────────

  function getLinks() {
    return db
      .collection("links")
      .doc("master")
      .get()
      .then(function (snap) {
        return snap.exists
          ? snap.data()
          : { token_global: "senai2026", links: [] };
      });
  }

  function saveLinks(data) {
    return db.collection("links").doc("master").set(data);
  }

  // ── FIRESTORE: CRONOGRAMA ────────────────────────────

  function getCronograma() {
    return db
      .collection("cronograma")
      .doc("config")
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : {};
      });
  }

  function saveCronograma(data) {
    return db.collection("cronograma").doc("config").set(data);
  }

  // ── FIRESTORE: CONFIG ─────────────────────────────────

  function getConfig() {
    return db
      .collection("config")
      .doc("global")
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : {};
      });
  }

  function saveConfig(data) {
    return db.collection("config").doc("global").set(data);
  }

  // ── FIRESTORE: ALUNOS ────────────────────────────────
  // Registra/atualiza aluno no Firestore ao logar
  function registrarAluno(user) {
    var ref = db.collection("alunos").doc(user.uid);
    return ref.get().then(function (snap) {
      if (!snap.exists) {
        // Primeiro acesso — cria registro com semestre 1
        return ref.set({
          uid: user.uid,
          email: user.email,
          nome: user.displayName || user.email,
          foto: user.photoURL || "",
          semestre: 1,
          ativo: true,
          criado: new Date().toISOString(),
          ultimo_login: new Date().toISOString(),
        });
      } else {
        // Já existe — atualiza último login
        return ref.update({ ultimo_login: new Date().toISOString() });
      }
    });
  }

  // Busca dados do aluno (incluindo semestre atual)
  function getAluno(uid) {
    return db
      .collection("alunos")
      .doc(uid)
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : null;
      });
  }

  // Lista todos os alunos (só docente)
  function getAlunos() {
    return db
      .collection("alunos")
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          lista.push(doc.data());
        });
        return lista;
      });
  }

  // Atualiza semestre do aluno
  function setSemestreAluno(uid, semestre) {
    return db.collection("alunos").doc(uid).update({ semestre: semestre });
  }

  // Bloqueia/desbloqueia aluno
  function setAtivoAluno(uid, ativo) {
    return db.collection("alunos").doc(uid).update({ ativo: ativo });
  }

  // ── FIRESTORE: TURMAS ─────────────────────────────────
  var LIMITE_TURMA = 32;

  // Registra aluno com verificação de limite de turma
  function registrarAlunoNaTurma(user, turmaHash) {
    var alunoRef = db.collection("alunos").doc(user.uid);
    var turmaRef = db.collection("turmas").doc(turmaHash);

    return db.runTransaction(function (tx) {
      return Promise.all([tx.get(alunoRef), tx.get(turmaRef)]).then(
        function (results) {
          var alunoSnap = results[0];
          var turmaSnap = results[1];
          var turmaData = turmaSnap.exists
            ? turmaSnap.data()
            : { count: 0, alunos: [] };
          var jaEstaNA =
            turmaData.alunos && turmaData.alunos.indexOf(user.uid) >= 0;

          if (!jaEstaNA && turmaData.count >= LIMITE_TURMA) {
            // Notifica docente e bloqueia
            notificarLimiteTurma(turmaHash, user.email);
            throw new Error("LIMITE_TURMA:" + user.email);
          }

          var now = new Date().toISOString();
          if (!alunoSnap.exists) {
            tx.set(alunoRef, {
              uid: user.uid,
              email: user.email,
              nome: user.displayName || user.email,
              foto: user.photoURL || "",
              semestre: 1,
              ativo: true,
              turma: turmaHash,
              criado: now,
              ultimo_login: now,
            });
          } else {
            tx.update(alunoRef, { ultimo_login: now, turma: turmaHash });
          }

          if (!jaEstaNA) {
            var novosAlunos = (turmaData.alunos || []).concat([user.uid]);
            tx.set(
              turmaRef,
              {
                hash: turmaHash,
                count: novosAlunos.length,
                alunos: novosAlunos,
                updatedAt: now,
              },
              { merge: true },
            );
          }
        },
      );
    });
  }

  function notificarLimiteTurma(turmaHash, emailTentou) {
    // Salva no Firestore para o admin ver
    db.collection("alertas").add({
      tipo: "limite_turma",
      turma: turmaHash,
      email: emailTentou,
      timestamp: new Date().toISOString(),
      visto: false,
    });
  }

  function getAlertas() {
    return db
      .collection("alertas")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          lista.push(Object.assign({ id: doc.id }, doc.data()));
        });
        return lista;
      });
  }

  function marcarAlertaVisto(id) {
    return db.collection("alertas").doc(id).update({ visto: true });
  }

  function getTurma(hash) {
    return db
      .collection("turmas")
      .doc(hash)
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : null;
      });
  }

  // ── FIRESTORE: PUBLICAÇÕES (aulas por turma) ──────────
  // Estrutura: /publicacoes/{semId}_{matId}_{aulaId}
  // { aulaId, turmas: ["TODAS"] ou ["hash1","hash2"], conteudo: {...} }

  function publicarAula(semId, matId, aula, turmas) {
    // turmas = ["TODAS"] ou array de hashes
    var id = semId + "_" + matId + "_" + aula.id;
    return db
      .collection("publicacoes")
      .doc(id)
      .set({
        semId: semId,
        matId: matId,
        aulaId: aula.id,
        aula: aula,
        turmas: turmas,
        publicadoEm: new Date().toISOString(),
        publicadoPor: currentUser ? currentUser.email : "",
      });
  }

  function getPublicacoesDaTurma(semId, matId, turmaHash) {
    // Busca aulas publicadas para esta turma OU para TODAS
    return db
      .collection("publicacoes")
      .where("semId", "==", semId)
      .where("matId", "==", matId)
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          if (
            d.turmas.indexOf("TODAS") >= 0 ||
            d.turmas.indexOf(turmaHash) >= 0
          ) {
            lista.push(d.aula);
          }
        });
        return lista;
      });
  }

  function getTodasPublicacoes(semId, matId) {
    return db
      .collection("publicacoes")
      .where("semId", "==", semId)
      .where("matId", "==", matId)
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          lista.push(Object.assign({ _docId: doc.id }, doc.data()));
        });
        return lista;
      });
  }

  function reutilizarPublicacao(docId, novasTurmas) {
    // Copia publicação existente para novas turmas
    return db
      .collection("publicacoes")
      .doc(docId)
      .get()
      .then(function (snap) {
        if (!snap.exists) throw new Error("Publicação não encontrada");
        var d = snap.data();
        var turmasMerge = d.turmas
          .concat(novasTurmas)
          .filter(function (t, i, arr) {
            return arr.indexOf(t) === i;
          });
        if (turmasMerge.indexOf("TODAS") >= 0) turmasMerge = ["TODAS"];
        return db.collection("publicacoes").doc(docId).update({
          turmas: turmasMerge,
          atualizadoEm: new Date().toISOString(),
        });
      });
  }

  function excluirAlunos(uids) {
    var batch = db.batch();
    uids.forEach(function (uid) {
      batch.delete(db.collection("alunos").doc(uid));
    });
    return batch.commit();
  }

  // ── FIRESTORE: TURMAS CONFIG ──────────────────────────

  function getTurmasConfig() {
    return db.collection("turmas_config")
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          lista.push(Object.assign({ id: doc.id }, doc.data()));
        });
        lista.sort(function (a, b) {
          return (a.criado || "").localeCompare(b.criado || "");
        });
        return lista;
      });
  }

  function saveTurmaConfig(turma) {
    return db.collection("turmas_config").doc(turma.id).set(turma);
  }

  function deleteTurmaConfig(id) {
    return db.collection("turmas_config").doc(id).delete();
  }

  function getAlunosDaTurma(hash) {
    return db.collection("alunos")
      .where("turma", "==", hash)
      .get()
      .then(function (snap) {
        var lista = [];
        snap.forEach(function (doc) {
          lista.push(doc.data());
        });
        return lista;
      });
  }

  return {
    init: init,
    loginGoogle: loginGoogle,
    logout: logout,
    showLoginScreen: showLoginScreen,
    getUser: getUser,
    getRole: getRole,
    isDocente: isDocente,
    isAluno: isAluno,
    isAuthorized: isAuthorized,
    getAulas: getAulas,
    saveAulas: saveAulas,
    onAulas: onAulas,
    getMateriais: getMateriais,
    saveMateriais: saveMateriais,
    getLinks: getLinks,
    saveLinks: saveLinks,
    getCronograma: getCronograma,
    saveCronograma: saveCronograma,
    getConfig: getConfig,
    saveConfig: saveConfig,
    registrarAluno: registrarAluno,
    registrarAlunoNaTurma: registrarAlunoNaTurma,
    getAluno: getAluno,
    getAlunos: getAlunos,
    setSemestreAluno: setSemestreAluno,
    setAtivoAluno: setAtivoAluno,
    excluirAlunos: excluirAlunos,
    getTurma: getTurma,
    getAlertas: getAlertas,
    marcarAlertaVisto: marcarAlertaVisto,
    publicarAula: publicarAula,
    getPublicacoesDaTurma: getPublicacoesDaTurma,
    getTodasPublicacoes: getTodasPublicacoes,
    reutilizarPublicacao: reutilizarPublicacao,
    LIMITE_TURMA: LIMITE_TURMA,
    getTurmasConfig: getTurmasConfig,
    saveTurmaConfig: saveTurmaConfig,
    deleteTurmaConfig: deleteTurmaConfig,
    getAlunosDaTurma: getAlunosDaTurma,
  };
})();
