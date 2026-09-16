const state = {
  index: null,
  currentDate: null,
  reportCache: new Map(),
  researchFramework: null,
  deskViewOverrides: null,
  historyMonth: null,
};

const els = {
  sidebar: document.querySelector("#sidebar"),
  historyList: document.querySelector("#historyList"),
  historyMonthFilter: document.querySelector("#historyMonthFilter"),
  historyMeta: document.querySelector("#historyMeta"),
  historyLatestButton: document.querySelector("#historyLatestButton"),
  historyToggleButton: document.querySelector("#historyToggleButton"),
  heroTitle: document.querySelector("#heroTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  statusLatestDate: document.querySelector("#statusLatestDate"),
  statusGeneratedAt: document.querySelector("#statusGeneratedAt"),
  statusToday: document.querySelector("#statusToday"),
  dashboardSections: document.querySelector("#dashboardSections"),
  detailSections: document.querySelector("#detailSections"),
  dashboardSummary: document.querySelector("#dashboardSummary"),
  strategyPanel: document.querySelector("#strategyPanel"),
  strategyFlag: document.querySelector("#strategyFlag"),
  strategyTone: document.querySelector("#strategyTone"),
  strategyDecision: document.querySelector("#strategyDecision"),
  strategyBody: document.querySelector("#strategyBody"),
  strategyDetails: document.querySelector("#strategyDetails"),
  marketPulse: document.querySelector("#marketPulse"),
  decisionFocus: document.querySelector("#decisionFocus"),
  trendStripPanel: document.querySelector("#trendStripPanel"),
  scPressurePanel: document.querySelector("#scPressurePanel"),
  optionContourPanel: document.querySelector("#optionContourPanel"),
  downloadLink: document.querySelector("#downloadLink"),
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    dashboard: document.querySelector("#dashboardView"),
    detail: document.querySelector("#detailView"),
  },
  refreshButton: document.querySelector("#refreshButton"),
  sectionTemplate: document.querySelector("#sectionTemplate"),
  cardTemplate: document.querySelector("#cardTemplate"),
  cardTooltip: document.querySelector("#cardTooltip"),
  trendTooltip: document.querySelector("#trendTooltip"),
};

function countDecimalsFromFormat(numFmt) {
  const match = numFmt?.match(/0\.(0+)/);
  return match ? match[1].length : 0;
}

