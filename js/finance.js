const STORE_KEY = "minigames.finance.v1";
const todayIso = () => new Date().toISOString().slice(0, 10);
const frequencies = ["One Time", "Monthly", "Quarterly", "Yearly"];
const categories = ["Food", "Travel", "Shopping", "Rent", "Bills", "Health", "Entertainment", "Investment", "Other"];
const paymentModes = ["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer"];
const flowTypes = ["Income", "Expense"];

let state = loadState();
let activeView = "dashboard";

const app = document.querySelector("#financeApp");
const statusEl = document.querySelector("#financeStatus");

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    render();
  });
});

document.querySelector("#exportFinance").addEventListener("click", exportData);
document.querySelector("#importFinance").addEventListener("change", importData);

render();

function defaultState() {
  return {
    settings: {
      currency: "₹",
      startingCashBalance: 250000
    },
    income: [],
    expenses: [],
    cashflows: [],
    stocks: [],
    goals: []
  };
}

function loadState() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return defaultState();
  }
}

function saveState(message = "Saved.") {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  statusEl.textContent = message;
}

function render() {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
  app.innerHTML = "";
  const views = {
    dashboard: renderDashboard,
    income: () => renderLedger("income"),
    expenses: () => renderLedger("expenses"),
    cashflows: () => renderLedger("cashflows"),
    stocks: renderStocks,
    goals: renderGoals,
    networth: renderNetWorth,
    settings: renderSettings
  };
  views[activeView]();
}

function renderDashboard() {
  const summary = getSummary();
  app.append(metricGrid([
    ["Current Cash", money(summary.cash)],
    ["Monthly Income", money(summary.monthlyIncome)],
    ["Monthly Expenses", money(summary.monthlyExpense)],
    ["Monthly Savings", money(summary.savings)],
    ["Savings Rate", `${summary.savingsRate.toFixed(1)}%`],
    ["Stock Portfolio", money(summary.portfolio)],
    ["Net Worth", money(summary.netWorth)],
    ["12M Projection", money(summary.projected)]
  ]));

  const grid = el("section", "dashboard-grid finance-dashboard");
  grid.append(
    panel("Daily Balance Projection", projectionChart(projectedBalance(false), "closingCash")),
    panel("Expense Categories", barList(categoryBreakdown())),
    panel("Upcoming Events", eventList(upcomingEvents())),
    panel("Recent Transactions", eventList(recentTransactions())),
    panel("Monthly Spending", barList(monthlySeries().map((row) => ({ label: row.label, value: row.expenses })))),
    panel("Savings Trend", barList(monthlySeries().map((row) => ({ label: row.label, value: row.income - row.expenses }))))
  );
  app.append(grid);
}

function renderLedger(kind) {
  const config = {
    income: {
      title: "Income",
      eyebrow: "Track inflows",
      fields: [
        field("source", "Source", "text", true),
        field("amount", "Amount", "number", true, "0.01"),
        field("date", "Date", "date", true),
        checkbox("recurring", "Recurring income"),
        selectField("frequency", "Frequency", frequencies),
        textarea("notes", "Notes")
      ],
      columns: ["Date", "Source", "Amount", "Frequency", "Notes"]
    },
    expenses: {
      title: "Expenses",
      eyebrow: "Control outflows",
      fields: [
        field("description", "Description", "text", true),
        field("amount", "Amount", "number", true, "0.01"),
        field("date", "Date", "date", true),
        selectField("category", "Category", categories),
        selectField("paymentMode", "Payment mode", paymentModes),
        checkbox("recurring", "Recurring expense"),
        selectField("frequency", "Frequency", frequencies),
        textarea("notes", "Notes")
      ],
      columns: ["Date", "Description", "Category", "Mode", "Amount"]
    },
    cashflows: {
      title: "Future Cash Flows",
      eyebrow: "Plan ahead",
      fields: [
        field("description", "Description", "text", true),
        field("amount", "Amount", "number", true, "0.01"),
        field("date", "Date", "date", true),
        selectField("type", "Type", flowTypes),
        selectField("category", "Category", [...categories, "Salary", "Bonus", "Tax", "Insurance"]),
        checkbox("recurring", "Recurring event"),
        selectField("frequency", "Frequency", frequencies),
        textarea("notes", "Notes")
      ],
      columns: ["Date", "Description", "Type", "Category", "Frequency", "Amount"]
    }
  }[kind];

  const wrap = el("section", "work-grid finance-work");
  wrap.append(ledgerForm(kind, config), ledgerTable(kind, config));
  app.append(pageHead(config.eyebrow, config.title), wrap);
}

