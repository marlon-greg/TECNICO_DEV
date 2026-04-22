// =======================================================
//  students.js — PAINEL DE GESTÃO DE ALUNOS
//  Docente vê todos os alunos, muda semestre, bloqueia
// =======================================================

var Students = (function () {
  var SEM_LABELS = { 1: "1º Sem", 2: "2º Sem", 3: "3º Sem", 4: "4º Sem" };

  function open() {
    document.getElementById("overlay-students").classList.add("open");
    load();
  }

  function close() {
    document.getElementById("overlay-students").classList.remove("open");
  }

  function load() {
    var container = document.getElementById("students-list");
    container.innerHTML =
      '<p class="empty-msg" style="padding:1rem">Carregando alunos...</p>';

    FB.getAlunos()
      .then(function (alunos) {
        if (alunos.length === 0) {
          container.innerHTML =
            '<p class="empty-msg" style="padding:1rem">Nenhum aluno cadastrado ainda.</p>';
          return;
        }

        // Ordena por nome
        alunos.sort(function (a, b) {
          return (a.nome || "").localeCompare(b.nome || "");
        });

        // Agrupa por semestre
        var porSem = { 1: [], 2: [], 3: [], 4: [] };
        var bloqueados = [];
        alunos.forEach(function (a) {
          if (a.ativo === false) {
            bloqueados.push(a);
            return;
          }
          var s = a.semestre || 1;
          if (!porSem[s]) porSem[s] = [];
          porSem[s].push(a);
        });

        var html = "";

        // Stats rápidas
        var ativos = alunos.filter(function (a) {
          return a.ativo !== false;
        }).length;
        html +=
          '<div class="students-stats">' +
          '<span class="stat-pill">&#128100; ' +
          ativos +
          " ativos</span>" +
          (bloqueados.length > 0
            ? '<span class="stat-pill stat-blocked">&#128274; ' +
              bloqueados.length +
              " bloqueados</span>"
            : "") +
          "</div>";

        // Por semestre
        [1, 2, 3, 4].forEach(function (sem) {
          var lista = porSem[sem];
          if (!lista || lista.length === 0) return;
          html +=
            '<div class="students-sem-title">' +
            sem +
            "º Semestre (" +
            lista.length +
            ")</div>";
          lista.forEach(function (a) {
            html += renderAluno(a);
          });
        });

        // Bloqueados
        if (bloqueados.length > 0) {
          html +=
            '<div class="students-sem-title" style="color:var(--red)">&#128274; Bloqueados (' +
            bloqueados.length +
            ")</div>";
          bloqueados.forEach(function (a) {
            html += renderAluno(a);
          });
        }

        container.innerHTML = html;
      })
      .catch(function (err) {
        container.innerHTML =
          '<p class="empty-msg" style="padding:1rem;color:var(--red)">Erro ao carregar: ' +
          err.message +
          "</p>";
      });
  }

  function renderAluno(a) {
    var ativo = a.ativo !== false;
    var semAtual = a.semestre || 1;
    var ultimoLogin = a.ultimo_login
      ? new Date(a.ultimo_login).toLocaleDateString("pt-BR")
      : "Nunca";

    return (
      '<div class="student-item' +
      (!ativo ? ' student-blocked" ' : '" ') +
      'data-uid="' +
      a.uid +
      '">' +
      '<div class="student-foto">' +
      (a.foto
        ? '<img src="' +
          a.foto +
          '" style="width:32px;height:32px;border-radius:50%">'
        : '<div class="student-avatar">' +
          (a.nome || "?")[0].toUpperCase() +
          "</div>") +
      "</div>" +
      '<div class="student-info">' +
      '<span class="student-nome">' +
      (a.nome || a.email) +
      "</span>" +
      '<span class="student-email">' +
      a.email +
      "</span>" +
      '<span class="student-meta">Último acesso: ' +
      ultimoLogin +
      "</span>" +
      "</div>" +
      '<div class="student-actions">' +
      '<select class="form-select student-sem-select" onchange="Students.setSemestre(\'' +
      a.uid +
      "', this.value)\" " +
      (ativo ? "" : "disabled ") +
      'style="width:auto;font-size:.75rem;padding:.2rem .4rem">' +
      [1, 2, 3, 4]
        .map(function (s) {
          return (
            '<option value="' +
            s +
            '"' +
            (s === semAtual ? " selected" : "") +
            ">" +
            s +
            "º Sem</option>"
          );
        })
        .join("") +
      "</select>" +
      '<button class="btn-sm ' +
      (ativo ? "danger-sm" : "btn-sm-mat") +
      '" ' +
      "onclick=\"Students.toggleAtivo('" +
      a.uid +
      "', " +
      ativo +
      ')">' +
      (ativo ? "&#128274; Bloquear" : "&#9989; Reativar") +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  function setSemestre(uid, sem) {
    FB.setSemestreAluno(uid, parseInt(sem))
      .then(function () {
        App.toast("Semestre atualizado!");
      })
      .catch(function () {
        App.toast("Erro ao atualizar semestre.");
      });
  }

  function toggleAtivo(uid, ativoAtual) {
    var novoAtivo = !ativoAtual;
    var msg = novoAtivo
      ? "Reativar este aluno?"
      : "Bloquear este aluno? Ele não conseguirá mais acessar.";
    if (!window.confirm(msg)) return;
    FB.setAtivoAluno(uid, novoAtivo)
      .then(function () {
        App.toast(novoAtivo ? "Aluno reativado!" : "Aluno bloqueado.");
        load();
      })
      .catch(function () {
        App.toast("Erro ao atualizar.");
      });
  }

  function refresh() {
    load();
  }

  return {
    open: open,
    close: close,
    setSemestre: setSemestre,
    toggleAtivo: toggleAtivo,
    refresh: refresh,
    excluirSelecionados: excluirSelecionados,
    selecionarTodos: selecionarTodos,
  };
})();
