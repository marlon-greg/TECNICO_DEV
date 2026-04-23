// =======================================================
//  turmas.js — PUBLICAÇÃO POR TURMA + ALERTAS
//  - Publicar aula para turma(s) específica(s) ou TODAS
//  - Reutilizar publicação de outra turma
//  - Ver alertas de limite de vagas
// =======================================================

var Turmas = (function () {
  // ── PUBLICAR AULA ─────────────────────────────────────

  var pubSemId = null;
  var pubMatId = null;
  var pubAula = null;

  function abrirPublicar(semId, matId, aulaId) {
    var state = App.getState();
    var mat = state.semestres
      .find(function (s) { return s.id === semId; })
      .materias.find(function (m) { return m.id === matId; });
    var aula = mat.aulas.find(function (a) { return a.id === aulaId; });
    if (!aula) return;

    pubSemId = semId;
    pubMatId = matId;
    pubAula = aula;

    document.getElementById("pub-aula-nome").textContent = aula.titulo;
    document.getElementById("overlay-publicar").classList.add("open");

    FB.getPublicacaoAula(semId, matId, aulaId)
      .then(function (pub) {
        renderTurmasCheckboxes(pub ? pub.turmas : []);
      })
      .catch(function () {
        renderTurmasCheckboxes([]);
      });
  }

  function fecharPublicar() {
    document.getElementById("overlay-publicar").classList.remove("open");
    pubSemId = pubMatId = pubAula = null;
  }

  function renderTurmasCheckboxes(turmasAtivas) {
    var container = document.getElementById("pub-turmas-lista");
    container.innerHTML = '<p class="empty-msg">Carregando turmas...</p>';

    FB.getTurmasConfig()
      .then(function (lista) {
        var ativas = lista.filter(function (t) {
          return t.linkAtivo && t.hash;
        });

        if (ativas.length === 0) {
          container.innerHTML =
            '<p class="empty-msg">Nenhuma turma ativa. Crie turmas primeiro.</p>';
          return;
        }

        var todasChecked = turmasAtivas.indexOf("TODAS") >= 0;

        var html =
          '<label class="turma-check-item turma-todas">' +
          '<input type="checkbox" id="pub-todas"' +
          (todasChecked ? " checked" : "") +
          ' onchange="Turmas.toggleTodas(this)">' +
          '<span class="turma-check-label">&#127775; TODAS AS TURMAS</span>' +
          "</label>";

        ativas.forEach(function (t) {
          var checked = todasChecked || turmasAtivas.indexOf(t.hash) >= 0;
          html +=
            '<label class="turma-check-item">' +
            '<input type="checkbox" class="pub-turma-cb" value="' +
            t.hash +
            '"' +
            (checked ? " checked" : "") +
            (todasChecked ? " disabled" : "") +
            ">" +
            '<span class="turma-check-label">' +
            "<strong>" +
            t.nome +
            "</strong>" +
            ' <span class="link-sem-badge">' +
            t.semestre +
            "º Sem</span>" +
            "</span>" +
            "</label>";
        });

        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML =
          '<p class="empty-msg" style="color:var(--red)">Erro ao carregar turmas.</p>';
      });
  }

  function toggleTodas(cb) {
    var todas = document.querySelectorAll(".pub-turma-cb");
    todas.forEach(function (el) {
      el.checked = false;
      el.disabled = cb.checked;
    });
  }

  function getSelecionadas() {
    if (
      document.getElementById("pub-todas") &&
      document.getElementById("pub-todas").checked
    ) {
      return ["TODAS"];
    }
    var selecionadas = [];
    document.querySelectorAll(".pub-turma-cb:checked").forEach(function (el) {
      selecionadas.push(el.value);
    });
    return selecionadas;
  }

  function confirmarPublicacao() {
    var turmas = getSelecionadas();

    FB.publicarAula(pubSemId, pubMatId, pubAula, turmas)
      .then(function () {
        var msg =
          turmas.length === 0
            ? "Aula ocultada de todas as turmas."
            : "Acesso salvo para " +
              (turmas[0] === "TODAS"
                ? "todas as turmas"
                : turmas.length + " turma(s)") +
              ".";
        App.toast(msg);
        fecharPublicar();
      })
      .catch(function (e) {
        App.toast("Erro ao salvar: " + e.message);
      });
  }

  // ── PAINEL DE ALERTAS ─────────────────────────────────

  function abrirAlertas() {
    document.getElementById("overlay-alertas").classList.add("open");
    carregarAlertas();
  }

  function fecharAlertas() {
    document.getElementById("overlay-alertas").classList.remove("open");
  }

  function carregarAlertas() {
    var container = document.getElementById("alertas-lista");
    container.innerHTML =
      '<p class="empty-msg" style="padding:1rem">Carregando...</p>';

    FB.getAlertas().then(function (alertas) {
      if (alertas.length === 0) {
        container.innerHTML =
          '<p class="empty-msg" style="padding:1rem">Nenhum alerta. Tudo tranquilo! ✅</p>';
        return;
      }

      var html = alertas
        .map(function (a) {
          var data = new Date(a.timestamp).toLocaleString("pt-BR");
          var icon = a.tipo === "limite_turma" ? "⚠️" : "ℹ️";
          return (
            '<div class="alerta-item' +
            (a.visto ? " alerta-visto" : "") +
            '">' +
            '<div class="alerta-icon">' +
            icon +
            "</div>" +
            '<div class="alerta-info">' +
            '<span class="alerta-msg">' +
            (a.tipo === "limite_turma"
              ? "Turma <strong>" +
                a.turma +
                "</strong> atingiu o limite. Tentativa de acesso por <strong>" +
                a.email +
                "</strong>"
              : a.mensagem || "Alerta") +
            "</span>" +
            '<span class="alerta-data">' +
            data +
            "</span>" +
            "</div>" +
            (!a.visto
              ? '<button class="btn-sm" onclick="Turmas.marcarVisto(\'' +
                a.id +
                "', this)\">OK</button>"
              : '<span style="font-size:.65rem;color:var(--text-faint)">Visto</span>') +
            "</div>"
          );
        })
        .join("");

      container.innerHTML = html;
      // Atualiza badge
      atualizarBadgeAlertas(
        alertas.filter(function (a) {
          return !a.visto;
        }).length,
      );
    });
  }

  function marcarVisto(id, btn) {
    FB.marcarAlertaVisto(id).then(function () {
      var item = btn.closest(".alerta-item");
      item.classList.add("alerta-visto");
      btn.outerHTML =
        '<span style="font-size:.65rem;color:var(--text-faint)">Visto</span>';
      // Atualiza badge
      var naovisto = document.querySelectorAll(
        ".alerta-item:not(.alerta-visto)",
      ).length;
      atualizarBadgeAlertas(naovisto);
    });
  }

  function atualizarBadgeAlertas(count) {
    var badge = document.getElementById("alertas-badge");
    if (!badge) return;
    badge.textContent = count > 0 ? count : "";
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }

  function verificarAlertas() {
    if (!window.FIREBASE_CONFIG || !FB.isDocente()) return;
    FB.getAlertas()
      .then(function (alertas) {
        var naovisto = alertas.filter(function (a) {
          return !a.visto;
        }).length;
        atualizarBadgeAlertas(naovisto);
      })
      .catch(function () {});
  }

  function init() {
    // Verifica alertas ao iniciar (só admin)
    setTimeout(verificarAlertas, 3000);
  }

  return {
    init: init,
    abrirPublicar: abrirPublicar,
    fecharPublicar: fecharPublicar,
    confirmarPublicacao: confirmarPublicacao,
    toggleTodas: toggleTodas,
    abrirAlertas: abrirAlertas,
    fecharAlertas: fecharAlertas,
    marcarVisto: marcarVisto,
  };
})();

