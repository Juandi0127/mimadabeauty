(() => {
  "use strict";

  const CFG = window.MIMADA_CONFIG || {};
  // Novedades (products.js) primero, luego el catálogo completo (catalogo.js)
  const PRODUCTS = [];
  const byId = {};
  [...(window.MIMADA_PRODUCTS || []), ...(window.MIMADA_CATALOGO || [])].forEach((p) => {
    if (p && p.id && !byId[p.id]) { byId[p.id] = p; PRODUCTS.push(p); }
  });
  const PAGE_SIZE = 24;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);
  const hasPrice = (p) => typeof p.precio === "number";

  /* ---------- Almacenamiento ---------- */
  const CART_KEY = "mimada_cart_v1";
  const CUSTOMER_KEY = "mimada_customer_v1";
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
    }
  };

  let cart = store.get(CART_KEY, []);
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter((i) => byId[i.id] && i.qty > 0);

  const lineKey = (i) => `${i.id}|${i.variant || ""}`;
  const saveCart = () => store.set(CART_KEY, cart);

  /* ---------- WhatsApp ---------- */
  const waUrl = (text) => {
    const num = String(CFG.whatsapp || "").replace(/\D/g, "");
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  };

  $$("[data-wa-direct]").forEach((a) => {
    a.href = waUrl(a.dataset.waText || "¡Hola MIMADA! ✨ Quisiera más información.");
    a.target = "_blank";
    a.rel = "noopener";
  });
  $$("[data-ig-link]").forEach((a) => { a.href = CFG.instagram || "#"; });
  $$("[data-ig-user]").forEach((el) => { el.textContent = CFG.instagramUser || el.textContent; });
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Toast ---------- */
  const toastEl = $("[data-toast]");
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2400);
  };

  /* ---------- Catálogo ---------- */
  const grid = $("[data-grid]");
  const emptyEl = $("[data-empty]");
  const filtersEl = $("[data-filters]");
  const searchEl = $("[data-search]");
  const brandEl = $("[data-brand]");
  const countEl = $("[data-count]");
  const moreBtn = $("[data-more]");
  const state = { cat: "Todo", q: "", brand: "", limit: PAGE_SIZE };

  // Orden de los filtros; las categorías que no estén en esta lista van al final
  const CAT_ORDER = ["Rostro", "Mejillas y contorno", "Ojos y cejas", "Labios", "Cuidado de la piel", "Cabello", "Cuerpo", "Brochas y accesorios"];
  const rank = (c) => (CAT_ORDER.includes(c) ? CAT_ORDER.indexOf(c) : CAT_ORDER.length);
  const categories = ["Todo", ...[...new Set(PRODUCTS.map((p) => p.categoria).filter(Boolean))].sort((a, b) => rank(a) - rank(b))];
  filtersEl.innerHTML = categories
    .map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === state.cat}">${esc(c)}</button>`)
    .join("");

  const brands = [...new Set(PRODUCTS.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  brandEl.insertAdjacentHTML("beforeend", brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join(""));
  const optLabel = (p) => p.tonosLabel || "Tono";

  const priceHtml = (p) =>
    hasPrice(p)
      ? `${p.precioAntes ? `<s>${money(p.precioAntes)}</s>` : ""}<strong>${money(p.precio)}</strong>`
      : `<span class="price__ask">Precio por WhatsApp</span>`;

  const tonesHtml = (p) => {
    const tonos = p.tonos || [];
    if (tonos.length > 1) {
      const first = tonos.findIndex((t) => !/\(agotado\)$/i.test(t));
      return `<div class="tones" role="radiogroup" aria-label="Elige ${esc(optLabel(p).toLowerCase())}">${tonos
        .map((t, i) => {
          const out = /\(agotado\)$/i.test(t);
          return `<button type="button" class="tone${i === first ? " is-on" : ""}" role="radio" aria-checked="${i === first}" data-tone="${esc(t)}" ${out ? "disabled" : ""}>${esc(t)}</button>`;
        })
        .join("")}</div>`;
    }
    return tonos.length === 1 ? `<p class="card__tone">${esc(optLabel(p))}: ${esc(tonos[0])}</p>` : "";
  };

  const cardHtml = (p, idx) => `
    <article class="card${p.agotado ? " is-out" : ""}" data-id="${esc(p.id)}" style="animation-delay:${(idx % PAGE_SIZE) * 40}ms">
      <div class="card__media${p.collage ? " card__media--contain" : ""}">
        <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">
        ${p.etiqueta ? `<span class="badge">${esc(p.etiqueta)}</span>` : ""}
        ${p.agotado ? `<span class="badge badge--out">Agotado</span>` : ""}
      </div>
      <div class="card__body">
        <p class="card__brand">${esc(p.marca)}</p>
        <h3 class="card__name">${esc(p.nombre)}</h3>
        ${p.descripcion ? `<p class="card__desc">${esc(p.descripcion)}</p>` : ""}
        ${tonesHtml(p)}
        <div class="card__foot">
          <div class="price">${priceHtml(p)}</div>
          <button class="btn btn--cacao btn--sm" type="button" data-add ${p.agotado ? "disabled" : ""}>
            <svg><use href="#i-bag"/></svg> ${p.agotado ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>`;

  const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Índice sin tildes ni signos: "Ani-K" también se encuentra como "anik", "L.A. Girl" como "la girl"
  const compact = (s) => normalize(s).replace(/[^a-z0-9\s]/g, "");
  const searchIndex = new Map(PRODUCTS.map((p) => {
    const text = `${p.nombre} ${p.marca} ${p.categoria} ${p.descripcion || ""} ${(p.tonos || []).join(" ")}`;
    return [p.id, `${compact(text)} ${compact(text).replace(/\s+/g, "")} ${compact(p.marca).replace(/\s+/g, "")}`];
  }));

  function filtered() {
    const words = compact(state.q).split(/\s+/).filter(Boolean);
    return PRODUCTS.filter((p) => {
      if (state.cat !== "Todo" && p.categoria !== state.cat) return false;
      if (state.brand && p.marca !== state.brand) return false;
      const hay = searchIndex.get(p.id);
      return words.every((w) => hay.includes(w));
    });
  }

  function renderGrid(append = false) {
    const list = filtered();
    const shown = list.slice(append ? state.limit - PAGE_SIZE : 0, state.limit);
    if (append) grid.insertAdjacentHTML("beforeend", shown.map(cardHtml).join(""));
    else grid.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = list.length > 0;
    const visible = Math.min(state.limit, list.length);
    countEl.textContent = list.length ? `Mostrando ${visible} de ${list.length} productos` : "";
    moreBtn.hidden = list.length <= state.limit;
  }

  const resetAndRender = () => { state.limit = PAGE_SIZE; renderGrid(); };

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    $$("[data-cat]", filtersEl).forEach((b) => b.setAttribute("aria-pressed", b === btn));
    resetAndRender();
  });
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = searchEl.value; resetAndRender(); }, 150);
  });
  brandEl.addEventListener("change", () => { state.brand = brandEl.value; resetAndRender(); });
  moreBtn.addEventListener("click", () => { state.limit += PAGE_SIZE; renderGrid(true); });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const tone = e.target.closest("[data-tone]");
    if (tone) {
      $$("[data-tone]", card).forEach((t) => {
        const on = t === tone;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-checked", on);
      });
      return;
    }

    if (e.target.closest("[data-add]")) {
      const p = byId[card.dataset.id];
      const chosen = $(".tone.is-on", card);
      const variant = chosen ? chosen.dataset.tone : (p.tonos && p.tonos[0]) || "";
      addToCart(p.id, variant);
    }
  });

  /* ---------- Bolsa ---------- */
  const drawer = $("[data-drawer]");
  const overlay = $("[data-overlay]");
  const listEl = $("[data-cart-list]");
  const cartEmptyEl = $("[data-cart-empty]");
  const footEl = $("[data-drawer-foot]");
  const subtotalEl = $("[data-subtotal]");
  const noteEl = $("[data-summary-note]");
  const titleEl = $("[data-drawer-title]");
  const backBtn = $("[data-step-back]");
  const goCheckoutBtn = $("[data-go-checkout]");
  const sendBtn = $("[data-send-order]");
  const form = $("[data-step='checkout']");
  const errorEl = $("[data-form-error]");
  let lastFocus = null;

  function addToCart(id, variant) {
    const existing = cart.find((i) => i.id === id && (i.variant || "") === variant);
    if (existing) existing.qty += 1;
    else cart.push({ id, variant, qty: 1 });
    saveCart();
    renderCart();
    const p = byId[id];
    toast(`${p.nombre}${variant && (p.tonos || []).length > 1 ? ` · ${variant}` : ""} agregado a tu bolsa ✦`);
    $$("[data-cart-count]").forEach((c) => {
      c.classList.remove("bump");
      void c.offsetWidth;
      c.classList.add("bump");
    });
  }

  function renderCart() {
    const count = cart.reduce((a, i) => a + i.qty, 0);
    $$("[data-cart-count]").forEach((c) => { c.textContent = count; });

    listEl.innerHTML = cart
      .map((i) => {
        const p = byId[i.id];
        return `
        <li class="cart__item" data-key="${esc(lineKey(i))}">
          <img src="${esc(p.imagen)}" alt="">
          <div>
            <p class="cart__brand">${esc(p.marca)}</p>
            <p class="cart__name">${esc(p.nombre)}</p>
            ${i.variant ? `<p class="cart__variant">${esc(optLabel(p))}: ${esc(i.variant)}</p>` : ""}
            <div class="qty">
              <button type="button" data-dec aria-label="Quitar uno">−</button>
              <span aria-live="polite">${i.qty}</span>
              <button type="button" data-inc aria-label="Agregar uno">+</button>
            </div>
          </div>
          <div class="cart__side">
            ${hasPrice(p)
              ? `<span class="cart__price">${money(p.precio * i.qty)}</span>`
              : `<span class="cart__price cart__price--ask">Precio por<br>confirmar</span>`}
            <button type="button" class="cart__remove" data-remove>Eliminar</button>
          </div>
        </li>`;
      })
      .join("");

    const empty = cart.length === 0;
    cartEmptyEl.hidden = !empty;
    footEl.hidden = empty;

    const priced = cart.filter((i) => hasPrice(byId[i.id]));
    const subtotal = priced.reduce((a, i) => a + byId[i.id].precio * i.qty, 0);
    const allPriced = priced.length === cart.length;
    subtotalEl.textContent = priced.length ? money(subtotal) : "Por confirmar";
    noteEl.textContent = allPriced
      ? "El valor del envío se confirma por WhatsApp."
      : "Te confirmamos precios y envío por WhatsApp.";

    if (empty) setStep("bag");
  }

  listEl.addEventListener("click", (e) => {
    const row = e.target.closest(".cart__item");
    if (!row) return;
    const item = cart.find((i) => lineKey(i) === row.dataset.key);
    if (!item) return;
    if (e.target.closest("[data-inc]")) item.qty += 1;
    else if (e.target.closest("[data-dec]")) item.qty -= 1;
    else if (e.target.closest("[data-remove]")) item.qty = 0;
    else return;
    cart = cart.filter((i) => i.qty > 0);
    saveCart();
    renderCart();
  });

  function setStep(step) {
    const checkout = step === "checkout";
    $$("[data-step]").forEach((el) => { el.hidden = el.dataset.step !== step; });
    backBtn.hidden = !checkout;
    goCheckoutBtn.hidden = checkout;
    sendBtn.hidden = !checkout;
    titleEl.textContent = checkout ? "Datos del pedido" : "Mi bolsa";
    errorEl.hidden = true;
  }

  function openCart() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    $("[data-close-cart]", drawer).focus();
  }

  function closeCart() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }

  $$("[data-open-cart]").forEach((b) => b.addEventListener("click", openCart));
  $$("[data-close-cart]").forEach((b) => b.addEventListener("click", () => {
    closeCart();
    if (b.closest(".cart-empty")) document.getElementById("catalogo").scrollIntoView();
  }));
  overlay.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) closeCart();
  });
  goCheckoutBtn.addEventListener("click", () => { setStep("checkout"); form.scrollTop = 0; });
  backBtn.addEventListener("click", () => setStep("bag"));

  /* ---------- Formulario ---------- */
  const entregas = CFG.entregas || [];
  const pagos = CFG.pagos || [];

  const radiosHtml = (name, items) =>
    items
      .map((o, i) => `
      <label class="option">
        <input type="radio" name="${name}" value="${esc(o.id)}" ${i === 0 ? "checked" : ""}>
        <span class="option__box"><strong>${esc(o.label)}</strong>${o.detalle ? `<small>${esc(o.detalle)}</small>` : ""}</span>
      </label>`)
      .join("");

  $("[data-entregas]").innerHTML = radiosHtml("entrega", entregas);
  $("[data-pagos]").innerHTML = radiosHtml("pago", pagos);

  const direccionBox = $("[data-direccion]");
  const currentEntrega = () => entregas.find((o) => o.id === form.elements.entrega?.value);
  const syncDireccion = () => { direccionBox.hidden = !(currentEntrega()?.pideDireccion ?? true); };
  form.addEventListener("change", (e) => { if (e.target.name === "entrega") syncDireccion(); });
  syncDireccion();

  // Recordar datos de la clienta en este navegador
  const saved = store.get(CUSTOMER_KEY, {});
  ["nombre", "celular", "ciudad", "direccion"].forEach((k) => {
    if (saved && saved[k] && form.elements[k]) form.elements[k].value = saved[k];
  });

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target.value.trim()) {
      e.target.removeAttribute("aria-invalid");
    }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); sendOrder(); });
  sendBtn.addEventListener("click", sendOrder);

  function validate() {
    const f = form.elements;
    const needsAddress = currentEntrega()?.pideDireccion ?? true;
    const checks = [
      [f.nombre, f.nombre.value.trim().length >= 2],
      [f.celular, f.celular.value.replace(/\D/g, "").length >= 7],
      [f.ciudad, !needsAddress || f.ciudad.value.trim().length > 1],
      [f.direccion, !needsAddress || f.direccion.value.trim().length > 3]
    ];
    const bad = checks.filter(([, ok]) => !ok).map(([el]) => el);
    checks.forEach(([el, ok]) => (ok ? el.removeAttribute("aria-invalid") : el.setAttribute("aria-invalid", "true")));
    return bad;
  }

  function buildMessage() {
    const f = form.elements;
    const entrega = currentEntrega();
    const pago = pagos.find((o) => o.id === f.pago?.value);
    const lines = ["¡Hola MIMADA! ✨ Quiero hacer este pedido:", ""];

    cart.forEach((i) => {
      const p = byId[i.id];
      const price = hasPrice(p) ? money(p.precio * i.qty) : "precio por confirmar";
      lines.push(`• ${i.qty} x ${p.nombre} (${p.marca}) — ${price}`);
      if (i.variant) lines.push(`   ${optLabel(p)}: ${i.variant}`);
    });

    const priced = cart.filter((i) => hasPrice(byId[i.id]));
    if (priced.length) {
      const subtotal = priced.reduce((a, i) => a + byId[i.id].precio * i.qty, 0);
      const pending = priced.length < cart.length ? " + productos por confirmar" : "";
      lines.push("", `*Subtotal:* ${money(subtotal)}${pending} + envío`);
    }

    lines.push("", "*Mis datos*");
    lines.push(`Nombre: ${f.nombre.value.trim()}`);
    lines.push(`Celular: ${f.celular.value.trim()}`);
    if (entrega) lines.push(`Entrega: ${entrega.label}`);
    if (entrega?.pideDireccion ?? true) {
      lines.push(`Ciudad: ${f.ciudad.value.trim()}`);
      lines.push(`Dirección: ${f.direccion.value.trim()}`);
    }
    if (pago) lines.push(`Pago: ${pago.label}`);
    if (f.notas.value.trim()) lines.push(`Notas: ${f.notas.value.trim()}`);
    return lines.join("\n");
  }

  function sendOrder() {
    if (!cart.length) return;
    const bad = validate();
    if (bad.length) {
      errorEl.textContent = "Completa los campos marcados para enviar tu pedido.";
      errorEl.hidden = false;
      bad[0].focus();
      return;
    }
    errorEl.hidden = true;

    const f = form.elements;
    store.set(CUSTOMER_KEY, {
      nombre: f.nombre.value.trim(),
      celular: f.celular.value.trim(),
      ciudad: f.ciudad.value.trim(),
      direccion: f.direccion.value.trim()
    });

    const url = waUrl(buildMessage());
    const win = window.open(url, "_blank", "noopener");
    if (!win) window.location.href = url;
    toast("¡Listo! Termina de enviar tu pedido en WhatsApp 💕");
  }

  /* ---------- Header ---------- */
  const header = $(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  renderGrid();
  renderCart();
})();
