// =======================================================
//  app.js — LÓGICA PRINCIPAL
//  Não edite este arquivo para adicionar conteúdo.
//  Edite apenas o data.js.
// =======================================================

var App = (function () {
  // ── ESTADO ────────────────────────────────────────────
  var state = null;
  var openMap = {};
  var curLesson = null;
  var curSemId = null;
  var curMatId = null;
  var isViewer = false; // modo aluno (sem edição)
  var maxSemester = null; // semestre máximo visível (?sem=N)
  var STORAGE_KEY = "curso_dev_v3";

  // ── MODO ALUNO / ADMIN ────────────────────────────────

  function detectMode(resolvedLink, role) {
    // Aluno via link hash
    if (resolvedLink) {
      isViewer = true;
      maxSemester = resolvedLink.sem;
      document.body.classList.add("viewer-mode");
      document.getElementById("header-sub").textContent =
        "Visualizando até o " + maxSemester + "º Semestre";
      return;
    }
    // Aluno logado Google
    if (role === "aluno") {
      isViewer = true;
      maxSemester = 4;
      document.body.classList.add("viewer-mode");
      document.getElementById("header-sub").textContent = "Modo Aluno";
      return;
    }
    // Admin
    if (role === "admin") {
      isViewer = false;
      return;
    }
    // Legado ?sem=N
    var params = new URLSearchParams(window.location.search);
    if (params.has("sem")) {
      isViewer = true;
      maxSemester = parseInt(params.get("sem"), 10) || 1;
      document.body.classList.add("viewer-mode");
      document.getElementById("header-sub").textContent =
        "Visualizando até o " + maxSemester + "º Semestre";
    }
  }

  // ── PERSISTÊNCIA ──────────────────────────────────────

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        state = JSON.parse(saved);
      } else {
        state = JSON.parse(JSON.stringify(CURSO_DATA));
      }
    } catch (e) {
      state = JSON.parse(JSON.stringify(CURSO_DATA));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    // Sincroniza com Firebase se admin logado
    if (FB && FB.isDocente()) {
      syncToFirebase();
    }
  }

  function syncToFirebase() {
    if (!state || !FB.isDocente()) return;
    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (mat) {
        if (mat.aulas && mat.aulas.length > 0) {
          FB.saveAulas(sem.id, mat.id, mat.aulas).catch(function (e) {
            console.warn("Firebase sync error:", e);
          });
        }
      });
    });
  }

  // ── HELPERS ───────────────────────────────────────────

  function findSem(semId) {
    return state.semestres.find(function (s) {
      return s.id === semId;
    });
  }
  function findMat(semId, matId) {
    var sem = findSem(semId);
    return sem
      ? sem.materias.find(function (m) {
          return m.id === matId;
        })
      : null;
  }
  function findLesson(semId, matId, lessonId) {
    var mat = findMat(semId, matId);
    return mat
      ? mat.aulas.find(function (a) {
          return a.id === lessonId;
        })
      : null;
  }

  // ── RENDER ────────────────────────────────────────────

  function render() {
    var html = "";
    state.semestres.forEach(function (sem, idx) {
      // Modo aluno: esconde semestres acima do limite
      if (isViewer && maxSemester !== null && idx + 1 > maxSemester) return;
      html += renderSemester(sem);
    });
    document.getElementById("app").innerHTML =
      html ||
      "<p style='padding:2rem;color:#aaa'>Nenhum semestre disponível.</p>";
  }

  function renderSemester(sem) {
    return (
      '<div class="semester-block">' +
      '<div class="semester-header" onclick="App.toggleSem(\'' +
      sem.id +
      "')\">" +
      "<h2>" +
      sem.titulo +
      ' <span class="sub">— ' +
      sem.sub +
      "</span></h2>" +
      '<span class="badge">' +
      sem.materias.length +
      " matérias</span>" +
      "</div>" +
      '<div id="sem-' +
      sem.id +
      '">' +
      sem.materias
        .map(function (mat) {
          return renderMat(sem.id, mat);
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function renderMat(semId, mat) {
    var key = semId + "-" + mat.id;
    var open = !!openMap[key];

    // Aulas visíveis (modo aluno) vs todas (admin)
    var todasAulas = mat.aulas;
    var aulasVisiveis = isViewer
      ? todasAulas.filter(function (a) {
          return !Schedule.isOculta(semId, mat.id, a.id);
        })
      : todasAulas;
    var done = aulasVisiveis.filter(function (a) {
      return a.status === "completa";
    }).length;
    var total = aulasVisiveis.length;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Previsão de cronograma
    var prev = Schedule.getPrevisao(mat.id, mat.ch);

    // Badge de aulas ocultas (só admin)
    var ocultasCount = todasAulas.filter(function (a) {
      return Schedule.isOculta(semId, mat.id, a.id);
    }).length;

    // Continuação: calcula progresso unificado se tiver ch_total
    var chTotal = mat.ch_total || mat.ch;
    var contDe = mat.continuacao_de || null;
    var isCont = !!contDe;
    var partLabel = "";
    if (isCont) {
      partLabel = "Parte 2";
    } else if (mat.ch_total && mat.ch_total !== mat.ch) {
      partLabel = "Parte 1";
    }

    // Progresso unificado: busca aulas concluídas da parte irmã também
    var doneTotal = done;
    var totalAulas = total;
    if (mat.ch_total) {
      // Procura matéria irmã no state
      var allMats = [];
      (state || { semestres: [] }).semestres.forEach(function (s) {
        s.materias.forEach(function (m) {
          allMats.push({ semId: s.id, mat: m });
        });
      });
      var irma = allMats.find(function (x) {
        return (
          x.mat.continuacao_de === mat.id ||
          (mat.continuacao_de && x.mat.id === mat.continuacao_de) ||
          (mat.continuacao_de &&
            x.mat.continuacao_de === mat.continuacao_de &&
            x.mat.id !== mat.id)
        );
      });
      if (irma) {
        var irmaVis = isViewer
          ? irma.mat.aulas.filter(function (a) {
              return !Schedule.isOculta(irma.semId, irma.mat.id, a.id);
            })
          : irma.mat.aulas;
        doneTotal += irmaVis.filter(function (a) {
          return a.status === "completa";
        }).length;
        totalAulas += irmaVis.length;
      }
    }
    var pctTotal =
      totalAulas > 0 ? Math.round((doneTotal / totalAulas) * 100) : 0;

    var html =
      '<div class="subject-item' +
      (isCont ? ' subject-continuation" data-cont-de="' + contDe + '"' : '"') +
      ">" +
      (isCont ? '<div class="cont-connector"></div>' : "") +
      '<div class="subject-header" onclick="App.toggleMat(\'' +
      semId +
      "','" +
      mat.id +
      "')\">" +
      '<div class="s-icon' +
      (isCont ? " s-icon-cont" : "") +
      '">' +
      mat.icone +
      "</div>" +
      '<div class="s-info">' +
      '<div class="s-name-row">' +
      '<span class="s-name">' +
      mat.nome +
      "</span>" +
      (partLabel ? '<span class="part-badge">' + partLabel + "</span>" : "") +
      "</div>" +
      '<div class="s-meta">' +
      "<span>" +
      mat.ch +
      (mat.ch_total && mat.ch_total !== mat.ch
        ? ' <span class="ch-total">/ ' + mat.ch_total + " total</span>"
        : "") +
      "</span>" +
      "<span>" +
      total +
      " aulas</span>" +
      (done > 0
        ? '<span class="done-count">' + done + " concluídas</span>"
        : "") +
      Materials.getBadge(semId, mat.id) +
      (!isViewer && prev.semanas
        ? '<span class="sch-badge">' + prev.semanas + " sem</span>"
        : "") +
      (!isViewer && ocultasCount > 0
        ? '<span class="hidden-badge">&#128065; ' +
          ocultasCount +
          " ocultas</span>"
        : "") +
      "</div>" +
      "</div>" +
      '<span class="chevron' +
      (open ? " open" : "") +
      '">&#9654;</span>' +
      "</div>" +
      // Barra de progresso (sempre visível se há aulas)
      (total > 0
        ? '<div class="progress-wrap">' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' +
          pct +
          '%"></div></div>' +
          '<span class="progress-label">' +
          pct +
          "% esta parte</span>" +
          (mat.ch_total && mat.ch_total !== mat.ch && totalAulas > total
            ? '<span class="progress-label-total">(' +
              pctTotal +
              "% total)</span>"
            : "") +
          (!isViewer && prev.fim
            ? '<span class="progress-date">Previsão: ' +
              prev.fim.toLocaleDateString("pt-BR") +
              "</span>"
            : "") +
          "</div>"
        : "");

    if (open) {
      html += '<div class="lessons-list">';

      // Botões de controle admin
      if (!isViewer) {
        html +=
          '<div class="lesson-bulk-actions">' +
          '<button class="btn-sm" onclick="App.abrirCronograma(\'' +
          semId +
          "','" +
          mat.id +
          "','" +
          mat.nome +
          "','" +
          mat.ch +
          "')\">&#128197; Cronograma</button>" +
          '<button class="btn-sm btn-sm-pdf" onclick="PdfConverter.open(\'' +
          semId +
          "','" +
          mat.id +
          "','" +
          mat.nome +
          "')\">&#128196; Importar PDF</button>" +
          '<button class="btn-sm btn-sm-mat" onclick="Materials.open(\'' +
          semId +
          "','" +
          mat.id +
          "','" +
          mat.nome +
          "')\">&#128279; Materiais</button>" +
          (todasAulas.length > 0
            ? '<button class="btn-sm" onclick="Schedule.ocultarTodas(\'' +
              semId +
              "','" +
              mat.id +
              "');App.render()\">&#128564; Ocultar tudo</button>" +
              '<button class="btn-sm" onclick="Schedule.mostrarTodas(\'' +
              semId +
              "','" +
              mat.id +
              "');App.render()\">&#128065; Mostrar tudo</button>"
            : "") +
          "</div>";
      }
      // Modo aluno: mostra badge de materiais complementares
      if (isViewer) {
        var matBadge = Materials.getBadge(semId, mat.id);
        if (matBadge) {
          html +=
            '<div class="mat-badge-row" onclick="Materials.open(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            mat.nome +
            "')\">" +
            matBadge +
            " Materiais complementares</div>";
        }
      }

      if (aulasVisiveis.length === 0 && todasAulas.length === 0) {
        html += '<div class="empty-msg">Nenhuma aula cadastrada ainda.</div>';
      } else if (aulasVisiveis.length === 0 && isViewer) {
        html +=
          '<div class="empty-msg">Nenhuma aula disponível no momento.</div>';
      } else {
        // Admin: mostra todas com indicador de oculta
        // Aluno: mostra só visíveis
        var listaRender = isViewer ? aulasVisiveis : todasAulas;
        listaRender.forEach(function (aula, i) {
          var oculta = Schedule.isOculta(semId, mat.id, aula.id);
          var classes = "lesson-item" + (oculta ? " lesson-hidden" : "");
          html +=
            '<div class="' +
            classes +
            '" onclick="App.openLesson(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            aula.id +
            "')\">" +
            '<div class="l-num' +
            (aula.status === "completa" ? " done" : "") +
            '">' +
            (i + 1) +
            "</div>" +
            '<span class="l-title">' +
            aula.titulo +
            (oculta ? ' <span class="oculta-tag">oculta</span>' : "") +
            "</span>" +
            '<span class="l-status">' +
            (aula.status === "completa" ? "&#10003; Completa" : "Em breve") +
            "</span>" +
            '<div class="lesson-actions admin-only" onclick="event.stopPropagation()">' +
            '<button class="btn-icon" title="' +
            (oculta ? "Mostrar" : "Ocultar") +
            '" onclick="Schedule.toggleOculta(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            aula.id +
            "');App.render()\">" +
            (oculta ? "&#128065;" : "&#128564;") +
            "</button>" +
            '<button class="btn-icon" title="Editar" onclick="App.editLesson(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            aula.id +
            "')\">&#9998;</button>" +
            '<button class="btn-icon danger" title="Excluir" onclick="App.confirmDelete(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            aula.id +
            "')\">&#128465;</button>" +
            "</div>" +
            "</div>";
        });
      }
      html +=
        '<button class="add-btn admin-only" onclick="App.addLesson(\'' +
        semId +
        "','" +
        mat.id +
        "')\">+ Adicionar aula</button>";
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  // ── NAVEGAÇÃO ─────────────────────────────────────────

  function toggleSem(id) {
    var el = document.getElementById("sem-" + id);
    if (el) el.style.display = el.style.display === "none" ? "" : "none";
  }

  function toggleMat(semId, matId) {
    var key = semId + "-" + matId;
    openMap[key] = !openMap[key];
    render();
  }

  // ── MODAL: ABRIR AULA ─────────────────────────────────

  function openLesson(semId, matId, lessonId) {
    var lesson = findLesson(semId, matId, lessonId);
    var mat = findMat(semId, matId);
    if (!lesson || !mat) return;

    curLesson = lesson;
    curSemId = semId;
    curMatId = matId;

    document.getElementById("m-title").textContent = lesson.titulo;
    document.getElementById("m-sub").textContent = mat.nome;

    document.getElementById("pane-content").innerHTML = marked.parse(
      lesson.conteudo || "_Sem conteúdo ainda._",
    );

    document.getElementById("pane-notes").innerHTML = lesson.notas
      ? marked.parse(lesson.notas)
      : '<p style="color:var(--text-faint);font-style:italic">Sem notas do professor.</p>';

    document.getElementById("json-ed").value = JSON.stringify(lesson, null, 2);

    switchTab("content");
    document.getElementById("overlay").classList.add("open");
  }

  // Abre direto na aba de edição
  function editLesson(semId, matId, lessonId) {
    openLesson(semId, matId, lessonId);
    switchTab("raw");
  }

  function closeModal() {
    document.getElementById("overlay").classList.remove("open");
    curLesson = null;
    curSemId = null;
    curMatId = null;
  }

  function switchTab(tab) {
    var names = ["content", "notes", "raw"];
    document.querySelectorAll(".tab").forEach(function (el, i) {
      el.classList.toggle("active", names[i] === tab);
    });
    document.querySelectorAll(".tab-pane").forEach(function (el, i) {
      el.classList.toggle("active", names[i] === tab);
    });
  }

  // ── EDITAR / SALVAR JSON ──────────────────────────────

  function saveEdit() {
    try {
      var updated = JSON.parse(document.getElementById("json-ed").value);
      var mat = findMat(curSemId, curMatId);
      var idx = mat.aulas.findIndex(function (a) {
        return a.id === curLesson.id;
      });
      mat.aulas[idx] = updated;
      curLesson = updated;
      saveState();
      saveMatToFirestore(curSemId, curMatId);
      document.getElementById("pane-content").innerHTML = marked.parse(
        updated.conteudo || "",
      );
      document.getElementById("pane-notes").innerHTML = updated.notas
        ? marked.parse(updated.notas)
        : '<p style="color:var(--text-faint);font-style:italic">Sem notas.</p>';
      document.getElementById("m-title").textContent = updated.titulo;
      switchTab("content");
      toast("Aula salva com sucesso!");
      render();
    } catch (e) {
      toast("JSON inválido. Verifique a sintaxe.");
    }
  }

  // ── EXCLUIR AULA ──────────────────────────────────────

  function confirmDelete(semId, matId, lessonId) {
    var lesson = findLesson(semId, matId, lessonId);
    if (!lesson) return;
    if (
      !window.confirm(
        'Excluir a aula "' +
          lesson.titulo +
          '"?\nEssa ação não pode ser desfeita.',
      )
    )
      return;
    var mat = findMat(semId, matId);
    mat.aulas = mat.aulas.filter(function (a) {
      return a.id !== lessonId;
    });
    saveState();
    saveMatToFirestore(semId, matId);
    render();
    toast("Aula excluída.");
  }

  function deleteLesson() {
    if (!curLesson) return;
    confirmDelete(curSemId, curMatId, curLesson.id);
    closeModal();
  }

  // ── ADICIONAR AULA ────────────────────────────────────

  function addLesson(semId, matId) {
    var mat = findMat(semId, matId);
    if (!mat) return;
    var n = mat.aulas.length + 1;
    var id = matId + "-a" + String(n).padStart(2, "0");
    var nova = {
      id: id,
      titulo: "Aula " + n + " — Novo Título",
      status: "em-breve",
      conteudo: "# Aula " + n + "\n\nConteúdo a ser preenchido.",
      notas: "",
    };
    mat.aulas.push(nova);
    saveState();
    saveMatToFirestore(semId, matId);
    render();
    editLesson(semId, matId, id);
    toast("Aula criada! Edite o conteúdo abaixo.");
  }

  // ── PDF ───────────────────────────────────────────────

  function printLesson() {
    if (!curLesson) return;
    var mat = findMat(curSemId, curMatId);
    var w = window.open("", "_blank");

    var css = [
      "body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#222;line-height:1.7}",
      "h1{font-size:1.5rem;color:#1a1a2e;border-bottom:3px solid #c8102e;padding-bottom:.5rem;margin-bottom:1.5rem}",
      "h2{font-size:1.1rem;color:#1a1a2e;margin:1.2rem 0 .4rem;border-bottom:1px solid #eee;padding-bottom:.2rem}",
      "h3{font-size:1rem;margin:.9rem 0 .3rem}p{margin-bottom:.6rem;font-size:.9rem}",
      "ul,ol{margin:.4rem 0 .6rem 1.4rem}li{margin-bottom:.25rem;font-size:.9rem}",
      "pre{background:#1e1e2e;color:#cdd6f4;padding:.9rem;border-radius:6px;overflow-x:auto;font-size:.8rem;line-height:1.5}",
      "code{background:#f0f0f0;padding:.1rem .3rem;border-radius:3px;font-size:.82rem}",
      "pre code{background:none;padding:0}",
      "blockquote{border-left:3px solid #c8102e;padding:.4rem .9rem;background:#fff8f8;margin:.6rem 0;border-radius:0 6px 6px 0}",
      "table{width:100%;border-collapse:collapse;font-size:.85rem}",
      "th{background:#1a1a2e;color:#fff;padding:.4rem .6rem;text-align:left}",
      "td{padding:.35rem .6rem;border-bottom:1px solid #eee}",
      ".hd{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #1a1a2e}",
      ".badge{background:#c8102e;color:#fff;padding:.3rem .8rem;border-radius:4px;font-weight:700;font-size:.85rem}",
      "@media print{body{margin:.5rem}}",
    ].join("");

    var html = [
      '<!DOCTYPE html><html><head><meta charset="UTF-8">',
      "<title>" + curLesson.titulo + "</title>",
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"><\/script>',
      "<style>" + css + "</style></head><body>",
      '<div class="hd">',
      '<div class="badge">SENAI</div>',
      "<div><strong>" + (mat ? mat.nome : "") + "</strong><br>",
      "<small>Técnico em Desenvolvimento de Sistemas</small></div>",
      "</div>",
      '<div id="c"></div>',
      "<script>",
      "document.getElementById('c').innerHTML=marked.parse(" +
        JSON.stringify(curLesson.conteudo || "") +
        ");",
      "window.onload=function(){window.print();};",
      "<\/script></body></html>",
    ].join("");

    w.document.write(html);
    w.document.close();
  }

  // ── TOAST ─────────────────────────────────────────────

  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 2500);
  }

  // ── INIT ──────────────────────────────────────────────

  function init() {
    FB.init(function (user) {
      if (!user && window.FIREBASE_CONFIG) {
        // Firebase configurado mas não logado → tela de login
        FB.showLoginScreen(null);
        return;
      }
      bootApp(user);
    });
  }

  function bootApp(user) {
    // Sem Firebase configurado → modo local, admin direto
    if (!window.FIREBASE_CONFIG) {
      isViewer = false;
      LinkManager.init(function (resolvedLink) {
        detectMode(resolvedLink);
        finishBoot();
      });
      return;
    }

    if (user && FB.isAluno()) {
      // Aluno logado → precisa de link válido
      LinkManager.init(function (resolvedLink) {
        if (!resolvedLink) {
          FB.showLoginScreen("Acesse pelo link fornecido pelo seu professor.");
          return;
        }
        detectMode(resolvedLink);
        finishBoot();
      });
      return;
    }

    // Docente → admin completo
    if (user && FB.isDocente()) {
      isViewer = false;
      addUserBadge(user);
    }

    LinkManager.init(function (resolvedLink) {
      if (!user) detectMode(resolvedLink);
      finishBoot();
    });
  }

  function finishBoot() {
    Schedule.init();
    Materials.init();
    loadState();
    loadFromFirestore();
    document.getElementById("overlay").addEventListener("click", function (e) {
      if (e.target === this) closeModal();
    });
    document
      .getElementById("overlay-move")
      .addEventListener("click", function (e) {
        if (e.target === this) AdminPanel.closeMoveModal();
      });
  }

  function loadFromFirestore() {
    if (!window.FIREBASE_CONFIG || !state) {
      render();
      return;
    }
    var total = 0;
    var done = 0;
    state.semestres.forEach(function (sem) {
      total += sem.materias.length;
    });
    if (total === 0) {
      render();
      return;
    }
    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (mat) {
        FB.getAulas(sem.id, mat.id)
          .then(function (aulas) {
            if (aulas.length > 0) mat.aulas = aulas;
          })
          .catch(function () {})
          .finally(function () {
            done++;
            if (done === total) render();
          });
      });
    });
  }

  function addUserBadge(user) {
    var header = document.getElementById("admin-header-actions");
    if (!header) return;
    var badge = document.createElement("div");
    badge.className = "user-badge";
    badge.innerHTML =
      (user.photoURL
        ? '<img src="' +
          user.photoURL +
          '" style="width:24px;height:24px;border-radius:50%">'
        : "") +
      "<span>" +
      (user.displayName || user.email) +
      "</span>" +
      '<button onclick="FB.logout()" class="btn btn-ghost" style="font-size:.7rem;padding:.2rem .5rem">Sair</button>';
    header.appendChild(badge);
  }

  // ── ABRIR CRONOGRAMA ──────────────────────────────────

  function abrirCronograma(semId, matId, matNome, matCh) {
    Schedule.openCronogramaModal(semId, matId, matNome, matCh);
  }

  // ── API PÚBLICA ───────────────────────────────────────
  return {
    init: init,
    abrirCronograma: abrirCronograma,
    toggleSem: toggleSem,
    toggleMat: toggleMat,
    openLesson: openLesson,
    editLesson: editLesson,
    closeModal: closeModal,
    switchTab: switchTab,
    saveEdit: saveEdit,
    confirmDelete: confirmDelete,
    deleteLesson: deleteLesson,
    addLesson: addLesson,
    printLesson: printLesson,
    getState: function () {
      return state;
    },
    saveState: saveState,
    render: render,
    toast: toast,
    isViewer: function () {
      return isViewer;
    },
    setViewer: function (v) {
      isViewer = v;
    },
  };
})();

