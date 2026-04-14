// =======================================================
//  schedule.js — CRONOGRAMA E OCULTAÇÃO DE AULAS
//  Gerencia: aulas/dia por matéria, data início,
//  previsão de término e visibilidade de aulas.
// =======================================================

var Schedule = (function () {
  var STORAGE_KEY = "curso_schedule_v1";

  // ── DADOS PADRÃO (baseados na planilha HORARIOS_2026) ─
  // aulas_dia: aulas de 45min por dia de aula
  // dias_semana: quantos dias por semana a matéria aparece
  var DEFAULTS = {
    logica: { aulas_dia: 5, dias_semana: 2 },
    so: { aulas_dia: 6, dias_semana: 2 },
    redes: { aulas_dia: 5, dias_semana: 2 },
    req: { aulas_dia: 4, dias_semana: 2 },
    back: { aulas_dia: 7, dias_semana: 2 },
    proj1: { aulas_dia: 3, dias_semana: 2 },
    bd: { aulas_dia: 5, dias_semana: 2 },
    html: { aulas_dia: 5, dias_semana: 2 },
    front: { aulas_dia: 5, dias_semana: 2 },
    back2: { aulas_dia: 5, dias_semana: 2 },
    mobile: { aulas_dia: 4, dias_semana: 2 },
    proj2: { aulas_dia: 1, dias_semana: 2 },
    iot: { aulas_dia: 5, dias_semana: 2 },
    front2: { aulas_dia: 5, dias_semana: 2 },
    mobile2: { aulas_dia: 4, dias_semana: 2 },
    testes: { aulas_dia: 3, dias_semana: 2 },
    proj3: { aulas_dia: 5, dias_semana: 2 },
    back3: { aulas_dia: 3, dias_semana: 2 },
  };

  var cfg = null; // configuração carregada

  // ── CARREGAR / SALVAR ─────────────────────────────────

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      cfg = saved ? JSON.parse(saved) : buildDefault();
    } catch (e) {
      cfg = buildDefault();
    }
  }

  function buildDefault() {
    return {
      semestres: {
        s1: { data_inicio: "", dias_sem: [] },
        s2: { data_inicio: "", dias_sem: [] },
        s3: { data_inicio: "", dias_sem: [] },
        s4: { data_inicio: "", dias_sem: [] },
      },
      materias: JSON.parse(JSON.stringify(DEFAULTS)),
      ocultas: {}, // { "semId|matId|aulaId": true }
    };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function getConfig() {
    return cfg;
  }

  // ── CÁLCULO DE SEMANAS ────────────────────────────────

  // ch em horas → aulas de 45min
  function horasToAulas45(ch) {
    var n = parseFloat(String(ch).replace("h", ""));
    return Math.ceil((n * 60) / 45);
  }

  // Dado matId e ch, calcula quantas semanas a matéria dura
  function calcSemanas(matId, ch) {
    var m = cfg.materias[matId] || { aulas_dia: 5, dias_semana: 2 };
    var totalAulas = horasToAulas45(ch);
    var aulasSemanais = m.aulas_dia * m.dias_semana;
    return Math.ceil(totalAulas / aulasSemanais);
  }

  // Soma N semanas úteis a partir de uma data (pula fins de semana)
  function addWeeks(dateStr, weeks) {
    if (!dateStr) return null;
    var d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return null;
    var dias = weeks * 7;
    d.setDate(d.getDate() + dias);
    return d;
  }

  function formatDate(d) {
    if (!d) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // Retorna { semanas, inicio, fim, aulasTotais, aulasSemanais }
  function getPrevisao(matId, ch) {
    var semanas = calcSemanas(matId, ch);
    var semCfg = getSemFromMat(matId);
    var inicio = semCfg ? semCfg.data_inicio : "";
    var fim = addWeeks(inicio, semanas);
    var m = cfg.materias[matId] || { aulas_dia: 5, dias_semana: 2 };
    return {
      semanas: semanas,
      inicio: inicio,
      fim: fim,
      aulasTotais: horasToAulas45(ch),
      aulasSemanais: m.aulas_dia * m.dias_semana,
      aulasDia: m.aulas_dia,
      diasSemana: m.dias_semana,
    };
  }

  // Descobre o semestre de uma matéria pelo state do App
  function getSemFromMat(matId) {
    var state = App.getState();
    if (!state) return null;
    for (var i = 0; i < state.semestres.length; i++) {
      var sem = state.semestres[i];
      for (var j = 0; j < sem.materias.length; j++) {
        if (sem.materias[j].id === matId) {
          return cfg.semestres[sem.id] || null;
        }
      }
    }
    return null;
  }

  // ── OCULTAÇÃO DE AULAS ────────────────────────────────

  function aulaKey(semId, matId, aulaId) {
    return semId + "|" + matId + "|" + aulaId;
  }

  function isOculta(semId, matId, aulaId) {
    return !!(cfg.ocultas && cfg.ocultas[aulaKey(semId, matId, aulaId)]);
  }

  function toggleOculta(semId, matId, aulaId) {
    var k = aulaKey(semId, matId, aulaId);
    if (cfg.ocultas[k]) {
      delete cfg.ocultas[k];
    } else {
      cfg.ocultas[k] = true;
    }
    save();
  }

  function ocultarTodas(semId, matId) {
    var state = App.getState();
    var mat = state.semestres
      .find(function (s) {
        return s.id === semId;
      })
      .materias.find(function (m) {
        return m.id === matId;
      });
    mat.aulas.forEach(function (a) {
      cfg.ocultas[aulaKey(semId, matId, a.id)] = true;
    });
    save();
  }

  function mostrarTodas(semId, matId) {
    var state = App.getState();
    var mat = state.semestres
      .find(function (s) {
        return s.id === semId;
      })
      .materias.find(function (m) {
        return m.id === matId;
      });
    mat.aulas.forEach(function (a) {
      delete cfg.ocultas[aulaKey(semId, matId, a.id)];
    });
    save();
  }

  // Conta aulas visíveis de uma matéria
  function aulasVisiveis(semId, mat) {
    return mat.aulas.filter(function (a) {
      return !isOculta(semId, mat.id, a.id);
    });
  }

  // ── PAINEL ADMIN: CRONOGRAMA ──────────────────────────

  function openCronogramaModal(semId, matId, matNome, matCh) {
    var modal = document.getElementById("overlay-schedule");
    if (!modal) return;

    var prev = getPrevisao(matId, matCh);
    var matCfg = cfg.materias[matId] || { aulas_dia: 5, dias_semana: 2 };
    var semCfg = cfg.semestres[semId] || { data_inicio: "" };

    document.getElementById("sch-mat-nome").textContent = matNome;
    document.getElementById("sch-mat-id").value = matId;
    document.getElementById("sch-sem-id").value = semId;
    document.getElementById("sch-mat-ch").value = matCh;
    document.getElementById("sch-aulas-dia").value = matCfg.aulas_dia;
    document.getElementById("sch-dias-sem").value = matCfg.dias_semana;
    document.getElementById("sch-data-inicio").value = semCfg.data_inicio || "";

    updatePrevisaoUI(prev, matCh);
    modal.classList.add("open");
  }

  function updatePrevisaoUI(prev, ch) {
    document.getElementById("sch-prev-semanas").textContent =
      prev.semanas + " semanas";
    document.getElementById("sch-prev-aulas").textContent =
      prev.aulasTotais + " aulas de 45min";
    document.getElementById("sch-prev-semana").textContent =
      prev.aulasSemanais +
      " aulas/semana (" +
      prev.aulasDia +
      "/dia × " +
      prev.diasSemana +
      " dias)";
    document.getElementById("sch-prev-inicio").textContent = prev.inicio
      ? new Date(prev.inicio + "T12:00:00").toLocaleDateString("pt-BR")
      : "—";
    document.getElementById("sch-prev-fim").textContent = formatDate(prev.fim);
  }

  // Chamado ao mudar qualquer campo do modal (atualiza previsão em tempo real)
  function recalcPrevisao() {
    var matId = document.getElementById("sch-mat-id").value;
    var ch = document.getElementById("sch-mat-ch").value;
    var adia = parseInt(document.getElementById("sch-aulas-dia").value) || 5;
    var dsem = parseInt(document.getElementById("sch-dias-sem").value) || 2;
    var inicio = document.getElementById("sch-data-inicio").value;

    // Aplica temporariamente para calcular
    var fake = { aulas_dia: adia, dias_semana: dsem };
    var semanas = Math.ceil(horasToAulas45(ch) / (adia * dsem));
    var fim = addWeeks(inicio, semanas);

    document.getElementById("sch-prev-semanas").textContent =
      semanas + " semanas";
    document.getElementById("sch-prev-aulas").textContent =
      horasToAulas45(ch) + " aulas de 45min";
    document.getElementById("sch-prev-semana").textContent =
      adia * dsem + " aulas/semana (" + adia + "/dia × " + dsem + " dias)";
    document.getElementById("sch-prev-inicio").textContent = inicio
      ? new Date(inicio + "T12:00:00").toLocaleDateString("pt-BR")
      : "—";
    document.getElementById("sch-prev-fim").textContent = formatDate(fim);
  }

  function saveCronograma() {
    var matId = document.getElementById("sch-mat-id").value;
    var semId = document.getElementById("sch-sem-id").value;
    var adia = parseInt(document.getElementById("sch-aulas-dia").value) || 5;
    var dsem = parseInt(document.getElementById("sch-dias-sem").value) || 2;
    var inicio = document.getElementById("sch-data-inicio").value;

    if (!cfg.materias[matId]) cfg.materias[matId] = {};
    cfg.materias[matId].aulas_dia = adia;
    cfg.materias[matId].dias_semana = dsem;

    if (!cfg.semestres[semId]) cfg.semestres[semId] = {};
    cfg.semestres[semId].data_inicio = inicio;

    save();
    closeCronogramaModal();
    App.render();
    App.toast("Cronograma salvo!");
  }

  function closeCronogramaModal() {
    var modal = document.getElementById("overlay-schedule");
    if (modal) modal.classList.remove("open");
  }

  // ── INIT ──────────────────────────────────────────────

  function init() {
    load();
  }

  return {
    init: init,
    getConfig: getConfig,
    getPrevisao: getPrevisao,
    calcSemanas: calcSemanas,
    isOculta: isOculta,
    toggleOculta: toggleOculta,
    ocultarTodas: ocultarTodas,
    mostrarTodas: mostrarTodas,
    aulasVisiveis: aulasVisiveis,
    openCronogramaModal: openCronogramaModal,
    closeCronogramaModal: closeCronogramaModal,
    recalcPrevisao: recalcPrevisao,
    saveCronograma: saveCronograma,
  };
})();