function renderValue(value, numFmt = "") {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (numFmt.includes("%")) {
      const decimals = countDecimalsFromFormat(numFmt);
      return `${(value * 100).toLocaleString("zh-TW", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    }
    return Number.isInteger(value)
      ? value.toLocaleString("zh-TW")
      : value.toLocaleString("zh-TW", { maximumFractionDigits: 6 });
  }
  return String(value);
}

function numericValue(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatTaipeiTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function determineFlowTone(value) {
  const numeric = numericValue(value);
  if (numeric === null) return "neutral";
  if (numeric > 0) return "bull";
  if (numeric < 0) return "bear";
  return "neutral";
}

function determineRiskTone(value, threshold) {
  const numeric = numericValue(value);
  if (numeric === null) return "neutral";
  if (numeric >= threshold) return "risk";
  if (numeric > 0) return "bull";
  if (numeric < 0) return "bear";
  return "neutral";
}

function collectCards(report) {
  const entries = [];
  for (const section of report.dashboard.sections ?? []) {
    for (const card of section.cards ?? []) {
      entries.push({ section: section.title, ...card });
    }
  }
  return entries;
}

function collectAllCards(report) {
  const entries = collectCards(report);
  for (const section of report.detail.sections ?? []) {
    for (const card of section.cards ?? []) {
      entries.push({ section: section.title, ...card });
    }
  }
  return entries;
}

function getCardValue(cards, label) {
  const card = cards.find((item) => item.label === label);
  return card ? numericValue(card.value) : null;
}

function getCardRender(cards, label) {
  const card = cards.find((item) => item.label === label);
  if (!card) return "—";
  return renderValue(card.value, card.numFmt ?? "");
}

function collectCardsFromReport(report) {
  const entries = [];
  for (const section of report?.dashboard?.sections ?? []) {
    for (const card of section.cards ?? []) {
      entries.push({ section: section.title, ...card });
    }
  }
  return entries;
}

function collectAllCardsFromReport(report) {
  const entries = collectCardsFromReport(report);
  for (const section of report?.detail?.sections ?? []) {
    for (const card of section.cards ?? []) {
      entries.push({ section: section.title, ...card });
    }
  }
  return entries;
}

function getReportCardValue(report, label, { detail = false } = {}) {
  const cards = detail ? collectAllCardsFromReport(report) : collectCardsFromReport(report);
  return getCardValue(cards, label);
}

function buildRetailPositionFromHistory(historyReports) {
  const requiredLabels = ["散戶看多", "散戶看空", "微台散戶看多", "微台散戶看空", "微台散戶多空比"];
  const samples = historyReports
    .slice(0, 45)
    .map((report) => {
      const values = Object.fromEntries(requiredLabels.map((label) => [label, getReportCardValue(report, label)]));
      return requiredLabels.every((label) => values[label] !== null) ? values : null;
    })
    .filter(Boolean);
  const current = samples[0];
  if (!current) return null;

  const equivalentLong = (values) => values["散戶看多"] + values["微台散戶看多"] / 5;
  const equivalentShort = (values) => values["散戶看空"] + values["微台散戶看空"] / 5;
  const equivalentNet = (values) => equivalentLong(values) - equivalentShort(values);
  const longShare = (values) => {
    const total = equivalentLong(values) + equivalentShort(values);
    return total ? equivalentLong(values) / total : 0;
  };
  const shortShare = (values) => {
    const total = equivalentLong(values) + equivalentShort(values);
    return total ? equivalentShort(values) / total : 0;
  };
  const rawLong = (values) => values["散戶看多"] + values["微台散戶看多"];
  const rawShort = (values) => values["散戶看空"] + values["微台散戶看空"];
  const metricDefinitions = [
    ["equivalentLong", "散戶多方位階", equivalentLong, "小台散戶看多 + 微台散戶看多 / 5", "多方擁擠"],
    ["equivalentShort", "散戶空方位階", equivalentShort, "小台散戶看空 + 微台散戶看空 / 5", "空方擁擠"],
    ["equivalentNet", "散戶淨多空位階", equivalentNet, "小台＋微台等值多單 - 小台＋微台等值空單", "淨多偏高"],
    ["longShare", "散戶多單持倉占比", longShare, "等值多單 / (等值多單 + 等值空單)", "多方持倉偏高", "share"],
    ["shortShare", "散戶空單持倉占比", shortShare, "等值空單 / (等值多單 + 等值空單)", "空方持倉偏高", "share"],
    ["microRatio", "微台多空比位階", (values) => values["微台散戶多空比"], "微台散戶多空比", "微台追價偏熱"],
  ];
  const canRank = samples.length >= 20;
  const metrics = metricDefinitions.map(([key, label, calculate, formula, crowding, type]) => {
    const currentValue = calculate(current);
    const values = samples.map(calculate);
    const below = values.filter((value) => value < currentValue).length;
    const equal = values.filter((value) => value === currentValue).length;
    return {
      key,
      label,
      value: canRank ? Math.round(((below + equal / 2) / values.length) * 1000) / 10 : null,
      current: currentValue,
      formula,
      crowding,
      type,
    };
  });
  const buildVelocityMetric = ({ key, label, equivalent, raw, formula, increased, decreased }) => {
    const speedSamples = samples
      .slice(0, -1)
      .map((values, index) => {
        const previous = samples[index + 1];
        const currentEquivalent = equivalent(values);
        const previousEquivalent = equivalent(previous);
        const currentRaw = raw(values);
        const previousRaw = raw(previous);
        if (previousEquivalent === 0 || previousRaw === 0) return null;
        return {
          equivalentRate: (currentEquivalent - previousEquivalent) / previousEquivalent,
          equivalentDelta: currentEquivalent - previousEquivalent,
          rawRate: (currentRaw - previousRaw) / previousRaw,
          rawDelta: currentRaw - previousRaw,
        };
      })
      .filter(Boolean);
    const currentSpeed = speedSamples[0] ?? null;
    if (!currentSpeed) return null;

    const speedStrength = Math.abs(currentSpeed.equivalentRate);
    const speedStrengthRank = speedSamples.length >= 20
      ? Math.round(
        ((
          speedSamples.filter((sample) => Math.abs(sample.equivalentRate) < speedStrength).length +
          speedSamples.filter((sample) => Math.abs(sample.equivalentRate) === speedStrength).length / 2
        ) / speedSamples.length) * 1000
      ) / 10
      : null;
    const isIncrease = currentSpeed.equivalentRate >= 0;
    return {
      key,
      label,
      value: speedStrengthRank,
      current: currentSpeed.equivalentRate,
      currentDelta: currentSpeed.equivalentDelta,
      rawRate: currentSpeed.rawRate,
      rawDelta: currentSpeed.rawDelta,
      formula,
      crowding: isIncrease
        ? speedStrengthRank !== null && speedStrengthRank >= 80 ? `${increased}加速` : increased
        : speedStrengthRank !== null && speedStrengthRank >= 80 ? `${decreased}加速` : decreased,
      type: "velocity",
      tone: isIncrease ? "positive" : "negative",
    };
  };
  const longVelocity = buildVelocityMetric({
    key: "equivalentLongVelocity",
    label: "等值多單增減速度",
    equivalent: equivalentLong,
    raw: rawLong,
    formula: "等值多單 = 小台散戶看多 + 微台散戶看多 / 5；速度強度位階以近45日等值多單日變動率絕對值取中間排名。",
    increased: "追多",
    decreased: "去槓桿",
  });
  const shortVelocity = buildVelocityMetric({
    key: "equivalentShortVelocity",
    label: "等值空單增減速度",
    equivalent: equivalentShort,
    raw: rawShort,
    formula: "等值空單 = 小台散戶看空 + 微台散戶看空 / 5；速度強度位階以近45日等值空單日變動率絕對值取中間排名。",
    increased: "空單加碼",
    decreased: "空單回補",
  });
  [longVelocity, shortVelocity].filter(Boolean).forEach((metric) => metrics.push(metric));
  const history = samples.map((values, index) => {
    const previous = samples[index + 1];
    const long = equivalentLong(values);
    const short = equivalentShort(values);
    const previousLong = previous ? equivalentLong(previous) : null;
    const previousShort = previous ? equivalentShort(previous) : null;
    return {
      date: historyReports[index]?.date ?? "",
      equivalentLong: long,
      equivalentShort: short,
      longShare: longShare(values),
      shortShare: shortShare(values),
      longVelocity: previousLong ? (long - previousLong) / previousLong : null,
      shortVelocity: previousShort ? (short - previousShort) / previousShort : null,
    };
  });
  const historyMidrank = (values, current, absolute = false) => {
    const normalized = values.map((value) => absolute ? Math.abs(value) : value);
    const target = absolute ? Math.abs(current) : current;
    const below = normalized.filter((value) => value < target).length;
    const equal = normalized.filter((value) => value === target).length;
    return Math.round(((below + equal / 2) / normalized.length) * 1000) / 10;
  };
  const longVelocityHistory = history.map((item) => item.longVelocity).filter((value) => value !== null);
  const shortVelocityHistory = history.map((item) => item.shortVelocity).filter((value) => value !== null);
  history.forEach((item) => {
    item.longShareRank = historyMidrank(history.map((sample) => sample.longShare), item.longShare);
    item.shortShareRank = historyMidrank(history.map((sample) => sample.shortShare), item.shortShare);
    item.longVelocityRank = item.longVelocity === null ? null : historyMidrank(longVelocityHistory, item.longVelocity, true);
    item.shortVelocityRank = item.shortVelocity === null ? null : historyMidrank(shortVelocityHistory, item.shortVelocity, true);
  });
  const longRank = metrics[0].value;
  const shortRank = metrics[1].value;
  const assessment = longRank !== null && shortRank !== null && longRank >= 80 && shortRank >= 80
    ? "雙向槓桿偏高"
    : longRank !== null && longRank >= 80
      ? "多方擁擠"
      : shortRank !== null && shortRank >= 80
        ? "空方擁擠"
        : canRank ? "未見極端擁擠" : "樣本不足";
  return {
    window: 45,
    sampleCount: samples.length,
    minimumSamples: 20,
    basis: "小台＋微台等值口數；微台 5 口換算為 1 口小台等值。",
    rankFormula: "近45日相對位階（同值取中間排名）= (低於本日筆數 + 同值筆數 / 2) / 樣本數 x 100。",
    assessment,
    metrics,
    history,
  };
}

function scPressureTone(rank) {
  if (rank === null) return "is-muted";
  if (rank >= 90) return "is-extreme";
  if (rank >= 75) return "is-pressure";
  if (rank >= 50) return "is-watch";
  return "is-normal";
}

function scPressureLabel(rank) {
  if (rank === null) return "樣本不足";
  if (rank >= 90) return "極端壓力";
  if (rank >= 75) return "壓力突出";
  if (rank >= 50) return "注意";
  return "正常";
}

function percentChange(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

function formatSignedPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${renderValue(value, "0.00%")}`;
}

function formatSignedNumber(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  const output = Number(value).toLocaleString("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value >= 0 ? "+" : ""}${output}`;
}

function buildScPressureSnapshot(historyReports) {
  const pairs = [];
  const maxPairs = Math.min(45, Math.max(0, historyReports.length - 1));
  for (let index = 0; index < maxPairs; index += 1) {
    const report = historyReports[index];
    const previous = historyReports[index + 1];
    const indexChange = getReportCardValue(report, "加權指數漲跌");
    const scQty = getReportCardValue(report, "外資SC口數", { detail: true });
    const previousScQty = getReportCardValue(previous, "外資SC口數", { detail: true });
    const scAmount = getReportCardValue(report, "外資SC金額", { detail: true });
    const previousScAmount = getReportCardValue(previous, "外資SC金額", { detail: true });
    const bcAmount = getReportCardValue(report, "外資BC金額", { detail: true });
    const previousBcAmount = getReportCardValue(previous, "外資BC金額", { detail: true });
    const scQtyRate = percentChange(scQty, previousScQty);
    const scAmountRate = percentChange(scAmount, previousScAmount);
    const bcAmountRate = percentChange(bcAmount, previousBcAmount);
    if ([indexChange, scQtyRate, scAmountRate, bcAmountRate].some((value) => value === null)) continue;
    pairs.push({
      date: report.date,
      indexChange,
      scQty,
      previousScQty,
      scQtyRate,
      scAmountRate,
      bcAmountRate,
      strictPressure: scAmountRate - bcAmountRate,
    });
  }

  const current = pairs[0] ?? null;
  if (!current) return null;
  const upDaySamples = pairs.filter((item) => item.indexChange > 0);
  const ranked = upDaySamples.length >= 20 && current.indexChange > 0;
  const rank = (key) => {
    if (!ranked) return null;
    const values = upDaySamples.map((item) => item[key]);
    const below = values.filter((value) => value < current[key]).length;
    const equal = values.filter((value) => value === current[key]).length;
    return Math.round(((below + equal / 2) / values.length) * 1000) / 10;
  };

  return {
    date: current.date,
    isUpDay: current.indexChange > 0,
    sampleCount: upDaySamples.length,
    window: maxPairs,
    speedRank: rank("scQtyRate"),
    strictRank: rank("strictPressure"),
    scQtyDelta: current.scQty - current.previousScQty,
    scQtyRate: current.scQtyRate,
    scAmountRate: current.scAmountRate,
    bcAmountRate: current.bcAmountRate,
    strictPressure: current.strictPressure,
    strictCondition: current.scAmountRate > 0 && current.bcAmountRate < 0,
  };
}

function buildScPressureMetric({ label, rank, raw, formula, tone }) {
  const item = document.createElement("article");
  item.className = `sc-pressure-metric ${tone}`;
  item.title = formula;

  const head = document.createElement("div");
  head.className = "sc-pressure-metric-head";
  const name = document.createElement("span");
  name.textContent = label;
  const badge = document.createElement("span");
  badge.className = `sc-pressure-badge ${tone}`;
  badge.textContent = scPressureLabel(rank);
  head.append(name, badge);

  const value = document.createElement("strong");
  value.textContent = rank === null ? "未評分" : `${renderValue(rank, "0.0")}%`;
  const rawLine = document.createElement("p");
  rawLine.className = "sc-pressure-raw";
  rawLine.textContent = raw;

  const track = document.createElement("div");
  track.className = "sc-pressure-track";
  const fill = document.createElement("span");
  fill.className = `sc-pressure-fill ${tone}`;
  fill.style.width = `${Math.max(0, Math.min(100, rank ?? 0))}%`;
  track.appendChild(fill);

  item.append(head, value, rawLine, track);
  return item;
}

function buildPanelDisclosure(summaryText, detailText) {
  const disclosure = document.createElement("details");
  disclosure.className = "panel-disclosure";
  const summary = document.createElement("summary");
  summary.textContent = summaryText;
  const detail = document.createElement("p");
  detail.textContent = detailText;
  disclosure.append(summary, detail);
  return disclosure;
}

function renderScPressurePanel(snapshot) {
  const panel = els.scPressurePanel;
  panel.replaceChildren();
  if (!snapshot) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.className = `sc-pressure-panel ${snapshot.isUpDay ? "" : "is-not-scored"}`;
  panel.setAttribute("aria-label", "上漲日 SC 壓力監測");

  const head = document.createElement("div");
  head.className = "sc-pressure-head";
  const heading = document.createElement("div");
  const title = document.createElement("div");
  title.className = "sc-pressure-title";
  title.textContent = snapshot.isUpDay ? "上漲日 SC 壓力監測" : "SC 壓力｜下跌日改看輪廓";
  const meta = document.createElement("p");
  meta.className = "sc-pressure-meta";
  meta.textContent = snapshot.isUpDay
    ? `透明試算｜近 ${snapshot.window} 筆交易快照中的 ${snapshot.sampleCount} 筆上漲日樣本`
    : "下跌日不以 CALL 賣方壓力百分位評分";
  heading.append(title, meta);
  const status = document.createElement("span");
  const highestRank = Math.max(snapshot.speedRank ?? 0, snapshot.strictRank ?? 0);
  const statusTone = snapshot.isUpDay ? scPressureTone(highestRank) : "is-muted";
  status.className = `sc-pressure-status ${statusTone}`;
  status.textContent = snapshot.isUpDay ? scPressureLabel(highestRank) : "改看 CALL／PUT";
  head.append(heading, status);
  panel.appendChild(head);

  if (!snapshot.isUpDay) {
    const inactive = document.createElement("p");
    inactive.className = "sc-pressure-inactive";
    inactive.textContent = "下跌日：SC 壓力百分位不評分。請優先看下方「選擇權輪廓」的 CALL 壓力是否收斂、PUT 防守是否升高，再交叉比對散戶位階。";
    panel.appendChild(inactive);
  } else {
    const grid = document.createElement("div");
    grid.className = "sc-pressure-grid";
    grid.append(
      buildScPressureMetric({
        label: "SC 增加速度",
        rank: snapshot.speedRank,
        raw: `SC 口數 ${formatSignedNumber(snapshot.scQtyDelta)} 口（${formatSignedPercent(snapshot.scQtyRate)}）`,
        formula: "口數日增幅 =（今日 SC 口數 − 前日 SC 口數）÷ 前日 SC 口數；再以同條件上漲日樣本取中位排名。",
        tone: scPressureTone(snapshot.speedRank),
      }),
      buildScPressureMetric({
        label: "嚴格 SC 壓力",
        rank: snapshot.strictRank,
        raw: `SC ${formatSignedPercent(snapshot.scAmountRate)} ｜ BC ${formatSignedPercent(snapshot.bcAmountRate)} ｜差 ${formatSignedPercent(snapshot.strictPressure).replace("%", " 個百分點")}`,
        formula: "壓力差 = SC 金額日增幅 − BC 金額日增幅；SC 增且 BC 降時，代表 Call 賣方壓力更嚴格。",
        tone: scPressureTone(snapshot.strictRank),
      })
    );
    panel.appendChild(grid);
    panel.appendChild(buildPanelDisclosure(
      "查看 SC 指標口徑",
      "SC 增加速度＝（今日 SC 口數－前日 SC 口數）÷ 前日 SC 口數；嚴格 SC 壓力＝SC 金額日增幅－BC 金額日增幅。兩者皆只在加權指數上漲日，與近45筆快照中的上漲日樣本比較並取中間排名。"
    ));
  }

  const note = document.createElement("p");
  note.className = "sc-pressure-note";
  note.textContent = "色彩只代表 Call 賣方壓力等級，不代表大盤漲跌方向。資料來源：TAIFEX 外資 BC／SC 未平倉口數與金額；百分位為本站透明試算，非期交所官方欄位。";
  if (snapshot.isUpDay) panel.appendChild(note);
}

function midrankFromValues(values, current) {
  if (values.length < 20 || current === null) return null;
  const below = values.filter((value) => value < current).length;
  const equal = values.filter((value) => value === current).length;
  return Math.round(((below + equal / 2) / values.length) * 1000) / 10;
}

function buildOptionContourSnapshot(historyReports) {
  const samples = historyReports.slice(0, 45).map((report) => {
    const bc = getReportCardValue(report, "外資BC金額", { detail: true });
    const sc = getReportCardValue(report, "外資SC金額", { detail: true });
    const bp = getReportCardValue(report, "外資BP金額", { detail: true });
    const sp = getReportCardValue(report, "外資SP金額", { detail: true });
    if ([bc, sc, bp, sp].some((value) => value === null)) return null;
    return { callPressure: sc - bc, putDefense: bp - sp };
  }).filter(Boolean);
  const current = samples[0] ?? null;
  const previous = samples[1] ?? null;
  if (!current || !previous) return null;

  return {
    sampleCount: samples.length,
    window: 45,
    callPressure: current.callPressure,
    callChange: current.callPressure - previous.callPressure,
    callRank: midrankFromValues(samples.map((item) => item.callPressure), current.callPressure),
    putDefense: current.putDefense,
    putChange: current.putDefense - previous.putDefense,
    putRank: midrankFromValues(samples.map((item) => item.putDefense), current.putDefense),
  };
}

function changeLabel(change, side) {
  if (change === 0) return side === "call" ? "壓力持平" : "防守持平";
  if (side === "call") return change > 0 ? "壓力升高" : "壓力收斂";
  return change > 0 ? "防守升高" : "防守減弱";
}

function changeTone(change, side) {
  if (change === 0) return "is-flat";
  if (side === "call") return change > 0 ? "is-call-rising" : "is-call-easing";
  return change > 0 ? "is-put-rising" : "is-put-easing";
}

function buildOptionContourMetric({ side, value, change, rank, formula }) {
  const isCall = side === "call";
  const item = document.createElement("article");
  item.className = `option-contour-metric ${isCall ? "is-call" : "is-put"}`;
  item.dataset.relationGroups = isCall ? "foreign-call" : "foreign-put";
  item.title = formula;

  const head = document.createElement("div");
  head.className = "option-contour-metric-head";
  const label = document.createElement("span");
  label.textContent = isCall ? "CALL 端｜上檔壓力" : "PUT 端｜下檔防守";
  const rankTag = document.createElement("span");
  rankTag.className = "option-contour-rank";
  rankTag.textContent = rank === null ? "樣本不足" : `${renderValue(rank, "0.0")}% 位階`;
  head.append(label, rankTag);

  const total = document.createElement("strong");
  total.className = "option-contour-total";
  total.textContent = renderValue(value, "#,##0");
  const unit = document.createElement("span");
  unit.className = "option-contour-unit";
  unit.textContent = "未平倉淨額｜仟元";

  const delta = document.createElement("div");
  const deltaTone = changeTone(change, side);
  delta.className = `option-contour-delta ${deltaTone}`;
  const arrow = document.createElement("span");
  arrow.textContent = change > 0 ? "▲" : change < 0 ? "▼" : "■";
  const deltaText = document.createElement("span");
  deltaText.textContent = `${formatSignedNumber(change)}｜${changeLabel(change, side)}`;
  delta.append(arrow, deltaText);

  const track = document.createElement("div");
  track.className = "option-contour-track";
  const fill = document.createElement("span");
  fill.className = "option-contour-fill";
  fill.style.width = `${Math.max(0, Math.min(100, rank ?? 0))}%`;
  track.appendChild(fill);

  item.append(head, total, unit, delta, track);
  bindResearchRelationInteraction(item);
  return item;
}

function renderOptionContourPanel(snapshot) {
  const panel = els.optionContourPanel;
  panel.replaceChildren();
  if (!snapshot) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.dataset.relationGroups = "foreign-call foreign-put";

  const head = document.createElement("div");
  head.className = "option-contour-head";
  const heading = document.createElement("div");
  const title = document.createElement("div");
  title.className = "option-contour-title";
  title.textContent = "外資選擇權輪廓｜存量 × 加減碼";
  const meta = document.createElement("p");
  meta.className = "option-contour-meta";
  meta.textContent = `近 ${snapshot.window} 筆交易快照 / ${snapshot.sampleCount} 筆樣本 / TAIFEX 外資未平倉金額`;
  heading.append(title, meta);
  const conclusion = document.createElement("span");
  conclusion.className = "option-contour-conclusion";
  conclusion.textContent = `${changeLabel(snapshot.callChange, "call")}｜${changeLabel(snapshot.putChange, "put")}`;
  head.append(heading, conclusion);
  panel.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "option-contour-grid";
  grid.append(
    buildOptionContourMetric({
      side: "call",
      value: snapshot.callPressure,
      change: snapshot.callChange,
      rank: snapshot.callRank,
      formula: "CALL 端壓力 = SC 金額 − BC 金額；今日增減 = 今日壓力 − 前日壓力。",
    }),
    buildOptionContourMetric({
      side: "put",
      value: snapshot.putDefense,
      change: snapshot.putChange,
      rank: snapshot.putRank,
      formula: "PUT 端防守 = BP 金額 − SP 金額；今日增減 = 今日防守 − 前日防守。",
    })
  );
  panel.appendChild(grid);

  const interpretation = document.createElement("p");
  interpretation.className = "option-contour-interpretation";
  interpretation.textContent = `本日輪廓：CALL 端較前日${snapshot.callChange > 0 ? "增加" : snapshot.callChange < 0 ? "減少" : "持平"} ${renderValue(Math.abs(snapshot.callChange), "#,##0")}；PUT 端較前日${snapshot.putChange > 0 ? "增加" : snapshot.putChange < 0 ? "減少" : "持平"} ${renderValue(Math.abs(snapshot.putChange), "#,##0")}。存量與增減必須一起看，不可單憑其中一側直接判定多空。`;
  panel.appendChild(interpretation);

  panel.appendChild(buildPanelDisclosure(
    "查看輪廓口徑與色碼",
    "CALL 端壓力＝SC 金額－BC 金額；PUT 端防守＝BP 金額－SP 金額；今日增減＝今日數值－前日數值。橘紅代表 CALL 上檔壓力、藍紫代表 PUT 下檔防守、青綠代表 CALL 壓力收斂、灰色代表持平或防守減弱。"
  ));

}

function firstSentence(value, fallback = "—") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const match = text.match(/^.*?[。！？]/);
  return match ? match[0] : text;
}

function buildPulseCell({ label, value, detail, tone = "neutral", signal = "", relationGroups = [] }) {
  const item = document.createElement("article");
  item.className = `market-pulse-cell tone-${tone}`;
  item.dataset.relationGroups = relationGroups.join(" ");
  const head = document.createElement("div");
  head.className = "market-pulse-cell-head";
  const name = document.createElement("span");
  name.textContent = label;
  const tag = document.createElement("span");
  tag.className = "market-pulse-tag";
  tag.textContent = signal || "觀察";
  head.append(name, tag);

  const primary = document.createElement("strong");
  primary.textContent = value;
  const note = document.createElement("p");
  note.textContent = detail;
  item.append(head, primary, note);
  bindResearchRelationInteraction(item);
  return item;
}

function buildMarketPulse(report, strategy, optionSnapshot, retailPosition) {
  const cards = collectCards(report);
  const indexLevel = getCardRender(cards, "加權指數");
  const indexChange = getCardValue(cards, "加權指數漲跌");
  const indexMove = getCardRender(cards, "加權指數漲跌");
  const futures = getCardValue(cards, "外資(大小台)期貨未平倉");
  const futuresDelta = getCardValue(cards, "外資期貨未平倉與前日增減");
  const metrics = new Map((retailPosition?.metrics ?? []).map((item) => [item.key, item]));
  const longShare = metrics.get("longShare")?.current;
  const shortShare = metrics.get("shortShare")?.current;

  const panel = els.marketPulse;
  panel.replaceChildren();
  panel.hidden = false;

  const head = document.createElement("div");
  head.className = "market-pulse-head";
  const title = document.createElement("div");
  title.className = "market-pulse-title";
  title.textContent = "Market Pulse";
  const meta = document.createElement("p");
  meta.className = "market-pulse-meta";
  meta.textContent = "先看四項關鍵結構；移入訊號可追蹤同一條研究脈絡。";
  head.append(title, meta);
  panel.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "market-pulse-grid";
  const marketSignal = indexChange === null ? "資料不足" : indexChange > 0 ? "收紅" : indexChange < 0 ? "收黑" : "平盤";
  grid.appendChild(buildPulseCell({
    label: "大盤動能",
    value: indexLevel,
    detail: `當日漲跌 ${indexMove}`,
    tone: determineFlowTone(indexChange),
    signal: marketSignal,
    relationGroups: ["market-price"],
  }));

  const futuresSignal = futuresDelta === null
    ? "資料不足"
    : futuresDelta > 0
      ? futures !== null && futures < 0 ? "空單回補" : "部位增加"
      : futuresDelta < 0
        ? futures !== null && futures < 0 ? "空單加碼" : "部位減碼"
        : "部位持平";
  grid.appendChild(buildPulseCell({
    label: "外資期貨",
    value: futures === null ? "—" : `${renderValue(futures, "#,##0")} 口`,
    detail: `前日增減 ${formatSignedNumber(futuresDelta)} 口`,
    tone: determineFlowTone(futuresDelta),
    signal: futuresSignal,
    relationGroups: ["foreign-flow"],
  }));

  const optionSignal = !optionSnapshot
    ? "資料不足"
    : optionSnapshot.callChange < 0 && optionSnapshot.putChange >= 0
      ? "結構改善"
      : optionSnapshot.callChange > 0 && optionSnapshot.putChange < 0
        ? "雙向轉弱"
        : `${changeLabel(optionSnapshot.callChange, "call")}／${changeLabel(optionSnapshot.putChange, "put")}`;
  const optionTone = !optionSnapshot
    ? "neutral"
    : optionSnapshot.callChange > 0 && optionSnapshot.putChange < 0
      ? "risk"
      : optionSnapshot.callChange < 0 && optionSnapshot.putChange >= 0
        ? "bull"
        : "neutral";
  grid.appendChild(buildPulseCell({
    label: "選擇權輪廓",
    value: optionSnapshot ? `CALL ${formatSignedNumber(optionSnapshot.callChange)}｜PUT ${formatSignedNumber(optionSnapshot.putChange)}` : "—",
    detail: "依外資未平倉金額的當日變化計算",
    tone: optionTone,
    signal: optionSignal,
    relationGroups: ["foreign-call", "foreign-put"],
  }));

  const retailAssessment = retailPosition?.assessment ?? "資料不足";
  const retailTone = retailAssessment.includes("雙向") ? "risk" : "neutral";
  grid.appendChild(buildPulseCell({
    label: "散戶位階",
    value: longShare === undefined || shortShare === undefined
      ? "—"
      : `多 ${renderValue(longShare, "0.0%")}｜空 ${renderValue(shortShare, "0.0%")}`,
    detail: "近 45 日等值部位相對水位",
    tone: retailTone,
    signal: retailAssessment,
    relationGroups: ["retail-long", "retail-short", "retail-net", "retail-micro"],
  }));
  panel.appendChild(grid);
}

function buildDecisionFocus(report, strategy) {
  const blocks = new Map((strategy.blocks ?? []).map((block) => [block.label, block]));
  const theme = strategy.flag || firstSentence(blocks.get("主命題")?.text, "盤勢結構判讀");
  const action = firstSentence(blocks.get("部位節奏")?.text, "依結構分段處理");
  const validation = firstSentence(blocks.get("驗證重點")?.text, "等待下一個驗證條件");
  const panel = els.decisionFocus;
  panel.replaceChildren();
  panel.hidden = false;
  panel.className = `decision-focus tone-${strategy.tone}`;

  const identity = document.createElement("div");
  identity.className = "decision-focus-identity";
  const kicker = document.createElement("span");
  kicker.textContent = "DECISION FOCUS";
  const date = document.createElement("strong");
  date.textContent = report.date;
  identity.append(kicker, date);

  const thesis = document.createElement("div");
  thesis.className = "decision-focus-item decision-focus-thesis";
  const thesisLabel = document.createElement("span");
  thesisLabel.textContent = "當日結論";
  const thesisValue = document.createElement("strong");
  thesisValue.textContent = `${theme} · ${strategy.toneLabel}`;
  thesis.append(thesisLabel, thesisValue);

  const actionItem = document.createElement("div");
  actionItem.className = "decision-focus-item";
  const actionLabel = document.createElement("span");
  actionLabel.textContent = "部位節奏";
  const actionValue = document.createElement("p");
  actionValue.textContent = action;
  actionItem.append(actionLabel, actionValue);

  const validationItem = document.createElement("div");
  validationItem.className = "decision-focus-item";
  const validationLabel = document.createElement("span");
  validationLabel.textContent = "下一個驗證";
  const validationValue = document.createElement("p");
  validationValue.textContent = validation;
  validationItem.append(validationLabel, validationValue);

  const openDesk = document.createElement("button");
  openDesk.type = "button";
  openDesk.className = "decision-focus-open";
  openDesk.textContent = "DESK VIEW";
  openDesk.setAttribute("aria-label", "展開完整 Desk View 判讀");
  openDesk.addEventListener("click", () => {
    els.strategyDetails.open = true;
    els.strategyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  panel.append(identity, thesis, actionItem, validationItem, openDesk);
}

function average(values) {
  if (!values || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDeskViewBody(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stylizeStrategyBody(body, tone) {
  let html = escapeHtml(body);
  const replacements = [
    { pattern: /雙紫爆/g, cls: "desk-risk" },
    { pattern: /驚驚漲末段/g, cls: "desk-risk" },
    { pattern: /高檔整理/g, cls: "desk-risk" },
    { pattern: /中期整理/g, cls: "desk-risk" },
    { pattern: /高槓桿/g, cls: "desk-risk" },
    { pattern: /回測整理/g, cls: "desk-risk" },
    { pattern: /5-8%/g, cls: "desk-risk" },
    { pattern: /風險回收/g, cls: "desk-risk" },
    { pattern: /部位調整/g, cls: "desk-risk" },
    { pattern: /動態避險/g, cls: "desk-focus" },
    { pattern: /逆勢布局/g, cls: "desk-bull" },
    { pattern: /逆勢布局型態/g, cls: "desk-bull" },
    { pattern: /積極偏多/g, cls: "desk-bull" },
    { pattern: /偏多/g, cls: "desk-bull" },
    { pattern: /短線相對低點/g, cls: "desk-bull" },
    { pattern: /5% 上下甚至更大的回測整理/g, cls: "desk-risk" },
  ];

  for (const { pattern, cls } of replacements) {
    html = html.replace(pattern, (match) => `<span class="${cls}">${match}</span>`);
  }

  const sentences = html
    .split(/(?<=。)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 0) {
    sentences[0] = `<span class="desk-lead tone-${tone}">${sentences[0]}</span>`;
  }

  return sentences.join("");
}

function renderStrategyBlocks(blocks, tone) {
  return blocks
    .filter((block) => block && block.text)
    .map((block, index) => {
      const label = escapeHtml(block.label ?? "");
      const bodyHtml = stylizeStrategyBody(block.text, index === 0 ? tone : "neutral");
      const evidenceLinks = deskEvidenceLinks[block.label] ?? [];
      const relationGroups = strategyBlockRelations[block.label] ?? evidenceLinks.flatMap((link) => link.groups);
      const relationAttribute = relationGroups.length ? ` data-relation-groups="${relationGroups.join(" ")}"` : "";
      const linksHtml = evidenceLinks.length === 0
        ? ""
        : `
          <div class="strategy-evidence-links" aria-label="${label} 對應資料卡">
            ${evidenceLinks.map((link) => `
              <button class="strategy-evidence-link" type="button" data-relation-groups="${link.groups.join(" ")}">
                <span>DATA</span>${escapeHtml(link.label)}
              </button>
            `).join("")}
          </div>
        `;
      return `
        <section class="strategy-block"${relationAttribute}>
          <div class="strategy-block-head">${label}</div>
          <div class="strategy-block-body">
            <div class="strategy-bullet"></div>
            <div class="strategy-block-text">${bodyHtml}${linksHtml}</div>
          </div>
        </section>
      `;
    })
    .join("");
}

const deskEvidenceLinks = {
  "支持證據": [
    { label: "外資期貨", groups: ["foreign-flow"] },
    { label: "CALL／PUT", groups: ["foreign-call", "foreign-put"] },
    { label: "散戶位階", groups: ["retail-long", "retail-short", "retail-net", "retail-micro"] },
  ],
  "反證風險": [
    { label: "外資期貨", groups: ["foreign-flow"] },
    { label: "CALL 壓力", groups: ["foreign-call"] },
    { label: "散戶部位", groups: ["retail-long", "retail-short", "retail-net"] },
  ],
  "驗證重點": [
    { label: "期貨續航", groups: ["foreign-flow"] },
    { label: "SP／PUT", groups: ["foreign-put"] },
    { label: "散戶降溫", groups: ["retail-long", "retail-short", "retail-net", "retail-micro"] },
  ],
};

const strategyBlockRelations = {
  "歷史定位": ["market-price", "foreign-flow", "foreign-call", "foreign-put", "retail-long", "retail-short", "retail-net"],
  "支持證據": ["foreign-flow", "foreign-call", "foreign-put", "retail-long", "retail-short", "retail-net", "retail-micro"],
  "反證風險": ["foreign-flow", "foreign-call", "foreign-put", "retail-long", "retail-short", "retail-net"],
  "部位節奏": ["market-price", "foreign-flow", "foreign-call", "foreign-put", "retail-net"],
  "驗證重點": ["foreign-flow", "foreign-call", "foreign-put", "retail-long", "retail-short", "retail-net", "retail-micro"],
};

function bindDeskEvidenceLinks() {
  els.strategyBody.querySelectorAll(".strategy-block[data-relation-groups]").forEach(bindResearchRelationInteraction);
  els.strategyBody.querySelectorAll(".strategy-evidence-link").forEach((button) => {
    button.addEventListener("click", () => {
      const groups = nodeRelationGroups(button);
      const target = [...document.querySelectorAll(".card[data-relation-groups]")]
        .find((card) => nodeRelationGroups(card).some((group) => groups.includes(group)));
      hideCardTooltip();
      setRelationActivity(groups);
      target?.classList.add("relation-jump");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        document.querySelectorAll(".relation-jump").forEach((card) => card.classList.remove("relation-jump"));
        document.querySelectorAll(".relation-active").forEach((card) => card.classList.remove("relation-active"));
      }, 2200);
    });
  });
}

function mergeStrategyBlocks(baseBlocks, overrideBlocks) {
  if (!Array.isArray(overrideBlocks) || overrideBlocks.length === 0) return baseBlocks;

  const overridesByLabel = new Map(
    overrideBlocks
      .filter((block) => block?.label && block?.text)
      .map((block) => [block.label, block])
  );
  const merged = baseBlocks.map((block) => overridesByLabel.get(block.label) ?? block);
  const knownLabels = new Set(baseBlocks.map((block) => block.label));
  return merged.concat(overrideBlocks.filter((block) => block?.label && !knownLabels.has(block.label)));
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === "string" && value.trim()))];
}

function compactSentences(values, limit = 2) {
  return uniqueStrings(values)
    .slice(0, limit)
    .map((value) => value.trim().replace(/。?$/, "。"));
}

function deriveResearchTags(context) {
  const tags = new Set([context.lensKey]);
  if (context.lensKey === "bottoming") tags.add("washout");
  if (context.lensKey === "washout") tags.add("bottoming");
  if (context.lensKey === "repair") tags.add("repair");
  if (context.lensKey === "accumulation") {
    tags.add("accumulation");
    tags.add("waiting");
  }
  if (context.lensKey === "divergence") tags.add("divergence");
  if (context.optionOverheatSignal) {
    tags.add("overheat");
    tags.add("no_chase");
  }
  if (context.contrarianBullSignal) tags.add("divergence");
  if (context.strongerBottomSignal || context.panicWashoutSignal) {
    tags.add("bottoming");
    tags.add("washout");
  }
  if (context.isSettlementResetDay || context.bcStallScHoldSignal) tags.add("settlement");
  if (context.whipsawReclaimSignal) tags.add("repair");
  return [...tags];
}

function buildResearchOverlay(framework, context) {
  if (!framework) return null;
  const archetype = framework.archetypes?.[context.lensKey] ?? null;
  const tags = deriveResearchTags(context);
  // Prefer curated notes over automatic drafts, then favor the newest matching research.
  const matchedNotes = (framework.notes ?? [])
    .filter((note) => (note.tags ?? []).some((tag) => tags.includes(tag)))
    .slice()
    .sort((left, right) => {
      const leftAuto = /自動初稿|_auto-note/i.test(`${left.title ?? ""} ${left.source ?? ""}`);
      const rightAuto = /自動初稿|_auto-note/i.test(`${right.title ?? ""} ${right.source ?? ""}`);
      if (leftAuto !== rightAuto) return leftAuto ? 1 : -1;
      return String(right.source ?? "").localeCompare(String(left.source ?? ""), "zh-Hant");
    });
  const noteTitles = matchedNotes.slice(0, 2).map((note) => note.title.replace(/\s*研究筆記$/, ""));
  const noteCorePoints = compactSentences(
    matchedNotes.flatMap((note) => note.corePoints ?? []),
    2
  );
  const noteDeskImpacts = compactSentences(
    matchedNotes.flatMap((note) => note.deskViewImpacts ?? []),
    2
  );
  const noteReminders = compactSentences(
    matchedNotes.flatMap((note) => note.practicalReminders ?? []),
    2
  );
  const principleHints = compactSentences(framework.principles ?? [], 2);

  const frameworkView = archetype
    ? `研究框架把今天先歸在「${archetype.label}」：${compactSentences([archetype.thesis, archetype.positioning], 2).join("")}`
    : "";
  const noteView =
    noteTitles.length > 0 || noteCorePoints.length > 0
      ? `對照研究庫${noteTitles.length > 0 ? `（${noteTitles.join("、")}）` : ""}，這類盤更該抓的是結構節奏，不是只跟著單日紅黑 K 解讀。${noteCorePoints.join("")}`
      : "";
  const evidenceAddon =
    noteDeskImpacts.length > 0
      ? `研究層的直接提醒是：${noteDeskImpacts.join("")}`
      : "";
  const riskAddon =
    noteReminders.length > 0 || principleHints.length > 0
      ? `研究層同步提醒：${compactSentences([...noteReminders, ...principleHints], 2).join("")}`
      : "";
  const validationAddon = compactSentences(
    [archetype?.validationFocus, ...noteDeskImpacts],
    2
  ).join("");

  return {
    frameworkView,
    noteView,
    evidenceAddon,
    riskAddon,
    validationAddon,
  };
}

function buildStrategyView(report, historyReports = [], researchFramework = null) {
  const recentReports = historyReports.length > 0 ? historyReports : [report];
  const prevReport = recentReports[1] ?? null;
  const cards = collectCards(report);
  const allCards = collectAllCards(report);
  const prevCards = prevReport ? collectCards(prevReport) : [];
  const prevAllCards = prevReport ? collectAllCards(prevReport) : [];
  const indexChange = getCardValue(cards, "加權指數漲跌");
  const indexLevel = getCardValue(cards, "加權指數");
  const pcr = getCardValue(cards, "PCR與結算比");
  const foreignSpot = getCardValue(cards, "外資現貨買賣超");
  const foreignFut = getCardValue(cards, "外資(大小台)期貨未平倉");
  const foreignFutDelta = getCardValue(cards, "外資期貨未平倉與前日增減");
  const foreignFutVsSettle = getCardValue(cards, "外資期貨未平倉與結算比");
  const bcSettle = getCardValue(cards, "外資(BC)OP未平倉金額與結算比");
  const bpSettle = getCardValue(cards, "外資(BP)OP未平倉金額與結算比");
  const foreignBuyOiLots = getCardValue(cards, "外資(買)OP未平倉口數");
  const foreignSellOiLots = getCardValue(cards, "外資(賣)OP未平倉口數");
  const foreignBuyOiAmount = getCardValue(cards, "外資(買)OP未平倉金額");
  const foreignSellOiAmount = getCardValue(cards, "外資(賣)OP未平倉金額");
  const foreignCpRatio = getCardValue(cards, "外資買權/賣權比");
  const dealerCpRatio = getCardValue(cards, "自營買方買權/賣權比");
  const foreignScBcDelta = getCardValue(allCards, "外資(SC增幅-BC增幅)金額");
  const foreignScAmount = getCardValue(allCards, "外資SC金額");
  const foreignBcAmount = getCardValue(allCards, "外資BC金額");
  const foreignBcScRatio = getCardValue(allCards, "外資BC/SC增幅比例");
  const foreignBpAmount = getCardValue(allCards, "外資BP金額");
  const foreignSpAmount = getCardValue(allCards, "外資SP金額");
  const foreignBpLots = getCardValue(allCards, "外資BP口數");
  const foreignSpLots = getCardValue(allCards, "外資SP口數");
  const foreignSpBpDelta = getCardValue(allCards, "外資(SP增幅-BP增幅)金額");
  const foreignBpSpRatio = getCardValue(allCards, "外資BP/SP增幅比例");
  const dealerBcSettle = getCardValue(cards, "自營(BC)OP未平倉金額與結算比");
  const dealerBpSettle = getCardValue(cards, "自營(BP)OP未平倉金額與結算比");
  const dealerBuyOiAmount = getCardValue(cards, "自營(買)OP未平倉金額");
  const scPressureSnapshot = buildScPressureSnapshot(recentReports);
  const optionContourSnapshot = buildOptionContourSnapshot(recentReports);
  const dealerSellOiAmount = getCardValue(cards, "自營(賣)OP未平倉金額");
  const dealerScBcDelta = getCardValue(allCards, "自營(SC增幅-BC增幅)金額");
  const dealerBpSpRatio = getCardValue(allCards, "自營BP/SP增幅比例");
  const retailNet = getCardValue(cards, "散戶未平倉");
  const retailMicroNet = getCardValue(cards, "微台散戶未平倉");
  const retailMicroRatio = getCardValue(cards, "微台散戶多空比");
  const retailLongRank = getCardValue(cards, "散戶多方位階(45日)");
  const retailShortRank = getCardValue(cards, "散戶空方位階(45日)");
  const retailLongShareRank = getCardValue(cards, "散戶多單持倉占比位階(45日)");
  const retailShortShareRank = getCardValue(cards, "散戶空單持倉占比位階(45日)");
  const retailNetRank = getCardValue(cards, "散戶淨多空位階(45日)");
  const microRatioRank = getCardValue(cards, "微台多空比位階(45日)");
  const prevRetailNet = getCardValue(prevCards, "散戶未平倉");
  const prevRetailMicroNet = getCardValue(prevCards, "微台散戶未平倉");
  const prevForeignFut = getCardValue(prevCards, "外資(大小台)期貨未平倉");
  const prevForeignBpLots = getCardValue(prevAllCards, "外資BP口數");
  const prevForeignSpLots = getCardValue(prevAllCards, "外資SP口數");
  const isSettlementResetDay = bcSettle === 0;
  const largeBcPosition =
    (bcSettle !== null && bcSettle >= 1_000_000) ||
    (foreignBcAmount !== null && foreignBcAmount >= 1_000_000);
  const dealerHot =
    (dealerBcSettle !== null && dealerBcSettle >= 1_000_000) ||
    (dealerCpRatio !== null && dealerCpRatio >= 8);
  const futuresHedgeExtreme =
    foreignFutVsSettle !== null && Math.abs(foreignFutVsSettle) >= 20_000;
  const retailLongParticipation =
    (retailNet !== null && retailNet > 0) ||
    (retailMicroNet !== null && retailMicroNet > 0) ||
    (retailMicroRatio !== null && retailMicroRatio >= 15) ||
    (retailLongRank !== null && retailLongRank >= 80) ||
    (microRatioRank !== null && microRatioRank >= 80);
  const retailCrowdedLong =
    (retailLongShareRank !== null && retailLongShareRank >= 80) ||
    (retailLongShareRank === null && retailLongRank !== null && retailLongRank >= 80);
  const retailCrowdedShort =
    (retailShortShareRank !== null && retailShortShareRank >= 80) ||
    (retailShortShareRank === null && retailShortRank !== null && retailShortRank >= 80);
  const retailSkepticalShort =
    retailShortShareRank !== null &&
    retailShortShareRank >= 70 &&
    (retailLongShareRank === null || retailLongShareRank < 80);
  const retailFomoLong =
    retailLongShareRank !== null &&
    retailLongShareRank >= 80 &&
    !retailSkepticalShort;
  // A positive retail net alone is not FOMO when the position mix is still short-heavy.
  const retailChasingLong = retailLongParticipation && !retailSkepticalShort;
  const retailLeverageCrowded = retailCrowdedLong && retailCrowdedShort;
  const optionOverheatSignal = largeBcPosition && dealerHot;
  const putDefenseSignal =
    (bpSettle !== null && bpSettle > 0) ||
    (foreignSellOiAmount !== null && foreignSellOiAmount > foreignBuyOiAmount);
  const foreignBpLotDelta =
    foreignBpLots !== null && prevForeignBpLots !== null ? foreignBpLots - prevForeignBpLots : null;
  const foreignSpLotDelta =
    foreignSpLots !== null && prevForeignSpLots !== null ? foreignSpLots - prevForeignSpLots : null;
  // SP is a down-day flow signal: both PUT sides add, but new SP lots exceed new BP lots.
  const foreignSpSignal =
    indexChange !== null &&
    indexChange < 0 &&
    foreignBpLotDelta !== null &&
    foreignSpLotDelta !== null &&
    foreignBpLotDelta > 0 &&
    foreignSpLotDelta > foreignBpLotDelta;
  const dealerShortOverheat =
    (dealerSellOiAmount !== null && dealerSellOiAmount < 0) ||
    (dealerBpSettle !== null && dealerBpSettle > 500000) ||
    (dealerBpSpRatio !== null && dealerBpSpRatio < 1);
  const retailDelta =
    retailNet !== null && prevRetailNet !== null ? retailNet - prevRetailNet : null;
  const retailMicroDelta =
    retailMicroNet !== null && prevRetailMicroNet !== null ? retailMicroNet - prevRetailMicroNet : null;
  const futuresCovering =
    prevForeignFut !== null && foreignFut !== null ? foreignFut - prevForeignFut : foreignFutDelta;
  const foreignCallPressure =
    foreignScAmount !== null && foreignBcAmount !== null ? foreignScAmount - foreignBcAmount : null;
  const foreignPutDefense =
    foreignBpAmount !== null && foreignSpAmount !== null ? foreignBpAmount - foreignSpAmount : null;
  // SC-BC is the CALL pressure change; the source's SP-BP field is the inverse of PUT defence.
  const foreignCallPressureDelta = foreignScBcDelta;
  const foreignPutDefenseDelta = foreignSpBpDelta !== null ? -foreignSpBpDelta : null;
  const sameDirectionFuturesSignal =
    indexChange !== null &&
    foreignFutDelta !== null &&
    ((indexChange > 0 && foreignFutDelta > 0) || (indexChange < 0 && foreignFutDelta < 0));
  const contrarianFuturesSignal =
    indexChange !== null &&
    foreignFutDelta !== null &&
    ((indexChange > 0 && foreignFutDelta < 0) || (indexChange < 0 && foreignFutDelta > 0));
  const priorReports = recentReports.slice(1, 5);
  const rallyReports = priorReports.filter((item) => {
    const change = getReportCardValue(item, "加權指數漲跌");
    return change !== null && change >= 500;
  });
  const priorBcAmounts = priorReports
    .map((item) => getReportCardValue(item, "外資BC金額", { detail: true }))
    .filter((value) => value !== null);
  const priorScAmounts = priorReports
    .map((item) => getReportCardValue(item, "外資SC金額", { detail: true }))
    .filter((value) => value !== null);
  const priorContrarianFuturesCount = recentReports.slice(0, 3).filter((item) => {
    const change = getReportCardValue(item, "加權指數漲跌");
    const delta = getReportCardValue(item, "外資期貨未平倉與前日增減");
    return change !== null && delta !== null && ((change > 0 && delta < 0) || (change < 0 && delta > 0));
  }).length;
  const recentBcPeak = priorBcAmounts.length > 0 ? Math.max(...priorBcAmounts) : null;
  const recentScPeak = priorScAmounts.length > 0 ? Math.max(...priorScAmounts) : null;
  const currentAndRecentReports = recentReports.slice(0, 5);
  const recentIndexLevels = currentAndRecentReports
    .map((item) => getReportCardValue(item, "加權指數"))
    .filter((value) => value !== null);
  const recentLow = recentIndexLevels.length > 0 ? Math.min(...recentIndexLevels) : null;
  const recentHigh = recentIndexLevels.length > 0 ? Math.max(...recentIndexLevels) : null;
  const recentIndexRange =
    recentLow !== null && recentHigh !== null ? recentHigh - recentLow : null;
  const recentAvgIndex = average(recentIndexLevels);
  const trendAboveMeanSignal =
    recentAvgIndex !== null && indexLevel !== null && indexLevel >= recentAvgIndex;
  const priorDownShockSignal =
    prevReport !== null &&
    getReportCardValue(prevReport, "加權指數漲跌") !== null &&
    getReportCardValue(prevReport, "加權指數漲跌") <= -1000;
  const bcStallScHoldSignal =
    foreignBcAmount !== null &&
    foreignScAmount !== null &&
    rallyReports.length >= 2 &&
    recentBcPeak !== null &&
    recentScPeak !== null &&
    foreignBcAmount <= recentBcPeak * 0.9 &&
    foreignScAmount >= recentScPeak * 0.8 &&
    foreignScAmount > foreignBcAmount;
  const boxDigestSignal =
    recentIndexRange !== null &&
    indexLevel !== null &&
    recentIndexRange / Math.max(indexLevel, 1) <= 0.055 &&
    rallyReports.length >= 1;
  const whipsawReclaimSignal =
    priorDownShockSignal &&
    indexChange !== null &&
    indexChange >= 800;
  const sentimentMismatchSignal =
    indexChange !== null &&
    foreignSpot !== null &&
    indexChange > 0 &&
    foreignSpot < 0;
  const optionCompressionSignal =
    foreignBuyOiAmount !== null &&
    foreignBuyOiAmount < 0 &&
    foreignBcAmount !== null &&
    foreignScAmount !== null &&
    foreignScAmount > foreignBcAmount;
  const continuationPrepSignal =
    (bcStallScHoldSignal || optionCompressionSignal || boxDigestSignal) &&
    trendAboveMeanSignal &&
    !retailChasingLong &&
    !putDefenseSignal;
  const consolidationRepairSignal =
    sentimentMismatchSignal &&
    indexChange !== null &&
    Math.abs(indexChange) <= 150 &&
    foreignFutDelta !== null &&
    foreignFutDelta > 0 &&
    foreignScBcDelta !== null &&
    foreignScBcDelta < 0 &&
    foreignBcScRatio !== null &&
    foreignBcScRatio > 1 &&
    !largeBcPosition;
  const panicWashoutSignal =
    retailDelta !== null && retailDelta < 0 && indexChange !== null && indexChange <= 0;
  const weakReboundOnly =
    panicWashoutSignal &&
    retailDelta !== null &&
    Math.abs(retailDelta) < 10000 &&
    !foreignSpSignal &&
    futuresCovering !== null &&
    futuresCovering > 0;
  const strongerBottomSignal =
    panicWashoutSignal &&
    foreignSpSignal &&
    futuresCovering !== null &&
    futuresCovering > 0;
  const consolidationBiasSignal =
    bcStallScHoldSignal || sameDirectionFuturesSignal;
  const lateStageConsolidationSignal =
    consolidationBiasSignal &&
    optionCompressionSignal &&
    !strongerBottomSignal;

  let score = 0;
  if (indexChange !== null) score += indexChange > 0 ? 1 : -1;
  if (foreignSpot !== null) score += foreignSpot > 0 ? 1 : -1;
  if (foreignFutDelta !== null) score += foreignFutDelta > 0 ? 1 : -1;
  if (foreignFutVsSettle !== null) score += foreignFutVsSettle > 0 ? 1 : -1;
  if (foreignCpRatio !== null) score += foreignCpRatio > 1 ? 1 : -1;
  if (dealerCpRatio !== null) score += dealerCpRatio > 1 ? 1 : -1;
  if (largeBcPosition) score += 1;
  if (panicWashoutSignal) score += 1;
  if (dealerShortOverheat) score += 1;
  if (foreignSpSignal) score += 1;
  if (continuationPrepSignal) score += 1;
  if (whipsawReclaimSignal) score += 1;

  const longSignal =
    largeBcPosition &&
    foreignScBcDelta !== null &&
    foreignScBcDelta <= -300000;
  const contrarianBullSignal =
    longSignal &&
    indexChange !== null &&
    indexChange < 0 &&
    foreignSpot !== null &&
    foreignSpot < 0;

  if (longSignal) score += 3;

  let tone = "neutral";
  let toneLabel = "中性";
  if (contrarianBullSignal) {
    tone = "risk";
    toneLabel = "積極偏多";
  } else if (longSignal || score >= 3) {
    tone = "bull";
    toneLabel = "偏多";
  } else if (score <= -3) {
    tone = "bear";
    toneLabel = "偏空";
  } else if (bcSettle !== null && bcSettle >= 1_000_000) {
    tone = "risk";
    toneLabel = "槓桿警示";
  }

  // A consolidation signal keeps a weak day from being labeled as a confirmed trend reversal.
  if (lateStageConsolidationSignal && tone === "bear") {
    toneLabel = "整理偏空";
  }

  let lensKey = "balanced";
  let lensLabel = "平衡確認型";
  if (contrarianBullSignal) {
    lensKey = "divergence";
    lensLabel = "背離布局型";
  } else if (strongerBottomSignal) {
    lensKey = "bottoming";
    lensLabel = "跌深低點型";
  } else if (panicWashoutSignal) {
    lensKey = "washout";
    lensLabel = "恐慌釋放型";
  } else if (consolidationRepairSignal) {
    lensKey = "repair";
    lensLabel = "修復觀察型";
  } else if (whipsawReclaimSignal) {
    lensKey = "repair";
    lensLabel = "修復觀察型";
  } else if (continuationPrepSignal) {
    lensKey = "accumulation";
    lensLabel = "整理吸納型";
  } else if (optionOverheatSignal && futuresHedgeExtreme) {
    lensKey = "overheat";
    lensLabel = "過熱降檔型";
  } else if (bcStallScHoldSignal || sameDirectionFuturesSignal) {
    lensKey = "accumulation";
    lensLabel = "整理吸納型";
  }

  const indexPhrase =
    indexChange === null
      ? "指數方向待補"
      : `指數${indexChange > 0 ? "收高" : "收低"}${getCardRender(cards, "加權指數漲跌")}`;
  const spotPhrase =
    foreignSpot === null
      ? "現貨籌碼待補"
      : `外資現貨${foreignSpot > 0 ? "回補" : "調節"}${getCardRender(cards, "外資現貨買賣超")}`;
  const futPhrase =
    foreignFut === null || foreignFutDelta === null
      ? "期貨留倉待補"
      : `大小台留倉來到 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，日變動 ${getCardRender(cards, "外資期貨未平倉與前日增減")}`;
  const optionPhrase =
    foreignCpRatio === null || dealerCpRatio === null
      ? "選擇權比值待補"
      : `外資淨買權/賣權比 ${getCardRender(cards, "外資買權/賣權比")}，自營買方比 ${getCardRender(cards, "自營買方買權/賣權比")}`;
  const leveragePhrase =
    foreignBcAmount === null
      ? "買權槓桿待補"
      : isSettlementResetDay
        ? `今日為結算日，BC 結算比歸零屬正常重置；改以外資 BC 原始金額 ${renderValue(foreignBcAmount, "#,##0")} 判斷槓桿部位。`
        : largeBcPosition
          ? `外資 BC 部位偏大；${bcSettle !== null ? `BC 結算比 ${getCardRender(cards, "外資(BC)OP未平倉金額與結算比")}，` : ""}BC 原始金額 ${renderValue(foreignBcAmount, "#,##0")} 顯示槓桿仍高。`
          : `外資 BC 原始金額 ${renderValue(foreignBcAmount, "#,##0")}，槓桿尚未失控。`;
  const expertLongPhrase = longSignal
    ? `外資 BC 原始金額 ${renderValue(foreignBcAmount, "#,##0")} 仍屬偏大的買權槓桿部位，同時 SC 金額縮到 ${renderValue(foreignScAmount, "#,##0")}，且 SC 相對 BC 的減碼差達 ${renderValue(foreignScBcDelta, "#,##0")}；這組合視為偏多做多訊號。`
    : "";
  const contrarianPhrase = contrarianBullSignal
    ? "當天指數收跌、外資現貨也同步賣超，但選擇權槓桿端反而維持大買權部位且 SC 顯著下降，屬於逆勢布局訊號，應提高對多方企圖的權重。"
    : "";
  const tapeView =
    indexLevel === null
      ? `${indexPhrase}，盤面主軸仍需搭配現貨與衍生性商品確認。`
      : panicWashoutSignal
        ? `${indexPhrase}，指數收在 ${renderValue(indexLevel, "#,##0.00")}；若急跌後散戶多單反而下降，通常代表市場恐慌正在釋放，這種結構更接近短線相對低點的形成，而不是單純跌勢延伸。${pcr !== null ? `PCR 目前為 ${getCardRender(cards, "PCR與結算比")}。` : ""}`
      : indexChange !== null && foreignSpot !== null && indexChange > 0 && foreignSpot > 0
        ? `${indexPhrase}，指數收在 ${renderValue(indexLevel, "#,##0.00")}；現貨與價格同向偏強，代表盤面不只是被權值硬拉，資金面也有跟進。${pcr !== null ? `PCR 來到 ${getCardRender(cards, "PCR與結算比")}，市場情緒仍偏樂觀。` : ""}`
        : indexChange !== null && foreignSpot !== null && indexChange < 0 && foreignSpot < 0
          ? `${indexPhrase}，指數收在 ${renderValue(indexLevel, "#,##0.00")}；現貨與價格同步走弱，盤面表象偏空，但是否轉成趨勢性回落，仍要看期貨與選擇權有沒有出現一致的防禦配置。${pcr !== null ? `PCR 為 ${getCardRender(cards, "PCR與結算比")}，可作為情緒強弱的輔助對照。` : ""}`
          : `${indexPhrase}，指數收在 ${renderValue(indexLevel, "#,##0.00")}；價格與現貨流向出現背離，代表日內方向不宜只看收盤漲跌，仍需把衍生性商品部位一起放進來讀。${pcr !== null ? `PCR 目前為 ${getCardRender(cards, "PCR與結算比")}。` : ""}`;
  const futuresView =
    foreignFut === null || foreignFutDelta === null || foreignFutVsSettle === null
      ? `${futPhrase}。`
      : sameDirectionFuturesSignal
        ? `期貨端目前 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，與前日相比 ${getCardRender(cards, "外資期貨未平倉與前日增減")}；若這個增減方向與指數漲跌同步，依最新納入的研究框架，較應優先解讀為整理格局延續，而不是單靠收盤方向就判斷趨勢重新發動。`
        : contrarianFuturesSignal || priorContrarianFuturesCount >= 2
          ? `期貨端目前 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，與前日相比 ${getCardRender(cards, "外資期貨未平倉與前日增減")}；若外資期貨在下跌時逆勢增加，且這種逆勢補倉能連續延伸數日，通常代表整理段的短線低點正在靠近，後續再搭配外資 SP 訊號會更有參考價值。`
      : strongerBottomSignal
        ? `期貨端目前 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，與前日相比出現 ${getCardRender(cards, "外資期貨未平倉與前日增減")} 的逆勢回補；若搭配散戶多單下降與外資 SP 訊號同步出現，較接近跌深後的籌碼回穩，而不是單純空單洗價。`
        : weakReboundOnly
          ? `期貨端雖有 ${getCardRender(cards, "外資期貨未平倉與前日增減")} 的逆勢回補，但時間仍偏短，且與結算比仍在 ${getCardRender(cards, "外資期貨未平倉與結算比")}；這種結構較像先反彈、後整理，而不是直接 V 轉翻多。`
      : futuresHedgeExtreme
        ? `期貨端目前來到 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，日變動 ${getCardRender(cards, "外資期貨未平倉與前日增減")}、與結算比 ${getCardRender(cards, "外資期貨未平倉與結算比")}；這已屬明顯偏極端區，較像外資在強勢波段中用期貨做動態避險，後續觀察重點不是空單多寡本身，而是拉回時這些空單會不會開始回補。`
        : foreignFutDelta > 0
          ? `期貨端留倉為 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，較前日增加 ${getCardRender(cards, "外資期貨未平倉與前日增減")}；空單續增雖會壓抑情緒，但若選擇權端沒有同步轉空，仍應優先解讀為避險增量。`
          : `期貨端留倉為 ${getCardRender(cards, "外資(大小台)期貨未平倉")}，日變動 ${getCardRender(cards, "外資期貨未平倉與前日增減")}；若空單不再擴大甚至開始收斂，代表外資對下檔防禦的需求沒有再升級。`;
  const optionsView = bcStallScHoldSignal
    ? `結算後的外資選擇權結構，較接近「BC 沒有跟著強漲有效擴張、SC 卻仍維持高水位」的壓縮型態。這種組合不宜直接解讀為全面翻空，反而更像多頭中的高檔整理或中期整理：上檔空間未必結束，但新一輪推升的速度通常會先放慢。`
    : largeBcPosition
    ? `外資選擇權核心仍在買權槓桿。${isSettlementResetDay ? `結算日使 BC 結算比歸零，但 BC 原始金額仍有 ${renderValue(foreignBcAmount, "#,##0")}，代表部位只是重置、不是退場。` : `BC 結算比 ${getCardRender(cards, "外資(BC)OP未平倉金額與結算比")}，原始 BC 金額 ${renderValue(foreignBcAmount, "#,##0")}；搭配買方比 ${getCardRender(cards, "外資買方買權/賣權比")} 與淨買權/賣權比 ${getCardRender(cards, "外資買權/賣權比")}，外資仍把槓桿押在上檔。`} ${foreignScBcDelta !== null && foreignScBcDelta < 0 ? `SC 減碼差 ${renderValue(foreignScBcDelta, "#,##0")} 顯示賣方買權同步縮手。` : ""} ${foreignBcScRatio !== null ? `BC/SC 增幅比例 ${renderValue(foreignBcScRatio, "0.00%")} 可視為買權主導度的延伸指標。` : ""}`
    : foreignSpSignal
      ? `外資 PUT 端在下跌日出現 SP 承接：BP 新增 ${formatSignedNumber(foreignBpLotDelta)} 口、SP 新增 ${formatSignedNumber(foreignSpLotDelta)} 口，且 SP 增量較大。這代表保護性部位開始轉為承接；若再與散戶多單下降、外資期貨逆勢回補同步，才提高相對低點權重。`
    : putDefenseSignal
      ? `外資買權槓桿沒有再明顯升溫，反而要留意賣權端的防禦配置。BP/SP 金額與增幅顯示保護性部位仍在，較像上方空間保留、下方風險同時控管的結構。`
      : `外資選擇權沒有單邊失衡，買方比 ${getCardRender(cards, "外資買方買權/賣權比")}、淨買權/賣權比 ${getCardRender(cards, "外資買權/賣權比")}，目前偏向保留彈性，而不是直接押單邊行情。`;
  const historyContextView = whipsawReclaimSignal
    ? `以急跌回箱框架來看，這種「前一日急跌、隔日長紅回收」更像跌破後的急洗與回箱，而不是光靠一根大漲就能確認新主升。重點要看的是後面幾天能否站回恐慌日上緣，並讓外資期貨空單停止持續擴張；若只修復價格、不修復期權結構，通常仍屬震盪盤中的反抽。`
    : consolidationRepairSignal
      ? `以整理期框架來看，今天更像箱體內的修復段，而不是趨勢重新發動。盤面重點不在指數僅小幅收紅，而在外資 SC 水位明顯下滑、BC/SC 結構同步改善，代表上方壓力已有鬆動；但現貨賣超與期貨偏空底色仍在，因此現階段較適合定義成「整理中的正向修復」，而非突破確認。`
    : lateStageConsolidationSignal
      ? `以最新納入的整理研究框架來看，這一型更接近「SC 單獨過熱後的中期整理中後段」，而不是單純偏空。也就是說，當 BC 不再擴張、買方選擇權淨額轉弱、期貨增減又與指數同向時，籌碼表面雖然變差，但更合理的解讀是整理已走到壓縮區，市場仍在等最後一次更乾淨的低點確認。`
    : continuationPrepSignal
      ? `以高檔整理消化框架來看，現在更接近趨勢多頭裡的橫盤消化，而不是結構性翻空。歷史上類似 2020 下半年到 2021 初、以及 2021 上半年區間整理的案例，常見特徵都是價格先走時間整理，外資買權不再追價擴張、SC 留在高檔控節奏，等乖離消化後才再找下一段續攻。`
      : boxDigestSignal
        ? `以高檔箱體消化的視角來看，整理不能只看指數漲跌，而要看它是在趨勢上方做時間換空間，還是在跌勢裡被動反彈。若價格仍維持在近期均值之上、外資選擇權沒有全面轉成防禦部位，這種箱體更應先視為多頭中的節奏調整。`
      : `以等待式布局框架來看，重點不是立刻猜方向，而是先把回測幅度、資金配置與加碼條件寫在前面，再觀察盤勢是否照劇本推進。所以 Desk View 不能只用單日強弱判斷方向，而要先把盤勢放進「主升段後整理、急跌後回箱、或高檔過熱延伸」這幾種結構，再看價格與籌碼有沒有同步驗證。`;
  const optionContourView =
    foreignCallPressure === null || foreignPutDefense === null
      ? "CALL / PUT 輪廓資料待補。"
      : `外資選擇權輪廓：CALL 端淨 SC 壓力 ${renderValue(foreignCallPressure, "#,##0")}，${foreignCallPressureDelta === null ? "日增減待補" : `較前日${foreignCallPressureDelta >= 0 ? "增加" : "收斂"} ${renderValue(Math.abs(foreignCallPressureDelta), "#,##0")}`}；PUT 端防守 ${renderValue(foreignPutDefense, "#,##0")}，${foreignPutDefenseDelta === null ? "日增減待補" : `較前日${foreignPutDefenseDelta >= 0 ? "升高" : "減弱"} ${renderValue(Math.abs(foreignPutDefenseDelta), "#,##0")}`}。${indexChange !== null && foreignCallPressureDelta !== null && indexChange > 0 && foreignCallPressureDelta > 0 ? "CALL 壓力與上漲同步擴張，先視為上檔對手盤與整理監測；若後續指數鈍化卻仍續增，才是需要降級的壓力。" : foreignCallPressureDelta !== null && foreignCallPressureDelta < 0 ? "CALL 壓力收斂，有利於降低上檔壓力，但仍需確認不是單日回補。" : "存量與加減碼需同步追蹤，不能只用一側部位直接定義趨勢。"}`;
  const scQualityView =
    !scPressureSnapshot
      ? "SC 壓力品質的歷史比較樣本不足，暫不以速度判斷。"
      : !scPressureSnapshot.isUpDay
        ? `今日為下跌日，依研究規則不將 SC 速度或嚴格 SC 壓力硬套進上漲日百分位；SC 金額 ${formatSignedPercent(scPressureSnapshot.scAmountRate)}、BC 金額 ${formatSignedPercent(scPressureSnapshot.bcAmountRate)}，應改以 CALL 壓力是否收斂與 PUT 防守是否升級判讀。`
        : `今日為上漲日，SC 口數日增 ${formatSignedPercent(scPressureSnapshot.scQtyRate)}，速度位階 ${scPressureSnapshot.speedRank === null ? "樣本不足" : `${renderValue(scPressureSnapshot.speedRank, "0.0")}%`}；嚴格 SC 壓力位階 ${scPressureSnapshot.strictRank === null ? "樣本不足" : `${renderValue(scPressureSnapshot.strictRank, "0.0")}%`}。${optionContourSnapshot?.callRank !== null && optionContourSnapshot?.callRank !== undefined ? `CALL 壓力存量位階 ${renderValue(optionContourSnapshot.callRank, "0.0")}%` : "CALL 壓力存量位階樣本不足"}；只有速度與壓力同時逼近極端、且 BC 由低檔加速時，才提高過熱降檔權重。`;
  const dealerRetailView = dealerShortOverheat
    ? `自營端賣方部位偏熱，自營(賣)OP 未平倉金額 ${renderValue(dealerSellOiAmount, "#,##0")}、BP/SP 增幅比例 ${dealerBpSpRatio !== null ? renderValue(dealerBpSpRatio, "0.00%") : "待補"}；若同時散戶多單下降，這通常支持先有反彈，但若外資 SP 與期貨回補延續不足，仍要把後續整理視為主情境。`
    : dealerHot
      ? `自營端買方比 ${getCardRender(cards, "自營買方買權/賣權比")}，BC 結算比 ${getCardRender(cards, "自營(BC)OP未平倉金額與結算比")}；券商端也把買權槓桿推高，若再搭配自營 SC/BC 減碼差 ${dealerScBcDelta !== null ? renderValue(dealerScBcDelta, "#,##0") : "待補"}，就容易走成短線過熱。`
    : dealerBuyOiAmount !== null && dealerSellOiAmount !== null
      ? `自營端買方金額 ${renderValue(dealerBuyOiAmount, "#,##0")}、賣方金額 ${renderValue(dealerSellOiAmount, "#,##0")}，買方比 ${getCardRender(cards, "自營買方買權/賣權比")}；目前更像中性偏多的配平，而非過度擴張槓桿。`
      : `自營端買權熱度目前尚未全面失控，可視為次要確認訊號；若後續與外資買權槓桿共振，才需要把短線過熱權重進一步拉高。`;
  const retailPositionView = retailLeverageCrowded
    ? `散戶位階顯示多方 ${renderValue(retailLongRank, "0.0")}%、空方 ${renderValue(retailShortRank, "0.0")}%，屬雙向槓桿偏高；優先防範波動放大，不可把單一位階當成方向訊號。`
    : retailFomoLong
      ? `散戶多單持倉占比位階 ${renderValue(retailLongShareRank, "0.0")}%、等值多單位階 ${renderValue(retailLongRank, "0.0")}%，多方部位偏擁擠；這是追價與回測風險提醒，不單獨構成偏空結論。`
      : retailSkepticalShort
        ? `散戶空單持倉占比位階 ${renderValue(retailShortShareRank, "0.0")}% 偏高、但多單占比未擁擠，屬市場仍有懷疑的高空單結構；價格未轉弱前可保留軋空延續的可能，但不構成追價理由。`
        : retailCrowdedShort
          ? `散戶等值空單位階 ${renderValue(retailShortRank, "0.0")}% 偏高；價格一旦止穩應留意軋空彈性，但不單獨構成偏多結論。`
        : retailNetRank !== null
          ? `散戶 45 日位階未見極端擁擠（淨多空位階 ${renderValue(retailNetRank, "0.0")}%）；結構是否延續仍以外資期貨與選擇權為主。`
          : "散戶位階樣本尚在累積，暫不以此作為方向判斷。";
  const retailView = panicWashoutSignal
    ? `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}，較前日 ${retailDelta !== null ? renderValue(retailDelta, "#,##0") : "待補"}；在大跌背景下反而減少多單，代表恐慌型部位開始鬆動，較容易形成短線相對低點。若這類盤屬於波動更大、時間更長的整理段，研究上更重視「抄底後願意先縮手」這個訊號，而不是只看散戶多單是否衝到歷史高峰。${retailMicroDelta !== null ? `微台未平倉變動 ${renderValue(retailMicroDelta, "#,##0")} 也可同步觀察情緒是否退潮。` : ""} ${retailPositionView}`
    : retailChasingLong
      ? `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}、微台未平倉 ${retailMicroNet !== null ? renderValue(retailMicroNet, "#,##0") : "待補"}，微台多空比 ${retailMicroRatio !== null ? `${renderValue(Number(retailMicroRatio.toFixed(2)))}%` : "待補"}；情緒面已有追多痕跡，依歷史經驗較常出現在行情末段或回測前夕。${retailPositionView}`
      : `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}、微台未平倉 ${retailMicroNet !== null ? renderValue(retailMicroNet, "#,##0") : "待補"}；目前還沒看到全面追價失控，這讓行情若要延續，結構上仍比較健康。${retailPositionView}`;
  const overheatView = optionOverheatSignal
    ? `若再把外資與自營買權槓桿一起看，現在已接近文章所說的「雙紫爆」輪廓；這通常不是單純看多確認，而是提醒短線漲勢可能已進入驚驚漲末段，後續較容易轉為 5% 上下甚至更大的回測整理。`
    : futuresHedgeExtreme
      ? `目前外資期貨與結算比已來到相對極端區，雖然還不能直接視為反轉，但代表風險管理權重應提高，後續要盯的是拉回時外資期貨是否由空翻多。`
      : "";
  const validationView = whipsawReclaimSignal
    ? `接下來的驗證重點不是今天這根長紅本身，而是三件事：第一，外資期貨與前日增減是否不再續空；第二，外資 BC/SC 增幅比例能否持續改善，而不是只剩價格修復；第三，散戶與微台是否重新快速追價。若三者沒有同步轉熱，較適合把它解讀為跌深回箱後的震盪修復。`
    : consolidationRepairSignal
      ? `後續 1-3 天的驗證焦點，不是指數還能再彈多少，而是籌碼修復能否延續。第一，看外資 SC 是否續降而非快速回補；第二，看外資期貨未平倉與前日增減能否持續改善，確認避險需求沒有再升級；第三，看現貨賣超是否同步收斂。若價格反彈而這三項沒有跟上，就仍應把本段視為整理箱中的修復，而不是新攻擊波。`
    : continuationPrepSignal
      ? `接下來要驗證的不是「會不會立刻噴出」，而是整理能否乾淨完成：外資 BC 不失速、自營空方熱度別再升高、散戶不要重新衝高追多。更實務地說，這裡應先把自己的回測容忍區間與分批條件設好，等待市場把價格與籌碼一起送進預期範圍，而不是在反彈日臨時改劇本去追價。若這幾項都維持克制，這種高檔盤整反而比較像為下一段趨勢做準備。`
    : lateStageConsolidationSignal
      ? `接下來的驗證重點要回到三件事：第一，外資 SP 訊號是否真正出現；第二，外資期貨是否在下跌或震盪時逆勢增加多單，且不是只出現一天；第三，散戶抄底部位是否開始降溫。若這三項沒有共振，就先把今天視為整理中後段的壓力測試，而不是低點確認。`
      : strongerBottomSignal
        ? `後續驗證點會放在外資期貨回補能否延續、外資 SP 訊號是否保留，以及散戶縮手是否不是只有一天。只有這三者同時延續，短線低點的可信度才會提高。`
        : `後續驗證點仍放在外資期貨日增減、BC/SC 與 BP/SP 增幅結構、以及散戶多單是否重新追價。也就是說，之後的 Desk View 會更像追蹤「結構有沒有升級」，而不是只重複形容單日漲跌；等待本身也會被寫成一種有條件的操作，而不是空泛觀望。`;
  const conclusionView = strongerBottomSignal
    ? `綜合來看，若跌幅已深、散戶多單明顯縮手、外資期貨開始回補且外資賣方訊號同步出現，較可把盤勢視為短線相對低點區，操作上可提高反彈延續的權重，但仍需用後續籌碼確認是否能從反彈升級為真正轉折。`
    : weakReboundOnly
      ? `綜合來看，這組籌碼較像先反彈、後整理：散戶恐慌有釋放，自營空單也提供短線支撐，但外資 SP 訊號與期貨逆增的延續仍不足，因此不宜太快把反彈直接上綱成 V 轉。`
    : consolidationRepairSignal
      ? `綜合判讀，今天屬於整理盤中的偏多修復，但等級仍停留在「修復確認」，還不是「趨勢確認」。SC 下滑與 BC/SC 改善，說明壓力端已有退讓；然而外資現貨尚未回補、期貨主部位仍偏空、買權淨額也未轉成積極攻擊，因此 Desk View 維持「中性偏多、先回箱再觀察」。實務上可把它視為整理盤裡較有利的喘息區，而非適合直接追價的突破點。`
    : whipsawReclaimSignal && sentimentMismatchSignal
      ? `綜合來看，像 6/30 這種大漲並不屬於最乾淨的多頭再加速，因為現貨沒有同步大幅回補、外資期貨空單也仍在增加。更合理的解讀是急跌後的價格修復已出現，但籌碼端還在重整，所以 Desk View 會把它放在「中性偏多、先回箱再觀察能否續攻」的位置，而不是直接視為新主升確立。`
    : consolidationBiasSignal && !longSignal
      ? `綜合來看，目前更像整理吸納型下的中期整理延續，而不是結構性轉空。尤其當 BC 沒有再擴張、SC 維持高水位、買方選擇權淨額轉弱，且外資期貨增減又與指數同步時，較應把它視為整理中後段的壓力測試。這種盤的重點不是急著猜最低點，而是接受籌碼會先變難看，並等待 SP 與外資期貨逆勢回補是否補上；在那之前，低接可分批，急彈不追價。`
    : contrarianBullSignal
    ? `綜合來看，這不是單純因指數走弱就要看空的盤，而是表面偏弱、內部槓桿卻逆勢偏多的結構，較接近逆勢布局型態，因此 Desk View 會上修為積極偏多；操作上可偏向順多思考，但仍要提防高槓桿帶來的短線震盪。`
    : optionOverheatSignal && futuresHedgeExtreme
      ? `綜合來看，結構上多頭尚未被破壞，但期貨避險幅度、外資買權槓桿與自營熱度同時推到高檔，較像強趨勢末段的過熱延伸。Desk View 會保留多方主軸，但實務上更重視部位調整與風險回收，不建議把超漲段當成新的安全追價區。`
    : longSignal
      ? `綜合來看，外資在買權端仍保留明顯企圖，期貨空單較應解讀為避險節奏而非全面翻空，因此 Desk View 維持偏多；實務上較適合等拉回承接，而不是在情緒最熱時追價。`
      : tone === "bear"
        ? `綜合來看，當前籌碼尚未形成明顯逆勢多方共振，若現貨、期貨與選擇權同步轉弱，Desk View 會先以偏空或保守中性處理；操作上應優先看節奏與風險，而非單靠單一數值下注。`
        : `綜合來看，目前更像多空交錯、需要持續追蹤結算後籌碼延續性的階段，Desk View 先以 ${toneLabel} 定位；後續若外資 BC 槓桿、自營買權熱度與散戶追價同時升溫，則要同步評估超漲後的回測風險。`;

  const researchOverlay = buildResearchOverlay(researchFramework, {
    lensKey,
    optionOverheatSignal,
    contrarianBullSignal,
    strongerBottomSignal,
    panicWashoutSignal,
    isSettlementResetDay,
    bcStallScHoldSignal,
    whipsawReclaimSignal,
  });

  const thesisView =
    lensKey === "divergence"
      ? `今天的主命題不是順著表面強弱追價，而是辨認「表面偏弱、內部槓桿卻逆勢偏多」的背離布局。這種盤的核心不在當日紅黑 K，而在資金是否提前卡位未來修復。`
      : lensKey === "bottoming"
        ? `今天的主命題是檢查短線相對低點是否正在形成，而不是急著把所有反彈都升格成 V 轉。重點在跌幅、籌碼與情緒是否一起走到低點區。`
        : lensKey === "washout"
          ? `今天的主命題是恐慌是否正在被釋放。這類盤不能只看跌幅，而要看散戶是否縮手、外資是否不再擴大防禦，因為低點往往先出現在情緒退潮，而不是新聞轉好之後。`
          : lensKey === "repair"
            ? `今天的主命題是修復觀察。價格雖然快速回收，但現在更重要的是判斷它屬於跌深後回箱，還是真的足以開啟新一輪趨勢。`
            : lensKey === "accumulation"
              ? lateStageConsolidationSignal
                ? `今天的主命題是整理吸納，但位置更偏中期整理的中後段壓縮，不是直接預測今天就是最低點。真正要處理的是：籌碼雖然轉差，但這種轉差究竟是趨勢毀損，還是整理尾聲前的壓力測試。`
                : `今天的主命題是整理吸納，不是預測哪一天直接噴出。真正要處理的是，當中期架構仍偏多時，如何把等待寫成有條件的布局，而不是空泛觀望。`
              : lensKey === "overheat"
                ? `今天的主命題是過熱降檔。方向未必立刻翻空，但籌碼與情緒若都推到高檔，操作重點就會從追價切換成風險回收與節奏控管。`
                  : `今天的主命題是平衡確認。眼前不是沒有訊號，而是訊號尚未集中到足以讓你押單邊，因此更需要把焦點放在結構是否升級，而不是替單日漲跌找理由。`;

  const evidenceView = buildDeskViewBody(
    lensKey === "divergence"
      ? [tapeView, optionsView, optionContourView, futuresView, contrarianPhrase || expertLongPhrase]
      : lensKey === "bottoming"
        ? [retailView, futuresView, optionsView, optionContourView]
        : lensKey === "washout"
          ? [tapeView, retailView, dealerRetailView]
          : lensKey === "repair"
            ? [historyContextView, futuresView, optionsView, optionContourView]
            : lensKey === "accumulation"
              ? [historyContextView, optionsView, optionContourView, scQualityView, retailView]
              : lensKey === "overheat"
                ? [optionsView, optionContourView, overheatView, retailView, dealerRetailView]
                  : [tapeView, futuresView, dealerRetailView, optionsView, optionContourView]
  );

  const riskView =
    lensKey === "divergence"
      ? `這一型最怕的是背離只維持一天。若外資 SC 很快回升、BC 槓桿失速，且期貨空單繼續同步擴大、散戶又開始追價，原本的逆勢布局就會被降級成單日異常。`
      : lensKey === "bottoming"
        ? `這一型最怕把反彈誤認成轉折。若外資期貨回補沒有延續、外資 SP 訊號很快消失，或散戶縮手只出現一天，那就更像先彈再整理，而不是低點確立。`
        : lensKey === "washout"
          ? `這一型最怕情緒雖退、結構卻沒穩。若現貨持續流出、外資防禦部位再升級，而跌幅又還沒走到預估區間，單靠散戶縮手還不足以支撐真正的低點判讀。`
          : lensKey === "repair"
          ? `這一型最怕只有價格修復、沒有籌碼修復。若後續站不回恐慌日上緣，或 BC/SC 結構沒有改善，這根長紅就更可能只是震盪盤中的回抽。`
            : lensKey === "accumulation"
              ? lateStageConsolidationSignal
                ? `這一型最怕的是把短線跌深或反彈，過早當成低點確認。若後續仍看不到外資 SP 訊號、外資期貨也沒有逆勢增多並延續，且散戶抄底熱度不降，那就代表整理尚未完成，原本的吸納判讀也不能升級成跌深低點型。`
                : `這一型最怕整理拖太久後轉成分配。若 BC 續弱、SC 續強，自營與散戶又重新升高追價熱度，那原本的整理吸納就可能轉成高檔震盪甚至出貨。`
              : lensKey === "overheat"
                ? `這一型最怕還用趨勢思維放大槓桿。當外資買權、自營熱度與散戶追價都在高檔時，即便中期方向未壞，短線也很容易用回測把過熱清掉。`
                  : `這一型最怕過早選邊。只要現貨、期貨、選擇權其中兩項開始出現同向共振，原本的平衡格局就會快速失效，屆時判讀要立即切到更明確的主命題。`;

  const executionView =
    lensKey === "divergence"
      ? `部位節奏上，比較適合把等待變成試單與承接條件：可以接受小量順多，但不在情緒回暖的第一根長紅追價；真正加碼要等背離訊號延續，而不是只賭今天特殊。`
      : lensKey === "bottoming"
        ? `部位節奏上，這是可以考慮分批布局的區域，但前提是用確認換倉位，而不是一次押滿。若後續 1-3 天籌碼延續改善，再把反彈看成更高級別的轉折。`
        : lensKey === "washout"
          ? `部位節奏上，先等價格與籌碼一起走進預設劇本，不急著猜最低點。若跌幅、外資防禦收斂與散戶縮手同步到位，承接與加碼才有勝率優勢。`
          : lensKey === "repair"
          ? `部位節奏上，先把它當修復而不是新主升。可以把基本倉位慢慢拿回，但不把單日修復直接上綱成全面進攻；追價在這一型裡通常最吃虧。`
            : lensKey === "accumulation"
              ? lateStageConsolidationSignal
                ? `部位節奏上，這一型更適合保留可承受的核心倉與分批承接空間，而不是因為籌碼難看就全退，也不是看到單日強彈就回頭追價。等待在這裡不是空白，而是明確保留資金，等 SP 與外資期貨逆勢回補這種更高勝率的落底條件出現。`
                : `部位節奏上，重點是先把回測容忍區間與分批條件寫好，再等待市場把價格與籌碼一起送進來。也就是說，等待本身就是操作的一部分，而不是沒有觀點。`
              : lensKey === "overheat"
                ? `部位節奏上，這裡更偏向降槓桿、收回追價衝動、保留好部位等下一次拉回，而不是把高勝率的主升段思維硬套在過熱尾端。`
                  : `部位節奏上，先保留彈性比急著下注更重要。當前更適合把倉位建立在條件觸發後，而不是建立在直覺或單一數值上。`;

  const body = buildDeskViewBody([
    thesisView,
    researchOverlay?.frameworkView,
    historyContextView,
    researchOverlay?.noteView,
    evidenceView,
    researchOverlay?.evidenceAddon,
    riskView,
    researchOverlay?.riskAddon,
    executionView,
    conclusionView,
    validationView,
    researchOverlay?.validationAddon,
  ]);
  const blocks = [
    {
      label: "主命題",
      text: buildDeskViewBody([thesisView, researchOverlay?.frameworkView]),
    },
    {
      label: "歷史定位",
      text: buildDeskViewBody([historyContextView, researchOverlay?.noteView]),
    },
    {
      label: "支持證據",
      text: buildDeskViewBody([evidenceView, researchOverlay?.evidenceAddon]),
    },
    {
      label: "反證風險",
      text: buildDeskViewBody([riskView, researchOverlay?.riskAddon]),
    },
    {
      label: "部位節奏",
      text: buildDeskViewBody([executionView, conclusionView]),
    },
    {
      label: "驗證重點",
      text: buildDeskViewBody([validationView, researchOverlay?.validationAddon]),
    },
  ];
  return {
    tone,
    toneLabel,
    body,
    blocks,
    flag:
      lensKey === "divergence"
        ? "背離布局"
        : lensKey === "bottoming"
          ? "低點測試"
          : lensKey === "washout"
            ? "恐慌釋放"
            : lensKey === "repair"
              ? "修復觀察"
              : lensKey === "accumulation"
                ? "整理吸納"
                : lensKey === "overheat"
                  ? "過熱降檔"
                    : "",
  };
}

function renderStrategy(report, historyReports = []) {
  const calculatedStrategy = buildStrategyView(report, historyReports, state.researchFramework);
  const dateOverride = state.deskViewOverrides?.[report.date];
  // Keep the full calculated framework and replace only the verified date-specific blocks.
  const strategy = dateOverride
    ? {
        ...calculatedStrategy,
        ...dateOverride,
        blocks: mergeStrategyBlocks(calculatedStrategy.blocks, dateOverride.blocks),
      }
    : calculatedStrategy;
  els.strategyPanel.hidden = false;
  els.strategyPanel.classList.remove("tone-bull", "tone-bear", "tone-risk", "tone-neutral");
  els.strategyPanel.classList.add(`tone-${strategy.tone}`);
  if (strategy.flag) {
    els.strategyFlag.hidden = false;
    els.strategyFlag.textContent = strategy.flag;
  } else {
    els.strategyFlag.hidden = true;
    els.strategyFlag.textContent = "";
  }
  els.strategyTone.textContent = strategy.toneLabel;
  els.strategyTone.className = `strategy-tone tone-${strategy.tone}`;
  const blocks = strategy.blocks ?? [{ label: "Desk View", text: strategy.body }];
  const blockByLabel = new Map(blocks.map((block) => [block.label, block]));
  const decisionItems = [
    {
      label: "主命題",
      value: strategy.flag || firstSentence(blockByLabel.get("主命題")?.text, "盤勢結構判讀"),
      note: strategy.flag ? firstSentence(blockByLabel.get("主命題")?.text) : "以今日籌碼結構定位",
      tone: strategy.tone,
    },
    {
      label: "方向結論",
      value: strategy.toneLabel,
      note: "訊號不是單日預測，需搭配下方條件驗證。",
      tone: strategy.tone,
    },
    {
      label: "部位節奏",
      value: firstSentence(blockByLabel.get("部位節奏")?.text, "依結構分段處理"),
      note: "先設定條件，再決定加碼或降檔。",
      tone: "neutral",
    },
    {
      label: "失效條件",
      value: firstSentence(blockByLabel.get("反證風險")?.text, "持續追蹤反證風險"),
      note: "若失效，應優先收斂風險，不以單一數值硬拗。",
      tone: "risk",
    },
  ];
  els.strategyDecision.replaceChildren();
  for (const item of decisionItems) {
    const node = document.createElement("article");
    node.className = `strategy-decision-item tone-${item.tone}`;
    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value;
    const note = document.createElement("p");
    note.textContent = item.note;
    node.append(label, value, note);
    els.strategyDecision.appendChild(node);
  }
  els.strategyDetails.open = false;
  els.strategyDetails.dataset.relationGroups = Object.values(strategyBlockRelations).flat().filter((group, index, groups) => groups.indexOf(group) === index).join(" ");
  bindResearchRelationInteraction(els.strategyDetails);
  els.strategyBody.innerHTML = renderStrategyBlocks(blocks.filter((block) => block.label !== "主命題"), strategy.tone);
  bindDeskEvidenceLinks();
  return strategy;
}

function isDirectionalCard(label) {
  return /漲跌|買賣超|增減|變化量|留倉差/.test(label ?? "");
}

function cardSignalLabel(label, value) {
  if (value === null || value === 0) return "持平";
  const positive = value > 0;
  if (/買賣超/.test(label ?? "")) return positive ? "買超" : "賣超";
  if (/漲跌/.test(label ?? "")) return positive ? "上漲" : "下跌";
  return positive ? "增加" : "減少";
}

function isPrimaryDashboardCard(sectionTitle, label) {
  const primaryLabels = {
    "大盤資訊": ["加權指數", "加權指數漲跌"],
    "外資布局": ["外資現貨買賣超", "外資(大小台)期貨未平倉"],
    "自營布局": ["自營(自行)現貨買賣超", "自營(大小台)期貨未平倉"],
  };
  return primaryLabels[sectionTitle]?.includes(label) ?? false;
}

const relationDescriptions = {
  "market-price": "市場基準：以指數、成交與波動資料確認當日價格結構。",
  "market-credit": "信用結構：融資與融券用於觀察槓桿是否擴張或收斂。",
  "position-rollover": "轉倉結構：結算日前後的留倉跳動需先排除換月影響。",
  "foreign-flow": "外資期貨／現貨：需交叉比對部位方向與前日變化，不以單一數字定多空。",
  "foreign-call": "外資 CALL 端：比較 BC、SC 存量與增減，確認上檔壓力是否被消化。",
  "foreign-put": "外資 PUT 端：比較 BP、SP 日增量；SP 訊號以口數增量為主條件。",
  "dealer-flow": "自營期貨／現貨：多為次級確認，宜與外資主導結構一起判讀。",
  "dealer-call": "自營 CALL 端：觀察券商買權槓桿與賣方壓力是否同步放大。",
  "dealer-put": "自營 PUT 端：觀察防守與承接是否改變，不能直接視為方向結論。",
  "retail-long": "散戶多方：多單增加速度與持倉位階需同時看，避免只解讀單一高低點。",
  "retail-short": "散戶空方：空單口數與持倉占比要一起判讀，才可評估軋空燃料。",
  "retail-net": "散戶淨部位：用於觀察散戶是否縮手、追價或轉為擁擠。",
  "retail-micro": "微台結構：以五口微台換算一口小台後，再與小台合併比較。",
};

function cardRelationGroups(label, sectionTitle = "") {
  const text = `${sectionTitle} ${label ?? ""}`;
  const groups = [];
  const add = (group) => {
    if (!groups.includes(group)) groups.push(group);
  };

  if (/加權|PCR/.test(text)) add("market-price");
  if (/融資|融券/.test(text)) add("market-credit");
  if (/結算日|當次月.*留倉|ROLLOVER/.test(text)) add("position-rollover");

  if (/外資/.test(text)) {
    if (/期貨|現貨|買賣超/.test(text)) add("foreign-flow");
    if (/BC|SC|\(買\)OP|買方買權|買權\/賣權比/.test(text)) add("foreign-call");
    if (/BP|SP|\(賣\)OP/.test(text)) add("foreign-put");
  }

  if (/自營/.test(text)) {
    if (/期貨|現貨|買賣超/.test(text)) add("dealer-flow");
    if (/BC|SC|\(買\)OP|買方買權/.test(text)) add("dealer-call");
    if (/BP|SP|\(賣\)OP/.test(text)) add("dealer-put");
  }

  if (/散戶|小台|微台/.test(text)) {
    if (/多單|看多|多方/.test(text)) add("retail-long");
    if (/空單|看空|空方/.test(text)) add("retail-short");
    if (/淨多空|散戶未平倉|留倉差/.test(text)) add("retail-net");
    if (/微台/.test(text)) add("retail-micro");
  }

  return groups;
}

function nodeRelationGroups(node) {
  return (node.dataset.relationGroups ?? "").split(" ").filter(Boolean);
}

const researchRelationPaths = {
  "foreign-flow": ["foreign-flow", "foreign-call", "foreign-put"],
  "foreign-call": ["foreign-call", "foreign-put", "foreign-flow"],
  "foreign-put": ["foreign-put", "foreign-call", "foreign-flow"],
  "retail-long": ["retail-long", "retail-short", "retail-net", "retail-micro"],
  "retail-short": ["retail-short", "retail-long", "retail-net", "retail-micro"],
  "retail-net": ["retail-net", "retail-long", "retail-short", "retail-micro"],
  "retail-micro": ["retail-micro", "retail-long", "retail-short", "retail-net"],
};

function expandedResearchGroups(groups) {
  return [...new Set(groups.flatMap((group) => researchRelationPaths[group] ?? [group]))];
}

function setRelationActivity(groups) {
  const active = new Set(expandedResearchGroups(groups));
  document.querySelectorAll("[data-relation-groups]").forEach((node) => {
    const isRelated = nodeRelationGroups(node).some((group) => active.has(group));
    node.classList.toggle("relation-active", isRelated);
  });
}

function clearRelationActivity() {
  document.querySelectorAll(".relation-active").forEach((node) => node.classList.remove("relation-active"));
}

function bindResearchRelationInteraction(node) {
  const groups = nodeRelationGroups(node);
  if (!groups.length || node.dataset.relationBound === "true") return;
  node.dataset.relationBound = "true";
  node.tabIndex = node.tabIndex >= 0 ? node.tabIndex : 0;
  node.addEventListener("pointerenter", () => setRelationActivity(groups));
  node.addEventListener("pointerleave", clearRelationActivity);
  node.addEventListener("focusin", () => setRelationActivity(groups));
  node.addEventListener("focusout", (event) => {
    if (!node.contains(event.relatedTarget)) clearRelationActivity();
  });
}

function quickRead(card, groups, numeric) {
  const summary = relationDescriptions[groups[0]] ?? "欄位之間的關聯以同色群組微亮提示。";
  if (!isDirectionalCard(card.label) || numeric === null) return summary;
  return `當日數值${cardSignalLabel(card.label, numeric)}。${summary}`;
}

function positionCardTooltip(anchor) {
  const tooltip = els.cardTooltip;
  const margin = 14;
  const offset = 14;
  const rect = anchor instanceof Element
    ? anchor.getBoundingClientRect()
    : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const box = tooltip.getBoundingClientRect();
  const preferRight = rect.right + offset + box.width <= window.innerWidth - margin;
  const left = preferRight ? rect.right + offset : rect.left - box.width - offset;
  const top = Math.min(Math.max(margin, rect.top), window.innerHeight - box.height - margin);
  tooltip.style.left = `${Math.max(margin, left)}px`;
  tooltip.style.top = `${top}px`;
}

function showCardTooltip(node, card, groups, anchor = node) {
  const tooltip = els.cardTooltip;
  tooltip.querySelector(".card-tooltip-title").textContent = card.label ?? "欄位說明";
  tooltip.querySelector(".card-tooltip-value").textContent = renderValue(card.value, card.numFmt ?? "");
  tooltip.querySelector(".card-tooltip-note").textContent = card.note ?? "此欄位暫無補充口徑。";
  tooltip.querySelector(".card-tooltip-insight").textContent = quickRead(card, groups, numericValue(card.value));
  tooltip.hidden = false;
  setRelationActivity(groups);
  positionCardTooltip(anchor);
}

function hideCardTooltip() {
  els.cardTooltip.hidden = true;
  document.querySelectorAll(".relation-active").forEach((node) => node.classList.remove("relation-active"));
}

function positionTrendTooltip(anchor) {
  const tooltip = els.trendTooltip;
  const margin = 14;
  const offset = 14;
  const rect = anchor.getBoundingClientRect();
  const box = tooltip.getBoundingClientRect();
  const preferRight = rect.right + offset + box.width <= window.innerWidth - margin;
  const left = preferRight ? rect.right + offset : rect.left - box.width - offset;
  const top = Math.min(Math.max(margin, rect.top), window.innerHeight - box.height - margin);
  tooltip.style.left = `${Math.max(margin, left)}px`;
  tooltip.style.top = `${top}px`;
}

function showTrendTooltip(row, definition, sample) {
  const tooltip = els.trendTooltip;
  const value = sample?.[definition.key];
  tooltip.querySelector(".trend-tooltip-title").textContent = `${definition.label}｜${sample?.date ?? "—"}`;
  tooltip.querySelector(".trend-tooltip-value").textContent = value === null || value === undefined
    ? "數值暫無"
    : `${renderValue(value, definition.numFmt)} ${definition.unit}`;
  tooltip.querySelector(".trend-tooltip-formula").textContent = `計算：${definition.formula}`;
  tooltip.querySelector(".trend-tooltip-reading").textContent = `研究框架：${definition.reading}`;
  tooltip.hidden = false;
  positionTrendTooltip(row);
}

function hideTrendTooltip() {
  els.trendTooltip.hidden = true;
}

function bindCardInteraction(node, card, sectionTitle) {
  const groups = cardRelationGroups(card.label, sectionTitle);
  node.dataset.relationGroups = groups.join(" ");
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  node.setAttribute("aria-label", `${card.label ?? "欄位"}：${renderValue(card.value, card.numFmt ?? "")}。可查看欄位口徑與關聯資料。`);

  node.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") showCardTooltip(node, card, groups, event);
  });
  node.addEventListener("pointermove", (event) => {
    if (!els.cardTooltip.hidden && event.pointerType !== "touch") positionCardTooltip(event);
  });
  node.addEventListener("pointerleave", () => hideCardTooltip());
  node.addEventListener("focus", () => showCardTooltip(node, card, groups));
  node.addEventListener("blur", () => hideCardTooltip());
  // Click always opens the card detail so focus + click works consistently on touch screens.
  node.addEventListener("click", () => showCardTooltip(node, card, groups));
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    showCardTooltip(node, card, groups);
  });
}