function ledgerForm(kind, config) {
  const form = el("form", "panel form-panel");
  const singular = kind === "income" ? "income" : kind === "cashflows" ? "event" : "expense";
  form.innerHTML = `<h2>Add ${singular}</h2>`;
  config.fields.forEach((node) => form.append(node));
  form.append(button(`Add ${singular}`, "primary"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.amount = Number(data.amount || 0);
    data.recurring = data.recurring === "on";
    data.frequency = data.recurring ? data.frequency : "One Time";
    data.id = crypto.randomUUID();
    data.createdAt = new Date().toISOString();
    if (!data.date) data.date = todayIso();
    if (kind === "income") {
      data.month = Number(data.date.slice(5, 7));
      data.year = Number(data.date.slice(0, 4));
    }
    state[kind].push(data);
    saveState(`${config.title} entry added.`);
    render();
  });
  return form;
}

function ledgerTable(kind, config) {
  const table = el("article", "panel table-panel");
  const rows = [...state[kind]].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  table.innerHTML = `
    <div class="table-scroll">
      <table class="finance-table">
        <thead><tr>${config.columns.map((item) => `<th>${item}</th>`).join("")}<th></th></tr></thead>
        <tbody>${rows.length ? rows.map((row) => ledgerRow(kind, row)).join("") : `<tr><td colspan="${config.columns.length + 1}" class="muted-cell">No entries yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  table.addEventListener("click", deleteHandler(kind));
  return table;
}

function ledgerRow(kind, row) {
  if (kind === "income") {
    return rowHtml(row.id, [formatDate(row.date), row.source, money(row.amount), row.frequency || "One Time", row.notes || ""]);
  }
  if (kind === "expenses") {
    return rowHtml(row.id, [formatDate(row.date), row.description, row.category, row.paymentMode, money(row.amount)]);
  }
  return rowHtml(row.id, [formatDate(row.date), row.description, row.type, row.category, row.frequency || "One Time", money(row.amount)]);
}

function renderStocks() {
  app.append(pageHead("Portfolio", "Stock Holdings"));
  const wrap = el("section", "work-grid finance-work");
  const form = el("form", "panel form-panel");
  form.innerHTML = "<h2>Add holding</h2>";
  [
    field("ticker", "Ticker", "text", true),
    field("companyName", "Company name", "text"),
    field("quantity", "Quantity", "number", true, "0.0001"),
    field("averageBuyPrice", "Average buy price", "number", true, "0.01"),
    field("manualPrice", "Latest/manual price", "number", false, "0.01"),
    field("purchaseDate", "Purchase date", "date"),
    textarea("notes", "Notes")
  ].forEach((node) => form.append(node));
  form.append(button("Add stock", "primary"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const ticker = normalizeTicker(data.ticker);
    const quantity = Number(data.quantity || 0);
    const average = Number(data.averageBuyPrice || 0);
    const latest = Number(data.manualPrice || average);
    const existing = state.stocks.find((stock) => stock.ticker === ticker);
    if (existing) {
      const totalQuantity = Number(existing.quantity) + quantity;
      existing.averageBuyPrice = totalQuantity ? ((Number(existing.quantity) * Number(existing.averageBuyPrice)) + (quantity * average)) / totalQuantity : average;
      existing.quantity = totalQuantity;
      existing.manualPrice = latest;
      existing.companyName = data.companyName || existing.companyName || ticker;
      existing.notes = data.notes || existing.notes || "";
    } else {
      state.stocks.push({ id: crypto.randomUUID(), ticker, companyName: data.companyName || ticker, quantity, averageBuyPrice: average, manualPrice: latest, purchaseDate: data.purchaseDate || todayIso(), notes: data.notes || "" });
    }
    saveState("Stock holding saved.");
    render();
  });

  const rows = stockRows();
  const table = el("article", "panel table-panel");
  table.innerHTML = `
    <div class="table-scroll"><table class="finance-table">
      <thead><tr><th>Ticker</th><th>Qty</th><th>Avg</th><th>Latest</th><th>Invested</th><th>Value</th><th>Upside</th><th>Weight</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map((row) => rowHtml(row.holding.id, [
        `<strong>${escapeHtml(row.holding.ticker)}</strong><small>${escapeHtml(row.holding.companyName || "")}</small>`,
        number(row.holding.quantity), money(row.holding.averageBuyPrice), money(row.price), money(row.invested), money(row.currentValue),
        `<span class="${row.profit >= 0 ? "good" : "bad"}">${money(row.profit)} · ${row.profitPct.toFixed(1)}%</span>`,
        `${row.weight.toFixed(1)}%`
      ])).join("") : `<tr><td colspan="9" class="muted-cell">No stock holdings yet.</td></tr>`}</tbody>
    </table></div>`;
  table.addEventListener("click", deleteHandler("stocks"));
  wrap.append(form, table);
  app.append(wrap);
}

