// =======================================================
//  app.js
// =======================================================

var App = (function () {
  var state = null;
  var openMap = {};
  var curLesson = null;
  var curSemId = null;
  var curMatId = null;
  var isViewer = false;
  var maxSemester = null;
  var alunoTurmaHash = null;
  var STORAGE_KEY = "curso_dev_v3";

  function detectMode(resolvedLink) {
    var params = new URLSearchParams(window.location.search);
    if (resolvedLink) {
      isViewer = true;
      maxSemester = resolvedLink.sem;
      document.body.classList.add("viewer-mode");
      document.getElementById("header-sub").textContent =
        "Visualizando até o " + maxSemester + "º Semestre";
      return;
    }
    if (params.has("sem")) {
      isViewer = true;
      maxSemester = parseInt(params.get("sem"), 10) || 1;
      document.body.classList.add("viewer-mode");
      document.getElementById("header-sub").textContent =
        "Visualizando até o " + maxSemester + "º Semestre";
    }
  }

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      state = saved
        ? JSON.parse(saved)
        : JSON.parse(JSON.stringify(CURSO_DATA));
    } catch (e) {
      state = JSON.parse(JSON.stringify(CURSO_DATA));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function saveMatToFirestore(semId, matId) {
    if (!window.FIREBASE_CONFIG || !FB.isDocente()) return;
    var mat = findMat(semId, matId);
    if (mat) FB.saveAulas(semId, matId, mat.aulas).catch(function () {});
  }

  function findSem(semId) {
    return state.semestres.find(function (s) {
      return s.id === semId;
    });
  }
  function findMat(semId, matId) {
    var s = findSem(semId);
    return s
      ? s.materias.find(function (m) {
          return m.id === matId;
        })
      : null;
  }
  function findLesson(semId, matId, lid) {
    var m = findMat(semId, matId);
    return m
      ? m.aulas.find(function (a) {
          return a.id === lid;
        })
      : null;
  }

  function render() {
    var html = "";
    state.semestres.forEach(function (sem, idx) {
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
        .map(function (m) {
          return renderMat(sem.id, m);
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function renderMat(semId, mat) {
    var key = semId + "-" + mat.id,
      open = !!openMap[key];
    var todasAulas = mat.aulas;
    var aulasVis = isViewer
      ? todasAulas.filter(function (a) {
          return !Schedule.isOculta(semId, mat.id, a.id);
        })
      : todasAulas;
    var done = aulasVis.filter(function (a) {
      return a.status === "completa";
    }).length;
    var total = aulasVis.length;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var prev = Schedule.getPrevisao(mat.id, mat.ch);
    var ocultasCount = todasAulas.filter(function (a) {
      return Schedule.isOculta(semId, mat.id, a.id);
    }).length;

    var doneTotal = done,
      totalAulas = total;
    if (mat.ch_total) {
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
    var isCont = !!mat.continuacao_de;
    var partLabel = isCont
      ? "Parte " + (mat.parte_num || 2)
      : mat.ch_total && mat.ch_total !== mat.ch
        ? "Parte 1"
        : "";

    var html =
      '<div class="subject-item' +
      (isCont
        ? ' subject-continuation" data-cont-de="' + mat.continuacao_de + '"'
        : '"') +
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
      " </span>" +
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
      (total > 0
        ? '<div class="progress-wrap">' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' +
          pct +
          '%"></div></div>' +
          '<span class="progress-label">' +
          pct +
          "% concluído</span>" +
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
              '\');App.render()">&#128564; Ocultar tudo</button><button class="btn-sm" onclick="Schedule.mostrarTodas(\'' +
              semId +
              "','" +
              mat.id +
              "');App.render()\">&#128065; Mostrar tudo</button>"
            : "") +
          "</div>";
      }
      if (isViewer && Materials.getBadge(semId, mat.id)) {
        html +=
          '<div class="mat-badge-row" onclick="Materials.open(\'' +
          semId +
          "','" +
          mat.id +
          "','" +
          mat.nome +
          "')\">&#128279; Materiais complementares</div>";
      }
      if (aulasVis.length === 0 && todasAulas.length === 0) {
        html += '<div class="empty-msg">Nenhuma aula cadastrada ainda.</div>';
      } else if (aulasVis.length === 0 && isViewer) {
        html +=
          '<div class="empty-msg">Nenhuma aula disponível no momento.</div>';
      } else {
        (isViewer ? aulasVis : todasAulas).forEach(function (aula, i) {
          var oc = Schedule.isOculta(semId, mat.id, aula.id);
          html +=
            '<div class="lesson-item' +
            (oc ? " lesson-hidden" : "") +
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
            (oc ? ' <span class="oculta-tag">oculta</span>' : "") +
            " </span>" +
            '<span class="l-status">' +
            (aula.status === "completa" ? "&#10003; Completa" : "Em breve") +
            "</span>" +
            '<div class="lesson-actions admin-only" onclick="event.stopPropagation()">' +
            '<button class="btn-icon" title="' +
            (oc ? "Mostrar" : "Ocultar") +
            '" onclick="Schedule.toggleOculta(\'' +
            semId +
            "','" +
            mat.id +
            "','" +
            aula.id +
            "');App.render()\">" +
            (oc ? "&#128065;" : "&#128564;") +
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
            "</div></div>";
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
    return html + "</div>";
  }

  function toggleSem(id) {
    var el = document.getElementById("sem-" + id);
    if (el) el.style.display = el.style.display === "none" ? "" : "none";
  }
  function toggleMat(semId, matId) {
    openMap[semId + "-" + matId] = !openMap[semId + "-" + matId];
    render();
  }

  function openLesson(semId, matId, lessonId) {
    var lesson = findLesson(semId, matId, lessonId),
      mat = findMat(semId, matId);
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
      document.getElementById("pane-content").innerHTML = marked.parse(
        updated.conteudo || "",
      );
      document.getElementById("pane-notes").innerHTML = updated.notas
        ? marked.parse(updated.notas)
        : '<p style="color:var(--text-faint);font-style:italic">Sem notas.</p>';
      document.getElementById("m-title").textContent = updated.titulo;
      switchTab("content");
      toast("Aula salva! Use Publicar para enviar às turmas.");
      render();
    } catch (e) {
      toast("JSON inválido. Verifique a sintaxe.");
    }
  }

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

  function addLesson(semId, matId) {
    var mat = findMat(semId, matId);
    if (!mat) return;
    var n = mat.aulas.length + 1,
      id = matId + "-a" + String(n).padStart(2, "0");
    mat.aulas.push({
      id: id,
      titulo: "Aula " + n + " — Novo Título",
      status: "em-breve",
      conteudo: "# Aula " + n + "\n\nConteúdo a ser preenchido.",
      notas: "",
    });
    saveState();
    render();
    editLesson(semId, matId, id);
    toast("Aula criada! Edite o conteúdo e depois clique em Publicar.");
  }

  function publicarAulaAtual() {
    if (!curLesson || !curSemId || !curMatId) return;
    var semId = curSemId, matId = curMatId, aulaId = curLesson.id;
    closeModal();
    Turmas.abrirPublicar(semId, matId, aulaId);
  }
  function abrirCronograma(semId, matId, matNome, matCh) {
    Schedule.openCronogramaModal(semId, matId, matNome, matCh);
  }

  function printLesson() {
    if (!curLesson) return;
    var mat = findMat(curSemId, curMatId),
      w = window.open("", "_blank");
    var css =
      "body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#222;line-height:1.7}h1{font-size:1.5rem;color:#1a1a2e;border-bottom:3px solid #c8102e;padding-bottom:.5rem;margin-bottom:1.5rem}h2{font-size:1.1rem;color:#1a1a2e;margin:1.2rem 0 .4rem}h3{font-size:1rem;margin:.9rem 0 .3rem}p{margin-bottom:.6rem;font-size:.9rem}ul,ol{margin:.4rem 0 .6rem 1.4rem}li{margin-bottom:.25rem;font-size:.9rem}pre{background:#1e1e2e;color:#cdd6f4;padding:.9rem;border-radius:6px;overflow-x:auto;font-size:.8rem}code{background:#f0f0f0;padding:.1rem .3rem;border-radius:3px;font-size:.82rem}pre code{background:none;padding:0}blockquote{border-left:3px solid #c8102e;padding:.4rem .9rem;background:#fff8f8;margin:.6rem 0}table{width:100%;border-collapse:collapse;font-size:.85rem}th{background:#1a1a2e;color:#fff;padding:.4rem .6rem;text-align:left}td{padding:.35rem .6rem;border-bottom:1px solid #eee}.hd{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #1a1a2e}.badge{background:#c8102e;color:#fff;padding:.3rem .8rem;border-radius:4px;font-weight:700;font-size:.85rem}@media print{body{margin:.5rem}}";
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
        curLesson.titulo +
        '</title><script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"><\/script><style>' +
        css +
        '</style></head><body><div class="hd"><div class="badge">SENAI</div><div><strong>' +
        (mat ? mat.nome : "") +
        '</strong><br><small>Técnico em Desenvolvimento de Sistemas</small></div></div><div id="c"></div><script>document.getElementById("c").innerHTML=marked.parse(' +
        JSON.stringify(curLesson.conteudo || "") +
        ");window.onload=function(){window.print()};<\/script></body></html>",
    );
    w.document.close();
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 2500);
  }

  function init() {
    FB.init(function (user) {
      if (!user && window.FIREBASE_CONFIG) {
        FB.showLoginScreen(null);
        return;
      }
      bootApp(user);
    });
  }

  function bootApp(user) {
    if (!window.FIREBASE_CONFIG) {
      isViewer = false;
      LinkManager.init(function (r) {
        detectMode(r);
        finishBoot();
      });
      return;
    }
    if (user && FB.isAluno()) {
      var th = window.location.hash.replace("#", "").trim() || null;
      (th ? FB.registrarAlunoNaTurma(user, th) : FB.registrarAluno(user))
        .then(function () {
          return FB.getAluno(user.uid);
        })
        .then(function (d) {
          if (!d || d.ativo === false) {
            FB.logout();
            FB.showLoginScreen("Acesso bloqueado. Fale com o professor.");
            return;
          }
          alunoTurmaHash = d.turma || th || null;
          isViewer = true;
          maxSemester = d.semestre || 1;
          document.body.classList.add("viewer-mode");
          document.getElementById("header-sub").textContent =
            "Olá, " +
            (user.displayName ? user.displayName.split(" ")[0] : "Aluno") +
            " — " +
            maxSemester +
            "º Semestre";
          finishBoot();
        })
        .catch(function (err) {
          if (err.message && err.message.indexOf("LIMITE_TURMA") === 0) {
            FB.logout();
            FB.showLoginScreen("Turma lotada. Fale com o professor.");
            return;
          }
          FB.showLoginScreen("Erro ao carregar dados. Tente novamente.");
        });
      return;
    }
    if (user && FB.isDocente()) {
      isViewer = false;
      addUserBadge(user);
    }
    LinkManager.init(function (r) {
      if (!user) detectMode(r);
      finishBoot();
    });
  }

  function finishBoot() {
    Schedule.init();
    Materials.init();
    if (!isViewer) Turmas.init();
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
    document
      .getElementById("overlay-turmas-admin")
      .addEventListener("click", function (e) {
        if (e.target === this) TurmasAdmin.close();
      });
  }

  function loadFromFirestore() {
    if (!window.FIREBASE_CONFIG || !state) {
      render();
      return;
    }
    var total = 0,
      done = 0;
    state.semestres.forEach(function (sem) {
      total += sem.materias.length;
    });
    if (total === 0) {
      render();
      return;
    }
    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (mat) {
        var p =
          isViewer && alunoTurmaHash
            ? FB.getPublicacoesDaTurma(sem.id, mat.id, alunoTurmaHash)
            : FB.getAulas(sem.id, mat.id);
        p.then(function (a) {
          if (a && a.length > 0) mat.aulas = a;
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
    var h = document.getElementById("admin-header-actions");
    if (!h) return;
    var b = document.createElement("div");
    b.className = "user-badge";
    b.innerHTML =
      (user.photoURL
        ? '<img src="' +
          user.photoURL +
          '" style="width:24px;height:24px;border-radius:50%">'
        : "") +
      "<span>" +
      (user.displayName || user.email) +
      "</span>" +
      '<button onclick="FB.logout()" class="btn btn-ghost" style="font-size:.7rem;padding:.2rem .5rem">Sair</button>';
    h.appendChild(b);
  }

  function getAlunoTurma() {
    return alunoTurmaHash;
  }

  return {
    init: init,
    abrirCronograma: abrirCronograma,
    publicarAulaAtual: publicarAulaAtual,
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
    getAlunoTurma: getAlunoTurma,
  };
})();

var AdminPanel = (function () {
  function openMoveModal() {
    var s = App.getState(),
      ms = document.getElementById("move-mat-select"),
      ss = document.getElementById("move-sem-select");
    ms.innerHTML = "";
    ss.innerHTML = "";
    s.semestres.forEach(function (sem) {
      sem.materias.forEach(function (mat) {
        var o = document.createElement("option");
        o.value = sem.id + "|" + mat.id;
        o.textContent = mat.nome + " (" + sem.titulo + ")";
        ms.appendChild(o);
      });
      var o = document.createElement("option");
      o.value = sem.id;
      o.textContent = sem.titulo + " — " + sem.sub;
      ss.appendChild(o);
    });
    document.getElementById("overlay-move").classList.add("open");
  }
  function closeMoveModal() {
    document.getElementById("overlay-move").classList.remove("open");
  }
  function confirmMove() {
    var mv = document.getElementById("move-mat-select").value,
      ds = document.getElementById("move-sem-select").value;
    if (!mv || !ds) return;
    var p = mv.split("|"),
      ss = p[0],
      mi = p[1];
    if (ss === ds) {
      App.toast("A matéria já está nesse semestre.");
      return;
    }
    var s = App.getState(),
      src = s.semestres.find(function (x) {
        return x.id === ss;
      }),
      dest = s.semestres.find(function (x) {
        return x.id === ds;
      });
    dest.materias.push(
      src.materias.splice(
        src.materias.findIndex(function (m) {
          return m.id === mi;
        }),
        1,
      )[0],
    );
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

document.addEventListener("DOMContentLoaded", function () {
  var waited = 0,
    iv = setInterval(function () {
      waited += 50;
      if (
        Object.prototype.hasOwnProperty.call(window, "FIREBASE_CONFIG") ||
        waited >= 2000
      ) {
        clearInterval(iv);
        App.init();
      }
    }, 50);
});
