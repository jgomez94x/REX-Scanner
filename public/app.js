const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  name: "",
  payload: null,
  inventoryFilter: "all",
  inventoryQuery: "",
};

const CLASS_FAMILY = {
  DW: "Dark Wizard", SM: "Soul Master", GM: "Grand Master",
  DK: "Dark Knight", BK: "Blade Knight", BM: "Blade Master",
  FE: "Fairy Elf", ME: "Muse Elf", HE: "High Elf",
  MG: "Magic Gladiator", DM: "Duel Master",
  DL: "Dark Lord", LE: "Lord Emperor",
  SUM: "Summoner", BS: "Bloody Summoner", DS: "Dimension Master",
  RF: "Rage Fighter", FM: "Fist Master",
};

const SLOT_LABELS = {
  RightHand: "Mano derecha", LeftHand: "Mano izquierda", Helm: "Casco",
  Armor: "Armadura", Pants: "Pantalones", Gloves: "Guantes", Boots: "Botas",
  Wings: "Alas", Pet: "Mascota", Pendant: "Pendant",
  RingRight: "Anillo derecho", RingLeft: "Anillo izquierdo",
};

const number = new Intl.NumberFormat("es-VE");
const date = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Caracas",
});

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeDate(value, empty = "No disponible") {
  if (!value || String(value).startsWith("1900-")) return empty;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? empty : date.format(parsed);
}

function setBusy(busy) {
  $("#searchButton").disabled = busy;
  $("#searchButton").textContent = busy ? "Buscando…" : "Buscar";
  $("#loadingState").hidden = !busy;
}

function showFeedback(message) {
  const el = $("#feedback");
  el.textContent = message;
  el.hidden = !message;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2300);
}

function recentNames() {
  try { return JSON.parse(localStorage.getItem("rex-scanner-recents") || "[]"); }
  catch { return []; }
}

function rememberName(name) {
  const next = [name, ...recentNames().filter((item) => item.toLowerCase() !== name.toLowerCase())].slice(0, 5);
  localStorage.setItem("rex-scanner-recents", JSON.stringify(next));
  renderRecents();
}

function renderRecents() {
  const names = recentNames();
  const wrap = $("#recentSearches");
  const list = $("#recentList");
  list.innerHTML = names.map((name) => `<button type="button" data-name="${esc(name)}">${esc(name)}</button>`).join("");
  wrap.hidden = names.length === 0;
}

