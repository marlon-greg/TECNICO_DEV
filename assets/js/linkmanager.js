// =======================================================
//  linkmanager.js — GERENCIADOR DE LINKS DE ACESSO
//
//  Fluxo:
//  1. Admin gera link aleatório → mapeia hash → {sem, token, label}
//  2. Salva em localStorage + exporta para links.json
//  3. Aluno acessa /#hash → portal resolve e libera semestre
//  4. Admin pode revogar qualquer link a qualquer hora
// =======================================================

var LinkManager = (function () {
  var STORAGE_KEY = "curso_links_v1";
  var TOKEN_KEY = "curso_global_token_v1";
  var LINKS_JSON = "links.json";

  var db = null; // { token_global, links: [{hash, sem, token, label, criado, ativo}] }
  var resolved = null; // link resolvido para esta sessão

  // ── INIT ──────────────────────────────────────────────

  function init(onReady) {
    // 1. Tenta carregar do localStorage
    var local = loadLocal();

    // 2. Tenta carregar links.json do servidor (sobrescreve se mais novo)
    fetch(LINKS_JSON + "?_=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (remote) {
        // Mescla: mantém links locais não presentes no remoto
        db = mergeDb(local, remote);
        saveLocal();
        resolveHash(onReady);
      })
      .catch(function () {
        // Offline ou arquivo não existe ainda — usa só local
        db = local || { token_global: "senai2026", links: [] };
        resolveHash(onReady);
      });
  }

  function loadLocal() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {}
  }

  function mergeDb(local, remote) {
    if (!local) return remote;
    // remote é a fonte de verdade; links locais extras são preservados
    var merged = JSON.parse(JSON.stringify(remote));
    (local.links || []).forEach(function (ll) {
      var exists = merged.links.find(function (rl) {
        return rl.hash === ll.hash;
      });
      if (!exists) merged.links.push(ll);
    });
    return merged;
  }

  // ── RESOLVER HASH DA URL ──────────────────────────────

  function resolveHash(onReady) {
    var hash = window.location.hash.replace("#", "").trim();

    if (!hash) {
      // Sem hash — se tem Firebase e usuário é docente, passa direto
      if (
        window.FIREBASE_CONFIG &&
        typeof FB !== "undefined" &&
        FB.isDocente()
      ) {
        resolved = null;
        if (onReady) onReady(null);
        return;
      }
      // Sem Firebase: verifica ?sem= ou ?admin=
      var params = new URLSearchParams(window.location.search);
      if (!params.has("sem") && !params.has("admin")) {
        // Sem Firebase configurado → abre como admin local
        if (!window.FIREBASE_CONFIG) {
          resolved = null;
          if (onReady) onReady(null);
          return;
        }
        showBlockedScreen("Acesse pelo link fornecido pelo seu professor.");
        return;
      }
      resolved = null;
      if (onReady) onReady(null);
      return;
    }

    // Busca hash no banco
    var link = db.links.find(function (l) {
      return l.hash === hash && l.ativo;
    });

    if (!link) {
      showBlockedScreen("Este link não é válido ou foi revogado.");
      return;
    }

    // Valida token do link contra token global
    if (link.token !== db.token_global) {
      showBlockedScreen(
        "Este link foi desativado. Solicite um novo ao professor.",
      );
      return;
    }

    resolved = link;

    // Injeta parâmetros sem mostrar na URL
    if (onReady) onReady(link);
  }

  function getResolved() {
    return resolved;
  }

  // ── TELA DE BLOQUEIO ──────────────────────────────────

  function showBlockedScreen(msg) {
    document.body.innerHTML =
      '<div style="' +
      "font-family:system-ui,sans-serif;" +
      "min-height:100vh;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;" +
      "background:#f5f5f0;color:#1a1a2e;text-align:center;padding:2rem" +
      '">' +
      '<div style="background:#c8102e;color:#fff;font-weight:700;' +
      "padding:.4rem .9rem;border-radius:4px;margin-bottom:1.5rem;" +
      'font-size:1rem;letter-spacing:.04em">SENAI</div>' +
      '<div style="font-size:2rem;margin-bottom:1rem">🔒</div>' +
      '<h2 style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem">' +
      "Acesso Restrito" +
      "</h2>" +
      '<p style="font-size:.85rem;color:#666;max-width:320px">' +
      msg +
      "</p>" +
      "</div>";
  }

  // ── GERADOR DE HASH ───────────────────────────────────

  function generateHash(len) {
    len = len || 8;
    var chars = "abcdefghjkmnpqrstuvwxyz23456789"; // sem chars ambíguos (0,o,1,l,i)
    var result = "";
    for (var i = 0; i < len; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    // Garante unicidade
    var exists = db.links.find(function (l) {
      return l.hash === result;
    });
    return exists ? generateHash(len) : result;
  }

  // ── ADMIN: GERENCIAR LINKS ────────────────────────────

  function openAdmin() {
    renderAdminModal();
    document.getElementById("overlay-links").classList.add("open");
  }

  function closeAdmin() {
    document.getElementById("overlay-links").classList.remove("open");
  }

  function createLink() {
    var sem = parseInt(document.getElementById("new-link-sem").value);
    var label = document.getElementById("new-link-label").value.trim();
    if (!label) {
      App.toast("Coloque um nome para identificar este link.");
      return;
    }

    var hash = generateHash(8);
    var link = {
      hash: hash,
      sem: sem,
      token: db.token_global,
      label: label,
      criado: new Date().toLocaleDateString("pt-BR"),
      ativo: true,
    };

    db.links.push(link);
    saveLocal();
    renderAdminModal();
    App.toast("Link gerado! Copie e envie para os alunos.");
  }

  function revokeLink(hash) {
    var link = db.links.find(function (l) {
      return l.hash === hash;
    });
    if (!link) return;
    if (
      !window.confirm(
        'Revogar link "' +
          link.label +
          '"?\nQuem tiver este link não conseguirá mais acessar.',
      )
    )
      return;
    link.ativo = false;
    saveLocal();
    renderAdminModal();
    App.toast("Link revogado.");
  }

  function reactivateLink(hash) {
    var link = db.links.find(function (l) {
      return l.hash === hash;
    });
    if (!link) return;
    link.token = db.token_global; // atualiza para o token atual
    link.ativo = true;
    saveLocal();
    renderAdminModal();
    App.toast("Link reativado.");
  }

  function deleteLink(hash) {
    if (!window.confirm("Excluir este link permanentemente?")) return;
    db.links = db.links.filter(function (l) {
      return l.hash !== hash;
    });
    saveLocal();
    renderAdminModal();
    App.toast("Link excluído.");
  }

  function rotateToken() {
    if (
      !window.confirm(
        "Rodar o token global vai REVOGAR TODOS os links ativos.\n" +
          "Você precisará reativar os links que quiser manter.\n\nContinuar?",
      )
    )
      return;
    // Gera novo token aleatório
    db.token_global = generateHash(12);
    saveLocal();
    renderAdminModal();
    App.toast("Token rotacionado. Todos os links foram invalidados.");
  }

  function buildUrl(hash) {
    var base = window.location.href.split("#")[0].split("?")[0];
    return base + "#" + hash;
  }

  function copyLink(hash) {
    var url = buildUrl(hash);
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

  function exportJson() {
    // Gera o conteúdo do links.json para o usuário subir no GitHub
    var json = JSON.stringify(db, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "links.json";
    a.click();
    URL.revokeObjectURL(url);
    App.toast("links.json baixado! Suba no repositório GitHub.");
  }

  // ── RENDER DO PAINEL ──────────────────────────────────

  var SEM_LABELS = {
    1: "1º Semestre",
    2: "2º Semestre",
    3: "3º Semestre",
    4: "4º Semestre",
  };

  function renderAdminModal() {
    var container = document.getElementById("links-list");
    if (!container) return;

    var ativos = db.links.filter(function (l) {
      return l.ativo;
    });
    var inativos = db.links.filter(function (l) {
      return !l.ativo;
    });

    var html = "";

    if (db.links.length === 0) {
      html =
        '<p class="empty-msg" style="padding:.8rem">Nenhum link gerado ainda.</p>';
    } else {
      // Ativos
      if (ativos.length > 0) {
        html +=
          '<div class="links-section-title">&#9989; Ativos (' +
          ativos.length +
          ")</div>";
        ativos.forEach(function (l) {
          var url = buildUrl(l.hash);
          html +=
            '<div class="link-item link-item-active">' +
            '<div class="link-info">' +
            '<span class="link-label">' +
            l.label +
            "</span>" +
            '<span class="link-sem-badge">' +
            (SEM_LABELS[l.sem] || l.sem + "º Sem") +
            "</span>" +
            '<span class="link-date">Criado: ' +
            l.criado +
            "</span>" +
            "</div>" +
            '<div class="link-url-row">' +
            '<code class="link-url">' +
            url +
            "</code>" +
            '<button class="btn-sm btn-sm-mat" onclick="LinkManager.copyLink(\'' +
            l.hash +
            "')\">&#128203; Copiar</button>" +
            "</div>" +
            '<div class="link-actions">' +
            '<button class="btn-sm" onclick="LinkManager.revokeLink(\'' +
            l.hash +
            "')\">&#128274; Revogar</button>" +
            '<button class="btn-sm danger-sm" onclick="LinkManager.deleteLink(\'' +
            l.hash +
            "')\">&#128465; Excluir</button>" +
            "</div>" +
            "</div>";
        });
      }

      // Inativos
      if (inativos.length > 0) {
        html +=
          '<div class="links-section-title" style="margin-top:.8rem">&#128274; Revogados (' +
          inativos.length +
          ")</div>";
        inativos.forEach(function (l) {
          html +=
            '<div class="link-item link-item-inactive">' +
            '<div class="link-info">' +
            '<span class="link-label" style="opacity:.5">' +
            l.label +
            "</span>" +
            '<span class="link-sem-badge" style="opacity:.5">' +
            (SEM_LABELS[l.sem] || l.sem + "º Sem") +
            "</span>" +
            '<span class="link-date">Criado: ' +
            l.criado +
            "</span>" +
            "</div>" +
            '<div class="link-actions">' +
            '<button class="btn-sm btn-sm-mat" onclick="LinkManager.reactivateLink(\'' +
            l.hash +
            "')\">&#9989; Reativar</button>" +
            '<button class="btn-sm danger-sm" onclick="LinkManager.deleteLink(\'' +
            l.hash +
            "')\">&#128465; Excluir</button>" +
            "</div>" +
            "</div>";
        });
      }
    }

    container.innerHTML = html;
  }

  return {
    init: init,
    getResolved: getResolved,
    openAdmin: openAdmin,
    closeAdmin: closeAdmin,
    createLink: createLink,
    revokeLink: revokeLink,
    reactivateLink: reactivateLink,
    deleteLink: deleteLink,
    rotateToken: rotateToken,
    copyLink: copyLink,
    exportJson: exportJson,
    buildUrl: buildUrl,
  };
})();
