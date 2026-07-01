const state = {
  index: null,
  currentDate: null,
  reportCache: new Map(),
};

const els = {
  historyList: document.querySelector("#historyList"),
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
  strategyBody: document.querySelector("#strategyBody"),
  downloadLink: document.querySelector("#downloadLink"),
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    dashboard: document.querySelector("#dashboardView"),
    detail: document.querySelector("#detailView"),
  },
  refreshButton: document.querySelector("#refreshButton"),
  sectionTemplate: document.querySelector("#sectionTemplate"),
  cardTemplate: document.querySelector("#cardTemplate"),
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
      return `
        <section class="strategy-block">
          <div class="strategy-block-head">${label}</div>
          <div class="strategy-block-body">
            <div class="strategy-bullet"></div>
            <div class="strategy-block-text">${bodyHtml}</div>
          </div>
        </section>
      `;
    })
    .join("");
}

function buildStrategyView(report, historyReports = []) {
  const recentReports = historyReports.length > 0 ? historyReports : [report];
  const prevReport = recentReports[1] ?? null;
  const cards = collectCards(report);
  const allCards = collectAllCards(report);
  const prevCards = prevReport ? collectCards(prevReport) : [];
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
  const foreignBpSpRatio = getCardValue(allCards, "外資BP/SP增幅比例");
  const dealerBcSettle = getCardValue(cards, "自營(BC)OP未平倉金額與結算比");
  const dealerBpSettle = getCardValue(cards, "自營(BP)OP未平倉金額與結算比");
  const dealerBuyOiAmount = getCardValue(cards, "自營(買)OP未平倉金額");
  const dealerSellOiAmount = getCardValue(cards, "自營(賣)OP未平倉金額");
  const dealerScBcDelta = getCardValue(allCards, "自營(SC增幅-BC增幅)金額");
  const dealerBpSpRatio = getCardValue(allCards, "自營BP/SP增幅比例");
  const retailNet = getCardValue(cards, "散戶未平倉");
  const retailMicroNet = getCardValue(cards, "微台散戶未平倉");
  const retailMicroRatio = getCardValue(cards, "微台散戶多空比");
  const prevRetailNet = getCardValue(prevCards, "散戶未平倉");
  const prevRetailMicroNet = getCardValue(prevCards, "微台散戶未平倉");
  const prevForeignFut = getCardValue(prevCards, "外資(大小台)期貨未平倉");
  const isSettlementResetDay = bcSettle === 0;
  const largeBcPosition =
    (bcSettle !== null && bcSettle >= 1_000_000) ||
    (foreignBcAmount !== null && foreignBcAmount >= 1_000_000);
  const dealerHot =
    (dealerBcSettle !== null && dealerBcSettle >= 1_000_000) ||
    (dealerCpRatio !== null && dealerCpRatio >= 8);
  const futuresHedgeExtreme =
    foreignFutVsSettle !== null && Math.abs(foreignFutVsSettle) >= 20_000;
  const retailChasingLong =
    (retailNet !== null && retailNet > 0) ||
    (retailMicroNet !== null && retailMicroNet > 0) ||
    (retailMicroRatio !== null && retailMicroRatio >= 15);
  const optionOverheatSignal = largeBcPosition && dealerHot;
  const putDefenseSignal =
    (bpSettle !== null && bpSettle > 0) ||
    (foreignSellOiAmount !== null && foreignSellOiAmount > foreignBuyOiAmount);
  const foreignSpSignal =
    (foreignSpAmount !== null && foreignBpAmount !== null && foreignSpAmount > foreignBpAmount) ||
    (foreignSellOiAmount !== null && foreignSellOiAmount < 0);
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
      ? `外資買權槓桿沒有再明顯升溫，但外資賣方部位已開始偏向 SP 訊號，代表保護性部位的性質正在轉變；若與散戶多單下降同步出現，通常比單看指數跌深更有參考價值。`
    : putDefenseSignal
      ? `外資買權槓桿沒有再明顯升溫，反而要留意賣權端的防禦配置。BP/SP 金額與增幅顯示保護性部位仍在，較像上方空間保留、下方風險同時控管的結構。`
      : `外資選擇權沒有單邊失衡，買方比 ${getCardRender(cards, "外資買方買權/賣權比")}、淨買權/賣權比 ${getCardRender(cards, "外資買權/賣權比")}，目前偏向保留彈性，而不是直接押單邊行情。`;
  const historyContextView = whipsawReclaimSignal
    ? `從最新研究補進來的歷史對照看，這種「前一日急跌、隔日長紅回收」更像跌破後的急洗與回箱，而不是光靠一根大漲就能確認新主升。重點要看的是後面幾天能否站回恐慌日上緣，並讓外資期貨空單停止持續擴張；若只修復價格、不修復期權結構，通常仍屬震盪盤中的反抽。`
    : continuationPrepSignal
      ? `以這篇 6/30 報告的框架來看，現在更接近趨勢多頭裡的高檔橫盤消化，而不是結構性翻空。歷史上類似 2020 下半年到 2021 初、以及 2021 上半年區間整理的案例，常見特徵都是價格先走時間整理，外資買權不再追價擴張、SC 留在高檔控節奏，等乖離消化後才再找下一段續攻。`
      : boxDigestSignal
        ? `報告補強的一個重點是：高檔整理不能只看指數漲跌，而要看它是在趨勢上方做時間換空間，還是在跌勢裡被動反彈。若價格仍維持在近期均值之上、外資選擇權沒有全面轉成防禦部位，這種箱體更應先視為多頭中的節奏調整。`
        : `這篇新報告提醒的是，Desk View 不能只用單日強弱去判斷方向，而要先把盤勢放進「主升段後整理、急跌後回箱、或高檔過熱延伸」這三種結構框架裡。也因此，之後解讀會更重視歷史位置、結算後籌碼重組、以及期權與散戶訊號是不是互相驗證。`;
  const dealerRetailView = dealerShortOverheat
    ? `自營端賣方部位偏熱，自營(賣)OP 未平倉金額 ${renderValue(dealerSellOiAmount, "#,##0")}、BP/SP 增幅比例 ${dealerBpSpRatio !== null ? renderValue(dealerBpSpRatio, "0.00%") : "待補"}；若同時散戶多單下降，這通常支持先有反彈，但若外資 SP 與期貨回補延續不足，仍要把後續整理視為主情境。`
    : dealerHot
      ? `自營端買方比 ${getCardRender(cards, "自營買方買權/賣權比")}，BC 結算比 ${getCardRender(cards, "自營(BC)OP未平倉金額與結算比")}；券商端也把買權槓桿推高，若再搭配自營 SC/BC 減碼差 ${dealerScBcDelta !== null ? renderValue(dealerScBcDelta, "#,##0") : "待補"}，就容易走成短線過熱。`
    : dealerBuyOiAmount !== null && dealerSellOiAmount !== null
      ? `自營端買方金額 ${renderValue(dealerBuyOiAmount, "#,##0")}、賣方金額 ${renderValue(dealerSellOiAmount, "#,##0")}，買方比 ${getCardRender(cards, "自營買方買權/賣權比")}；目前更像中性偏多的配平，而非過度擴張槓桿。`
      : `自營端買權熱度目前尚未全面失控，可視為次要確認訊號；若後續與外資買權槓桿共振，才需要把短線過熱權重進一步拉高。`;
  const retailView = panicWashoutSignal
    ? `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}，較前日 ${retailDelta !== null ? renderValue(retailDelta, "#,##0") : "待補"}；在大跌背景下反而減少多單，代表恐慌型部位開始鬆動，較容易形成短線相對低點。若這類盤屬於波動更大、時間更長的整理段，研究上更重視「抄底後願意先縮手」這個訊號，而不是只看散戶多單是否衝到歷史高峰。${retailMicroDelta !== null ? `微台未平倉變動 ${renderValue(retailMicroDelta, "#,##0")} 也可同步觀察情緒是否退潮。` : ""}`
    : retailChasingLong
      ? `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}、微台未平倉 ${retailMicroNet !== null ? renderValue(retailMicroNet, "#,##0") : "待補"}，微台多空比 ${retailMicroRatio !== null ? renderValue(retailMicroRatio, "0.00%") : "待補"}；情緒面已有追多痕跡，依歷史經驗較常出現在行情末段或回測前夕。`
      : `散戶未平倉 ${retailNet !== null ? renderValue(retailNet, "#,##0") : "待補"}、微台未平倉 ${retailMicroNet !== null ? renderValue(retailMicroNet, "#,##0") : "待補"}；目前還沒看到全面追價失控，這讓行情若要延續，結構上仍比較健康。`;
  const overheatView = optionOverheatSignal
    ? `若再把外資與自營買權槓桿一起看，現在已接近文章所說的「雙紫爆」輪廓；這通常不是單純看多確認，而是提醒短線漲勢可能已進入驚驚漲末段，後續較容易轉為 5% 上下甚至更大的回測整理。`
    : futuresHedgeExtreme
      ? `目前外資期貨與結算比已來到相對極端區，雖然還不能直接視為反轉，但代表風險管理權重應提高，後續要盯的是拉回時外資期貨是否由空翻多。`
      : "";
  const validationView = whipsawReclaimSignal
    ? `接下來的驗證重點不是今天這根長紅本身，而是三件事：第一，外資期貨與前日增減是否不再續空；第二，外資 BC/SC 增幅比例能否持續改善，而不是只剩價格修復；第三，散戶與微台是否重新快速追價。若三者沒有同步轉熱，較適合把它解讀為跌深回箱後的震盪修復。`
    : continuationPrepSignal
      ? `接下來要驗證的不是「會不會立刻噴出」，而是整理能否乾淨完成：外資 BC 不失速、自營空方熱度別再升高、散戶不要重新衝高追多。若這幾項都維持克制，這種高檔盤整反而比較像為下一段趨勢做準備。`
      : strongerBottomSignal
        ? `後續驗證點會放在外資期貨回補能否延續、外資 SP 訊號是否保留，以及散戶縮手是否不是只有一天。只有這三者同時延續，短線低點的可信度才會提高。`
        : `後續驗證點仍放在外資期貨日增減、BC/SC 與 BP/SP 增幅結構、以及散戶多單是否重新追價。也就是說，之後的 Desk View 會更像追蹤「結構有沒有升級」，而不是只重複形容單日漲跌。`;
  const conclusionView = strongerBottomSignal
    ? `綜合來看，若跌幅已深、散戶多單明顯縮手、外資期貨開始回補且外資賣方訊號同步出現，較可把盤勢視為短線相對低點區，操作上可提高反彈延續的權重，但仍需用後續籌碼確認是否能從反彈升級為真正轉折。`
    : weakReboundOnly
      ? `綜合來看，這組籌碼較像先反彈、後整理：散戶恐慌有釋放，自營空單也提供短線支撐，但外資 SP 訊號與期貨逆增的延續仍不足，因此不宜太快把反彈直接上綱成 V 轉。`
    : whipsawReclaimSignal && sentimentMismatchSignal
      ? `綜合來看，像 6/30 這種大漲並不屬於最乾淨的多頭再加速，因為現貨沒有同步大幅回補、外資期貨空單也仍在增加。更合理的解讀是急跌後的價格修復已出現，但籌碼端還在重整，所以 Desk View 會把它放在「中性偏多、先回箱再觀察能否續攻」的位置，而不是直接視為新主升確立。`
    : consolidationBiasSignal && !longSignal
      ? `綜合來看，目前更像多頭架構裡的高檔整理，而不是結構性轉空。尤其當 BC 沒有跟漲擴張、SC 卻維持高檔，且外資期貨增減又與指數同步時，較應把它視為中期整理訊號；操作上重點是接受震盪與節奏切換，並預留約 5-8% 的回測整理空間，而不是急著把每一次拉回都解讀成空頭起跌。`
    : contrarianBullSignal
    ? `綜合來看，這不是單純因指數走弱就要看空的盤，而是表面偏弱、內部槓桿卻逆勢偏多的結構，較接近逆勢布局型態，因此 Desk View 會上修為積極偏多；操作上可偏向順多思考，但仍要提防高槓桿帶來的短線震盪。`
    : optionOverheatSignal && futuresHedgeExtreme
      ? `綜合來看，結構上多頭尚未被破壞，但期貨避險幅度、外資買權槓桿與自營熱度同時推到高檔，較像強趨勢末段的過熱延伸。Desk View 會保留多方主軸，但實務上更重視部位調整與風險回收，不建議把超漲段當成新的安全追價區。`
    : longSignal
      ? `綜合來看，外資在買權端仍保留明顯企圖，期貨空單較應解讀為避險節奏而非全面翻空，因此 Desk View 維持偏多；實務上較適合等拉回承接，而不是在情緒最熱時追價。`
      : tone === "bear"
        ? `綜合來看，當前籌碼尚未形成明顯逆勢多方共振，若現貨、期貨與選擇權同步轉弱，Desk View 會先以偏空或保守中性處理；操作上應優先看節奏與風險，而非單靠單一數值下注。`
        : `綜合來看，目前更像多空交錯、需要持續追蹤結算後籌碼延續性的階段，Desk View 先以 ${toneLabel} 定位；後續若外資 BC 槓桿、自營買權熱度與散戶追價同時升溫，則要同步評估超漲後的回測風險。`;

  const body = buildDeskViewBody([
    tapeView,
    historyContextView,
    futuresView,
    optionsView,
    dealerRetailView,
    retailView,
    overheatView,
    validationView,
    conclusionView,
  ]);
  const blocks = [
    {
      label: "盤面主軸",
      text: tapeView,
    },
    {
      label: "歷史定位",
      text: historyContextView,
    },
    {
      label: "外資期貨",
      text: futuresView,
    },
    {
      label: "選擇權槓桿",
      text: buildDeskViewBody([optionsView, overheatView]),
    },
    {
      label: "自營與散戶",
      text: buildDeskViewBody([dealerRetailView, retailView]),
    },
    {
      label: "驗證重點",
      text: validationView,
    },
    {
      label: "操作結論",
      text: conclusionView,
    },
  ];
  return {
    tone,
    toneLabel,
    body,
    blocks,
    flag: contrarianBullSignal
      ? "逆勢做多"
      : whipsawReclaimSignal
        ? "急跌回箱"
        : continuationPrepSignal
          ? "整理待發"
          : consolidationBiasSignal && !longSignal
            ? "高檔整理"
            : longSignal
              ? "多方異常"
              : "",
  };
}

