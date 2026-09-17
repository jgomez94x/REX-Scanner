const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  name: "",
  payload: null,
  inventoryFilter: "all",
  inventoryQuery: "",
  comparison: null,
  compareRequest: 0,
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
  const groups = new Map();
  for (const entry of visible.sort((a, b) => a.slotIndex - b.slotIndex)) {
    const group = Number(entry.item.group);
    const category = group <= 11 ? "Armas y armaduras" : group <= 13 ? "Accesorios y materiales" : group === 14 ? "Consumibles" : "Otros objetos";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(entry);
  }
  $("#inventoryGrid").innerHTML = [...groups].map(([category, entries]) => `
    <section class="inventory-group" aria-label="${esc(category)}">
      <div class="inventory-group-heading"><h4>${esc(category)}</h4><span>${entries.length} objeto${entries.length === 1 ? "" : "s"}</span></div>
      <div class="inventory-tiles">${entries.map(({ slotIndex, item }) => {
        const group = Number(item.group);
        const excellent = (item.excellentOptionsDecoded || []).length > 0;
        const rare = excellent || Boolean(item.ancient) || (item.sockets || []).length > 0;
        const options = (item.excellentOptionsDecoded || []).map((option) => `<li>${esc(option)}</li>`).join("");
        const flags = itemFlags(item).map((flag) => `<span class="item-tag ${esc(flag.cls || "")}">${esc(flag.text)}</span>`).join("");
        return `<details class="inventory-tile${rare ? " rare" : ""}">
          <summary title="${esc(item.name)} ${esc(item.levelDisplay || "")}">
            <span class="tile-slot">#${esc(slotIndex)}</span>
            <span class="tile-glyph" aria-hidden="true">${group <= 5 ? "⚔" : group <= 11 ? "⬡" : group <= 13 ? "✧" : "✦"}</span>
            <span class="tile-name">${esc(item.name)}</span>
            ${item.level > 0 ? `<span class="tile-level">${esc(item.levelDisplay || `+${item.level}`)}</span>` : ""}
          </summary>
          <div class="tile-details"><strong>${esc(item.name)} ${esc(item.levelDisplay || "")}</strong>
            <span>Casilla #${esc(slotIndex)} · Durabilidad ${esc(item.durability ?? 0)}</span>
            ${flags ? `<div class="item-tags">${flags}</div>` : ""}
            ${options ? `<ul>${options}</ul>` : ""}
          </div>
        </details>`;
      }).join("")}</div>
    </section>`).join("");
  $("#inventoryEmpty").hidden = visible.length > 0;
}

function comparisonValue(data, key) {
  const c = data.character;
  return ({ level: c.level, resets: c.resets, masterLevel: c.masterLevel,
    zen: c.economy?.zen, strength: c.stats?.strength, dexterity: c.stats?.dexterity,
    vitality: c.stats?.vitality, energy: c.stats?.energy,
    kills: c.combat?.kills, deaths: c.combat?.deaths,
    equipped: data.equipment?.slots?.filter((slot) => slot.item).length,
    inventory: data.inventory?.slots?.length })[key];
}

function serverLabel(value) {
  if (value === "REX-ASIA") return "Asia (REX-ASIA)";
  if (value === "REX") return "Latam (REX)";
  return value || "No disponible";
}