function buildShortTrendPanel(historyReports) {
  const rawSamples = historyReports.slice(0, 5).reverse().map((report) => {
    const retailNet = getReportCardValue(report, "小台+微台等值淨多空")
      ?? (() => {
        const small = getReportCardValue(report, "散戶未平倉");
        const micro = getReportCardValue(report, "微台散戶未平倉");
        return small === null || micro === null ? null : small + micro / 5;
      })();
    const callNet = getReportCardValue(report, "外資(買)OP未平倉金額");
    return {
      date: report?.date ?? "",
      index: getReportCardValue(report, "加權指數"),
      futures: getReportCardValue(report, "外資(大小台)期貨未平倉"),
      callPressure: callNet === null ? null : -callNet,
      putDefense: getReportCardValue(report, "外資(賣)OP未平倉金額"),
      retailNet,
    };
  }).filter((sample) => sample.date);
  if (rawSamples.length < 2) return null;

  const definitions = [
    {
      key: "index", label: "加權指數", unit: "點", numFmt: "#,##0.00", tone: "market",
      relationGroups: ["market-price"],
      formula: "TWSE MI_INDEX 收盤指數；5D 差額 = 當日收盤 - 五個交易日前收盤。",
      reading: "價格是結構背景，不是單獨訊號。需與期貨、CALL／PUT 與散戶是否同向或背離一起看。",
    },
    {
      key: "futures", label: "外資期貨", unit: "口", numFmt: "#,##0", tone: "futures",
      relationGroups: ["foreign-flow"],
      formula: "外資 TXF 淨額 + MXF 淨額 / 4 + TMF 淨額 / 20，四捨五入為小台等值口數。",
      reading: "下跌時若外資期貨逆勢回補且能延續，才提高低點測試權重；若與指數同向變化，優先視為整理訊號。",
    },
    {
      key: "callPressure", label: "CALL 壓力", unit: "仟元", numFmt: "#,##0", tone: "call",
      relationGroups: ["foreign-call"],
      formula: "外資 SC 未平倉金額 - BC 未平倉金額；等於主表「外資(買)OP未平倉金額」的相反數。",
      reading: "壓力連續收斂才表示上檔賣方壓力減輕。下跌日應看這個淨壓力，不將上漲日 SC 百分位硬套入判讀。",
    },
    {
      key: "putDefense", label: "PUT 防守", unit: "仟元", numFmt: "#,##0", tone: "put",
      relationGroups: ["foreign-put"],
      formula: "外資 BP 未平倉金額 - SP 未平倉金額；即主表「外資(賣)OP未平倉金額」。",
      reading: "防守提高代表 PUT 端結構轉強，但 SP 訊號只在下跌日、BP 與 SP 口數皆增加且 SP 增量大於 BP 時成立。",
    },
    {
      key: "retailNet", label: "散戶淨部位", unit: "等值口", numFmt: "#,##0.0", tone: "retail",
      relationGroups: ["retail-long", "retail-short", "retail-net", "retail-micro"],
      formula: "(小台散戶看多 - 小台散戶看空) + (微台散戶看多 - 微台散戶看空) / 5。",
      reading: "淨部位需搭配多空持倉占比與增減速度判讀：高多單或速度急升偏 FOMO，高空單而多單未擁擠則是懷疑型結構。",
    },
  ].filter((definition) => rawSamples.filter((sample) => sample[definition.key] !== null).length >= 2);
  if (!definitions.length) return null;

  const panel = document.createElement("section");
  panel.className = "trend-strip-panel";
  panel.setAttribute("aria-label", "短線結構追蹤");
  const head = document.createElement("div");
  head.className = "trend-strip-head";
  const title = document.createElement("div");
  title.innerHTML = "<span>STRUCTURE TRACE</span><strong>短線結構追蹤</strong>";
  const selectedDate = document.createElement("p");
  selectedDate.className = "trend-strip-date";
  head.append(title, selectedDate);
  panel.appendChild(head);

  const legend = document.createElement("p");
  legend.className = "trend-strip-legend";
  legend.textContent = "最近 5 個交易日，共用日期索引；各列以自身數值縮放，請比較方向與背離，不比較線高。";
  panel.appendChild(legend);
  const rows = document.createElement("div");
  rows.className = "trend-strip-rows";
  panel.appendChild(rows);

  const refs = [];
  let activeIndex = rawSamples.length - 1;
  const width = 210;
  const height = 32;
  const padding = 4;
  const formatChange = (value, numFmt) => `${value > 0 ? "+" : ""}${renderValue(value, numFmt)}`;
  const updateSelected = (selectedIndex) => {
    activeIndex = selectedIndex;
    const sample = rawSamples[selectedIndex] ?? rawSamples.at(-1);
    selectedDate.textContent = `${sample.date}｜移動節點可交叉比對同一交易日`;
    refs.forEach((ref) => {
      const value = sample[ref.definition.key];
      ref.value.textContent = value === null ? "—" : renderValue(value, ref.definition.numFmt);
      ref.dots.forEach((dot, index) => dot.classList.toggle("is-selected", index === selectedIndex));
    });
  };

  for (const definition of definitions) {
    const values = rawSamples.map((sample) => sample[definition.key]);
    const numeric = values.filter((value) => value !== null);
    const first = numeric[0];
    const latest = numeric.at(-1);
    const delta = latest - first;
    const movementTone = definition.tone === "call"
      ? (delta > 0 ? "is-pressure" : "is-relief")
      : definition.tone === "put"
        ? (delta > 0 ? "is-stronger" : "is-weaker")
        : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat";
    const row = document.createElement("article");
    row.className = `trend-strip-row trend-${definition.tone} ${movementTone}`;
    row.dataset.relationGroups = definition.relationGroups.join(" ");
    row.setAttribute("aria-label", `${definition.label}。移入可查看計算口徑與研究判讀。`);
    const label = document.createElement("div");
    label.className = "trend-strip-label";
    label.textContent = definition.label;
    const value = document.createElement("strong");
    value.className = "trend-strip-value";
    const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chart.setAttribute("class", "trend-strip-chart");
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", `${definition.label}近五日走勢`);
    let low = Math.min(...numeric);
    let high = Math.max(...numeric);
    if (low === high) {
      const allowance = Math.abs(low || 1) * 0.08;
      low -= allowance;
      high += allowance;
    }
    const xAt = (index) => padding + (index / (rawSamples.length - 1)) * (width - padding * 2);
    const yAt = (item) => height - padding - ((item - low) / (high - low)) * (height - padding * 2);
    const zeroY = low <= 0 && high >= 0 ? yAt(0) : null;
    if (zeroY !== null) {
      const baseline = document.createElementNS(chart.namespaceURI, "line");
      baseline.setAttribute("class", "trend-strip-baseline");
      baseline.setAttribute("x1", "0");
      baseline.setAttribute("x2", String(width));
      baseline.setAttribute("y1", String(zeroY));
      baseline.setAttribute("y2", String(zeroY));
      chart.appendChild(baseline);
    }
    let pathData = "";
    values.forEach((item, index) => {
      if (item === null) return;
      pathData += `${pathData ? " L" : "M"}${xAt(index).toFixed(2)} ${yAt(item).toFixed(2)}`;
    });
    const path = document.createElementNS(chart.namespaceURI, "path");
    path.setAttribute("class", "trend-strip-line");
    path.setAttribute("d", pathData);
    chart.appendChild(path);
    const dots = [];
    values.forEach((item, index) => {
      if (item === null) return;
      const dot = document.createElementNS(chart.namespaceURI, "circle");
      dot.setAttribute("class", "trend-strip-dot");
      dot.setAttribute("cx", String(xAt(index)));
      dot.setAttribute("cy", String(yAt(item)));
      dot.setAttribute("r", "2.5");
      dot.setAttribute("tabindex", "0");
      dot.setAttribute("role", "button");
      dot.setAttribute("aria-label", `${rawSamples[index].date} ${definition.label} ${renderValue(item, definition.numFmt)}`);
      dot.addEventListener("pointerenter", () => {
        updateSelected(index);
        showTrendTooltip(row, definition, rawSamples[index]);
      });
      dot.addEventListener("focus", () => {
        updateSelected(index);
        showTrendTooltip(row, definition, rawSamples[index]);
      });
      dot.addEventListener("click", () => {
        updateSelected(index);
        showTrendTooltip(row, definition, rawSamples[index]);
      });
      chart.appendChild(dot);
      dots[index] = dot;
    });
    const change = document.createElement("span");
    change.className = "trend-strip-change";
    change.textContent = `5D ${formatChange(delta, definition.numFmt)}`;
    const unit = document.createElement("small");
    unit.textContent = definition.unit;
    const copy = document.createElement("div");
    copy.className = "trend-strip-value-wrap";
    copy.append(value, unit);
    row.append(label, copy, chart, change);
    row.addEventListener("pointerenter", () => showTrendTooltip(row, definition, rawSamples[activeIndex]));
    row.addEventListener("pointermove", () => {
      if (!els.trendTooltip.hidden) positionTrendTooltip(row);
    });
    row.addEventListener("pointerleave", hideTrendTooltip);
    row.addEventListener("focusin", () => showTrendTooltip(row, definition, rawSamples[activeIndex]));
    row.addEventListener("focusout", (event) => {
      if (!row.contains(event.relatedTarget)) hideTrendTooltip();
    });
    bindResearchRelationInteraction(row);
    rows.appendChild(row);
    refs.push({ definition, value, dots });
  }
  updateSelected(rawSamples.length - 1);
  return panel;
}

