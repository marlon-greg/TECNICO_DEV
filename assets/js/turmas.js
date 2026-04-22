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
      .find(function (s) {
        return s.id === semId;
      })
      .materias.find(function (m) {
        return m.id === matId;
      });
    var aula = mat.aulas.find(function (a) {
      return a.id === aulaId;
    });
    if (!aula) return;

    pubSemId = semId;
    pubMatId = matId;
    pubAula = aula;

    document.getElementById("pub-aula-nome").textContent = aula.titulo;
    renderTurmasCheckboxes();
    renderPublicacoesExistentes();
    document.getElementById("overlay-publicar").classList.add("open");
  }

  function fecharPublicar() {
    document.getElementById("overlay-publicar").classList.remove("open");
    pubSemId = pubMatId = pubAula = null;
  }

  function renderTurmasCheckboxes() {
    FB.getLinks().then(function (linksData) {
      var links = (linksData.links || []).filter(function (l) {
        return l.ativo;
      });
      var container = document.getElementById("pub-turmas-lista");

      if (links.length === 0) {
        container.innerHTML =
          '<p class="empty-msg">Nenhuma turma ativa. Gere links primeiro.</p>';
        return;
      }

      var html =
        '<label class="turma-check-item turma-todas">' +
        '<input type="checkbox" id="pub-todas" onchange="Turmas.toggleTodas(this)">' +
        '<span class="turma-check-label">&#127775; TODAS AS TURMAS</span>' +
        "</label>";

      links.forEach(function (l) {
        html +=
          '<label class="turma-check-item">' +
          '<input type="checkbox" class="pub-turma-cb" value="' +
          l.hash +
          '">' +
          '<span class="turma-check-label">' +
          "<strong>" +
          l.label +
          "</strong>" +
          ' <span class="link-sem-badge">' +
          l.sem +
          "º Sem</span>" +
          "</span>" +
          "</label>";
      });

      container.innerHTML = html;
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
    if (turmas.length === 0) {
      App.toast("Selecione ao menos uma turma.");
      return;
    }

    FB.publicarAula(pubSemId, pubMatId, pubAula, turmas)
      .then(function () {
        App.toast(
          "Publicado para " +
            (turmas[0] === "TODAS"
              ? "todas as turmas"
              : turmas.length + " turma(s)") +
            "!",
        );
        renderPublicacoesExistentes();
      })
      .catch(function (e) {
        App.toast("Erro ao publicar: " + e.message);
      });
  }

  // ── REUTILIZAR PUBLICAÇÃO ─────────────────────────────

  function renderPublicacoesExistentes() {
    var container = document.getElementById("pub-reutilizar-lista");
    container.innerHTML =
      '<p style="font-size:.75rem;color:var(--text-muted)">Carregando...</p>';

    FB.getTodasPublicacoes(pubSemId, pubMatId).then(function (pubs) {
      if (pubs.length === 0) {
        container.innerHTML =
          '<p class="empty-msg">Nenhuma publicação anterior nesta matéria.</p>';
        return;
      }

      var html = pubs
        .map(function (p) {
          var turmasLabel =
            p.turmas[0] === "TODAS" ? "Todas as turmas" : p.turmas.join(", ");
          var data = p.publicadoEm
            ? new Date(p.publicadoEm).toLocaleDateString("pt-BR")
            : "—";
          return (
            '<div class="reuse-item">' +
            '<div class="reuse-info">' +
            '<span class="reuse-titulo">' +
            (p.aula ? p.aula.titulo : p.aulaId) +
            "</span>" +
            '<span class="reuse-meta">&#128100; ' +
            turmasLabel +
            " &nbsp;&#128197; " +
            data +
            "</span>" +
            "</div>" +
            '<button class="btn-sm btn-sm-mat" onclick="Turmas.reutilizar(\'' +
            p._docId +
            "')\">Reutilizar</button>" +
            "</div>"
          );
        })
        .join("");

      container.innerHTML = html;
    });
  }

  function reutilizar(docId) {
    var turmas = getSelecionadas();
    if (turmas.length === 0) {
      App.toast("Selecione as turmas de destino antes de reutilizar.");
      return;
    }
    FB.reutilizarPublicacao(docId, turmas)
      .then(function () {
        App.toast("Publicação reutilizada!");
        renderPublicacoesExistentes();
      })
      .catch(function (e) {
        App.toast("Erro: " + e.message);
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
    reutilizar: reutilizar,
    abrirAlertas: abrirAlertas,
    fecharAlertas: fecharAlertas,
    marcarVisto: marcarVisto,
  };
})();