// =======================================================
//  TurmasAdmin — PAINEL DE GESTÃO DE TURMAS
// =======================================================

var TurmasAdmin = (function () {
  var turmasList = [];
  var viewingTurma = null;

  var SEM_LABELS = { 1: "1º Sem", 2: "2º Sem", 3: "3º Sem", 4: "4º Sem" };

  // ── ABRIR / FECHAR ────────────────────────────────────

  function open() {
    if (!window.FIREBASE_CONFIG || !FB.isDocente()) return;
    document.getElementById("overlay-turmas-admin").classList.add("open");
    load();
  }

  function close() {
    document.getElementById("overlay-turmas-admin").classList.remove("open");
    viewingTurma = null;
  }

  // ── CARREGAR TURMAS ───────────────────────────────────

  function load() {
    var container = document.getElementById("turmas-admin-list");
    container.innerHTML = '<p class="empty-msg">Carregando...</p>';
    FB.getTurmasConfig()
      .then(function (lista) {
        turmasList = lista;
        syncToLinkManager(lista);
        renderList();
      })
      .catch(function () {
        container.innerHTML =
          '<p class="empty-msg" style="color:var(--red)">Erro ao carregar turmas.</p>';
      });
  }

  function syncToLinkManager(lista) {
    lista.forEach(function (t) {
      if (t.hash && t.linkAtivo) {
        LinkManager.addLinkToDb({
          hash: t.hash,
          sem: t.semestre,
          token: t.token || "senai2026",
          label: t.nome,
          criado: t.criado
            ? new Date(t.criado).toLocaleDateString("pt-BR")
            : "—",
          ativo: true,
        });
      } else if (t.hash && !t.linkAtivo) {
        LinkManager.removeLinkFromDb(t.hash);
      }
    });
  }

  // ── RENDERIZAR LISTA ──────────────────────────────────

  function renderList() {
    var container = document.getElementById("turmas-admin-list");

    if (turmasList.length === 0) {
      container.innerHTML =
        '<p class="empty-msg" style="padding:1rem">Nenhuma turma criada. Crie a primeira acima!</p>';
      return;
    }

    var html = turmasList
      .map(function (t) {
        var linkHtml = "";
        if (t.hash && t.linkAtivo) {
          var url = LinkManager.buildUrl(t.hash);
          linkHtml =
            '<div class="ta-link-row">' +
            '<code class="link-url ta-link-url">' +
            url +
            "</code>" +
            '<button class="btn-sm btn-sm-mat" onclick="TurmasAdmin.copiarLink(\'' +
            t.hash +
            "')\">\u{1F4CB} Copiar</button>" +
            "</div>" +
            '<div class="ta-actions">' +
            '<button class="btn-sm" onclick="TurmasAdmin.verAlunos(\'' +
            t.id +
            "')\">\u{1F465} Ver alunos</button>" +
            '<button class="btn-sm" onclick="TurmasAdmin.regerarLink(\'' +
            t.id +
            "')\">\u{21BB} Regen. link</button>" +
            '<button class="btn-sm danger-sm" onclick="TurmasAdmin.revogarLink(\'' +
            t.id +
            "')\">\u{1F512} Revogar link</button>" +
            '<button class="btn-sm danger-sm" onclick="TurmasAdmin.excluirTurma(\'' +
            t.id +
            "')\">\u{1F5D1} Excluir turma</button>" +
            "</div>";
        } else {
          linkHtml =
            '<div class="ta-no-link">Sem link ativo</div>' +
            '<div class="ta-actions">' +
            '<button class="btn-sm" onclick="TurmasAdmin.verAlunos(\'' +
            t.id +
            "')\">\u{1F465} Ver alunos</button>" +
            '<button class="btn-sm btn-sm-mat" onclick="TurmasAdmin.gerarLink(\'' +
            t.id +
            "')\">\u{1F517} Gerar link</button>" +
            '<button class="btn-sm danger-sm" onclick="TurmasAdmin.excluirTurma(\'' +
            t.id +
            "')\">\u{1F5D1} Excluir turma</button>" +
            "</div>";
        }

        return (
          '<div class="ta-turma-item">' +
          '<div class="ta-turma-header">' +
          '<span class="ta-turma-nome">' +
          t.nome +
          "</span>" +
          '<span class="link-sem-badge">' +
          (SEM_LABELS[t.semestre] || t.semestre + "º Sem") +
          "</span>" +
          '<span class="ta-aluno-count" id="ta-count-' +
          t.id +
          '">\u{1F465} —</span>' +
          "</div>" +
          linkHtml +
          "</div>"
        );
      })
      .join("");

    container.innerHTML = html;

    turmasList.forEach(function (t) {
      if (!t.hash) {
        var el = document.getElementById("ta-count-" + t.id);
        if (el) el.textContent = "👥 0 aluno(s)";
        return;
      }
      FB.getAlunosDaTurma(t.hash)
        .then(function (alunos) {
          var el = document.getElementById("ta-count-" + t.id);
          if (el) el.textContent = "👥 " + alunos.length + " aluno(s)";
        })
        .catch(function () {});
    });
  }

  // ── CRIAR TURMA ───────────────────────────────────────

  function criarTurma() {
    var nome = document.getElementById("ta-nova-nome").value.trim();
    var sem = parseInt(document.getElementById("ta-nova-sem").value);
    if (!nome) {
      App.toast("Digite o nome da turma.");
      return;
    }
    var id = "turma_" + Date.now().toString(36);
    var turma = {
      id: id,
      nome: nome,
      semestre: sem,
      criado: new Date().toISOString(),
      hash: null,
      token: null,
      linkAtivo: false,
    };
    FB.saveTurmaConfig(turma)
      .then(function () {
        document.getElementById("ta-nova-nome").value = "";
        App.toast('Turma "' + nome + '" criada!');
        load();
      })
      .catch(function (e) {
        App.toast("Erro ao criar turma: " + e.message);
      });
  }

  // ── GERAR / REGEN / REVOGAR LINK ─────────────────────

  function gerarLink(turmaId) {
    var turma = turmasList.find(function (t) { return t.id === turmaId; });
    if (!turma) return;
    turma.hash = gerarHash();
    turma.token = "senai2026";
    turma.linkAtivo = true;
    FB.saveTurmaConfig(turma)
      .then(function () {
        App.toast("Link gerado para " + turma.nome + "!");
        load();
      })
      .catch(function (e) { App.toast("Erro: " + e.message); });
  }

  function regerarLink(turmaId) {
    if (
      !window.confirm(
        "Gerar um novo link invalida o link atual.\nAlunos com o link antigo não conseguirão mais entrar.\n\nContinuar?"
      )
    )
      return;
    var turma = turmasList.find(function (t) { return t.id === turmaId; });
    if (!turma) return;
    if (turma.hash) LinkManager.removeLinkFromDb(turma.hash);
    turma.hash = gerarHash();
    turma.token = "senai2026";
    turma.linkAtivo = true;
    FB.saveTurmaConfig(turma)
      .then(function () {
        App.toast("Novo link gerado!");
        load();
      })
      .catch(function (e) { App.toast("Erro: " + e.message); });
  }

  function revogarLink(turmaId) {
    if (
      !window.confirm(
        "Revogar o link desta turma?\nAlunos já cadastrados continuam com acesso, mas ninguém novo entra por este link."
      )
    )
      return;
    var turma = turmasList.find(function (t) { return t.id === turmaId; });
    if (!turma) return;
    if (turma.hash) LinkManager.removeLinkFromDb(turma.hash);
    turma.linkAtivo = false;
    FB.saveTurmaConfig(turma)
      .then(function () {
        App.toast("Link revogado.");
        load();
      })
      .catch(function (e) { App.toast("Erro: " + e.message); });
  }

  function excluirTurma(turmaId) {
    var turma = turmasList.find(function (t) { return t.id === turmaId; });
    if (!turma) return;
    if (
      !window.confirm(
        'Excluir a turma "' +
          turma.nome +
          '"?\nOs alunos vinculados não serão excluídos, mas perderão a referência de turma.'
      )
    )
      return;
    if (turma.hash) LinkManager.removeLinkFromDb(turma.hash);
    FB.deleteTurmaConfig(turmaId)
      .then(function () {
        App.toast("Turma excluída.");
        load();
      })
      .catch(function (e) { App.toast("Erro: " + e.message); });
  }

  function copiarLink(hash) {
    var url = LinkManager.buildUrl(hash);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        App.toast("Link copiado!");
      });
    } else {
      var ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      App.toast("Link copiado!");
    }
  }

  // ── VER ALUNOS ────────────────────────────────────────

  function verAlunos(turmaId) {
    viewingTurma = turmasList.find(function (t) { return t.id === turmaId; });
    if (!viewingTurma) return;
    document.getElementById("turmas-admin-list-view").style.display = "none";
    document.getElementById("turmas-admin-alunos-view").style.display = "";
    document.getElementById("ta-alunos-titulo").textContent =
      "Alunos — " + viewingTurma.nome;

    var container = document.getElementById("ta-alunos-lista");
    if (!viewingTurma.hash) {
      container.innerHTML =
        '<p class="empty-msg">Nenhum link gerado para esta turma ainda.</p>';
      return;
    }
    container.innerHTML = '<p class="empty-msg">Carregando...</p>';
    FB.getAlunosDaTurma(viewingTurma.hash)
      .then(function (alunos) {
        if (alunos.length === 0) {
          container.innerHTML =
            '<p class="empty-msg">Nenhum aluno nesta turma ainda.</p>';
          return;
        }
        container.innerHTML = alunos
          .map(function (a) {
            return (
              '<div class="ta-aluno-item' +
              (!a.ativo ? " ta-aluno-inativo" : "") +
              '">' +
              (a.foto
                ? '<img src="' + a.foto + '" class="ta-aluno-foto">'
                : '<div class="ta-aluno-foto ta-aluno-foto-placeholder">&#128100;</div>') +
              '<div class="ta-aluno-info">' +
              '<span class="ta-aluno-nome">' +
              (a.nome || a.email) +
              "</span>" +
              '<span class="ta-aluno-email">' +
              a.email +
              "</span>" +
              "</div>" +
              '<div class="ta-aluno-actions">' +
              '<span class="link-sem-badge">' +
              (a.semestre || 1) +
              "º Sem</span>" +
              '<button class="btn-sm ' +
              (a.ativo ? "danger-sm" : "btn-sm-mat") +
              '" onclick="TurmasAdmin.toggleAluno(\'' +
              a.uid +
              "'," +
              !a.ativo +
              ')">' +
              (a.ativo ? "&#128274; Bloquear" : "&#9989; Liberar") +
              "</button>" +
              "</div>" +
              "</div>"
            );
          })
          .join("");
      })
      .catch(function () {
        container.innerHTML =
          '<p class="empty-msg" style="color:var(--red)">Erro ao carregar alunos.</p>';
      });
  }

  function voltarLista() {
    document.getElementById("turmas-admin-list-view").style.display = "";
    document.getElementById("turmas-admin-alunos-view").style.display = "none";
    viewingTurma = null;
  }

  function toggleAluno(uid, ativo) {
    FB.setAtivoAluno(uid, ativo)
      .then(function () {
        App.toast(ativo ? "Aluno liberado." : "Aluno bloqueado.");
        verAlunos(viewingTurma.id);
      })
      .catch(function (e) { App.toast("Erro: " + e.message); });
  }

  // ── HELPER: GERAR HASH ────────────────────────────────

  function gerarHash() {
    var chars = "abcdefghjkmnpqrstuvwxyz23456789";
    var result = "";
    for (var i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    var exists = turmasList.find(function (t) { return t.hash === result; });
    return exists ? gerarHash() : result;
  }

  return {
    open: open,
    close: close,
    criarTurma: criarTurma,
    gerarLink: gerarLink,
    regerarLink: regerarLink,
    revogarLink: revogarLink,
    excluirTurma: excluirTurma,
    copiarLink: copiarLink,
    verAlunos: verAlunos,
    voltarLista: voltarLista,
    toggleAluno: toggleAluno,
  };
})();
