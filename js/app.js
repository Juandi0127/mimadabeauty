(() => {
  "use strict";

  const CFG = window.MIMADA_CONFIG || {};
  const PAGE_SIZE = 24;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);
  const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const compact = (s) => normalize(s).replace(/[^a-z0-9\s]/g, "");

  /* ---------- Almacenamiento ---------- */
  const CART_KEY = "mimada_cart_v2";
  const CUSTOMER_KEY = "mimada_customer_v1";
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
    }
  };

  /* ---------- Productos ----------
     Catálogo principal: /api/catalogo (sincronizado con el proveedor + ajustes del panel admin).
     Respaldo: data/catalogo-respaldo.json. Productos propios: js/products.js. */
  let PRODUCTS = [];
  let byId = {};
  let loaded = false;

  // Productos propios (products.js) al mismo formato del catálogo
  const extras = (window.MIMADA_PRODUCTS || []).map((p) => {
    const item = { ...p };
    if (Array.isArray(p.tonos) && p.tonos.length) {
      item.opcion = p.tonosLabel || "Tono";
      item.variantes = p.tonos.map((t) => ({
        nombre: String(t).replace(/\s*\(agotado\)$/i, ""),
        precio: p.precio ?? null,
        disponible: !/\(agotado\)$/i.test(t)
      }));
    }
    delete item.tonos;
    return item;
  });

  async function fetchCatalog() {
    for (const url of ["/api/catalogo", "data/catalogo-respaldo.json"]) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        if (Array.isArray(data.productos) && data.productos.length) return data.productos;
      } catch { /* probar la siguiente fuente */ }
    }
    return [];
  }

  const variantsOf = (p) => p.variantes || [];
  const findVariant = (p, name) => variantsOf(p).find((v) => v.nombre === name);
  const optLabel = (p) => p.opcion || "Tono";
  const priceOf = (p, variant) => {
    const v = variant ? findVariant(p, variant) : null;
    return v && v.precio != null ? v.precio : p.precio ?? null;
  };
  const isAvailable = (p, variant) => {
    if (!p || p.agotado) return false;
    if (!variantsOf(p).length) return true;
    const v = findVariant(p, variant);
    return Boolean(v && v.disponible);
  };
  const firstAvailable = (p) => variantsOf(p).find((v) => v.disponible) || variantsOf(p)[0];

  /* ---------- Bolsa (estado) ---------- */
  let cart = store.get(CART_KEY, []);
  if (!Array.isArray(cart)) cart = [];
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
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
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
  let searchIndex = new Map();

  // Orden de los filtros; las categorías que no estén en esta lista van al final
  const CAT_ORDER = ["Rostro", "Mejillas y contorno", "Ojos y cejas", "Labios", "Cuidado de la piel", "Cabello", "Cuerpo", "Brochas y accesorios", "Eléctricos"];
  const rank = (c) => (CAT_ORDER.includes(c) ? CAT_ORDER.indexOf(c) : CAT_ORDER.length);

  function buildFilters() {
    const categories = ["Todo", ...[...new Set(PRODUCTS.map((p) => p.categoria).filter(Boolean))].sort((a, b) => rank(a) - rank(b))];
    filtersEl.innerHTML = categories
      .map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === state.cat}">${esc(c)}</button>`)
      .join("");
    const brands = [...new Set(PRODUCTS.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    brandEl.innerHTML = `<option value="">Todas las marcas</option>` + brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    // Palabras de cada producto; la búsqueda compara el inicio de cada palabra
    // ("termo" encuentra "Termo" y "Termoprotector", pero no "de-termo-inado").
    searchIndex = new Map(PRODUCTS.map((p) => {
      const main = new Set(compact(`${p.nombre} ${p.marca}`).split(/\s+/).filter(Boolean));
      main.add(compact(p.marca).replace(/\s+/g, "")); // "L.A. Girl" -> "lagirl", "Ani-K" -> "anik"
      const rest = `${p.categoria} ${p.descripcion || ""} ${variantsOf(p).map((v) => v.nombre).join(" ")}`;
      const all = new Set([...main, ...compact(rest).split(/\s+/).filter(Boolean)]);
      return [p.id, { main: [...main], all: [...all], brand: compact(p.marca) }];
    }));
  }

  const matchesSearch = (p, terms) => {
    const { all } = searchIndex.get(p.id) || { all: [] };
    return terms.every((t) => all.some((w) => w.startsWith(t)));
  };

  // Relevancia: primero lo que coincide en nombre/marca (mejor si es la palabra exacta o la marca completa)
  const searchScore = (p, terms, query) => {
    const { main, brand } = searchIndex.get(p.id) || { main: [], brand: "" };
    let score = brand && (brand === query || brand.replace(/\s+/g, "") === query.replace(/\s+/g, "")) ? 10 : 0;
    for (const t of terms) {
      if (main.includes(t)) score += 3;
      else if (main.some((w) => w.startsWith(t))) score += 2;
    }
    return score;
  };

  const priceHtml = (p, variant) => {
    const price = priceOf(p, variant);
    if (price == null) return `<span class="price__ask">Precio por WhatsApp</span>`;
    const desde = !variant && p.precioDesde ? `<small>Desde</small>` : "";
    return `${p.precioAntes ? `<s>${money(p.precioAntes)}</s>` : ""}${desde}<strong>${money(price)}</strong>`;
  };

  const variantPickerHtml = (p, selected) => {
    const vs = variantsOf(p);
    if (!vs.length) return "";
    const label = esc(optLabel(p));
    if (vs.length === 1) return `<p class="card__tone">${label}: ${esc(vs[0].nombre)}${vs[0].disponible ? "" : " (agotado)"}</p>`;
    if (vs.length <= 8) {
      return `<div class="tones" role="radiogroup" aria-label="Elige ${label.toLowerCase()}">${vs
        .map((v) => {
          const on = v.nombre === selected;
          return `<button type="button" class="tone${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-variant="${esc(v.nombre)}" ${v.disponible ? "" : "disabled title=\"Agotado\""}>${esc(v.nombre)}</button>`;
        })
        .join("")}</div>`;
    }
    const available = vs.filter((v) => v.disponible).length;
    return `<label class="variant-select">
        <span>${label} <small>(${available} de ${vs.length} disponibles)</small></span>
        <select data-variant-select>${vs
          .map((v) => `<option value="${esc(v.nombre)}" ${v.nombre === selected ? "selected" : ""} ${v.disponible ? "" : "disabled"}>${esc(v.nombre)}${v.disponible ? "" : " — agotado"}</option>`)
          .join("")}</select>
      </label>`;
  };

  // Fotos del producto para la galería de la tarjeta (incluye las fotos de cada tono)
  const galleryOf = (p) => {
    const fotos = [...(p.fotos || []), p.imagen, ...variantsOf(p).map((v) => v.imagen)].filter(Boolean);
    return [...new Set(fotos)];
  };

  const galleryHtml = (gallery, current) => {
    if (gallery.length < 2) return "";
    return `
        <button type="button" class="gal gal--prev" data-gal="-1" aria-label="Foto anterior"><svg><use href="#i-back"/></svg></button>
        <button type="button" class="gal gal--next" data-gal="1" aria-label="Foto siguiente"><svg><use href="#i-back"/></svg></button>
        <div class="gal__dots" aria-hidden="true">${gallery.slice(0, 10).map((_, i) => `<span${i === current ? ' class="is-on"' : ""}></span>`).join("")}</div>`;
  };

  function showPhoto(card, p, target) {
    const gallery = galleryOf(p);
    const index = typeof target === "number"
      ? (target + gallery.length) % gallery.length
      : Math.max(0, gallery.indexOf(target));
    const url = typeof target === "string" && !gallery.includes(target) ? target : gallery[index];
    if (!url) return;
    card.dataset.fi = index;
    $("[data-img]", card).src = url;
    $$(".gal__dots span", card).forEach((d, i) => d.classList.toggle("is-on", i === index));
  }

  const cardHtml = (p, idx) => {
    const selected = firstAvailable(p)?.nombre || "";
    const out = !isAvailable(p, selected);
    const img = findVariant(p, selected)?.imagen || p.imagen;
    const gallery = galleryOf(p);
    const current = Math.max(0, gallery.indexOf(img));
    return `
    <article class="card${p.agotado ? " is-out" : ""}" data-id="${esc(p.id)}" data-fi="${current}" style="animation-delay:${(idx % PAGE_SIZE) * 35}ms">
      <div class="card__media${img ? "" : " card__media--empty"}" data-detail title="Ver producto">
        <img src="${esc(img || "assets/img/logo-mimada.png")}" alt="${esc(p.nombre)}" loading="lazy" decoding="async" data-img>
        ${galleryHtml(gallery, current)}
        ${p.etiqueta ? `<span class="badge">${esc(p.etiqueta)}</span>` : ""}
        ${p.agotado ? `<span class="badge badge--out">Agotado</span>` : ""}
      </div>
      <div class="card__body">
        <p class="card__brand">${esc(p.marca)}</p>
        <h3 class="card__name"><button type="button" class="card__link" data-detail>${esc(p.nombre)}</button></h3>
        ${p.descripcion ? `<p class="card__desc">${esc(p.descripcion)}</p>` : ""}
        ${variantPickerHtml(p, selected)}
        <div class="card__foot">
          <div class="price" data-price>${priceHtml(p, variantsOf(p).length > 1 ? "" : selected)}</div>
          <button class="btn btn--cacao btn--sm" type="button" data-add ${out ? "disabled" : ""}>
            <svg><use href="#i-bag"/></svg> ${out ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>`;
  };

  function selectedVariant(card, p) {
    const chip = $(".tone.is-on", card);
    if (chip) return chip.dataset.variant;
    const select = $("[data-variant-select]", card);
    if (select) return select.value;
    return variantsOf(p)[0]?.nombre || "";
  }

  function refreshCard(card, p, variant, touched) {
    const v = findVariant(p, variant);
    const priceEl = $("[data-price]", card);
    priceEl.innerHTML = priceHtml(p, touched ? variant : variantsOf(p).length > 1 ? "" : variant);
    if (v?.imagen) showPhoto(card, p, v.imagen);
    const ok = isAvailable(p, variant);
    const btn = $("[data-add]", card);
    btn.disabled = !ok;
    btn.innerHTML = `<svg><use href="#i-bag"/></svg> ${ok ? "Agregar" : "Agotado"}`;
  }

  function filtered({ ignoreFilters = false } = {}) {
    const query = compact(state.q).trim();
    const terms = query.split(/\s+/).filter(Boolean);
    const list = PRODUCTS.filter((p) => {
      if (!ignoreFilters && state.cat !== "Todo" && p.categoria !== state.cat) return false;
      if (!ignoreFilters && state.brand && p.marca !== state.brand) return false;
      return !terms.length || matchesSearch(p, terms);
    });
    if (!terms.length || ignoreFilters) return list;
    return list
      .map((p, i) => ({ p, i, s: searchScore(p, terms, query) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.p);
  }

  // Si hay búsqueda con filtros activos, avisar de los resultados que quedan por fuera
  const hintEl = $("[data-hint]");
  function renderHint(visibleCount) {
    const filtersOn = state.cat !== "Todo" || state.brand;
    const extra = state.q.trim() && filtersOn ? filtered({ ignoreFilters: true }).length - visibleCount : 0;
    hintEl.hidden = extra <= 0;
    if (extra > 0) {
      hintEl.innerHTML = `Hay ${extra} ${extra === 1 ? "resultado más" : "resultados más"} para “${esc(state.q.trim())}” en otras categorías o marcas. <button type="button" class="link" data-clear-filters>Ver todos</button>`;
    }
  }

  hintEl.addEventListener("click", (e) => {
    if (!e.target.closest("[data-clear-filters]")) return;
    state.cat = "Todo";
    state.brand = "";
    brandEl.value = "";
    $$("[data-cat]", filtersEl).forEach((b) => b.setAttribute("aria-pressed", b.dataset.cat === "Todo"));
    resetAndRender();
  });

  function renderGrid(append = false) {
    if (!loaded) return;
    const list = filtered();
    renderHint(list.length);
    const shown = list.slice(append ? state.limit - PAGE_SIZE : 0, state.limit);
    if (append) grid.insertAdjacentHTML("beforeend", shown.map(cardHtml).join(""));
    else grid.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = list.length > 0;
    const visible = Math.min(state.limit, list.length);
    countEl.textContent = list.length ? `Mostrando ${visible} de ${list.length} productos` : "";
    moreBtn.hidden = list.length <= state.limit;
  }

  function renderSkeleton() {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="card card--skeleton" aria-hidden="true">
        <div class="card__media"></div>
        <div class="card__body"><span></span><span></span><span></span></div>
      </div>`).join("");
    countEl.textContent = "Cargando catálogo…";
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
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    const p = byId[card.dataset.id];
    if (!p) return;

    const nav = e.target.closest("[data-gal]");
    if (nav) {
      showPhoto(card, p, Number(card.dataset.fi || 0) + Number(nav.dataset.gal));
      return;
    }

    const chip = e.target.closest("[data-variant]");
    if (chip && !chip.disabled) {
      $$("[data-variant]", card).forEach((t) => {
        const on = t === chip;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-checked", on);
      });
      refreshCard(card, p, chip.dataset.variant, true);
      return;
    }

    if (e.target.closest("[data-add]")) { addToCart(p.id, selectedVariant(card, p)); return; }

    if (e.target.closest("[data-detail]")) openDetail(p.id, selectedVariant(card, p), Number(card.dataset.fi || 0));
  });

  // Deslizar con el dedo sobre la foto para ver las demás
  let touch = null;
  grid.addEventListener("touchstart", (e) => {
    const media = e.target.closest(".card__media");
    if (media && e.touches.length === 1) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, media };
  }, { passive: true });
  grid.addEventListener("touchend", (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    const card = touch.media.closest(".card[data-id]");
    touch = null;
    if (!card || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const p = byId[card.dataset.id];
    if (p && galleryOf(p).length > 1) showPhoto(card, p, Number(card.dataset.fi || 0) + (dx < 0 ? 1 : -1));
  }, { passive: true });

  grid.addEventListener("change", (e) => {
    const select = e.target.closest("[data-variant-select]");
    if (!select) return;
    const card = select.closest(".card[data-id]");
    refreshCard(card, byId[card.dataset.id], select.value, true);
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

  function addToCart(id, variant, qty = 1) {
    const p = byId[id];
    if (!isAvailable(p, variant)) { toast("Ese producto está agotado por ahora."); return false; }
    const existing = cart.find((i) => i.id === id && (i.variant || "") === (variant || ""));
    if (existing) existing.qty += qty;
    else cart.push({ id, variant: variant || "", qty });
    saveCart();
    renderCart();
    toast(`${qty > 1 ? `${qty} × ` : ""}${p.nombre}${variant && variantsOf(p).length > 1 ? ` · ${variant}` : ""} agregado a tu bolsa ✦`);
    $$("[data-cart-count]").forEach((c) => {
      c.classList.remove("bump");
      void c.offsetWidth;
      c.classList.add("bump");
    });
    return true;
  }

  /* ---------- Vista de producto ---------- */
  const pd = $("[data-pd]");
  const pdBody = $("[data-pd-body]");
  const pdState = { id: null, variant: "", index: 0, qty: 1, pushed: false };
  const productUrl = (id) => `${location.origin}${location.pathname}#producto=${encodeURIComponent(id)}`;

  function openDetail(id, variant, index, { fromLink = false } = {}) {
    const p = byId[id];
    if (!p) return;
    const gallery = galleryOf(p);
    pdState.id = id;
    pdState.qty = 1;
    pdState.variant = variant || firstAvailable(p)?.nombre || "";
    const variantImg = findVariant(p, pdState.variant)?.imagen;
    pdState.index = typeof index === "number" && index < gallery.length ? index : Math.max(0, gallery.indexOf(variantImg || p.imagen));
    renderDetail();
    if (!pd.open) {
      pd.showModal();
      document.body.classList.add("no-scroll");
      pdBody.scrollTop = 0;
    }
    // Enlace propio del producto (se puede compartir) y el botón "atrás" del celular cierra la vista
    if (!fromLink && !location.hash.startsWith("#producto=")) {
      history.pushState({ producto: id }, "", `#producto=${encodeURIComponent(id)}`);
      pdState.pushed = true;
    } else if (!fromLink) {
      history.replaceState(history.state, "", `#producto=${encodeURIComponent(id)}`);
    }
  }

  function closeDetail() {
    if (pd.classList.contains("pd--full")) { setFull(false); return; }
    pd.close();
  }

  pd.addEventListener("close", () => {
    document.body.classList.remove("no-scroll");
    setFull(false);
    if (location.hash.startsWith("#producto=")) {
      if (pdState.pushed && history.state?.producto) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    pdState.pushed = false;
  });
  pd.addEventListener("cancel", (e) => {
    if (pd.classList.contains("pd--full")) { e.preventDefault(); setFull(false); }
  });
  window.addEventListener("popstate", () => {
    if (pd.open && !location.hash.startsWith("#producto=")) { pdState.pushed = false; pd.close(); }
  });

  const askText = (p) => `¡Hola MIMADA! ✨ Quiero preguntar por este producto:\n${p.nombre}${p.marca ? ` (${p.marca})` : ""}${pdState.variant ? `\n${optLabel(p)}: ${pdState.variant}` : ""}\n${productUrl(p.id)}`;

  function renderDetail() {
    const p = byId[pdState.id];
    const gallery = galleryOf(p);
    const vs = variantsOf(p);
    const ok = isAvailable(p, pdState.variant);
    const img = gallery[pdState.index] || p.imagen;
    const nav = gallery.length > 1 ? `
          <button type="button" class="gal gal--prev" data-pd-nav="-1" aria-label="Foto anterior"><svg><use href="#i-back"/></svg></button>
          <button type="button" class="gal gal--next" data-pd-nav="1" aria-label="Foto siguiente"><svg><use href="#i-back"/></svg></button>
          <span class="pd__counter" data-pd-counter>${pdState.index + 1} / ${gallery.length}</span>` : "";

    pdBody.innerHTML = `
      <div class="pd__gallery">
        <div class="pd__stage${img ? "" : " pd__stage--empty"}" data-pd-stage>
          <img src="${esc(img || "assets/img/logo-mimada.png")}" alt="${esc(p.nombre)}" data-pd-img draggable="false">
          ${nav}
          ${img ? `<button type="button" class="pd__zoom" data-pd-full aria-label="Ver foto en pantalla completa"><svg><use href="#i-expand"/></svg></button>` : ""}
        </div>
        ${gallery.length > 1 ? `<div class="pd__thumbs">${gallery.map((u, i) => `
          <button type="button" class="pd__thumb${i === pdState.index ? " is-on" : ""}" data-pd-go="${i}" aria-label="Foto ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}
        </div>` : ""}
      </div>
      <div class="pd__info">
        <p class="card__brand">${esc(p.marca)}</p>
        <h2 id="pd-title" class="pd__title">${esc(p.nombre)}</h2>
        <p class="pd__cat">${esc(p.categoria)}${p.etiqueta ? ` <span class="pd__tag">${esc(p.etiqueta)}</span>` : ""}</p>
        <div class="price pd__price">${priceHtml(p, pdState.variant)}</div>
        ${vs.length ? `
        <div class="pd__variants">
          <p class="pd__label">${esc(optLabel(p))}: <strong>${esc(pdState.variant)}</strong>${ok ? "" : ` <span class="pd__out">· agotado</span>`}</p>
          <div class="pd__chips">${vs.map((v) => `
            <button type="button" class="pd-chip${v.nombre === pdState.variant ? " is-on" : ""}${v.imagen ? " pd-chip--img" : ""}" data-pd-variant="${esc(v.nombre)}" ${v.disponible ? "" : "disabled"} title="${esc(v.nombre)}${v.disponible ? "" : " (agotado)"}">
              ${v.imagen ? `<img src="${esc(v.imagen)}" alt="" loading="lazy">` : ""}<span>${esc(v.nombre)}</span>
            </button>`).join("")}
          </div>
        </div>` : ""}
        ${p.descripcion ? `<p class="pd__desc">${esc(p.descripcion)}</p>` : ""}
        <div class="pd__buy">
          <div class="qty qty--lg">
            <button type="button" data-pd-qty="-1" aria-label="Quitar uno">−</button>
            <span aria-live="polite">${pdState.qty}</span>
            <button type="button" data-pd-qty="1" aria-label="Agregar uno">+</button>
          </div>
          <button type="button" class="btn btn--cacao pd__add" data-pd-add ${ok ? "" : "disabled"}><svg><use href="#i-bag"/></svg> ${ok ? "Agregar a la bolsa" : "Agotado"}</button>
        </div>
        <div class="pd__more">
          <a class="btn btn--ghost-dark btn--sm" href="${esc(waUrl(askText(p)))}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg> Preguntar por WhatsApp</a>
          <button type="button" class="btn btn--ghost-dark btn--sm" data-pd-share><svg><use href="#i-share"/></svg> Compartir</button>
        </div>
      </div>`;
  }

  function setDetailPhoto(i) {
    const p = byId[pdState.id];
    const gallery = galleryOf(p);
    if (!gallery.length) return;
    pdState.index = (i + gallery.length) % gallery.length;
    setZoom(false);
    $("[data-pd-img]", pd).src = gallery[pdState.index];
    const counter = $("[data-pd-counter]", pd);
    if (counter) counter.textContent = `${pdState.index + 1} / ${gallery.length}`;
    $$("[data-pd-go]", pd).forEach((t, n) => t.classList.toggle("is-on", n === pdState.index));
    $(`[data-pd-go="${pdState.index}"]`, pd)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // Pantalla completa y zoom (tocar la foto acerca en ese punto; mover el dedo/ratón recorre la foto)
  function setFull(on) {
    pd.classList.toggle("pd--full", on);
    if (!on) setZoom(false);
  }
  function setZoom(on, e) {
    const img = $("[data-pd-img]", pd);
    if (!img) return;
    img.classList.toggle("is-zoom", on);
    if (on && e) moveZoom(e);
    if (!on) img.style.transformOrigin = "";
  }
  function moveZoom(e) {
    const img = $("[data-pd-img]", pd);
    const r = img.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    img.style.transformOrigin = `${x}% ${y}%`;
  }

  pd.addEventListener("click", async (e) => {
    if (e.target === pd || e.target.closest("[data-pd-close]")) { closeDetail(); return; }
    const p = byId[pdState.id];
    if (!p) return;

    const nav = e.target.closest("[data-pd-nav]");
    if (nav) { setDetailPhoto(pdState.index + Number(nav.dataset.pdNav)); return; }
    const go = e.target.closest("[data-pd-go]");
    if (go) { setDetailPhoto(Number(go.dataset.pdGo)); return; }

    if (e.target.closest("[data-pd-full]")) { setFull(true); return; }
    if (e.target.closest("[data-pd-img]")) {
      if (!pd.classList.contains("pd--full")) { if (galleryOf(p).length) setFull(true); return; }
      const img = $("[data-pd-img]", pd);
      setZoom(!img.classList.contains("is-zoom"), e);
      return;
    }

    const chip = e.target.closest("[data-pd-variant]");
    if (chip && !chip.disabled) {
      pdState.variant = chip.dataset.pdVariant;
      const vImg = findVariant(p, pdState.variant)?.imagen;
      if (vImg) pdState.index = Math.max(0, galleryOf(p).indexOf(vImg));
      const scroll = pdBody.scrollTop;
      renderDetail();
      pdBody.scrollTop = scroll;
      return;
    }

    const q = e.target.closest("[data-pd-qty]");
    if (q) {
      pdState.qty = Math.min(20, Math.max(1, pdState.qty + Number(q.dataset.pdQty)));
      $(".qty--lg span", pd).textContent = pdState.qty;
      return;
    }

    const add = e.target.closest("[data-pd-add]");
    if (add) {
      if (addToCart(p.id, pdState.variant, pdState.qty)) {
        add.innerHTML = `<svg><use href="#i-bag"/></svg> ¡Agregado!`;
        setTimeout(() => { if (add.isConnected) add.innerHTML = `<svg><use href="#i-bag"/></svg> Agregar a la bolsa`; }, 1400);
      }
      return;
    }

    if (e.target.closest("[data-pd-share]")) {
      const url = productUrl(p.id);
      try {
        if (navigator.share) await navigator.share({ title: `${p.nombre} · MIMADA Beauty`, text: `${p.nombre}${p.marca ? ` (${p.marca})` : ""} en MIMADA Beauty`, url });
        else { await navigator.clipboard.writeText(url); toast("Enlace copiado ✦ pégalo donde quieras compartirlo"); }
      } catch { /* la persona canceló */ }
    }
  });

  pd.addEventListener("pointermove", (e) => {
    const img = e.target.closest("[data-pd-img]");
    if (img && img.classList.contains("is-zoom")) moveZoom(e);
  });

  pd.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") setDetailPhoto(pdState.index - 1);
    if (e.key === "ArrowRight") setDetailPhoto(pdState.index + 1);
  });

  // Deslizar la foto grande con el dedo
  let pdTouch = null;
  pd.addEventListener("touchstart", (e) => {
    if (e.target.closest("[data-pd-stage]") && e.touches.length === 1 && !$("[data-pd-img]", pd)?.classList.contains("is-zoom")) {
      pdTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });
  pd.addEventListener("touchend", (e) => {
    if (!pdTouch) return;
    const dx = e.changedTouches[0].clientX - pdTouch.x;
    const dy = e.changedTouches[0].clientY - pdTouch.y;
    pdTouch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) setDetailPhoto(pdState.index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  function openFromHash() {
    const m = location.hash.match(/^#producto=(.+)$/);
    if (m && byId[decodeURIComponent(m[1])] && !pd.open) openDetail(decodeURIComponent(m[1]), "", undefined, { fromLink: true });
  }
  window.addEventListener("hashchange", openFromHash);

  const lineTotal = (i) => {
    const price = priceOf(byId[i.id], i.variant);
    return price == null ? null : price * i.qty;
  };

  function renderCart() {
    const count = cart.reduce((a, i) => a + i.qty, 0);
    $$("[data-cart-count]").forEach((c) => { c.textContent = count; });
    if (!loaded) return;

    listEl.innerHTML = cart
      .map((i) => {
        const p = byId[i.id];
        const total = lineTotal(i);
        const img = findVariant(p, i.variant)?.imagen || p.imagen || "assets/img/logo-mimada.png";
        return `
        <li class="cart__item" data-key="${esc(lineKey(i))}">
          <img src="${esc(img)}" alt="">
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
            ${total != null
              ? `<span class="cart__price">${money(total)}</span>`
              : `<span class="cart__price cart__price--ask">Precio por<br>confirmar</span>`}
            <button type="button" class="cart__remove" data-remove>Eliminar</button>
          </div>
        </li>`;
      })
      .join("");

    const empty = cart.length === 0;
    cartEmptyEl.hidden = !empty;
    footEl.hidden = empty;

    const totals = cart.map(lineTotal);
    const known = totals.filter((t) => t != null);
    subtotalEl.textContent = known.length ? money(known.reduce((a, b) => a + b, 0)) : "Por confirmar";
    noteEl.textContent = known.length === totals.length
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
      const total = lineTotal(i);
      const brand = p.marca ? ` (${p.marca})` : "";
      lines.push(`• ${i.qty} x ${p.nombre}${brand} — ${total != null ? money(total) : "precio por confirmar"}`);
      if (i.variant) lines.push(`   ${optLabel(p)}: ${i.variant}`);
    });

    const totals = cart.map(lineTotal);
    const known = totals.filter((t) => t != null);
    if (known.length) {
      const pending = known.length < totals.length ? " + productos por confirmar" : "";
      lines.push("", `*Subtotal:* ${money(known.reduce((a, b) => a + b, 0))}${pending} + envío`);
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
    if (!cart.length || !loaded) return;
    const unavailable = cart.filter((i) => !isAvailable(byId[i.id], i.variant));
    if (unavailable.length) {
      errorEl.textContent = "Algunos productos de tu bolsa se agotaron. Quítalos para continuar.";
      errorEl.hidden = false;
      setStep("bag");
      return;
    }
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
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url;
    toast("¡Listo! Termina de enviar tu pedido en WhatsApp 💕");
  }

  /* ---------- Header ---------- */
  const header = $(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Inicio ---------- */
  renderSkeleton();
  renderCart();

  fetchCatalog().then((catalog) => {
    const ids = new Set();
    PRODUCTS = [...extras, ...catalog].filter((p) => p && p.id && !ids.has(p.id) && ids.add(p.id));
    byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
    loaded = true;

    if (!PRODUCTS.length) {
      grid.innerHTML = "";
      countEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.innerHTML = `No pudimos cargar el catálogo en este momento. <a class="link" href="${esc(waUrl("¡Hola MIMADA! ✨ Quisiera ver el catálogo."))}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>.`;
      return;
    }

    // Quitar de la bolsa lo que ya no existe o se agotó desde la última visita
    const before = cart.length;
    cart = cart.filter((i) => byId[i.id] && isAvailable(byId[i.id], i.variant));
    if (cart.length !== before) {
      saveCart();
      toast("Actualizamos tu bolsa: algunos productos ya no están disponibles.");
    }

    buildFilters();
    renderGrid();
    renderCart();
    openFromHash(); // enlace directo a un producto: .../#producto=gloss-sublime-atenea
  });
})();