function buildCard(card, sectionTitle = "") {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  if (card.alert) node.classList.add("card-alert");
  const numeric = numericValue(card.value);
  const directional = isDirectionalCard(card.label);
  if (card.alert) {
    node.classList.add("card-risk");
  } else if (directional && numeric !== null) {
    if (numeric > 0) node.classList.add("card-bull");
    if (numeric < 0) node.classList.add("card-bear");
  }
  if (isPrimaryDashboardCard(sectionTitle, card.label)) node.classList.add("card-primary");
  const badge = node.querySelector(".card-alert-badge");
  const signal = node.querySelector(".card-signal");
  if (card.alertLabel) {
    badge.hidden = false;
    badge.textContent = card.alertLabel;
  }
  if (directional && numeric !== null) {
    signal.hidden = false;
    signal.classList.add(numeric > 0 ? "is-up" : numeric < 0 ? "is-down" : "is-flat");
    signal.textContent = `${numeric > 0 ? "▲" : numeric < 0 ? "▼" : "■"} ${cardSignalLabel(card.label, numeric)}`;
  }
  node.querySelector(".card-label").textContent = card.label ?? "";
  node.querySelector(".card-value").textContent = renderValue(card.value, card.numFmt ?? "");
  node.querySelector(".card-note").textContent = card.note ?? "";
  bindCardInteraction(node, card, sectionTitle);
  return node;
}