function renderStrategy(report, historyReports = []) {
  const strategy = buildStrategyView(report, historyReports);
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
  els.strategyBody.innerHTML = renderStrategyBlocks(strategy.blocks ?? [{ label: "Desk View", text: strategy.body }], strategy.tone);
}

function buildCard(card) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  if (card.alert) node.classList.add("card-alert");
  const numeric = numericValue(card.value);
  if (card.alert) {
    node.classList.add("card-risk");
  } else if (numeric !== null) {
    if (numeric > 0) node.classList.add("card-bull");
    if (numeric < 0) node.classList.add("card-bear");
  }
  const badge = node.querySelector(".card-alert-badge");
  if (card.alertLabel) {
    badge.hidden = false;
    badge.textContent = card.alertLabel;
  }
  node.querySelector(".card-label").textContent = card.label ?? "";
  node.querySelector(".card-value").textContent = renderValue(card.value, card.numFmt ?? "");
  node.querySelector(".card-note").textContent = card.note ?? "";
  return node;
}

function buildSection(section) {
  const node = els.sectionTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("h3").textContent = section.title ?? "";
  const grid = node.querySelector(".card-grid");
  for (const card of section.cards ?? []) {
    grid.appendChild(buildCard(card));
  }
  return node;
}

function renderSections(container, sections) {
  container.replaceChildren();
  for (const section of sections ?? []) {
    container.appendChild(buildSection(section));
  }
}

