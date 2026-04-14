// =======================================================
//  extras.js — FUNCIONALIDADES EXTRAS
//  1. Conversor PDF → JSON de aula
//  2. Materiais Complementares (links)
// =======================================================

// ═══════════════════════════════════════════════════════
//  MÓDULO 1: CONVERSOR PDF → JSON
// ═══════════════════════════════════════════════════════

var PdfConverter = (function () {

  var currentSemId = null;
  var currentMatId = null;

  function open(semId, matId, matNome) {
    currentSemId = semId;
    currentMatId = matId;
    document.getElementById("pdf-mat-nome").textContent = matNome;
    document.getElementById("pdf-file-input").value = "";
    document.getElementById("pdf-status").textContent = "";
    document.getElementById("pdf-preview").style.display = "none";
    document.getElementById("pdf-result-json").value = "";
    document.getElementById("overlay-pdf").classList.add("open");
  }

  function close() {
    document.getElementById("overlay-pdf").classList.remove("open");
  }

  function handleFile(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setStatus("❌ Selecione um arquivo PDF.", "error");
      return;
    }
    setStatus("⏳ Lendo PDF...", "info");

    var reader = new FileReader();
    reader.onload = function (e) {
      var arrayBuffer = e.target.result;
      extractPdfText(arrayBuffer, file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function extractPdfText(buffer, fileName) {
    // Usa pdf.js para extração de texto
    if (!window.pdfjsLib) {
      setStatus("❌ pdf.js não carregado.", "error");
      return;
    }

    var loadingTask = pdfjsLib.getDocument({ data: buffer });
    loadingTask.promise.then(function (pdf) {
      setStatus("⏳ Extraindo texto de " + pdf.numPages + " páginas...", "info");

      var pages = [];
      var promises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        promises.push(pdf.getPage(i).then(function (page) {
          return page.getTextContent().then(function (tc) {
            return tc.items.map(function (item) { return item.str; }).join(" ");
          });
        }));
      }

      Promise.all(promises).then(function (texts) {
        var fullText = texts.join("\n\n");
        convertToJson(fullText, fileName);
      });
    }).catch(function (err) {
      setStatus("❌ Erro ao ler PDF: " + err.message, "error");
    });
  }

  function convertToJson(text, fileName) {
    setStatus("⏳ Convertendo para JSON...", "info");

    // Chama a API do Claude para converter o texto em JSON de aula
    var mat = null;
    var state = App.getState();
    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (m) {
        if (m.id === currentMatId) mat = m;
      });
    });

    var matNome = mat ? mat.nome : "Matéria";
    var nextNum = mat ? mat.aulas.length + 1 : 1;
    var nextId  = currentMatId + "-a" + String(nextNum).padStart(2, "0");

    var prompt = [
      "Você é um assistente que converte conteúdo de aulas técnicas para JSON estruturado.",
      "Converta o texto abaixo em um objeto JSON de aula para o portal do Curso Técnico em Desenvolvimento de Sistemas (SENAI).",
      "",
      "MATÉRIA: " + matNome,
      "ID SUGERIDO: " + nextId,
      "NÚMERO DA AULA: " + nextNum,
      "",
      "FORMATO EXATO DO JSON (retorne APENAS o JSON, sem explicações, sem markdown):",
      "{",
      '  "id": "' + nextId + '",',
      '  "titulo": "Título descritivo da aula",',
      '  "status": "completa",',
      '  "conteudo": "# Título\\n\\n## Seção 1\\n\\nConteúdo em markdown...",',
      '  "notas": "Notas do professor em markdown (dicas, observações, pontos de atenção)"',
      "}",
      "",
      "REGRAS:",
      "- O campo 'conteudo' deve usar markdown com # para títulos, ## para subtítulos, - para listas, ``` para código",
      "- Preserve exemplos de código exatamente como estão",
      "- O campo 'notas' deve ter dicas pedagógicas extraídas do material",
      "- Use \\n para quebras de linha dentro das strings JSON",
      "- Retorne SOMENTE o JSON válido, nada mais",
      "",
      "TEXTO DO PDF:",
      text.substring(0, 12000) // limite para o contexto
    ].join("\n");

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var raw = data.content && data.content[0] ? data.content[0].text : "";
      // Remove possíveis ```json ``` do output
      var clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        var parsed = JSON.parse(clean);
        document.getElementById("pdf-result-json").value = JSON.stringify(parsed, null, 2);
        document.getElementById("pdf-preview").style.display = "block";
        setStatus("✅ Convertido com sucesso! Revise o JSON e importe.", "success");
      } catch (e) {
        // Mostra raw mesmo assim para o usuário poder revisar
        document.getElementById("pdf-result-json").value = clean;
        document.getElementById("pdf-preview").style.display = "block";
        setStatus("⚠️ Revise o JSON gerado (pode precisar de ajuste manual).", "warn");
      }
    })
    .catch(function (err) {
      setStatus("❌ Erro na API: " + err.message, "error");
    });
  }

  function importJson() {
    var raw = document.getElementById("pdf-result-json").value;
    try {
      var obj = JSON.parse(raw);
      // Garante campos obrigatórios
      if (!obj.id || !obj.titulo) {
        setStatus("❌ JSON precisa ter 'id' e 'titulo'.", "error");
        return;
      }
      var mat = null;
      var state = App.getState();
      state.semestres.forEach(function (sem) {
        sem.materias.forEach(function (m) {
          if (m.id === currentMatId) mat = m;
        });
      });
      if (!mat) return;
      // Verifica se ID já existe
      var exists = mat.aulas.find(function (a) { return a.id === obj.id; });
      if (exists) {
        obj.id = obj.id + "_" + Date.now().toString(36);
      }
      mat.aulas.push(obj);
      App.saveState();
      App.render();
      App.toast("Aula importada do PDF com sucesso!");
      close();
    } catch (e) {
      setStatus("❌ JSON inválido. Corrija a sintaxe antes de importar.", "error");
    }
  }

  function setStatus(msg, type) {
    var el = document.getElementById("pdf-status");
    el.textContent = msg;
    el.className = "pdf-status pdf-status-" + (type || "info");
  }

  return { open: open, close: close, handleFile: handleFile, importJson: importJson };

})();