function buildRetailPositionPanel(position) {
  if (!position || !Array.isArray(position.metrics)) return null;

  const panel = document.createElement("aside");
  panel.className = "retail-position-panel";
  panel.setAttribute("aria-label", "散戶位階圖");

  const head = document.createElement("div");
  head.className = "retail-position-head";
  const title = document.createElement("div");
  title.className = "retail-position-title";
  title.textContent = "散戶位階圖";
  const meta = document.createElement("div");
  meta.className = "retail-position-meta";
  meta.textContent = `${position.window ?? 45} 日樣本 / 等值口數 / 結算日排除到期契約`;
  head.append(title, meta);

  const assessment = document.createElement("div");
  const assessmentTone = String(position.assessment ?? "").includes("擁擠") ? "is-risk" : "is-neutral";
  assessment.className = `retail-position-assessment ${assessmentTone}`;
  assessment.textContent = position.assessment ?? "樣本不足";
  head.appendChild(assessment);
  panel.appendChild(head);

  const metricMap = new Map(position.metrics.map((metric) => [metric.key, metric]));
  const coreKeys = ["equivalentLongVelocity", "equivalentShortVelocity", "longShare", "shortShare"];
  const grid = document.createElement("div");
  grid.className = "retail-position-grid retail-position-grid-core";
  const meterRefs = new Map();

  const selectedState = (key, sample) => {
    const metric = metricMap.get(key);
    if (!metric) return null;
    if (key === "equivalentLongVelocity" || key === "equivalentShortVelocity") {
      const long = key === "equivalentLongVelocity";
      const speed = long ? sample.longVelocity : sample.shortVelocity;
      const rank = long ? sample.longVelocityRank : sample.shortVelocityRank;
      const increase = speed !== null && speed >= 0;
      return {
        metric,
        primary: speed === null ? "樣本不足" : formatSignedPercent(speed),
        rank,
        caption: speed === null
          ? "沒有足夠前一交易日資料。"
          : `${increase ? (long ? "多單加碼" : "空單加碼") : (long ? "多單去槓桿" : "空單回補")}｜速度強度 ${rank === null ? "樣本不足" : `${renderValue(rank, "0.0")}%`}`,
        tone: increase ? "is-increase" : "is-decrease",
      };
    }
    const long = key === "longShare";
    const share = long ? sample.longShare : sample.shortShare;
    const rank = long ? sample.longShareRank : sample.shortShareRank;
    const equivalent = long ? sample.equivalentLong : sample.equivalentShort;
    return {
      metric,
      primary: renderValue(share, "0.0%"),
      rank,
      caption: `等值留倉 ${renderValue(equivalent, "#,##0.0")} 口｜水位位階 ${rank === null ? "樣本不足" : `${renderValue(rank, "0.0")}%`}`,
      tone: long ? "is-long-share" : "is-short-share",
    };
  };

  const createMeter = (key) => {
    const metric = metricMap.get(key);
    if (!metric) return null;
    const item = document.createElement("article");
    item.className = `retail-meter retail-meter-${key}`;
    const metricHead = document.createElement("div");
    metricHead.className = "retail-meter-head";
    const label = document.createElement("span");
    label.textContent = metric.label ?? "位階";
    const value = document.createElement("strong");
    metricHead.append(label, value);
    item.appendChild(metricHead);

    const track = document.createElement("div");
    track.className = "retail-meter-track";
    const fill = document.createElement("span");
    fill.className = "retail-meter-fill";
    // The selected-date handler applies the actual rank after every hover/click.
    fill.style.width = "0%";
    track.appendChild(fill);
    item.appendChild(track);

    const caption = document.createElement("p");
    item.appendChild(caption);
    meterRefs.set(key, { item, value, fill, caption });
    return item;
  };

  for (const key of coreKeys) {
    const meter = createMeter(key);
    if (meter) grid.appendChild(meter);
  }
  panel.appendChild(grid);

  const history = Array.isArray(position.history) ? position.history.filter((item) => item.date) : [];
  const interactive = document.createElement("div");
  interactive.className = "retail-history";
  const historyHead = document.createElement("div");
  historyHead.className = "retail-history-head";
  const historyLabel = document.createElement("span");
  historyLabel.textContent = "45 日部位軌跡";
  const historyDate = document.createElement("strong");
  historyHead.append(historyLabel, historyDate);
  interactive.appendChild(historyHead);

  const historyTrack = document.createElement("div");
  historyTrack.className = "retail-history-track";
  interactive.appendChild(historyTrack);

  const detail = document.createElement("p");
  detail.className = "retail-history-detail";
  interactive.appendChild(detail);

  const inventory = document.createElement("div");
  inventory.className = "retail-position-inventory";
  const inventoryTitle = document.createElement("span");
  inventoryTitle.textContent = "等值留倉明細";
  const inventoryValues = document.createElement("strong");
  inventory.append(inventoryTitle, inventoryValues);
  panel.appendChild(interactive);
  panel.appendChild(inventory);

  const points = new Map();
  const updateSelected = (index) => {
    const sample = history[index];
    if (!sample) return;
    historyDate.textContent = sample.date;
    for (const key of coreKeys) {
      const state = selectedState(key, sample);
      const refs = meterRefs.get(key);
      if (!state || !refs) continue;
      refs.value.textContent = state.primary;
      refs.caption.textContent = state.caption;
      refs.fill.style.width = `${Math.max(0, Math.min(100, state.rank ?? 0))}%`;
      refs.item.classList.toggle("is-increase", state.tone === "is-increase");
      refs.item.classList.toggle("is-decrease", state.tone === "is-decrease");
      refs.item.classList.toggle("is-long-share", state.tone === "is-long-share");
      refs.item.classList.toggle("is-short-share", state.tone === "is-short-share");
    }
    const longAction = sample.longVelocity === null ? "多單資料不足" : sample.longVelocity >= 0 ? "多單加碼" : "多單去槓桿";
    const shortAction = sample.shortVelocity === null ? "空單資料不足" : sample.shortVelocity >= 0 ? "空單加碼" : "空單回補";
    detail.textContent = `${longAction} ${sample.longVelocity === null ? "" : formatSignedPercent(sample.longVelocity)}；${shortAction} ${sample.shortVelocity === null ? "" : formatSignedPercent(sample.shortVelocity)}。水位為多單 ${renderValue(sample.longShare, "0.0%")}／空單 ${renderValue(sample.shortShare, "0.0%")} 。`;
    inventoryValues.textContent = `多 ${renderValue(sample.equivalentLong, "#,##0.0")}｜空 ${renderValue(sample.equivalentShort, "#,##0.0")}｜淨 ${renderValue(sample.equivalentLong - sample.equivalentShort, "#,##0.0")} 口`;
    points.forEach((point, pointIndex) => point.classList.toggle("is-active", pointIndex === index));
  };

  history.slice().reverse().forEach((sample, reverseIndex) => {
    const index = history.length - 1 - reverseIndex;
    const point = document.createElement("button");
    point.type = "button";
    point.className = "retail-history-point";
    point.style.setProperty("--point-height", `${Math.round(18 + sample.longShare * 70)}%`);
    point.setAttribute("aria-label", `${sample.date}，多單占比 ${renderValue(sample.longShare, "0.0%")}`);
    point.title = `${sample.date}｜多 ${renderValue(sample.longShare, "0.0%")}｜空 ${renderValue(sample.shortShare, "0.0%")}`;
    point.addEventListener("pointerenter", () => updateSelected(index));
    point.addEventListener("focus", () => updateSelected(index));
    point.addEventListener("click", () => updateSelected(index));
    historyTrack.appendChild(point);
    points.set(index, point);
  });
  if (history.length) updateSelected(0);

  const note = document.createElement("p");
  note.className = "retail-position-note";
  note.textContent = `移動游標至軌跡任一日，可同步查看當日四項結構。水位以等值多空持倉占比計算，速度以等值多空單日變動率的絕對強度排名；結算日已排除到期契約。顏色只用於辨識部位與變化，不是方向建議。`;
  panel.appendChild(note);
  return panel;
}