// ── ADMIN PANEL (mover matéria) ───────────────────────

var AdminPanel = (function () {
  function openMoveModal() {
    var state = App.getState();
    var matSel = document.getElementById("move-mat-select");
    var semSel = document.getElementById("move-sem-select");
    matSel.innerHTML = "";
    semSel.innerHTML = "";

    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (mat) {
        var opt = document.createElement("option");
        opt.value = sem.id + "|" + mat.id;
        opt.textContent = mat.nome + " (" + sem.titulo + ")";
        matSel.appendChild(opt);
      });
    });

    state.semestres.forEach(function (sem) {
      var opt = document.createElement("option");
      opt.value = sem.id;
      opt.textContent = sem.titulo + " — " + sem.sub;
      semSel.appendChild(opt);
    });

    document.getElementById("overlay-move").classList.add("open");
  }

  function closeMoveModal() {
    document.getElementById("overlay-move").classList.remove("open");
  }

  function confirmMove() {
    var matVal = document.getElementById("move-mat-select").value;
    var destSem = document.getElementById("move-sem-select").value;
    if (!matVal || !destSem) return;

    var parts = matVal.split("|");
    var srcSem = parts[0];
    var matId = parts[1];

    if (srcSem === destSem) {
      App.toast("A matéria já está nesse semestre.");
      return;
    }

    var state = App.getState();
    var src = state.semestres.find(function (s) {
      return s.id === srcSem;
    });
    var dest = state.semestres.find(function (s) {
      return s.id === destSem;
    });
    var matIdx = src.materias.findIndex(function (m) {
      return m.id === matId;
    });
    var mat = src.materias.splice(matIdx, 1)[0];
    dest.materias.push(mat);

    App.saveState();
    App.render();
    closeMoveModal();
    App.toast("Matéria movida para " + dest.titulo + "!");
  }

  return {
    openMoveModal: openMoveModal,
    closeMoveModal: closeMoveModal,
    confirmMove: confirmMove,
  };
})();

// Inicializa — aguarda firebase-config.js carregar (async), com fallback de 2s
document.addEventListener("DOMContentLoaded", function () {
  var waited = 0;
  var interval = setInterval(function () {
    waited += 50;
    // FIREBASE_CONFIG definido (mesmo null) = config tentou carregar
    var configReady = Object.prototype.hasOwnProperty.call(
      window,
      "FIREBASE_CONFIG",
    );
    if (configReady || waited >= 2000) {
      clearInterval(interval);
      App.init();
    }
  }, 50);
});
