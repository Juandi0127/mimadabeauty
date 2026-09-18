(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, "");

  const PW_KEY = "mimada_admin_pw";
  const PAGE = 40;
  let password = "";
  try { password = sessionStorage.getItem(PW_KEY) || ""; } catch { /* sin almacenamiento */ }

  let productos = [];
  let byId = {};
  let saved = {};      // ajustes guardados en el servidor
  let draft = {};      // ajustes con cambios sin guardar
  let actualizado = null;
  let hasLoaded = false;
  const state = { q: "", filter: "", cat: "", brand: "", limit: PAGE };

  /* ---------- utilidades ---------- */
  const toastEl = $("[data-toast]");
  let toastTimer;
  function toast(msg, error = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("is-error", error);
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 3200);
  }

  async function api(method, query = "", body) {
    const res = await fetch(`/api/admin${query}`, {
      method,
      headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout(data.error || "Contraseña incorrecta.");
      throw new Error("401");
    }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  const adj = (id) => draft[id] || {};
  const isDirty = (id) => JSON.stringify(draft[id] || {}) !== JSON.stringify(saved[id] || {});
  const dirtyIds = () => [...new Set([...Object.keys(draft), ...Object.keys(saved)])].filter(isDirty);

  const isEmpty = (v) => v === false || v === "" || v == null || Number.isNaN(v)
    || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);

  function setField(id, field, value) {
    const a = { ...adj(id) };
    if (isEmpty(value)) delete a[field];
    else a[field] = value;
    if (Object.keys(a).length) draft[id] = a;
    else delete draft[id];
    updateSavebar();
    const row = $(`.row[data-id="${CSS.escape(id)}"]`);
    if (row) row.classList.toggle("is-dirty", isDirty(id)), row.classList.toggle("is-hidden", Boolean(adj(id).oculto));
    renderStats();
  }

  /* ---------- fotos ---------- */
  const principalOf = (p) => adj(p.id).imagen || p.imagen || (adj(p.id).fotosExtra || [])[0] || "";
  const photosOf = (p) => {
    const a = adj(p.id);
    return [...new Set([...(a.fotosExtra || []), ...(p.fotos || []), p.imagen, ...(p.variantes || []).map((v) => v.imagen)].filter(Boolean))];
  };
  const tonePhoto = (p, v) => adj(p.id).fotosTono?.[v.nombre] || v.imagen || "";
  const tonesWithPhoto = (p) => (p.variantes || []).filter((v) => tonePhoto(p, v)).length;

  function photoStatus(p) {
    if (!principalOf(p)) return `<span class="pill pill--out">Sin foto</span>`;
    const vs = p.variantes || [];
    if (vs.length < 2) return "";
    const n = tonesWithPhoto(p);
    return `<span class="pill ${n === vs.length ? "pill--ok" : "pill--warn"}">${n}/${vs.length} tonos con foto</span>`;
  }

  async function resizeImage(file, max = 1200) {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error(`No se pudo leer "${file.name}". Usa una foto JPG o PNG.`);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const dialog = $("[data-photos]");
  let photoId = null;

  function refreshRow(id) {
    const row = $(`.row[data-id="${CSS.escape(id)}"]`);
    if (row && byId[id]) row.outerHTML = rowHtml(byId[id]);
  }

  function openPhotos(id) {
    photoId = id;
    renderPhotos();
    dialog.showModal();
  }

  function renderPhotos() {
    const p = byId[photoId];
    const a = adj(photoId);
    const fotos = photosOf(p);
    const principal = principalOf(p);
    const subidas = new Set(a.fotosExtra || []);
    $("[data-ph-title]").textContent = p.nombre;
    $("[data-ph-sub]").textContent = `${p.marca || "Sin marca"} · ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`;

    $("[data-ph-grid]").innerHTML = fotos.length
      ? fotos.map((url) => `
        <figure class="ph${url === principal ? " is-main" : ""}">
          <button type="button" class="ph__pick" data-ph-main="${esc(url)}" aria-label="Poner como foto principal"><img src="${esc(url)}" alt="" loading="lazy"></button>
          ${url === principal ? `<span class="ph__badge">Principal</span>` : ""}
          ${subidas.has(url) ? `<button type="button" class="ph__del" data-ph-del="${esc(url)}" aria-label="Quitar foto subida">×</button>` : ""}
        </figure>`).join("")
      : `<p class="ph-empty">Este producto no tiene fotos. Sube una con el botón de abajo.</p>`;

    const vs = p.variantes || [];
    $("[data-ph-tones-wrap]").hidden = vs.length < 2;
    $("[data-ph-tones]").innerHTML = vs.map((v) => {
      const current = tonePhoto(p, v);
      const options = fotos.map((url) => `<button type="button" class="tone-opt${url === current ? " is-on" : ""}" data-ph-tone="${esc(url)}" aria-label="Usar esta foto para ${esc(v.nombre)}"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join("");
      const none = v.imagen ? "" : `<button type="button" class="tone-opt tone-opt--none${current ? "" : " is-on"}" data-ph-tone="">Sin foto</button>`;
      return `
        <div class="tone-row" data-tone="${esc(v.nombre)}">
          <div class="tone-row__name"><strong>${esc(v.nombre)}</strong>${v.disponible ? "" : "<small>agotado</small>"}</div>
          <div class="tone-row__opts">${none}${options}</div>
        </div>`;
    }).join("");
  }

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-ph-close]")) { dialog.close(); return; }
    const p = byId[photoId];
    const a = adj(photoId);

    const main = e.target.closest("[data-ph-main]");
    if (main) {
      const url = main.dataset.phMain;
      setField(photoId, "imagen", url === p.imagen ? null : url);
      renderPhotos();
      return;
    }

    const del = e.target.closest("[data-ph-del]");
    if (del) {
      const url = del.dataset.phDel;
      setField(photoId, "fotosExtra", (a.fotosExtra || []).filter((f) => f !== url));
      if (a.imagen === url) setField(photoId, "imagen", null);
      const tonos = Object.fromEntries(Object.entries(a.fotosTono || {}).filter(([, f]) => f !== url));
      setField(photoId, "fotosTono", tonos);
      renderPhotos();
      return;
    }

    const opt = e.target.closest("[data-ph-tone]");
    if (opt) {
      const name = opt.closest("[data-tone]").dataset.tone;
      const v = (p.variantes || []).find((x) => x.nombre === name);
      const url = opt.dataset.phTone;
      const tonos = { ...(a.fotosTono || {}) };
      if (!url || url === v?.imagen) delete tonos[name];
      else tonos[name] = url;
      setField(photoId, "fotosTono", tonos);
      renderPhotos();
    }
  });

  dialog.addEventListener("close", () => { if (photoId) refreshRow(photoId); });

  $("[data-ph-upload]").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length || !photoId) return;
    const label = $("[data-ph-upload-label]");
    const id = photoId;
    try {
      for (const [i, file] of files.entries()) {
        label.textContent = `Subiendo ${i + 1} de ${files.length}…`;
        const data = await resizeImage(file);
        const { url } = await api("POST", "?accion=foto", { data });
        const p = byId[id];
        setField(id, "fotosExtra", [...(adj(id).fotosExtra || []), url]);
        if (!p.imagen && !adj(id).imagen) setField(id, "imagen", url);
      }
      toast(files.length === 1 ? "Foto subida. Toca Guardar cambios para publicarla." : `${files.length} fotos subidas. Toca Guardar cambios para publicarlas.`);
    } catch (err) {
      if (err.message !== "401") toast(err.message, true);
    } finally {
      label.textContent = "+ Subir foto";
      if (photoId === id && dialog.open) renderPhotos();
    }
  });

  /* ---------- login ---------- */
  const loginView = $("[data-login]");
  const appView = $("[data-app]");
  const loginForm = $("[data-login-form]");
  const loginError = $("[data-login-error]");

  function logout(message) {
    password = "";
    try { sessionStorage.removeItem(PW_KEY); } catch { /* */ }
    appView.hidden = true;
    loginView.hidden = false;
    loginError.hidden = !message;
    loginError.textContent = message || "";
    loginForm.password.value = "";
    loginForm.password.focus();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    password = loginForm.password.value;
    const btn = $("button", loginForm);
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await load();
      try { sessionStorage.setItem(PW_KEY, password); } catch { /* */ }
      loginView.hidden = true;
      appView.hidden = false;
    } catch (err) {
      if (err.message !== "401") { loginError.textContent = err.message; loginError.hidden = false; }
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("[data-logout]").addEventListener("click", () => {
    if (dirtyIds().length && !confirm("Tienes cambios sin guardar. ¿Salir de todas formas?")) return;
    logout();
  });

  /* ---------- datos ---------- */
  async function load() {
    const data = await api("GET");
    productos = data.productos || [];
    byId = Object.fromEntries(productos.map((p) => [p.id, p]));
    actualizado = data.actualizado;
    // Al recargar datos (p. ej. tras "Actualizar desde proveedor") se conservan los cambios sin guardar
    const pending = hasLoaded ? Object.fromEntries(dirtyIds().map((id) => [id, draft[id]])) : {};
    saved = clone(data.ajustes?.productos);
    draft = clone(saved);
    for (const [id, value] of Object.entries(pending)) {
      if (value) draft[id] = value;
      else delete draft[id];
    }
    hasLoaded = true;
    buildFilters();
    renderAll();
  }

  function buildFilters() {
    const cats = [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, "es"));
    const brands = [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    $("[data-cat]").innerHTML = `<option value="">Todas las categorías</option>` + cats.map((c) => `<option ${c === state.cat ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("[data-brand]").innerHTML = `<option value="">Todas las marcas</option>` + brands.map((b) => `<option ${b === state.brand ? "selected" : ""}>${esc(b)}</option>`).join("");
  }

  function syncInfo() {
    if (!actualizado) return "Sin sincronizar";
    const mins = Math.round((Date.now() - Date.parse(actualizado)) / 60000);
    const when = mins < 1 ? "hace un momento" : mins < 60 ? `hace ${mins} min` : `hace ${Math.round(mins / 60)} h`;
    return `Proveedor actualizado ${when}`;
  }

  /* ---------- render ---------- */
  function filtered() {
    const words = normalize(state.q).split(/\s+/).filter(Boolean);
    return productos.filter((p) => {
      const a = adj(p.id);
      if (state.cat && p.categoria !== state.cat) return false;
      if (state.brand && p.marca !== state.brand) return false;
      switch (state.filter) {
        case "cambios": if (!draft[p.id] && !isDirty(p.id)) return false; break;
        case "oculto": if (!a.oculto) return false; break;
        case "agotado": if (!p.agotado && !a.agotado) return false; break;
        case "destacado": if (!a.destacado) return false; break;
        case "precio": if (!a.precio) return false; break;
        case "nuevo": if (p.etiqueta !== "Nuevo") return false; break;
        case "sinfoto": if (principalOf(p)) return false; break;
        case "tonossinfoto": if (!p.variantes || p.variantes.length < 2 || tonesWithPhoto(p) === p.variantes.length) return false; break;
      }
      if (!words.length) return true;
      const hay = normalize(`${p.nombre} ${p.marca} ${p.categoria} ${(p.variantes || []).map((v) => v.nombre).join(" ")}`);
      return words.every((w) => hay.includes(w));
    });
  }

  function stockText(p) {
    const vs = p.variantes || [];
    if (p.agotado) return `<span class="pill pill--out">Agotado en proveedor</span>`;
    if (!vs.length) return `<span class="pill pill--ok">Disponible</span>`;
    const ok = vs.filter((v) => v.disponible).length;
    return `<span class="pill ${ok === vs.length ? "pill--ok" : "pill--warn"}">${ok}/${vs.length} tonos disponibles</span>`;
  }

  function rowHtml(p) {
    const a = adj(p.id);
    const providerPrice = p.precio != null ? `${p.precioDesde ? "desde " : ""}${money(p.precio)}` : "sin precio";
    return `
    <article class="row${a.oculto ? " is-hidden" : ""}${isDirty(p.id) ? " is-dirty" : ""}" data-id="${esc(p.id)}">
      <button type="button" class="row__img${principalOf(p) ? "" : " row__img--empty"}" data-photos-open aria-label="Fotos de ${esc(p.nombre)}">
        <img src="${esc(principalOf(p) || "../assets/img/logo-mimada.png")}" alt="" loading="lazy">
      </button>
      <div class="row__info">
        <strong>${esc(p.nombre)}</strong>
        <span>${esc(p.marca || "Sin marca")} · ${esc(p.categoria)}${p.etiqueta === "Nuevo" ? ` · <b class="new">Nuevo</b>` : ""}</span>
        <span>Precio proveedor: <b>${providerPrice}</b> ${stockText(p)}</span>
        <span class="row__photo-line">${photoStatus(p)} <button type="button" class="linkbtn" data-photos-open>Fotos${(p.variantes || []).length > 1 ? " y tonos" : ""}</button></span>
      </div>
      <label class="row__field">
        <span>Precio propio</span>
        <input type="number" inputmode="numeric" min="0" step="100" placeholder="${p.precio ?? ""}" value="${a.precio ?? ""}" data-field="precio">
      </label>
      <label class="row__field">
        <span>Etiqueta</span>
        <input type="text" maxlength="30" placeholder="Oferta, Top…" value="${esc(a.etiqueta || "")}" data-field="etiqueta">
      </label>
      <div class="row__toggles">
        <label class="switch"><input type="checkbox" data-field="visible" ${a.oculto ? "" : "checked"}><span></span>Visible</label>
        <label class="switch"><input type="checkbox" data-field="agotado" ${a.agotado ? "checked" : ""}><span></span>Agotado</label>
        <label class="switch"><input type="checkbox" data-field="destacado" ${a.destacado ? "checked" : ""}><span></span>Destacado</label>
      </div>
    </article>`;
  }

  function renderStats() {
    const total = productos.length;
    const vals = Object.values(draft);
    const ocultos = vals.filter((a) => a.oculto).length;
    const agotados = productos.filter((p) => p.agotado || adj(p.id).agotado).length;
    const stats = [
      ["Productos", total],
      ["Visibles", total - ocultos],
      ["Ocultos", ocultos],
      ["Agotados", agotados],
      ["Destacados", vals.filter((a) => a.destacado).length],
      ["Precio propio", vals.filter((a) => a.precio).length],
    ];
    $("[data-stats]").innerHTML = stats.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
    $("[data-sync-info]").textContent = syncInfo();
  }

  function renderList(append = false) {
    const list = filtered();
    const from = append ? state.limit - PAGE : 0;
    const html = list.slice(from, state.limit).map(rowHtml).join("");
    if (append) $("[data-list]").insertAdjacentHTML("beforeend", html);
    else $("[data-list]").innerHTML = html || `<p class="empty">No hay productos con estos filtros.</p>`;
    $("[data-count]").textContent = `${Math.min(state.limit, list.length)} de ${list.length} productos`;
    $("[data-more]").hidden = list.length <= state.limit;
  }

  function updateSavebar() {
    const n = dirtyIds().length;
    $("[data-savebar]").hidden = n === 0;
    $("[data-pending]").textContent = `${n} ${n === 1 ? "producto con cambios" : "productos con cambios"} sin guardar`;
  }

  function renderAll() {
    renderStats();
    renderList();
    updateSavebar();
  }

  /* ---------- eventos ---------- */
  let qTimer;
  $("[data-q]").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value; state.limit = PAGE; renderList(); }, 150);
  });
  for (const [sel, key] of [["[data-filter]", "filter"], ["[data-cat]", "cat"], ["[data-brand]", "brand"]]) {
    $(sel).addEventListener("change", (e) => { state[key] = e.target.value; state.limit = PAGE; renderList(); });
  }
  $("[data-more]").addEventListener("click", () => { state.limit += PAGE; renderList(true); });

  $("[data-list]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-photos-open]");
    if (btn) openPhotos(btn.closest(".row").dataset.id);
  });

  $("[data-list]").addEventListener("change", (e) => {
    const input = e.target.closest("[data-field]");
    const row = e.target.closest(".row");
    if (!input || !row) return;
    const id = row.dataset.id;
    switch (input.dataset.field) {
      case "visible": setField(id, "oculto", !input.checked); break;
      case "agotado": setField(id, "agotado", input.checked); break;
      case "destacado": setField(id, "destacado", input.checked); break;
      case "precio": {
        const n = Math.round(Number(input.value));
        setField(id, "precio", input.value.trim() && n > 0 ? n : null);
        break;
      }
      case "etiqueta": setField(id, "etiqueta", input.value.trim().slice(0, 30)); break;
    }
  });

  $("[data-save]").addEventListener("click", async () => {
    const btn = $("[data-save]");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const data = await api("PUT", "", { ajustes: { productos: draft } });
      saved = clone(data.ajustes.productos);
      draft = clone(saved);
      renderAll();
      toast("Cambios guardados. La tienda se actualiza en máximo 1 minuto ✦");
    } catch (err) {
      if (err.message !== "401") toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar cambios";
    }
  });

  $("[data-discard]").addEventListener("click", () => {
    if (!confirm("¿Descartar los cambios sin guardar?")) return;
    draft = clone(saved);
    renderAll();
  });

  $("[data-sync]").addEventListener("click", async () => {
    const btn = $("[data-sync]");
    btn.disabled = true;
    btn.textContent = "Actualizando…";
    try {
      const r = await api("POST", "?accion=sincronizar");
      await load();
      toast(r.ok ? `Listo: ${r.total} productos actualizados desde el proveedor.` : r.motivo || "No se pudo actualizar.", !r.ok);
    } catch (err) {
      if (err.message !== "401") toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Actualizar desde proveedor";
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirtyIds().length) { e.preventDefault(); e.returnValue = ""; }
  });
  setInterval(() => { if (!appView.hidden) $("[data-sync-info]").textContent = syncInfo(); }, 60000);

  /* ---------- inicio ---------- */
  if (password) {
    load().then(() => { loginView.hidden = true; appView.hidden = false; }).catch(() => logout());
  }
})();