function buildSection(section) {
  const node = els.sectionTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`section-${String(section.title ?? "").replaceAll(/[^a-zA-Z0-9]/g, "") || "data"}`);
  node.querySelector("h3").textContent = section.title ?? "";
  node.querySelector(".section-meta").textContent = `${section.cards?.length ?? 0} 項資料`;
  const grid = node.querySelector(".card-grid");
  const retailPanel = buildRetailPositionPanel(section.retailPosition);
  if (retailPanel) grid.before(retailPanel);
  for (const card of section.cards ?? []) {
    grid.appendChild(buildCard(card, section.title ?? ""));
  }
  return node;
}

function renderSections(container, sections) {
  container.replaceChildren();
  for (const section of sections ?? []) {
    container.appendChild(buildSection(section));
  }
}

function dateMonth(date) {
  return String(date ?? "").slice(0, 7);
}

function monthLabel(month) {
  const [year, value] = String(month).split("-");
  return year && value ? `${year} 年 ${value} 月` : month;
}

function renderHistory(index) {
  const reports = index.reports ?? [];
  const months = [...new Set(reports.map((report) => dateMonth(report.date)).filter(Boolean))];
  const preferredMonth = dateMonth(state.currentDate);
  if (!state.historyMonth || !months.includes(state.historyMonth)) {
    state.historyMonth = preferredMonth || months[0] || null;
  }

  els.historyMonthFilter.replaceChildren();
  for (const month of months) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthLabel(month);
    option.selected = month === state.historyMonth;
    els.historyMonthFilter.appendChild(option);
  }

  const visibleReports = reports.filter((report) => dateMonth(report.date) === state.historyMonth);
  els.historyMeta.textContent = `${monthLabel(state.historyMonth)} · ${visibleReports.length} 筆`;
  els.historyList.replaceChildren();
  for (const report of visibleReports) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    if (report.date === state.currentDate) button.classList.add("is-active");
    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = report.date.slice(5).replace("-", "/");
    const copy = document.createElement("span");
    copy.className = "history-item-copy";
    copy.textContent = report.date === state.currentDate
      ? "正在檢視"
      : report.date === index.latestDate
        ? "最新快照"
        : "盤後快照";
    button.append(date, copy);
    button.addEventListener("click", () => loadReport(report.date));
    els.historyList.appendChild(button);
  }
}