function renderGoals() {
  app.append(pageHead("Savings path", "Savings Goals"));
  const wrap = el("section", "work-grid finance-work");
  const form = el("form", "panel form-panel");
  form.innerHTML = "<h2>Add goal</h2>";
  [
    field("name", "Goal name", "text", true),
    field("targetAmount", "Target amount", "number", true, "0.01"),
    field("currentSaved", "Current saved", "number", true, "0.01"),
    field("deadline", "Deadline", "date", true),
    textarea("notes", "Notes")
  ].forEach((node) => form.append(node));
  form.append(button("Add goal", "primary"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    state.goals.push({ id: crypto.randomUUID(), name: data.name, targetAmount: Number(data.targetAmount), currentSaved: Number(data.currentSaved), deadline: data.deadline, notes: data.notes || "" });
    saveState("Savings goal added.");
    render();
  });
  const cards = el("div", "goal-grid finance-goals");
  cards.innerHTML = state.goals.length ? state.goals.map(goalCard).join("") : `<article class="panel"><p class="small-note">No goals yet.</p></article>`;
  cards.addEventListener("click", deleteHandler("goals"));
  wrap.append(form, cards);
  app.append(wrap);
}

function goalCard(goal) {
  const target = Number(goal.targetAmount || 0);
  const saved = Number(goal.currentSaved || 0);
  const progress = target ? Math.min(100, (saved / target) * 100) : 0;
  const remaining = Math.max(0, target - saved);
  const monthsLeft = Math.max(1, monthDiff(new Date(), parseDate(goal.deadline)));
  const requiredMonthly = remaining / monthsLeft;
  return `
    <article class="panel goal-card">
      <div class="goal-top"><div><h2>${escapeHtml(goal.name)}</h2><p>${formatDate(goal.deadline)}</p></div><button class="btn warning" type="button" data-delete="${goal.id}">Delete</button></div>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <div class="goal-stats">
        <span>Saved <strong>${money(saved)}</strong></span>
        <span>Target <strong>${money(target)}</strong></span>
        <span>Monthly need <strong>${money(requiredMonthly)}</strong></span>
        <span class="${progress >= Math.max(0, Math.min(100, 100 * (1 - monthsLeft / 12))) ? "good" : "bad"}">${progress.toFixed(1)}%</span>
      </div>
    </article>`;
}

