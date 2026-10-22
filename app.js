const PAGE_SIZE = 24;
const STORAGE_KEY = "field-furrow-quote-list";
const QUOTE_EMAIL = "louisb10@me.com";

const $ = (selector) => document.querySelector(selector);
const productGrid = $("#product-grid");
const searchInput = $("#search-input");
const suggestions = $("#suggestions");
const resultsSummary = $("#results-summary");
const emptyState = $("#empty-state");
const activeFilter = $("#active-filter");
const loadMoreProducts = $("#load-more-products");
const drawer = $("#quote-drawer");
const backdrop = $("#drawer-backdrop");
const drawerItems = $("#drawer-items");
const drawerEmpty = $("#drawer-empty");
const drawerFooter = $("#drawer-footer");
const toast = $("#toast");
const dialog = $("#part-dialog");
const dialogBody = $("#dialog-body");

let products = [];
let categories = [];
let activeCategory = "all";
let visibleProductCount = PAGE_SIZE;
let loadError = "";
let toastTimer;
let quoteItems = [];
try {
  quoteItems = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
} catch {
  quoteItems = [];
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const normalize = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const categoryById = (id) => categories.find((category) => category.id === id);
const photo = (product) => encodeURI(`./${product.i}`);

function searchTerms() {
  return normalize(searchInput.value).split(/\s+/).filter(Boolean);
}

function matchesTerms(product, terms) {
  return terms.every((term) => product.s.includes(term));
}

function filteredProducts() {
  const terms = searchTerms();
  let list = products.filter((product) => (activeCategory === "all" || product.c === activeCategory) && matchesTerms(product, terms));
  if (terms.length) {
    // exact part-number hits first
    const joined = terms.join("");
    const rank = (product) => {
      const code = normalize(product.p).replace(/ /g, "");
      return code === joined ? 0 : code.startsWith(joined) ? 1 : 2;
    };
    list = list.map((product, index) => ({ product, index, rank: rank(product) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.product);
  }
  const sort = $("#sort-select").value;
  if (sort === "part-asc") list = [...list].sort((a, b) => a.p.localeCompare(b.p, undefined, { numeric: true }));
  if (sort === "part-desc") list = [...list].sort((a, b) => b.p.localeCompare(a.p, undefined, { numeric: true }));
  return list;
}

function productCard(product) {
  const category = categoryById(product.c);
  return `
    <article class="product-card">
      <button class="product-visual" type="button" data-open-part="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.p)} details">
        <span class="product-tag">${escapeHtml(category ? category.label : "")}</span>
        <img src="${photo(product)}" alt="${escapeHtml(product.p)} — ${escapeHtml(product.n)}" loading="lazy" decoding="async">
      </button>
      <div class="product-info">
        <p class="part-number">${escapeHtml(product.p)}${product.o ? ` <span aria-hidden="true">·</span> OEM ${escapeHtml(product.o)}` : ""}</p>
        <h3 class="product-name">${escapeHtml(product.n)}</h3>
        <p class="product-fit">${escapeHtml(product.t)}</p>
        <div class="product-card-footer">
          <button class="add-button" type="button" data-add-product="${escapeHtml(product.id)}"><span aria-hidden="true">+</span> Add to list</button>
        </div>
      </div>
    </article>`;
}

function renderCategories() {
  const groups = ["Planting", "Tillage", "Harvest", "Other"];
  $("#category-groups").innerHTML = groups.map((group) => {
    const items = categories.filter((category) => category.group === group);
    if (!items.length) return "";
    return `
      <div class="category-group">
        <h3 class="category-group-title">${group}</h3>
        <div class="category-grid">
          ${items.map((category) => `
            <button class="category-card" type="button" data-category="${category.id}" aria-pressed="${activeCategory === category.id}">
              <span class="category-photo"><img src="${encodeURI(`./${category.sample}`)}" alt="" loading="lazy" decoding="async"></span>
              <span class="category-label">${escapeHtml(category.label)}</span>
              <span class="category-count">${category.count} parts</span>
            </button>`).join("")}
        </div>
      </div>`;
  }).join("");
}

function renderActiveFilter() {
  const category = categoryById(activeCategory);
  activeFilter.innerHTML = category
    ? `<span class="filter-chip">${escapeHtml(category.label)} <button type="button" data-clear-category aria-label="Clear category filter">×</button></span>`
    : `<span class="filter-all">All categories</span>`;
}

function renderProducts() {
  const matching = filteredProducts();
  const shown = matching.slice(0, visibleProductCount);
  productGrid.innerHTML = shown.map(productCard).join("");
  const query = searchInput.value.trim();
  resultsSummary.textContent = `${matching.length.toLocaleString()} part${matching.length === 1 ? "" : "s"}${query ? ` matching “${query}”` : ""}`;
  emptyState.hidden = matching.length > 0;
  loadMoreProducts.hidden = matching.length <= shown.length;
  loadMoreProducts.innerHTML = `Show more parts (${(matching.length - shown.length).toLocaleString()} left) <span aria-hidden="true">↓</span>`;
}

function renderSuggestions() {
  const terms = searchTerms();
  if (!terms.length || !products.length) {
    suggestions.hidden = true;
    return;
  }
  const list = products.filter((product) => matchesTerms(product, terms)).slice(0, 6);
  if (!list.length) {
    suggestions.innerHTML = `<p class="suggestion-empty">No parts match “${escapeHtml(searchInput.value.trim())}”.</p>`;
    suggestions.hidden = false;
    return;
  }
  suggestions.innerHTML = list.map((product) => `
    <button class="suggestion" type="button" data-open-part="${escapeHtml(product.id)}">
      <img src="${photo(product)}" alt="" loading="lazy" decoding="async">
      <span><strong>${escapeHtml(product.p)}</strong><small>${escapeHtml(product.n)}</small></span>
    </button>`).join("") + `<button class="suggestion suggestion-all" type="button" data-show-all>See all results ↓</button>`;
  suggestions.hidden = false;
}

function renderAll() {
  renderCategories();
  renderActiveFilter();
  renderProducts();
}

function openPart(id) {
  const product = products.find((entry) => entry.id === id);
  if (!product) return;
  const category = categoryById(product.c);
  dialogBody.innerHTML = `
    <div class="dialog-photo"><img src="${photo(product)}" alt="${escapeHtml(product.p)}"></div>
    <div class="dialog-info">
      <p class="eyebrow dark-eyebrow">${escapeHtml(category ? category.label : "")}</p>
      <h2 id="dialog-title">${escapeHtml(product.p)}</h2>
      <p class="dialog-name">${escapeHtml(product.n)}</p>
      <dl class="dialog-specs">
        ${product.o ? `<div><dt>OEM no.</dt><dd>${escapeHtml(product.o)}</dd></div>` : ""}
        ${product.w ? `<div><dt>Weight</dt><dd>${escapeHtml(product.w)}</dd></div>` : ""}
      </dl>
      <p class="dialog-text">${escapeHtml(product.t)}</p>
      <div class="dialog-actions">
        <button class="quote-submit dialog-add" type="button" data-add-product="${escapeHtml(product.id)}">Add to quote list <span aria-hidden="true">+</span></button>
      </div>
    </div>`;
  suggestions.hidden = true;
  dialog.showModal();
}

function updateCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteItems));
  const count = quoteItems.reduce((sum, item) => sum + item.quantity, 0);
  $("#cart-count").textContent = String(count);
  drawerItems.innerHTML = quoteItems.map((item, index) => `
    <article class="drawer-item">
      ${item.img ? `<img class="drawer-thumb" src="${encodeURI(item.img)}" alt="">` : ""}
      <div class="drawer-item-info">
        <strong>${escapeHtml(item.part)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </div>
      <div class="drawer-item-controls">
        <button type="button" class="quantity-button" data-quantity="${index}" data-delta="-1" aria-label="Decrease quantity">−</button>
        <span class="quantity-value">${item.quantity}</span>
        <button type="button" class="quantity-button" data-quantity="${index}" data-delta="1" aria-label="Increase quantity">+</button>
      </div>
      <button type="button" class="remove-button" data-remove="${index}">Remove</button>
    </article>`).join("");
  drawerEmpty.hidden = quoteItems.length > 0;
  drawerItems.hidden = quoteItems.length === 0;
  drawerFooter.hidden = quoteItems.length === 0;
  const subject = `Parts quote request — ${count} item${count === 1 ? "" : "s"}`;
  const body = [
    "Hello,", "",
    "Please quote the following parts:",
    ...quoteItems.map((item) => `- ${item.part} | Qty ${item.quantity} | ${item.description}`),
    "", "Please confirm pricing, availability, and fitment.", "", "Thank you,",
  ].join("\n");
  $("#quote-submit").href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function addQuoteItem(item) {
  const existing = quoteItems.find((entry) => entry.part === item.part);
  if (existing) existing.quantity += 1;
  else quoteItems.push({ ...item, quantity: 1 });
  updateCart();
  showToast(`${item.part} added to your quote list`);
}

function openDrawer() {
  backdrop.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  $("#close-cart").focus();
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("drawer-open");
  $("#open-cart").focus();
}

function selectCategory(id) {
  activeCategory = id;
  visibleProductCount = PAGE_SIZE;
  renderAll();
}

function scrollToShop() {
  $("#shop").scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    selectCategory(categoryButton.dataset.category);
    scrollToShop();
    return;
  }
  if (event.target.closest("[data-clear-category]")) {
    selectCategory("all");
    return;
  }
  if (event.target.closest("[data-show-all]")) {
    suggestions.hidden = true;
    scrollToShop();
    return;
  }
  const openButton = event.target.closest("[data-open-part]");
  if (openButton) {
    openPart(openButton.dataset.openPart);
    return;
  }
  const addButton = event.target.closest("[data-add-product]");
  if (addButton) {
    const product = products.find((entry) => entry.id === addButton.dataset.addProduct);
    if (product) addQuoteItem({ part: product.p, description: product.n, img: product.i });
    return;
  }
  if (!event.target.closest(".hero-search")) suggestions.hidden = true;
});

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  suggestions.hidden = true;
  visibleProductCount = PAGE_SIZE;
  renderAll();
  scrollToShop();
});