function statCell(label, value, accent = false) {
  return `<div class="data-cell${accent ? " accent" : ""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function itemFlags(item) {
  if (!item) return [];
  const flags = [];
  if (item.hasSkill) flags.push({ text: "Skill" });
  if (item.hasLuck) flags.push({ text: "Luck", cls: "luck" });
  if (Number(item.addOptionDisplay) > 0) flags.push({ text: `Adicional +${item.addOptionDisplay}` });
  if (item.ancient) flags.push({ text: "Ancient" });
  if ((item.sockets || []).length) flags.push({ text: `${item.sockets.length} sockets` });
  if (item.isItem380) flags.push({ text: "Opción 380" });
  if (item.isExpired) flags.push({ text: "Vencido" });
  if (item.isPeriodic) flags.push({ text: "Temporal" });
  return flags;
}

function itemCard(item, slotLabel, slotNumber = null) {
  if (!item) {
    return `<div class="item-card empty"><div><div class="item-slot">${esc(slotLabel)}</div>Vacío</div></div>`;
  }
  const excellent = (item.excellentOptionsDecoded || []).length > 0;
  const flags = itemFlags(item);
  const options = item.excellentOptionsDecoded || [];
  return `
    <div class="item-card${excellent ? " excellent" : ""}">
      ${slotNumber === null ? "" : `<span class="slot-number">#${esc(slotNumber)}</span>`}
      <div class="item-slot">${esc(slotLabel)}</div>
      <h4>${esc(item.name)} ${esc(item.levelDisplay || "")}</h4>
      <div class="item-tags">
        <span class="item-tag">Dur. ${esc(item.durability ?? 0)}</span>
        ${flags.map((flag) => `<span class="item-tag ${esc(flag.cls || "")}">${esc(flag.text)}</span>`).join("")}
      </div>
      ${options.length ? `<div class="item-options">${options.map((option) => `<span>• ${esc(option)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function renderSummary(data) {
  const c = data.character;
  const stats = c.stats || {};
  const combat = c.combat || {};
  const total = [stats.strength, stats.dexterity, stats.vitality, stats.energy, stats.leadership]
    .reduce((sum, value) => sum + Number(value || 0), 0);

  $("#statsGrid").innerHTML = [
    ["Fuerza", stats.strength], ["Agilidad", stats.dexterity],
    ["Vitalidad", stats.vitality], ["Energía", stats.energy],
    ["Comando", stats.leadership], ["Puntos libres", stats.freePoints, true],
  ].map(([label, value, accent]) => statCell(label, number.format(value || 0), accent)).join("");
  $("#totalStats").textContent = `${number.format(total)} pts colocados`;

  const kd = Number(combat.deaths) ? (Number(combat.kills || 0) / Number(combat.deaths)).toFixed(2) : Number(combat.kills) ? "∞" : "0.00";
  $("#combatGrid").innerHTML = [
    ["Kills", combat.kills], ["Deaths", combat.deaths], ["K/D", kd],
    ["PK Count", combat.pkCount], ["PK Level", combat.pkLevel], ["Honor", combat.honor],
  ].map(([label, value]) => statCell(label, number.format(value || 0))).join("");

  if (c.guild) {
    const gd = data.guildDetail;
    $("#guildContent").innerHTML = `
      <div class="guild-card"><div class="guild-mark">${esc(c.guild.name.slice(0, 2).toUpperCase())}</div>
      <div><strong>${esc(c.guild.name)}</strong><span>${esc(c.guild.statusLabel || "Miembro")}${gd ? ` · GM ${esc(gd.master || "—")} · ${number.format((gd.members || []).length)} miembros` : ""}</span></div></div>`;
  } else {
    $("#guildContent").innerHTML = `<div class="guild-card"><div class="guild-mark">—</div><div><strong>Sin guild</strong><span>No pertenece a ningún clan</span></div></div>`;
  }

  const meta = c.meta || {};
  $("#activityContent").innerHTML = [
    ["Creado", safeDate(meta.createdAt)],
    ["Último login", safeDate(meta.lastLogin)],
    ["Último reset", safeDate(meta.lastReset, "Nunca")],
  ].map(([label, value]) => `<div class="timeline-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
}

function renderEquipment(data) {
  const slots = data.equipment?.slots || [];
  const equipped = slots.filter((slot) => slot.item).length;
  $("#equipmentCount").textContent = equipped;
  $("#equipmentGrid").innerHTML = slots.map((slot) => itemCard(slot.item, SLOT_LABELS[slot.position] || slot.position)).join("");
}

function inventoryMatches(item) {
  const query = state.inventoryQuery.trim().toLowerCase();
  if (query && !String(item.name).toLowerCase().includes(query)) return false;
  if (state.inventoryFilter === "excellent") return (item.excellentOptionsDecoded || []).length > 0;
  if (state.inventoryFilter === "ancient") return Boolean(item.ancient);
  if (state.inventoryFilter === "socket") return (item.sockets || []).length > 0;
  return true;
}

function renderInventory() {
  const slots = state.payload?.inventory?.slots || [];
  const visible = slots.filter(({ item }) => inventoryMatches(item));
  $("#inventoryCount").textContent = slots.length;
  $("#inventoryGrid").innerHTML = visible.map(({ slotIndex, item }) => itemCard(item, "Inventario", slotIndex)).join("");
  $("#inventoryEmpty").hidden = visible.length > 0;
}

function renderSkills(data) {
  const normal = data.skills?.skills || [];
  const master = data.skills?.masterSkills || [];
  $("#skillsCount").textContent = normal.length + master.length;
  $("#masterSkillNote").textContent = `${master.length} master skills asignadas`;
  const all = [
    ...normal.map((skill) => ({ ...skill, kind: "Skill" })),
    ...master.map((skill) => ({ ...skill, kind: "Master" })),
  ];
  $("#skillsGrid").innerHTML = all.length
    ? all.map((skill) => `<div class="skill-card"><div class="skill-icon">${esc(skill.skillId)}</div><div><strong>${esc(skill.kind)} #${esc(skill.skillId)}</strong><span>Slot ${esc(skill.slot ?? "—")} · Nivel ${esc(skill.level ?? 0)}</span></div></div>`).join("")
    : `<p class="empty-message">No se detectaron skills.</p>`;
}

function render(data) {
  state.payload = data;
  const c = data.character;
  state.name = c.name;
  const family = CLASS_FAMILY[c.class] || c.class;
  const online = Boolean(data.online);

  $("#classEmblem").textContent = c.class;
  $("#characterTitle").textContent = c.name;
  $("#characterSubtitle").textContent = `${family} · Código ${c.classCode}`;
  $("#onlineBadge").textContent = online ? "● ONLINE" : "● OFFLINE";
  $("#onlineBadge").className = `badge${online ? "" : " offline"}`;
  $("#vipBadge").hidden = !data.rankings?.isVip;
  $("#locationName").textContent = c.location?.mapName || "No disponible";
  $("#locationCoords").textContent = c.location ? `X ${c.location.x} · Y ${c.location.y}` : "Sin coordenadas";
  $("#quickLevel").textContent = number.format(c.level || 0);
  $("#quickResets").textContent = number.format(c.resets || 0);
  $("#quickMaster").textContent = number.format(c.masterLevel || 0);
  $("#quickZen").textContent = number.format(c.economy?.zen || 0);
  $("#quickGlobalRank").textContent = data.rankings?.globalRank ? `#${data.rankings.globalRank}` : "Fuera Top 100";
  $("#quickClassRank").textContent = data.rankings?.classRank ? `#${data.rankings.classRank}` : "—";
  $("#serverState").innerHTML = `<span class="status-dot"></span>${number.format(data.onlineTotal || 0)} jugadores online`;
  $("#updatedAt").textContent = `Actualizado ${date.format(new Date(data.fetchedAt || Date.now()))}`;

  renderSummary(data);
  renderEquipment(data);
  renderInventory();
  renderSkills(data);

  $("#emptyState").hidden = true;
  $("#result").hidden = false;
  const url = new URL(location.href);
  url.searchParams.set("pj", c.name);
  history.replaceState({}, "", url);
  document.title = `${c.name} — REX Scanner`;
}

async function lookup(rawName) {
  const name = rawName.trim();
  if (!/^[a-zA-Z0-9_-]{1,10}$/.test(name)) {
    showFeedback("Escribe un nombre válido de hasta 10 caracteres.");
    return;
  }
  setBusy(true);
  showFeedback("");
  try {
    const response = await fetch(`/api/character?name=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || "No se pudo consultar el personaje.");
    render(payload.data);
    rememberName(payload.data.character.name);
  } catch (error) {
    $("#result").hidden = true;
    $("#emptyState").hidden = false;
    showFeedback(error.message === "CHARACTER_NOT_FOUND" ? "Ese personaje no existe o todavía no aparece en la API." : error.message);
    $("#serverState").innerHTML = `<span class="status-dot red"></span>No se pudo actualizar`;
  } finally {
    setBusy(false);
  }
}

function activateTab(name) {
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.id === `${name}Panel`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function summaryText() {
  const d = state.payload;
  if (!d) return "";
  const c = d.character;
  const combat = c.combat || {};
  const kd = Number(combat.deaths) ? (combat.kills / combat.deaths).toFixed(2) : "0.00";
  return `${d.online ? "🟢" : "🔴"} ${c.name} está ${d.online ? "ONLINE" : "OFFLINE"}\n` +
    `⚔️ ${CLASS_FAMILY[c.class] || c.class} · Nivel ${number.format(c.level)} · Reset ${number.format(c.resets)}\n` +
    `⭐ Master Level ${number.format(c.masterLevel)}${d.rankings?.isVip ? " · VIP ✅" : ""}\n` +
    `📍 ${c.location?.mapName || "—"} [${c.location?.x ?? "—"},${c.location?.y ?? "—"}]\n` +
    `💰 ${number.format(c.economy?.zen || 0)} Zen\n` +
    `🎯 ${number.format(combat.kills || 0)} Kills · ${number.format(combat.deaths || 0)} Deaths · K/D ${kd}\n` +
    `🏰 Guild: ${c.guild?.name || "Sin guild"}`;
}

$("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  lookup($("#characterName").value);
});

$("#recentList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-name]");
  if (!button) return;
  $("#characterName").value = button.dataset.name;
  lookup(button.dataset.name);
});

$("#refreshButton").addEventListener("click", () => state.name && lookup(state.name));
$("#shareButton").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(summaryText()); toast("Resumen copiado"); }
  catch { toast("No se pudo copiar el resumen"); }
});

$(".tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) activateTab(tab.dataset.tab);
});

$("#inventoryFilters").addEventListener("click", (event) => {
  const filter = event.target.closest("[data-filter]");
  if (!filter) return;
  state.inventoryFilter = filter.dataset.filter;
  $$(".filter").forEach((item) => item.classList.toggle("active", item === filter));
  renderInventory();
});

$("#inventorySearch").addEventListener("input", (event) => {
  state.inventoryQuery = event.target.value;
  renderInventory();
});

renderRecents();
const initialName = new URLSearchParams(location.search).get("pj");
if (initialName) {
  $("#characterName").value = initialName;
  lookup(initialName);
}
