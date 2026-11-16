import {
  BENCHMARK,
  CONFORMING_LIMIT,
  GUIDELINES,
  STATE_TAX_RATES,
  creditBand,
  estimateScenario,
} from "./mortgage.js";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PROFILES = {
  mid: {
    creditScore: 720,
    annualIncome: 120_000,
    monthlyDebts: 650,
    purchasePrice: 450_000,
    downPayment: 45_000,
    termYears: 30,
    program: "conventional",
    occupancy: "primary",
    state: "US",
    annualInsurance: 1_575,
    monthlyHoa: 0,
  },
  strong: {
    creditScore: 760,
    annualIncome: 180_000,
    monthlyDebts: 400,
    purchasePrice: 600_000,
    downPayment: 120_000,
    termYears: 30,
    program: "conventional",
    occupancy: "primary",
    state: "US",
    annualInsurance: 2_100,
    monthlyHoa: 0,
  },
  fha: {
    creditScore: 660,
    annualIncome: 85_000,
    monthlyDebts: 350,
    purchasePrice: 320_000,
    downPayment: 11_200,
    termYears: 30,
    program: "fha",
    occupancy: "primary",
    state: "US",
    annualInsurance: 1_120,
    monthlyHoa: 0,
  },
};

const MIX = [
  ["principalAndInterest", "Principal & interest", "pi"],
  ["mortgageInsurance", "Mortgage insurance", "mi"],
  ["propertyTax", "Property tax", "tax"],
  ["homeownersInsurance", "Insurance", "ins"],
  ["hoa", "HOA", "hoa"],
];

const $ = (id) => document.getElementById(id);
const out = (name) => document.querySelector(`[data-out="${name}"]`);

let downMode = "dollars";
let insuranceAuto = true;

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return Number.NaN;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}