function renderNetWorth() {
  const summary = getSummary();
  app.append(pageHead("Assets", "Net Worth"));
  app.append(metricGrid([
    ["Cash", money(summary.cash)],
    ["Stocks", money(summary.portfolio)],
    ["Total Assets", money(summary.netWorth)],
    ["Projected Net Worth", money(projectedBalance(true).at(-1)?.closingTotal || summary.netWorth)]
  ]));
  const grid = el("section", "dashboard-grid finance-dashboard");
  grid.append(
    panel("Growth Curve", projectionChart(projectedBalance(true), "closingTotal")),
    panel("Asset Allocation", barList([{ label: "Cash", value: summary.cash }, ...stockRows().map((row) => ({ label: row.holding.ticker, value: row.currentValue }))]))
  );
  app.append(grid);
}

function renderSettings() {
  app.append(pageHead("Preferences", "Settings"));
  const form = el("form", "panel settings-form finance-settings");
  form.innerHTML = `
    ${fieldMarkup("currency", "Currency", "text", state.settings.currency)}
    ${fieldMarkup("startingCashBalance", "Starting cash balance", "number", state.settings.startingCashBalance, "0.01")}
    <button class="btn primary" type="submit">Save settings</button>
    <button class="btn warning" type="button" id="clearFinance">Clear finance data</button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    state.settings.currency = data.currency || "₹";
    state.settings.startingCashBalance = Number(data.startingCashBalance || 0);
    saveState("Settings saved.");
    render();
  });
  app.append(form);
  document.querySelector("#clearFinance").addEventListener("click", () => {
    if (!confirm("Clear all finance tracker data from this browser?")) return;
    state = defaultState();
    saveState("Finance data cleared.");
    render();
  });
}

function getSummary() {
  const start = monthStart(new Date());
  const end = monthEnd(new Date());
  const monthlyIncome = incomeBetween(start, end);
  const monthlyExpense = expenseBetween(start, end);
  const savings = monthlyIncome - monthlyExpense;
  const cash = Number(state.settings.startingCashBalance || 0) + incomeBetween(new Date("1900-01-01"), new Date()) - state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const portfolio = stockRows().reduce((sum, row) => sum + row.currentValue, 0);
  return {
    cash,
    monthlyIncome,
    monthlyExpense,
    savings,
    savingsRate: monthlyIncome ? (savings / monthlyIncome) * 100 : 0,
    portfolio,
    netWorth: cash + portfolio,
    projected: projectedBalance(false).at(-1)?.closingCash || cash
  };
}

function incomeBetween(start, end) {
  return state.income.reduce((sum, item) => sum + occurrencesBetween(item, start, end).length * Number(item.amount || 0), 0);
}

function expenseBetween(start, end) {
  return state.expenses.reduce((sum, item) => {
    const date = parseDate(item.date);
    return date >= start && date <= end ? sum + Number(item.amount || 0) : sum;
  }, 0);
}

function projectedBalance(includeStocks) {
  let opening = getSummaryCashOnly();
  const stocks = includeStocks ? stockRows().reduce((sum, row) => sum + row.currentValue, 0) : 0;
  const today = new Date();
  const rows = [];
  for (let offset = 0; offset <= 365; offset += 1) {
    const date = addDays(today, offset);
    let income = 0;
    let expenses = 0;
    let futureInflows = 0;
    let futureOutflows = 0;
    state.income.forEach((item) => { if (occursOn(item, date) && date > today) income += Number(item.amount || 0); });
    state.expenses.forEach((item) => { if (occursOn(item, date) && date > today) expenses += Number(item.amount || 0); });
    state.cashflows.forEach((item) => {
      if (occursOn(item, date) && date >= today) {
        if (item.type === "Income") futureInflows += Number(item.amount || 0);
        else futureOutflows += Number(item.amount || 0);
      }
    });
    const closingCash = opening + income - expenses + futureInflows - futureOutflows;
    rows.push({ label: formatDate(iso(date)), date: iso(date), closingCash, closingTotal: closingCash + stocks });
    opening = closingCash;
  }
  return rows;
}

function getSummaryCashOnly() {
  return Number(state.settings.startingCashBalance || 0) + incomeBetween(new Date("1900-01-01"), new Date()) - state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function occurrencesBetween(item, start, end) {
  const dates = [];
  const itemDate = parseDate(item.date);
  if (!item.recurring) return itemDate >= start && itemDate <= end ? [itemDate] : [];
  let cursor = monthStart(new Date(Math.max(monthStart(itemDate), monthStart(start))));
  while (cursor <= monthStart(end)) {
    const occurrence = occurrenceDateForMonth(itemDate, cursor, item.frequency);
    if (occurrence && occurrence >= start && occurrence <= end) dates.push(occurrence);
    cursor = addMonths(cursor, 1);
  }
  return dates;
}

function occursOn(item, target) {
  return occurrencesBetween(item, target, target).length > 0;
}

function occurrenceDateForMonth(itemDate, target, frequency) {
  const startMonth = monthStart(itemDate);
  const targetMonth = monthStart(target);
  if (startMonth > targetMonth) return null;
  const monthsApart = monthDiff(startMonth, targetMonth);
  if (frequency === "Monthly") return withDay(targetMonth, itemDate.getDate());
  if (frequency === "Quarterly" && monthsApart % 3 === 0) return withDay(targetMonth, itemDate.getDate());
  if (frequency === "Yearly" && targetMonth.getMonth() === itemDate.getMonth()) return withDay(targetMonth, itemDate.getDate());
  if (frequency === "One Time" && monthsApart === 0) return withDay(targetMonth, itemDate.getDate());
  return null;
}

function stockRows() {
  const total = state.stocks.reduce((sum, stock) => sum + Number(stock.quantity || 0) * Number(stock.manualPrice || stock.averageBuyPrice || 0), 0);
  return state.stocks.slice().sort((a, b) => a.ticker.localeCompare(b.ticker)).map((holding) => {
    const price = Number(holding.manualPrice || holding.averageBuyPrice || 0);
    const invested = Number(holding.quantity || 0) * Number(holding.averageBuyPrice || 0);
    const currentValue = Number(holding.quantity || 0) * price;
    const profit = currentValue - invested;
    return { holding, price, invested, currentValue, profit, profitPct: invested ? (profit / invested) * 100 : 0, weight: total ? (currentValue / total) * 100 : 0 };
  });
}

function monthlySeries() {
  const rows = [];
  const base = monthStart(new Date());
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = addMonths(base, -offset);
    rows.push({ label: date.toLocaleDateString(undefined, { month: "short" }), income: incomeBetween(monthStart(date), monthEnd(date)), expenses: expenseBetween(monthStart(date), monthEnd(date)) });
  }
  return rows;
}

function categoryBreakdown() {
  const start = monthStart(new Date());
  const end = monthEnd(new Date());
  const map = new Map();
  state.expenses.forEach((expense) => {
    const date = parseDate(expense.date);
    if (date >= start && date <= end) map.set(expense.category || "Other", (map.get(expense.category || "Other") || 0) + Number(expense.amount || 0));
  });
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function upcomingEvents() {
  const today = new Date();
  const horizon = addMonths(today, 12);
  const events = [];
  [...state.cashflows, ...state.income].forEach((item) => {
    const source = item.source ? { ...item, type: "Income", description: item.source } : item;
    let cursor = new Date(today);
    while (cursor <= horizon) {
      if (occursOn(source, cursor) && cursor >= today) {
        events.push({ date: iso(cursor), description: source.description, type: source.type, amount: Number(source.amount || 0) });
        break;
      }
      cursor = addDays(cursor, 1);
    }
  });
  return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
}

function recentTransactions() {
  return [
    ...state.income.map((item) => ({ date: item.date, description: item.source, type: "Income", amount: item.amount })),
    ...state.expenses.map((item) => ({ date: item.date, description: item.description, type: "Expense", amount: item.amount }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
}

function metricGrid(items) {
  const grid = el("section", "metric-grid finance-metrics");
  grid.innerHTML = items.map(([label, value]) => `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
  return grid;
}