function renderStatus(index, currentDate) {
  els.statusLatestDate.textContent = index.latestDate ?? "—";
  els.statusGeneratedAt.textContent = formatTaipeiTime(index.generatedAt);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const ok = currentDate === today;
  els.statusToday.textContent = ok ? "已更新" : "非今日";
  els.statusToday.classList.toggle("is-good", ok);
  els.statusToday.classList.toggle("is-warn", !ok);
}

async function fetchJson(path) {
  const response = await fetch(`${path}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`Failed to fetch ${path}`);
  return response.json();
}

async function fetchReport(date) {
  if (state.reportCache.has(date)) return state.reportCache.get(date);
  const report = await fetchJson(`./data/reports/${date}.json`);
  state.reportCache.set(date, report);
  return report;
}

async function loadResearchFramework() {
  try {
    // This file exists only in the local workspace. Public Pages deliberately
    // receives no source articles, notes, or full research framework.
    return await fetchJson("./.private/research-framework.json");
  } catch (_error) {
    return null;
  }
}

async function loadDeskViewOverrides() {
  try {
    return await fetchJson("./data/reports/desk-view-overrides.json");
  } catch (_error) {
    return {};
  }
}

async function loadHistoryReports(date, limit = 5) {
  const dates = (state.index?.reports ?? []).map((item) => item.date);
  const start = dates.indexOf(date);
  if (start === -1) return [];
  const slice = dates.slice(start, start + limit);
  return Promise.all(slice.map((itemDate) => fetchReport(itemDate)));
}

async function loadIndex() {
  [state.researchFramework, state.deskViewOverrides] = await Promise.all([
    loadResearchFramework(),
    loadDeskViewOverrides(),
  ]);
  state.index = await fetchJson("./data/reports/index.json");
  const dateFromQuery = new URLSearchParams(window.location.search).get("date");
  state.currentDate = dateFromQuery || state.index.latestDate;
  renderStatus(state.index, state.currentDate);
  renderHistory(state.index);
  if (state.currentDate) await loadReport(state.currentDate, false);
}

async function loadReport(date, updateQuery = true) {
  const report = await fetchReport(date);
  const historyReports = await loadHistoryReports(date, 46);
  const retailPosition = buildRetailPositionFromHistory(historyReports);
  const dashboardSections = (report.dashboard.sections ?? []).map((section) => {
    if (section.title !== "散戶") return section;
    return { ...section, retailPosition };
  });
  state.currentDate = date;
  if (updateQuery) {
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.replaceState({}, "", url);
  }

  els.heroTitle.textContent = report.dashboard.title ?? date;
  els.heroSubtitle.textContent = report.dashboard.subtitle ?? "";
  els.dashboardSummary.textContent = report.dashboard.summary ?? "";
  els.downloadLink.href = report.xlsxHref ?? "#";

  const strategy = renderStrategy(report, historyReports);
  const optionContour = buildOptionContourSnapshot(historyReports);
  buildMarketPulse(report, strategy, optionContour, retailPosition);
  buildDecisionFocus(report, strategy);
  const trendPanel = buildShortTrendPanel(historyReports);
  els.trendStripPanel.replaceChildren();
  els.trendStripPanel.hidden = !trendPanel;
  if (trendPanel) els.trendStripPanel.appendChild(trendPanel);
  renderScPressurePanel(buildScPressureSnapshot(historyReports));
  renderOptionContourPanel(optionContour);
  renderSections(els.dashboardSections, dashboardSections);
  renderSections(els.detailSections, report.detail.sections);
  renderStatus(state.index, state.currentDate);
  renderHistory(state.index);
}

function bindTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      const next = tab.dataset.tab;
      Object.entries(els.views).forEach(([name, view]) => {
        view.classList.toggle("is-active", name === next);
      });
      els.tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    });
  });
}

function setHistoryCollapsed(collapsed) {
  els.sidebar.classList.toggle("is-history-collapsed", collapsed);
  els.historyToggleButton.setAttribute("aria-expanded", String(!collapsed));
  els.historyToggleButton.textContent = collapsed ? "展開" : "收合";
}

els.refreshButton.addEventListener("click", async () => {
  await loadIndex();
});

bindTabs();
els.tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.classList.contains("is-active"))));
els.historyMonthFilter.addEventListener("change", () => {
  state.historyMonth = els.historyMonthFilter.value;
  renderHistory(state.index);
});

els.historyLatestButton.addEventListener("click", () => {
  const latestDate = state.index?.latestDate;
  if (!latestDate) return;
  state.historyMonth = dateMonth(latestDate);
  loadReport(latestDate);
});

els.historyToggleButton.addEventListener("click", () => {
  setHistoryCollapsed(!els.sidebar.classList.contains("is-history-collapsed"));
});

if (window.matchMedia("(max-width: 1024px)").matches) setHistoryCollapsed(true);

loadIndex().catch((error) => {
  els.heroTitle.textContent = "資料載入失敗";
  els.heroSubtitle.textContent = error.message;
});