searchInput.addEventListener("input", () => {
  visibleProductCount = PAGE_SIZE;
  renderProducts();
  renderSuggestions();
});
searchInput.addEventListener("focus", renderSuggestions);
$("#sort-select").addEventListener("change", renderProducts);
loadMoreProducts.addEventListener("click", () => {
  visibleProductCount += PAGE_SIZE;
  renderProducts();
});
drawerItems.addEventListener("click", (event) => {
  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    const index = Number(quantityButton.dataset.quantity);
    quoteItems[index].quantity += Number(quantityButton.dataset.delta);
    if (quoteItems[index].quantity <= 0) quoteItems.splice(index, 1);
    updateCart();
    return;
  }
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    quoteItems.splice(Number(removeButton.dataset.remove), 1);
    updateCart();
  }
});

$("#open-cart").addEventListener("click", openDrawer);
$("#close-cart").addEventListener("click", closeDrawer);
$("#continue-shopping").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);
$("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    suggestions.hidden = true;
    if (drawer.classList.contains("is-open")) closeDrawer();
  }
});

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}). Start the site with “python3 -m http.server” from this folder.`);
  return response.json();
}

Promise.all([loadJson("./products.json"), loadJson("./categories.json")])
  .then(([productData, categoryData]) => {
    products = productData.map((product, index) => ({
      ...product,
      id: String(index),
      s: normalize(`${product.p} ${product.o} ${product.n} ${product.t} ${(categoryData.find((category) => category.id === product.c) || {}).label || ""}`),
    }));
    categories = categoryData;
    $("#stat-parts").textContent = products.length.toLocaleString();
    $("#stat-cats").textContent = String(categories.length);
    renderAll();
  })
  .catch((error) => {
    loadError = error.message;
    resultsSummary.textContent = loadError;
  });

updateCart();