function panel(title, body) {
  const node = el("article", "panel");
  node.innerHTML = `<div class="panel-head"><h2>${escapeHtml(title)}</h2></div>`;
  node.append(body);
  return node;
}

function projectionChart(rows, key) {
  const sample = rows.filter((_, index) => index % 30 === 0 || index === rows.length - 1);
  return barList(sample.map((row) => ({ label: row.label, value: row[key] })));
}

function barList(items) {
  const list = el("div", "finance-bars");
  const max = Math.max(...items.map((item) => Math.abs(Number(item.value || 0))), 1);
  list.innerHTML = items.length ? items.map((item) => `
    <div class="bar-row">
      <span>${escapeHtml(item.label)}</span>
      <i><b style="width:${Math.min(100, Math.abs(Number(item.value || 0)) / max * 100)}%"></b></i>
      <strong>${money(item.value)}</strong>
    </div>`).join("") : `<p class="small-note">No data yet.</p>`;
  return list;
}

function eventList(items) {
  const list = el("div", "list-stack");
  list.innerHTML = items.length ? items.map((item) => `
    <div class="event-row">
      <div><strong>${escapeHtml(item.description || "Untitled")}</strong><small>${formatDate(item.date)}</small></div>
      <span class="${item.type === "Income" ? "good" : "bad"}">${escapeHtml(item.type || "")} ${money(item.amount)}</span>
    </div>`).join("") : `<p class="small-note">No data yet.</p>`;
  return list;
}

