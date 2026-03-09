const state = {
  assets: [],
  services: [],
  macros: [],
  flows: [],
};

const byId = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

function save() {
  localStorage.setItem("mapa-portas-state", JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem("mapa-portas-state");
  if (raw) Object.assign(state, JSON.parse(raw));
}

function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

function refreshSelectors() {
  const servers = state.assets.filter((a) => a.type === "server");
  const clients = state.assets.filter((a) => a.type === "client");
  const networks = state.assets.filter((a) => a.type === "network");
  const pathNodes = state.assets.filter((a) => ["gateway", "firewall", "device"].includes(a.type));

  byId("service-server").replaceChildren(...servers.map((s) => option(s.id, s.name)));
  byId("macro-services").replaceChildren(
    ...state.services.map((s) => option(s.id, `${s.name} (porta ${s.port})`))
  );
  byId("flow-client").replaceChildren(...clients.map((c) => option(c.id, c.name)));
  byId("flow-network").replaceChildren(...networks.map((n) => option(n.id, n.name)));

  const serviceOptions = [
    ...state.services.map((s) => ({ id: `svc:${s.id}`, name: `Serviço: ${s.name}` })),
    ...state.macros.map((m) => ({ id: `macro:${m.id}`, name: `Macro: ${m.name}` })),
  ];
  byId("flow-service").replaceChildren(...serviceOptions.map((s) => option(s.id, s.name)));

  byId("flow-path").replaceChildren(...pathNodes.map((n) => option(n.id, n.name)));

  const mapOptions = state.flows.map((f) => {
    const client = state.assets.find((a) => a.id === f.clientId)?.name || "?";
    const dest = displayTarget(f.target);
    return option(f.id, `${client} -> ${dest}`);
  });
  byId("map-selector").replaceChildren(...mapOptions);
}

function displayTarget(target) {
  const [kind, id] = target.split(":");
  if (kind === "svc") {
    const svc = state.services.find((s) => s.id === id);
    return svc ? `${svc.name}:${svc.port}` : "serviço removido";
  }
  const macro = state.macros.find((m) => m.id === id);
  if (!macro) return "macro removido";
  const services = macro.serviceIds
    .map((svcId) => state.services.find((s) => s.id === svcId))
    .filter(Boolean)
    .map((s) => `${s.name}:${s.port}`)
    .join(", ");
  return `${macro.name} [${services}]`;
}

function renderLists() {
  byId("asset-list").replaceChildren(
    ...state.assets.map((a) => {
      const li = document.createElement("li");
      li.textContent = `${a.type.toUpperCase()}: ${a.name}${a.details ? ` (${a.details})` : ""}`;
      return li;
    })
  );

  byId("service-list").replaceChildren(
    ...state.services.map((s) => {
      const li = document.createElement("li");
      const server = state.assets.find((a) => a.id === s.serverId)?.name || "Servidor removido";
      li.textContent = `${s.name} | porta ${s.port} | destino: ${server}`;
      return li;
    })
  );

  byId("macro-list").replaceChildren(
    ...state.macros.map((m) => {
      const li = document.createElement("li");
      li.textContent = `${m.name}: ${m.serviceIds
        .map((id) => state.services.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .join(", ")}`;
      return li;
    })
  );

  byId("flow-list").replaceChildren(
    ...state.flows.map((f) => {
      const li = document.createElement("li");
      const client = state.assets.find((a) => a.id === f.clientId)?.name || "?";
      const network = state.assets.find((a) => a.id === f.networkId)?.name || "?";
      const path = f.pathIds
        .map((id) => state.assets.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(" -> ");
      li.textContent = `${client} na ${network} acessa ${displayTarget(f.target)} via ${path || "direto"}`;
      return li;
    })
  );
}

function renderMap() {
  const flowId = byId("map-selector").value;
  const flow = state.flows.find((f) => f.id === flowId);
  const canvas = byId("map-canvas");
  canvas.replaceChildren();

  if (!flow) {
    canvas.textContent = "Crie um fluxo para visualizar o caminho.";
    return;
  }

  const chain = [
    state.assets.find((a) => a.id === flow.clientId)?.name,
    state.assets.find((a) => a.id === flow.networkId)?.name,
    ...flow.pathIds.map((id) => state.assets.find((a) => a.id === id)?.name),
    displayTarget(flow.target),
  ].filter(Boolean);

  chain.forEach((label, i) => {
    const node = document.createElement("span");
    node.className = "node";
    node.textContent = label;
    canvas.appendChild(node);
    if (i < chain.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "➜";
      canvas.appendChild(arrow);
    }
  });
}

function bindForms() {
  byId("asset-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    state.assets.push({
      id: uid(),
      type: byId("asset-type").value,
      name: byId("asset-name").value.trim(),
      details: byId("asset-details").value.trim(),
    });
    ev.target.reset();
    refresh();
  });

  byId("service-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    state.services.push({
      id: uid(),
      name: byId("service-name").value.trim(),
      port: Number(byId("service-port").value),
      serverId: byId("service-server").value,
    });
    ev.target.reset();
    refresh();
  });

  byId("macro-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const selected = [...byId("macro-services").selectedOptions].map((o) => o.value);
    state.macros.push({ id: uid(), name: byId("macro-name").value.trim(), serviceIds: selected });
    ev.target.reset();
    refresh();
  });

  byId("flow-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const pathIds = [...byId("flow-path").selectedOptions].map((o) => o.value);
    state.flows.push({
      id: uid(),
      clientId: byId("flow-client").value,
      networkId: byId("flow-network").value,
      target: byId("flow-service").value,
      pathIds,
    });
    ev.target.reset();
    refresh();
  });

  byId("map-selector").addEventListener("change", renderMap);

  byId("seed").addEventListener("click", () => {
    state.assets = [
      { id: "c1", type: "client", name: "Cliente RH", details: "10.10.20.25" },
      { id: "n1", type: "network", name: "Rede RH", details: "VLAN 20" },
      { id: "g1", type: "gateway", name: "Gateway Matriz", details: "10.10.20.1" },
      { id: "f1", type: "firewall", name: "Firewall Core", details: "Cluster A" },
      { id: "s1", type: "server", name: "APP Protheus", details: "10.50.0.30" },
    ];
    state.services = [
      { id: "sv1", name: "Broker", port: 22100, serverId: "s1" },
      { id: "sv2", name: "Meu RH", port: 8013, serverId: "s1" },
    ];
    state.macros = [{ id: "m1", name: "Protheus", serviceIds: ["sv1", "sv2"] }];
    state.flows = [
      { id: "fl1", clientId: "c1", networkId: "n1", target: "macro:m1", pathIds: ["g1", "f1"] },
    ];
    refresh();
  });

  byId("clear").addEventListener("click", () => {
    state.assets = [];
    state.services = [];
    state.macros = [];
    state.flows = [];
    refresh();
  });
}

function refresh() {
  refreshSelectors();
  renderLists();
  save();
  renderMap();
}

load();
bindForms();
refresh();