// ═══════════════════════════════════════════════════════
//  MÓDULO 2: MATERIAIS COMPLEMENTARES
// ═══════════════════════════════════════════════════════

var Materials = (function () {

  var STORAGE_KEY = "curso_materials_v1";
  var data = null; // { "semId|matId": [ {id, tipo, titulo, url, descricao} ] }
  var currentSemId = null;
  var currentMatId = null;
  var currentMatNome = null;
  var editingId = null;

  var TIPOS = {
    video   : { label: "Vídeo",   icon: "▶" },
    curso   : { label: "Curso",   icon: "🎓" },
    artigo  : { label: "Artigo",  icon: "📄" },
    doc     : { label: "Docs",    icon: "📚" },
    ferramenta: { label: "Ferramenta", icon: "🛠" },
    outro   : { label: "Outro",   icon: "🔗" }
  };

  // ── PERSISTÊNCIA ──────────────────────────────────────

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      data = saved ? JSON.parse(saved) : {};
    } catch (e) { data = {}; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function key(semId, matId) { return semId + "|" + matId; }

  function getList(semId, matId) {
    return data[key(semId, matId)] || [];
  }

  // ── MODAL ─────────────────────────────────────────────

  function open(semId, matId, matNome) {
    load();
    currentSemId  = semId;
    currentMatId  = matId;
    currentMatNome = matNome;
    editingId     = null;
    document.getElementById("mat-nome").textContent = matNome;
    // Esconde formulário e ações de edição no modo aluno
    var viewer = App.isViewer();
    document.getElementById("mat-form-section").style.display = viewer ? "none" : "";
    renderList();
    if (!viewer) renderForm(null);
    document.getElementById("overlay-materials").classList.add("open");
  }

  function close() {
    document.getElementById("overlay-materials").classList.remove("open");
  }

  function renderList() {
    var list = getList(currentSemId, currentMatId);
    var container = document.getElementById("mat-list");
    if (list.length === 0) {
      container.innerHTML = '<p class="empty-msg" style="padding:.8rem">Nenhum material cadastrado ainda.</p>';
      return;
    }

    container.innerHTML = list.map(function (item) {
      var tipo = TIPOS[item.tipo] || TIPOS.outro;
      return (
        '<div class="mat-item">' +
          '<span class="mat-tipo-icon">' + tipo.icon + '</span>' +
          '<div class="mat-info">' +
            '<a class="mat-titulo" href="' + item.url + '" target="_blank" rel="noopener">' + item.titulo + '</a>' +
            '<span class="mat-tipo-label">' + tipo.label + '</span>' +
            (item.descricao ? '<p class="mat-desc">' + item.descricao + '</p>' : '') +
          '</div>' +
          '<div class="mat-actions">' +
            '<button class="btn-icon" title="Editar" onclick="Materials.editItem(\'' + item.id + '\')">&#9998;</button>' +
            '<button class="btn-icon danger" title="Excluir" onclick="Materials.deleteItem(\'' + item.id + '\')">&#128465;</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderForm(item) {
    document.getElementById("mat-form-titulo").value    = item ? item.titulo    : "";
    document.getElementById("mat-form-url").value       = item ? item.url       : "";
    document.getElementById("mat-form-descricao").value = item ? item.descricao : "";
    document.getElementById("mat-form-tipo").value      = item ? item.tipo      : "video";
    document.getElementById("mat-form-title").textContent = item ? "Editar material" : "Adicionar material";
    document.getElementById("mat-save-btn").textContent   = item ? "Salvar edição" : "Adicionar";
    editingId = item ? item.id : null;
    // Popula select de aulas
    populateAulasSelect(item ? item.aula_id : "");
  }

  function populateAulasSelect(selectedAulaId) {
    var sel = document.getElementById("mat-form-aula");
    if (!sel) return;
    sel.innerHTML = '<option value="">— Geral (não vinculado a aula específica)</option>';
    var state = App.getState();
    state.semestres.forEach(function (sem) {
      sem.materias.forEach(function (m) {
        if (m.id === currentMatId) {
          m.aulas.forEach(function (a, i) {
            var opt = document.createElement("option");
            opt.value = a.id;
            opt.textContent = "Aula " + (i + 1) + " — " + a.titulo;
            if (a.id === selectedAulaId) opt.selected = true;
            sel.appendChild(opt);
          });
        }
      });
    });
  }

  function saveItem() {
    var titulo    = document.getElementById("mat-form-titulo").value.trim();
    var url       = document.getElementById("mat-form-url").value.trim();
    var descricao = document.getElementById("mat-form-descricao").value.trim();
    var tipo      = document.getElementById("mat-form-tipo").value;

    var aulaId = document.getElementById("mat-form-aula").value;

    if (!titulo || !url) {
      App.toast("Preencha título e URL.");
      return;
    }
    if (!url.startsWith("http")) {
      App.toast("URL deve começar com http:// ou https://");
      return;
    }

    var k    = key(currentSemId, currentMatId);
    if (!data[k]) data[k] = [];

    if (editingId) {
      var idx = data[k].findIndex(function (x) { return x.id === editingId; });
      if (idx >= 0) {
        data[k][idx] = { id: editingId, tipo: tipo, titulo: titulo, url: url, descricao: descricao, aula_id: aulaId };
      }
    } else {
      data[k].push({
        id        : "mat_" + Date.now().toString(36),
        tipo      : tipo,
        titulo    : titulo,
        url       : url,
        descricao : descricao,
        aula_id   : aulaId
      });
    }

    save();
    renderForm(null);
    renderList();
    App.toast(editingId ? "Material atualizado!" : "Material adicionado!");
    // Atualiza badge na lista de aulas
    App.render();
  }

  function editItem(id) {
    var list = getList(currentSemId, currentMatId);
    var item = list.find(function (x) { return x.id === id; });
    if (item) renderForm(item);
    document.getElementById("mat-form-titulo").focus();
  }

  function deleteItem(id) {
    if (!window.confirm("Excluir este material?")) return;
    var k = key(currentSemId, currentMatId);
    data[k] = (data[k] || []).filter(function (x) { return x.id !== id; });
    save();
    renderList();
    App.render();
    App.toast("Material removido.");
  }

  function cancelEdit() {
    renderForm(null);
  }

  // Conta materiais de uma matéria (para badge na lista)
  function countMaterials(semId, matId) {
    load();
    return getList(semId, matId).length;
  }

  // Renderiza badge de materiais para uso no app.js
  function getBadge(semId, matId) {
    load();
    var count = getList(semId, matId).length;
    return count > 0
      ? '<span class="mat-badge" title="' + count + ' material(is) complementar(es)">&#128279; ' + count + '</span>'
      : '';
  }

  function init() { load(); }

  return {
    init       : init,
    open       : open,
    close      : close,
    saveItem   : saveItem,
    editItem   : editItem,
    deleteItem : deleteItem,
    cancelEdit : cancelEdit,
    getBadge   : getBadge
  };

})();