function formatInput(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function money(value, whole = false) {
  return (whole ? usdWhole : usd).format(value);
}

function rate(value) {
  return `${Number(value).toFixed(2)}%`;
}

function signedRate(bp) {
  const text = `${(Math.abs(bp) / 100).toFixed(2)}%`;
  if (bp > 0) return `+${text}`;
  if (bp < 0) return `−${text}`;
  return text;
}

function percent(fraction, digits = 1) {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}

function checked(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function setChecked(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function stateRate(code) {
  return STATE_TAX_RATES.find((state) => state.code === code)?.rate ?? 0.011;
}

function suggestedInsurance(price) {
  return Math.round(price * 0.0035);
}

function readInput() {
  const typedCredit = parseNumber($("credit").value);
  const creditScore = typedCredit >= 300 && typedCredit <= 850 ? typedCredit : Number($("credit-range").value);
  const customOn = $("custom-toggle").checked;
  const custom = parseNumber($("custom-rate").value);
  const reserves = $("reserves").value.trim();
  return {
    creditScore,
    annualIncome: parseNumber($("income").value) || 0,
    monthlyDebts: parseNumber($("debts").value) || 0,
    purchasePrice: parseNumber($("price").value) || 0,
    downPayment: parseNumber($("down").value) || 0,
    termYears: Number(checked("term") || 30),
    program: checked("program") || "conventional",
    occupancy: $("occupancy").value,
    propertyTaxRate: (parseNumber($("tax").value) || 0) / 100,
    annualInsurance: parseNumber($("insurance").value) || 0,
    monthlyHoa: parseNumber($("hoa").value) || 0,
    vaUse: checked("vaUse") || "first",
    financeUpfrontFee: $("finance-fee").checked,
    customRate: customOn && Number.isFinite(custom) ? custom : null,
    closingCostRate: (parseNumber($("closing").value) || 0) / 100,
    cashLeftAfterClosing: reserves === "" ? null : parseNumber(reserves) || 0,
  };
}

function line(label, value, { total = false, note = "" } = {}) {
  const row = document.createElement("div");
  row.className = total ? "line total" : "line";
  const name = document.createElement("span");
  name.textContent = label;
  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    name.append(small);
  }
  const amount = document.createElement("span");
  amount.textContent = value;
  row.append(name, amount);
  return row;
}

function fillReceipt(node, rows) {
  node.replaceChildren(...rows);
}

function renderErrors(errors) {
  const list = document.createElement("p");
  list.className = "errors";
  list.textContent = errors.join(" ");
  out("verdict").textContent = "Check the inputs";
  out("verdict").parentElement.dataset.tone = "unlikely";
  out("payment").textContent = "—";
  out("rate-line").textContent = "";
  out("mix").replaceChildren();
  out("mix-legend").replaceChildren();
  fillReceipt(out("breakdown"), [list]);
  out("first-month").textContent = "";
  out("rate-build").replaceChildren();
  out("rate-note").textContent = "";
  out("ratios").replaceChildren();
  out("cash").replaceChildren();
  out("fee-note").textContent = "";
  out("reasons").replaceChildren();
  out("insights").replaceChildren();
  out("payment-mobile").textContent = "—";
  out("rate-mobile").textContent = "";
  out("verdict-mobile").textContent = "Check inputs";
}

function renderResult(result) {
  const verdict = out("verdict");
  verdict.textContent = result.screening.title;
  verdict.parentElement.dataset.tone = result.screening.status;
  out("payment").textContent = money(result.monthly.total);
  const bits = [];
  if (result.hasLoan) {
    bits.push(result.rateIsCustom ? `${rate(result.rate)} typed` : rate(result.rate));
    bits.push(`${result.termYears}-year fixed`);
    bits.push(result.programLabel);
    bits.push(`${money(result.loanAmount, true)} loan`);
  } else {
    bits.push("Cash purchase");
  }
  out("rate-line").textContent = bits.join(" · ");

  const parts = MIX.map(([key, label, kind]) => ({
    key,
    label,
    kind,
    amount: result.monthly[key],
  })).filter((part) => part.amount > 0);
  const mix = out("mix");
  mix.replaceChildren();
  const legend = out("mix-legend");
  legend.replaceChildren();
  for (const part of parts) {
    const slice = document.createElement("span");
    slice.className = part.kind;
    slice.style.width = `${(part.amount / result.monthly.total) * 100}%`;
    slice.title = `${part.label} ${money(part.amount)}`;
    mix.append(slice);
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = part.kind;
    item.append(swatch, document.createTextNode(` ${part.label}`));
    legend.append(item);
  }

  const breakdown = [
    line("Principal and interest", money(result.monthly.principalAndInterest)),
  ];
  if (result.monthly.mortgageInsurance > 0) {
    breakdown.push(
      line(result.mortgageInsurance.label, money(result.monthly.mortgageInsurance), {
        note: result.mortgageInsurance.durationLabel,
      }),
    );
  }
  if (result.monthly.propertyTax > 0) breakdown.push(line("Property tax", money(result.monthly.propertyTax)));
  if (result.monthly.homeownersInsurance > 0) {
    breakdown.push(line("Homeowners insurance", money(result.monthly.homeownersInsurance)));
  }
  if (result.monthly.hoa > 0) breakdown.push(line("HOA", money(result.monthly.hoa)));
  breakdown.push(line("Monthly payment", money(result.monthly.total), { total: true }));
  fillReceipt(out("breakdown"), breakdown);

  out("first-month").textContent = result.hasLoan
    ? `The first payment puts ${money(result.firstMonth.interest)} toward interest and ${money(result.firstMonth.principal)} toward principal.`
    : "";

  if (result.hasLoan) {
    const rows = result.rateBuild.map((row) =>
      line(row.label, row.kind === "base" ? rate(row.bp / 100) : signedRate(row.bp)),
    );
    rows.push(line("Modeled rate", rate(result.modelRate), { total: true }));
    fillReceipt(out("rate-build"), rows);
    const using = result.rateIsCustom ? ` The payment uses your ${rate(result.rate)} rate.` : "";
    out("rate-note").textContent = `A typical lender spread around the model is ${rate(result.rateLow)}–${rate(result.rateHigh)}, before discount points.${using}`;
  } else {
    out("rate-build").replaceChildren();
    out("rate-note").textContent = "There is no loan to price.";
  }

  const ratios = out("ratios");
  ratios.replaceChildren();
  const cards = [
    ["Loan-to-value", result.ltv, result.ltv, 1, result.ltv > 0.95 ? "bad" : result.ltv > 0.8 ? "warn" : ""],
  ];
  if (result.ratios) {
    const rules = GUIDELINES.dti[result.program];
    const housingTone = result.ratios.housing > 0.45 ? "bad" : result.ratios.housing > GUIDELINES.housingStretch ? "warn" : "";
    const backTone = result.ratios.backEnd > rules.max ? "bad" : result.ratios.backEnd > rules.preferred ? "warn" : "";
    cards.push(["Housing ratio", result.ratios.housing, result.ratios.housing, 0.5, housingTone]);
    cards.push(["Back-end ratio", result.ratios.backEnd, result.ratios.backEnd, 0.6, backTone]);
  }
  for (const [label, display, fill, scale, tone] of cards) {
    const card = document.createElement("div");
    const name = document.createElement("span");
    name.className = "stat-label";
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = percent(display);
    const meter = document.createElement("div");
    meter.className = `meter ${tone}`.trim();
    const bar = document.createElement("span");
    bar.style.width = `${Math.min(100, (fill / scale) * 100)}%`;
    meter.append(bar);
    card.append(name, value, meter);
    ratios.append(card);
  }

  const cashRows = [
    line("Down payment", money(result.cashToClose.downPayment)),
    line("Closing costs", money(result.cashToClose.closingCosts)),
    line("Prepaids, about 2 months", money(result.cashToClose.prepaids)),
  ];
  if (result.cashToClose.upfrontFee > 0) {
    cashRows.push(line(result.upfrontFee.label, money(result.cashToClose.upfrontFee)));
  }
  cashRows.push(line("Cash to close", money(result.cashToClose.total), { total: true }));
  fillReceipt(out("cash"), cashRows);

  if (result.upfrontFee?.amount > 0 && result.upfrontFee.financed) {
    out("fee-note").textContent = `${money(result.upfrontFee.amount)} of ${result.upfrontFee.label.toLowerCase()} is financed, so it is in the loan instead of the cash due.`;
  } else if (result.upfrontFee?.label === "VA funding fee exempt") {
    out("fee-note").textContent = "The VA funding fee is exempt on this file.";
  } else {
    out("fee-note").textContent = "";
  }

  const reasons = out("reasons");
  reasons.replaceChildren();
  for (const reason of result.screening.reasons) {
    const item = document.createElement("li");
    item.className = reason.tone;
    item.textContent = reason.text;
    reasons.append(item);
  }

  const insights = out("insights");
  insights.replaceChildren();
  for (const insight of result.insights) {
    const paragraph = document.createElement("p");
    paragraph.textContent = insight.text;
    insights.append(paragraph);
  }

  out("payment-mobile").textContent = money(result.monthly.total);
  out("rate-mobile").textContent = result.hasLoan ? rate(result.rate) : "Cash";
  const mobileVerdict = out("verdict-mobile");
  mobileVerdict.textContent = result.screening.title;
  mobileVerdict.dataset.tone = result.screening.status;
  mobileVerdict.className = "verdict";
}

function renderComparisons(input) {
  const terms = [10, 15, 20, 30].map((termYears) =>
    estimateScenario({ ...input, termYears, customRate: null }),
  );
  const termBody = out("term-table");
  termBody.replaceChildren();
  for (const scenario of terms) {
    if (!scenario.ok) continue;
    const row = document.createElement("tr");
    if (scenario.termYears === input.termYears) row.className = "is-selected";
    const termCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.term = String(scenario.termYears);
    button.textContent = `${scenario.termYears}-year`;
    button.setAttribute("aria-pressed", scenario.termYears === input.termYears ? "true" : "false");
    termCell.append(button);
    row.append(
      termCell,
      cell(scenario.hasLoan ? rate(scenario.modelRate) : "—"),
      cell(money(scenario.monthly.total)),
      cell(scenario.hasLoan ? money(scenario.totals.interest, true) : "—"),
    );
    termBody.append(row);
  }

  const programs = ["conventional", "fha", "va", "usda"].map((program) =>
    estimateScenario({ ...input, program, customRate: null }),
  );
  const programBody = out("program-table");
  programBody.replaceChildren();
  for (const scenario of programs) {
    if (!scenario.ok) continue;
    const row = document.createElement("tr");
    if (scenario.program === input.program) row.className = "is-selected";
    const nameCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.program = scenario.program;
    button.textContent = scenario.programLabel;
    button.setAttribute("aria-pressed", scenario.program === input.program ? "true" : "false");
    nameCell.append(button);
    const screen = document.createElement("td");
    screen.textContent = scenario.screening.title;
    screen.className = `tone-${scenario.screening.status}`;
    row.append(
      nameCell,
      cell(scenario.hasLoan ? rate(scenario.modelRate) : "—"),
      cell(money(scenario.monthly.total)),
      screen,
    );
    programBody.append(row);
  }
}

function cell(text) {
  const node = document.createElement("td");
  node.textContent = text;
  return node;
}

function renderChart(result) {
  const section = out("chart-section");
  if (!result.ok || !result.hasLoan || result.years.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const max = Math.max(...result.years.map((year) => year.interest + year.principal), 1);
  const chart = out("chart");
  chart.replaceChildren();
  for (const year of result.years) {
    const column = document.createElement("div");
    column.className = "bar-col";
    const bar = document.createElement("div");
    bar.className = "bar";
    const interest = document.createElement("i");
    interest.className = "interest";
    interest.style.height = `${(year.interest / max) * 100}%`;
    const principal = document.createElement("i");
    principal.className = "principal";
    principal.style.height = `${(year.principal / max) * 100}%`;
    bar.append(interest, principal);
    const label = document.createElement("em");
    if (year.year === 1 || year.year === result.years.length || year.year % 5 === 0) {
      label.textContent = String(year.year);
    }
    column.append(bar, label);
    chart.append(column);
  }
  const first = result.years[0];
  out("chart-summary").textContent = `Each bar is one year of principal and interest. In year 1, ${money(first.interest, true)} is interest and ${money(first.principal, true)} is principal. Over ${result.termYears} years, interest totals ${money(result.totals.interest, true)}.`;

  const body = out("year-table");
  body.replaceChildren();
  for (const year of result.years) {
    const row = document.createElement("tr");
    row.append(
      cell(String(year.year)),
      cell(money(year.principal, true)),
      cell(money(year.interest, true)),
      cell(money(year.balance, true)),
    );
    body.append(row);
  }
}

function renderDownMeta(input) {
  const price = input.purchasePrice;
  const down = input.downPayment;
  const caption = $("down-meta");
  if (!(price > 0)) {
    caption.textContent = "Enter a price to see the percent down and the loan amount.";
    return;
  }
  const pct = down / price;
  const loan = Math.max(0, price - down);
  caption.textContent = `${percent(pct)} of the price · ${money(loan, true)} before financed fees · ${percent(Math.max(0, 1 - pct))} loan-to-value`;
  for (const button of document.querySelectorAll("[data-down]")) {
    const target = Number(button.dataset.down);
    button.setAttribute("aria-pressed", Math.abs(pct - target) < 0.0008 ? "true" : "false");
  }
}

function syncDownFields(source) {
  const price = parseNumber($("price").value);
  if (source === "percent") {
    downMode = "percent";
    const pct = parseNumber($("down-pct").value);
    if (price > 0 && Number.isFinite(pct)) {
      $("down").value = formatInput(Math.round((price * pct) / 100));
    }
  } else if (source === "dollars") {
    downMode = "dollars";
    const down = parseNumber($("down").value);
    if (price > 0 && Number.isFinite(down)) $("down-pct").value = ((down / price) * 100).toFixed(1);
  } else if (downMode === "percent") {
    const pct = parseNumber($("down-pct").value);
    if (price > 0 && Number.isFinite(pct)) $("down").value = formatInput(Math.round((price * pct) / 100));
  } else {
    const down = parseNumber($("down").value);
    if (price > 0 && Number.isFinite(down)) $("down-pct").value = ((down / price) * 100).toFixed(1);
  }
}

function render() {
  const input = readInput();
  $("credit-caption").textContent = `${input.creditScore || "—"} · ${creditBand(input.creditScore)}`;
  $("va-options").hidden = input.program !== "va";
  $("finance-option").hidden = input.program === "conventional";
  $("custom-wrap").hidden = !$("custom-toggle").checked;
  renderDownMeta(input);
  const result = estimateScenario(input);
  if (!result.ok) {
    renderErrors(result.errors);
    out("chart-section").hidden = true;
    out("term-table").replaceChildren();
    out("program-table").replaceChildren();
    return;
  }
  renderResult(result);
  renderComparisons(input);
  renderChart(result);
}

function clearProfiles() {
  for (const button of document.querySelectorAll("[data-profile]")) {
    button.setAttribute("aria-pressed", "false");
  }
}

function applyProfile(id) {
  const profile = PROFILES[id];
  $("credit").value = String(profile.creditScore);
  $("credit-range").value = String(profile.creditScore);
  $("income").value = formatInput(profile.annualIncome);
  $("debts").value = formatInput(profile.monthlyDebts);
  $("price").value = formatInput(profile.purchasePrice);
  $("down").value = formatInput(profile.downPayment);
  $("down-pct").value = ((profile.downPayment / profile.purchasePrice) * 100).toFixed(1);
  downMode = "dollars";
  $("occupancy").value = profile.occupancy;
  $("state").value = profile.state;
  $("tax").value = (stateRate(profile.state) * 100).toFixed(2);
  $("insurance").value = formatInput(profile.annualInsurance);
  insuranceAuto = true;
  $("insurance").dataset.auto = "true";
  $("hoa").value = formatInput(profile.monthlyHoa);
  setChecked("term", String(profile.termYears));
  setChecked("program", profile.program);
  setChecked("vaUse", "first");
  $("finance-fee").checked = true;
  $("custom-toggle").checked = false;
  $("closing").value = "2.5";
  $("reserves").value = "";
  clearProfiles();
  document.querySelector(`[data-profile="${id}"]`)?.setAttribute("aria-pressed", "true");
  render();
}

function bindMoney(id) {
  const input = $(id);
  input.addEventListener("blur", () => {
    const value = parseNumber(input.value);
    if (Number.isFinite(value)) input.value = formatInput(value);
  });
}

function populate() {
  const select = $("state");
  for (const state of STATE_TAX_RATES) {
    const option = document.createElement("option");
    option.value = state.code;
    option.textContent = `${state.name} · ${(state.rate * 100).toFixed(2)}%`;
    select.append(option);
  }
  const label = document.createElement("strong");
  label.textContent = `Freddie Mac · ${BENCHMARK.asOf}`;
  const detail = document.createElement("span");
  detail.textContent = `30-year ${rate(BENCHMARK.year30)} · 15-year ${rate(BENCHMARK.year15)}`;
  out("benchmark").append(label, document.createTextNode(" "), detail);

  const method = out("method");
  method.className = "method";
  const paragraphs = [
    `The starting rate is the ${BENCHMARK.source} for ${BENCHMARK.asOf}: ${rate(BENCHMARK.year30)} on a 30-year fixed and ${rate(BENCHMARK.year15)} on a 15-year fixed. A 20-year term sits between them. A 10-year term is 0.20 points under the 15-year average.`,
    "The survey is a national average of real applications. This model treats a 740–759 credit score, 20% down, a primary residence, and a conforming loan as zero, then moves the rate for credit, loan-to-value, occupancy, debt-to-income, jumbo size, and program. Those steps are a screening sketch. They are not a lender rate sheet and they are not Fannie Mae loan-level price adjustments.",
    `Conventional mortgage insurance follows a published 2026 borrower-paid monthly grid by credit score and loan-to-value for fixed terms over 20 years. Shorter terms often cost less. FHA uses a 1.75% upfront premium plus the annual schedule, with the higher tier above the ${money(CONFORMING_LIMIT, true)} conforming limit. VA uses the standard purchase funding-fee schedule. USDA uses a 1% upfront guarantee fee and a 0.35% annual fee.`,
    "Property-tax choices are rounded statewide approximations. The payment includes principal and interest, mortgage insurance, tax, homeowners insurance, and HOA. It leaves out discount points, a specific county loan limit, and a lender credit decision.",
  ];
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    method.append(paragraph);
  }
  const source = document.createElement("p");
  const link = document.createElement("a");
  link.href = BENCHMARK.sourceUrl;
  link.textContent = "Freddie Mac Primary Mortgage Market Survey";
  link.rel = "noreferrer";
  link.target = "_blank";
  source.append(document.createTextNode("Benchmark source: "), link, document.createTextNode("."));
  method.append(source);
}

function bind() {
  $("worksheet").addEventListener("submit", (event) => event.preventDefault());
  for (const id of ["income", "debts", "price", "down", "insurance", "hoa", "reserves"]) bindMoney(id);

  $("credit").addEventListener("input", () => {
    const score = parseNumber($("credit").value);
    if (score >= 300 && score <= 850) $("credit-range").value = String(score);
    clearProfiles();
    render();
  });
  $("credit-range").addEventListener("input", () => {
    $("credit").value = $("credit-range").value;
    clearProfiles();
    render();
  });
  $("down").addEventListener("input", () => {
    syncDownFields("dollars");
    clearProfiles();
    render();
  });
  $("down-pct").addEventListener("input", () => {
    syncDownFields("percent");
    clearProfiles();
    render();
  });
  $("price").addEventListener("input", () => {
    syncDownFields("price");
    if (insuranceAuto) {
      const price = parseNumber($("price").value);
      if (price > 0) $("insurance").value = formatInput(suggestedInsurance(price));
    }
    clearProfiles();
    render();
  });
  $("insurance").addEventListener("input", () => {
    insuranceAuto = false;
    $("insurance").dataset.auto = "false";
    clearProfiles();
    render();
  });
  $("state").addEventListener("change", () => {
    $("tax").value = (stateRate($("state").value) * 100).toFixed(2);
    clearProfiles();
    render();
  });
  $("tax").addEventListener("input", () => {
    clearProfiles();
    render();
  });

  for (const input of document.querySelectorAll("input, select")) {
    if (["credit", "credit-range", "down", "down-pct", "price", "insurance", "state", "tax"].includes(input.id)) continue;
    input.addEventListener("input", () => {
      clearProfiles();
      render();
    });
    input.addEventListener("change", () => {
      clearProfiles();
      render();
    });
  }

  document.querySelector(".chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-down]");
    if (!button) return;
    downMode = "percent";
    const pct = Number(button.dataset.down) * 100;
    $("down-pct").value = pct.toFixed(1);
    syncDownFields("percent");
    clearProfiles();
    render();
  });

  document.querySelector(".profiles").addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile]");
    if (button) applyProfile(button.dataset.profile);
  });

  out("term-table").addEventListener("click", (event) => {
    const button = event.target.closest("[data-term]");
    if (!button) return;
    setChecked("term", button.dataset.term);
    clearProfiles();
    render();
  });
  out("program-table").addEventListener("click", (event) => {
    const button = event.target.closest("[data-program]");
    if (!button) return;
    setChecked("program", button.dataset.program);
    clearProfiles();
    render();
  });
}

populate();
bind();
applyProfile("mid");
