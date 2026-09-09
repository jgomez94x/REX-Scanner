const API_BASE = "https://ofapi.rexmu.online/api/v1";
const API_HEADERS = {
  Accept: "application/json",
  Origin: "https://rexmu.online",
  Referer: "https://rexmu.online/",
  "User-Agent": "REX-Scanner/1.0",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function api(path, ttl = 10) {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: API_HEADERS,
    cf: { cacheEverything: true, cacheTtl: ttl },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || payload?.error || `UPSTREAM_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function classFamily(classCode) {
  const base = Number(classCode) & 0xf0;
  return ({ 0: "DW", 16: "DK", 32: "FE", 48: "MG", 64: "DL", 80: "SUM", 96: "RF" })[base] || null;
}

async function onlineState(name) {
  const first = await api("server/online/players?page=1&pageSize=100", 8);
  const firstMatch = first.data.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (firstMatch) return { online: true, total: first.data.total, player: firstMatch };

  const pages = Math.ceil(first.data.total / 100);
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - start + 1) }, (_, index) => start + index)
        .map((page) => api(`server/online/players?page=${page}&pageSize=100`, 8)),
    );
    for (const response of batch) {
      const match = response.data.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
      if (match) return { online: true, total: first.data.total, player: match };
    }
  }
  return { online: false, total: first.data.total, player: null };
}

async function rankingState(character) {
  const family = classFamily(character.classCode);
  const global = await api("rankings/characters?page=1&pageSize=100&sortBy=resets", 20);
  const globalMatch = global.data.find((row) => row.name.toLowerCase() === character.name.toLowerCase());
  if (!family) return { globalRank: globalMatch?.rank || null, classRank: null, classTotal: null, isVip: globalMatch?.isVip || false };

  const first = await api(`rankings/characters?page=1&pageSize=100&sortBy=resets&class=${family}`, 20);
  let classMatch = first.data.find((row) => row.name.toLowerCase() === character.name.toLowerCase());
  if (!classMatch) {
    for (let start = 2; start <= first.meta.totalPages; start += 5) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(5, first.meta.totalPages - start + 1) }, (_, index) => start + index)
          .map((page) => api(`rankings/characters?page=${page}&pageSize=100&sortBy=resets&class=${family}`, 20)),
      );
      classMatch = batch.flatMap((response) => response.data)
        .find((row) => row.name.toLowerCase() === character.name.toLowerCase());
      if (classMatch) break;
    }
  }
  return {
    globalRank: globalMatch?.rank || null,
    classRank: classMatch?.rank || null,
    classTotal: first.meta.total,
    isVip: Boolean(globalMatch?.isVip ?? classMatch?.isVip),
  };
}

async function optional(task, fallback, warnings, label) {
  try { return await task; }
  catch { warnings.push(label); return fallback; }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const name = (url.searchParams.get("name") || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,10}$/.test(name)) {
    return json({ success: false, error: "INVALID_CHARACTER_NAME" }, 400);
  }

  let character;
  try {
    character = (await api(`characters/${encodeURIComponent(name)}`, 5)).data;
  } catch (error) {
    return json({ success: false, error: error.status === 404 ? "CHARACTER_NOT_FOUND" : "REX_API_UNAVAILABLE" }, error.status === 404 ? 404 : 502);
  }

  const encoded = encodeURIComponent(character.name);
  const warnings = [];
  const [equipment, inventory, skills, history, online, rankings, guildDetail] = await Promise.all([
    optional(api(`characters/${encoded}/equipment`, 20).then((r) => r.data), { slots: [] }, warnings, "equipment"),
    optional(api(`characters/${encoded}/inventory`, 20).then((r) => r.data), { slots: [] }, warnings, "inventory"),
    optional(api(`characters/${encoded}/skills`, 20).then((r) => r.data), { skills: [], masterSkills: [] }, warnings, "skills"),
    optional(api(`characters/${encoded}/history`, 15).then((r) => r.data), [], warnings, "history"),
    optional(onlineState(character.name), { online: false, total: 0, player: null }, warnings, "online"),
    optional(rankingState(character), { globalRank: null, classRank: null, classTotal: null, isVip: false }, warnings, "rankings"),
    character.guild?.name
      ? optional(api(`guilds/${encodeURIComponent(character.guild.name)}`, 60).then((r) => r.data), null, warnings, "guild")
      : Promise.resolve(null),
  ]);

  return json({
    success: true,
    data: {
      character,
      equipment,
      inventory,
      skills,
      history,
      online: online.online,
      onlinePlayer: online.player,
      onlineTotal: online.total,
      rankings,
      guildDetail,
      warnings,
      fetchedAt: new Date().toISOString(),
    },
  });
}
