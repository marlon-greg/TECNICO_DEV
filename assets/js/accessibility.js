// =======================================================
//  accessibility.js — PAINEL DE ACESSIBILIDADE
//  Salva preferências no localStorage automaticamente.
// =======================================================

var A11y = (function () {
  var STORAGE_KEY = "curso_a11y_prefs";
  var panelOpen = false;

  // ── PADRÕES ───────────────────────────────────────────
  var defaults = {
    theme: "light",
    font: "md",
    spacing: "normal",
    fontFamily: "sans",
  };

  // ── CARREGAR / SALVAR ─────────────────────────────────

  function loadPrefs() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : Object.assign({}, defaults);
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  // ── APLICAR ───────────────────────────────────────────

  function applyAll(prefs) {
    var html = document.documentElement;
    html.setAttribute("data-theme", prefs.theme);
    html.setAttribute("data-font", prefs.font);
    html.setAttribute("data-spacing", prefs.spacing);
    html.setAttribute("data-font-family", prefs.fontFamily);
    updateButtons(prefs);
  }

  function updateButtons(prefs) {
    // Tema
    document.querySelectorAll(".a11y-btn[data-theme]").forEach(function (btn) {
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-theme") === prefs.theme,
      );
    });
  }

  // ── AÇÕES PÚBLICAS ────────────────────────────────────

  function setTheme(theme) {
    var prefs = loadPrefs();
    prefs.theme = theme;
    savePrefs(prefs);
    applyAll(prefs);
  }

  function setFont(size) {
    var prefs = loadPrefs();
    prefs.font = size;
    savePrefs(prefs);
    applyAll(prefs);
  }

  function setSpacing(spacing) {
    var prefs = loadPrefs();
    prefs.spacing = spacing;
    savePrefs(prefs);
    applyAll(prefs);
  }

  function setFontFamily(family) {
    var prefs = loadPrefs();
    prefs.fontFamily = family;
    savePrefs(prefs);
    applyAll(prefs);
  }

  function toggle() {
    panelOpen = !panelOpen;
    var panel = document.getElementById("a11y-panel");
    if (panel) panel.classList.toggle("open", panelOpen);
  }

  // ── INIT ──────────────────────────────────────────────

  function init() {
    var prefs = loadPrefs();
    applyAll(prefs);

    // Fechar painel ao clicar fora
    document.addEventListener("click", function (e) {
      if (!panelOpen) return;
      var panel = document.getElementById("a11y-panel");
      var toggle = document.querySelector(".a11y-toggle");
      if (
        panel &&
        toggle &&
        !panel.contains(e.target) &&
        !toggle.contains(e.target)
      ) {
        panelOpen = false;
        panel.classList.remove("open");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    setTheme: setTheme,
    setFont: setFont,
    setSpacing: setSpacing,
    setFontFamily: setFontFamily,
    toggle: toggle,
  };
})();