function renderHistory(index) {
  els.historyList.replaceChildren();
  for (const report of index.reports ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    if (report.date === state.currentDate) button.classList.add("is-active");
    button.innerHTML = `
      <span class="history-date">${report.date}</span>
      <span>${report.title ?? ""}</span>
    `;
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

async function loadHistoryReports(date, limit = 5) {
  const dates = (state.index?.reports ?? []).map((item) => item.date);
  const start = dates.indexOf(date);
  if (start === -1) return [];
  const slice = dates.slice(start, start + limit);
  return Promise.all(slice.map((itemDate) => fetchReport(itemDate)));
}

async function loadIndex() {
  state.index = await fetchJson("./data/reports/index.json");
  const dateFromQuery = new URLSearchParams(window.location.search).get("date");
  state.currentDate = dateFromQuery || state.index.latestDate;
  renderStatus(state.index, state.currentDate);
  renderHistory(state.index);
  if (state.currentDate) await loadReport(state.currentDate, false);
}

async function loadReport(date, updateQuery = true) {
  const report = await fetchReport(date);
  const historyReports = await loadHistoryReports(date, 5);
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

  renderStrategy(report, historyReports);
  renderSections(els.dashboardSections, report.dashboard.sections);
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
    });
  });
}

els.refreshButton.addEventListener("click", async () => {
  await loadIndex();
});

bindTabs();
loadIndex().catch((error) => {
  els.heroTitle.textContent = "資料載入失敗";
  els.heroSubtitle.textContent = error.message;
});