function pageHead(eyebrow, title) {
  const head = el("div", "page-head");
  head.innerHTML = `<div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1></div>`;
  return head;
}

function field(name, label, type, required = false, step = "") {
  const wrap = el("label", "field");
  wrap.innerHTML = `${escapeHtml(label)} <input name="${name}" type="${type}" ${step ? `step="${step}"` : ""} ${required ? "required" : ""}>`;
  if (type === "date") wrap.querySelector("input").value = todayIso();
  return wrap;
}

function fieldMarkup(name, label, type, value, step = "") {
  return `<label class="field">${escapeHtml(label)} <input name="${name}" type="${type}" value="${escapeHtml(value)}" ${step ? `step="${step}"` : ""} required></label>`;
}

function selectField(name, label, options) {
  const wrap = el("label", "field");
  wrap.innerHTML = `${escapeHtml(label)} <select name="${name}">${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select>`;
  return wrap;
}

function checkbox(name, label) {
  const wrap = el("label", "check-field");
  wrap.innerHTML = `<input name="${name}" type="checkbox"> <span>${escapeHtml(label)}</span>`;
  return wrap;
}

function textarea(name, label) {
  const wrap = el("label", "field");
  wrap.innerHTML = `${escapeHtml(label)} <textarea name="${name}" rows="3"></textarea>`;
  return wrap;
}

function button(label, tone = "") {
  const btn = el("button", `btn ${tone}`.trim());
  btn.type = "submit";
  btn.textContent = label;
  return btn;
}

function rowHtml(id, cells) {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}<td><button class="btn warning" type="button" data-delete="${id}">Delete</button></td></tr>`;
}

function deleteHandler(kind) {
  return (event) => {
    const id = event.target.closest("[data-delete]")?.dataset.delete;
    if (!id) return;
    state[kind] = state[kind].filter((item) => item.id !== id);
    saveState("Entry deleted.");
    render();
  };
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `finance-tracker-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  statusEl.textContent = "Export downloaded.";
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = { ...defaultState(), ...JSON.parse(reader.result) };
      saveState("Finance data imported.");
      render();
    } catch {
      statusEl.textContent = "Could not import that JSON file.";
      statusEl.classList.add("error");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function normalizeTicker(ticker) {
  const clean = String(ticker || "").trim().toUpperCase();
  return clean && !clean.includes(".") && /^[A-Z]+$/.test(clean) ? `${clean}.NS` : clean;
}

function money(value) {
  return `${state.settings.currency || "₹"}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function number(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDate(value) {
  return parseDate(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function parseDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value || todayIso()).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, days) {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = parseDate(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months, 1);
  next.setDate(Math.min(day, monthEnd(next).getDate()));
  return next;
}

function withDay(monthDate, day) {
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(day, monthEnd(monthDate).getDate()));
}

function monthDiff(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function el(tag, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