function renderComparison() {
  const other = state.comparison;
  const panel = $("#compareResult");
  if (!other || !state.payload) { panel.hidden = true; panel.innerHTML = ""; return; }
  const first = state.payload;
  const rows = [
    ["Nivel", "level"], ["Resets", "resets"], ["Master Level", "masterLevel"],
    ["Zen", "zen"], ["Fuerza", "strength"], ["Agilidad", "dexterity"],
    ["Vitalidad", "vitality"], ["Energía", "energy"],
    ["Kills", "kills"], ["Deaths", "deaths"],
    ["Equipo colocado", "equipped"], ["Objetos en mochila", "inventory"],
  ];
  panel.innerHTML = `<div class="compare-table" role="table" aria-label="Comparación de personajes">
    <div class="compare-row compare-head" role="row"><span role="columnheader">Dato</span>
      <strong role="columnheader">${esc(first.character.name)} <small>${esc(CLASS_FAMILY[first.character.class] || first.character.class)}</small></strong>
      <strong role="columnheader">${esc(other.character.name)} <small>${esc(CLASS_FAMILY[other.character.class] || other.character.class)}</small></strong></div>
    <div class="compare-row" role="row"><span role="rowheader">Estado</span><strong role="cell">${first.online ? "🟢 Online" : "🔴 Offline"}</strong><strong role="cell">${other.online ? "🟢 Online" : "🔴 Offline"}</strong></div>
    <div class="compare-row" role="row"><span role="rowheader">Servidor</span><strong role="cell">${esc(serverLabel(first.characterServer))}</strong><strong role="cell">${esc(serverLabel(other.characterServer))}</strong></div>
    <div class="compare-row" role="row"><span role="rowheader">Mapa</span><strong role="cell">${esc(first.character.location?.mapName || "—")}</strong><strong role="cell">${esc(other.character.location?.mapName || "—")}</strong></div>
    <div class="compare-row" role="row"><span role="rowheader">Guild</span><strong role="cell">${esc(first.character.guild?.name || "Sin guild")}</strong><strong role="cell">${esc(other.character.guild?.name || "Sin guild")}</strong></div>
    <div class="compare-row" role="row"><span role="rowheader">Ranking global</span><strong role="cell">${first.rankings?.globalRank ? `#${number.format(first.rankings.globalRank)}` : "Fuera Top 100"}</strong><strong role="cell">${other.rankings?.globalRank ? `#${number.format(other.rankings.globalRank)}` : "Fuera Top 100"}</strong></div>
    ${rows.map(([label, key]) => {
      const a = comparisonValue(first, key), b = comparisonValue(other, key);
      const diff = a == null || b == null ? "" : `<small class="compare-delta">${b - a >= 0 ? "+" : "−"}${number.format(Math.abs(b - a))} frente al primer PJ</small>`;
      return `<div class="compare-row" role="row"><span role="rowheader">${label}</span><strong role="cell">${a == null ? "—" : number.format(a)}</strong><strong role="cell">${b == null ? "—" : number.format(b)}${diff}</strong></div>`;
    }).join("")}
  </div>`;
  panel.hidden = false;
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
  $("#locationServer").textContent = `Servidor: ${data.characterServer ? serverLabel(data.characterServer) : "No disponible en la API"}`;
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
  renderComparison();

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
    if (state.name && state.name.toLowerCase() !== payload.data.character.name.toLowerCase()) {
      state.compareRequest++;
      state.comparison = null;
      $("#compareName").value = "";
      $("#compareError").hidden = true;
      $("#compareButton").disabled = false;
      $("#compareButton").textContent = "Comparar";
    }
    render(payload.data);
    if (state.comparison?.character.name.toLowerCase() === payload.data.character.name.toLowerCase()) {
      state.comparison = null;
      renderComparison();
    }
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
    `📍 ${c.location?.mapName || "—"} [${c.location?.x ?? "—"},${c.location?.y ?? "—"}] · Servidor: ${serverLabel(d.characterServer)}\n` +
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

$("#compareForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("#compareName").value.trim();
  const error = $("#compareError");
  if (!/^[a-zA-Z0-9_-]{1,10}$/.test(name)) {
    error.textContent = "Escribe un nombre válido de hasta 10 caracteres.";
    error.hidden = false;
    return;
  }
  if (name.toLowerCase() === state.name.toLowerCase()) {
    error.textContent = "Elige un personaje distinto al primero.";
    error.hidden = false;
    return;
  }
  const request = ++state.compareRequest;
  error.hidden = true;
  $("#compareButton").disabled = true;
  $("#compareButton").textContent = "Comparando…";
  try {
    const response = await fetch(`/api/character?name=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || "No se pudo consultar el PJ.");
    if (request !== state.compareRequest) return;
    if (result.data.character.name.toLowerCase() === state.name.toLowerCase()) throw new Error("Elige un personaje distinto al primero.");
    state.comparison = result.data;
    renderComparison();
    rememberName(result.data.character.name);
  } catch (caught) {
    if (request !== state.compareRequest) return;
    error.textContent = caught.message === "CHARACTER_NOT_FOUND" ? "No encontré ese segundo personaje." : caught.message;
    error.hidden = false;
  } finally {
    if (request === state.compareRequest) {
      $("#compareButton").disabled = false;
      $("#compareButton").textContent = "Comparar";
    }
  }
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
