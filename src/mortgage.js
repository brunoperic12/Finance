/**
 * Mortgage screener model.
 *
 * Rates start from the Freddie Mac Primary Mortgage Market Survey for
 * November 12, 2026 and then move for credit, loan-to-value, occupancy,
 * debt-to-income, jumbo size, and program. The adjustments are a sketch
 * for screening, not a lender rate sheet.
 */

export const BENCHMARK = {
  asOf: "November 12, 2026",
  source: "Freddie Mac Primary Mortgage Market Survey",
  sourceUrl: "https://www.freddiemac.com/pmms",
  year15: 6.45,
  year30: 7.11,
};

/** Baseline 1-unit conforming loan limit for 2026. */
export const CONFORMING_LIMIT = 832_750;

export const GUIDELINES = {
  housingComfort: 0.28,
  housingStretch: 0.36,
  dti: {
    conventional: { preferred: 0.43, max: 0.5 },
    fha: { preferred: 0.43, max: 0.569 },
    va: { preferred: 0.41, max: 0.6 },
    usda: { preferred: 0.41, max: 0.5 },
  },
};

/** Rounded statewide effective property-tax rates for a starting estimate. */
export const STATE_TAX_RATES = [
  { code: "US", name: "U.S. typical", rate: 0.011 },
  { code: "AL", name: "Alabama", rate: 0.004 },
  { code: "AK", name: "Alaska", rate: 0.0104 },
  { code: "AZ", name: "Arizona", rate: 0.0062 },
  { code: "AR", name: "Arkansas", rate: 0.0064 },
  { code: "CA", name: "California", rate: 0.0075 },
  { code: "CO", name: "Colorado", rate: 0.0055 },
  { code: "CT", name: "Connecticut", rate: 0.0196 },
  { code: "DE", name: "Delaware", rate: 0.0057 },
  { code: "DC", name: "District of Columbia", rate: 0.0062 },
  { code: "FL", name: "Florida", rate: 0.0089 },
  { code: "GA", name: "Georgia", rate: 0.0092 },
  { code: "HI", name: "Hawaii", rate: 0.0032 },
  { code: "ID", name: "Idaho", rate: 0.0067 },
  { code: "IL", name: "Illinois", rate: 0.0208 },
  { code: "IN", name: "Indiana", rate: 0.0085 },
  { code: "IA", name: "Iowa", rate: 0.0152 },
  { code: "KS", name: "Kansas", rate: 0.0134 },
  { code: "KY", name: "Kentucky", rate: 0.0083 },
  { code: "LA", name: "Louisiana", rate: 0.0055 },
  { code: "ME", name: "Maine", rate: 0.0124 },
  { code: "MD", name: "Maryland", rate: 0.0105 },
  { code: "MA", name: "Massachusetts", rate: 0.0114 },
  { code: "MI", name: "Michigan", rate: 0.0138 },
  { code: "MN", name: "Minnesota", rate: 0.0111 },
  { code: "MS", name: "Mississippi", rate: 0.0065 },
  { code: "MO", name: "Missouri", rate: 0.0099 },
  { code: "MT", name: "Montana", rate: 0.0074 },
  { code: "NE", name: "Nebraska", rate: 0.0163 },
  { code: "NV", name: "Nevada", rate: 0.0055 },
  { code: "NH", name: "New Hampshire", rate: 0.0193 },
  { code: "NJ", name: "New Jersey", rate: 0.0223 },
  { code: "NM", name: "New Mexico", rate: 0.008 },
  { code: "NY", name: "New York", rate: 0.0154 },
  { code: "NC", name: "North Carolina", rate: 0.0082 },
  { code: "ND", name: "North Dakota", rate: 0.0098 },
  { code: "OH", name: "Ohio", rate: 0.0159 },
  { code: "OK", name: "Oklahoma", rate: 0.009 },
  { code: "OR", name: "Oregon", rate: 0.009 },
  { code: "PA", name: "Pennsylvania", rate: 0.0149 },
  { code: "RI", name: "Rhode Island", rate: 0.014 },
  { code: "SC", name: "South Carolina", rate: 0.0057 },
  { code: "SD", name: "South Dakota", rate: 0.0117 },
  { code: "TN", name: "Tennessee", rate: 0.0067 },
  { code: "TX", name: "Texas", rate: 0.0168 },
  { code: "UT", name: "Utah", rate: 0.0057 },
  { code: "VT", name: "Vermont", rate: 0.0183 },
  { code: "VA", name: "Virginia", rate: 0.0082 },
  { code: "WA", name: "Washington", rate: 0.0087 },
  { code: "WV", name: "West Virginia", rate: 0.0057 },
  { code: "WI", name: "Wisconsin", rate: 0.0161 },
  { code: "WY", name: "Wyoming", rate: 0.0061 },
];

const PROGRAMS = ["conventional", "fha", "va", "usda"];
const OCCUPANCIES = ["primary", "second", "investment"];
const VA_USES = ["first", "subsequent", "exempt"];

export const DEFAULTS = {
  creditScore: 740,
  annualIncome: 0,
  monthlyDebts: 0,
  purchasePrice: 0,
  downPayment: 0,
  termYears: 30,
  program: "conventional",
  occupancy: "primary",
  propertyTaxRate: 0.011,
  annualInsurance: 0,
  monthlyHoa: 0,
  vaUse: "first",
  financeUpfrontFee: true,
  customRate: null,
  closingCostRate: 0.025,
  cashLeftAfterClosing: null,
  extraMonthlyPayment: 0,
  appreciationRate: 0.03,
  sellingCostRate: 0.06,
};

export function roundCents(value) {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-8)) / 100;
}

function toCents(amount) {
  return Math.round(amount * 100);
}

export function monthlyPrincipalAndInterest(principal, annualRatePercent, termYears) {
  const months = Math.round(termYears * 12);
  if (!(principal > 0) || months <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const growth = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * growth) / (growth - 1);
}

/** Survey rate in basis points. 711 = 7.11%. */
export function benchmarkRateBp(termYears) {
  const year15 = 645;
  const year30 = 711;
  if (termYears >= 30) return year30;
  if (termYears <= 15) return year15 - Math.round((15 - termYears) * 4);
  return year15 + Math.round(((year30 - year15) * (termYears - 15)) / 15);
}

function bpToPercent(bp) {
  return Number((bp / 100).toFixed(2));
}

export function benchmarkRate(termYears) {
  return bpToPercent(benchmarkRateBp(termYears));
}

function creditRateBp(program, score) {
  if (program === "conventional") {
    if (score >= 760) return -10;
    if (score >= 740) return 0;
    if (score >= 720) return 15;
    if (score >= 700) return 30;
    if (score >= 680) return 50;
    if (score >= 660) return 75;
    if (score >= 640) return 100;
    if (score >= 620) return 140;
    if (score >= 580) return 190;
    return 240;
  }
  if (score >= 760) return -10;
  if (score >= 740) return 0;
  if (score >= 720) return 10;
  if (score >= 680) return 20;
  if (score >= 640) return 40;
  if (score >= 620) return 60;
  if (score >= 580) return 90;
  if (score >= 500) return 125;
  return 180;
}

function ltvRateBp(program, ltvBp) {
  if (program !== "conventional") return 0;
  if (ltvBp <= 6000) return -15;
  if (ltvBp <= 7000) return -10;
  if (ltvBp <= 7500) return -5;
  if (ltvBp <= 8000) return 0;
  if (ltvBp <= 8500) return 15;
  if (ltvBp <= 9000) return 30;
  if (ltvBp <= 9500) return 45;
  return 60;
}

function occupancyRateBp(program, occupancy) {
  if (program !== "conventional") return 0;
  if (occupancy === "second") return 35;
  if (occupancy === "investment") return 65;
  return 0;
}

function dtiRateBp(program, backEnd) {
  if (!Number.isFinite(backEnd)) return 0;
  if (program === "conventional") {
    if (backEnd > 0.5) return 25;
    if (backEnd > 0.43) return 10;
    return 0;
  }
  if (backEnd > 0.5) return 15;
  if (backEnd > 0.43) return 5;
  return 0;
}

function programRateBp(program) {
  if (program === "fha" || program === "usda") return -15;
  if (program === "va") return -35;
  return 0;
}

/**
 * Annual PMI percent (0.46 means 0.46%) from a 2026 borrower-paid monthly
 * grid for fixed-rate terms over 20 years. Zero at or below 80% LTV.
 */
export function conventionalPmiPercent(creditScore, ltv) {
  const ltvBp = Math.round(ltv * 10_000);
  return bpToPercent(pmiHundredths(ltvBp, creditScore));
}

function pmiHundredths(ltvBp, score) {
  if (ltvBp <= 8000) return 0;
  const bands =
    ltvBp <= 8500
      ? [19, 20, 23, 25, 28, 38, 40, 44]
      : ltvBp <= 9000
        ? [28, 38, 46, 55, 65, 90, 91, 94]
        : ltvBp <= 9500
          ? [38, 53, 66, 78, 96, 128, 133, 142]
          : [58, 70, 87, 99, 121, 154, 165, 186];
  const index =
    score >= 760 ? 0 : score >= 740 ? 1 : score >= 720 ? 2 : score >= 700 ? 3 : score >= 680 ? 4 : score >= 660 ? 5 : score >= 640 ? 6 : 7;
  return bands[index];
}

export function vaFundingFeePercent(downPaymentPercent, vaUse) {
  if (vaUse === "exempt") return 0;
  if (downPaymentPercent >= 0.1) return 1.25;
  if (downPaymentPercent >= 0.05) return 1.5;
  return vaUse === "subsequent" ? 3.3 : 2.15;
}

function vaFundingFeeBp(downCents, priceCents, vaUse) {
  if (vaUse === "exempt" || priceCents <= 0) return 0;
  const downBp = Math.round((downCents * 10_000) / priceCents);
  if (downBp >= 1000) return 125;
  if (downBp >= 500) return 150;
  return vaUse === "subsequent" ? 330 : 215;
}

/**
 * FHA annual MIP. `annualPercent` of 0.55 means 0.55% of the base loan.
 * The higher tier applies when the base loan exceeds the conforming limit.
 */
export function fhaMipQuote(baseLoan, ltv, termYears) {
  const quote = fhaMipFromCents(toCents(baseLoan), Math.round(ltv * 10_000), termYears);
  return {
    annualPercent: bpToPercent(quote.hundredths),
    duration: quote.duration,
    upfrontPercent: 1.75,
  };
}

function fhaMipFromCents(baseCents, ltvBp, termYears) {
  const high = baseCents > CONFORMING_LIMIT * 100;
  const long = termYears > 15;
  let hundredths;
  let duration;
  if (long && !high) {
    if (ltvBp <= 9000) {
      hundredths = 50;
      duration = "11-years";
    } else if (ltvBp <= 9500) {
      hundredths = 50;
      duration = "life";
    } else {
      hundredths = 55;
      duration = "life";
    }
  } else if (long && high) {
    if (ltvBp <= 9000) {
      hundredths = 70;
      duration = "11-years";
    } else if (ltvBp <= 9500) {
      hundredths = 70;
      duration = "life";
    } else {
      hundredths = 75;
      duration = "life";
    }
  } else if (!high) {
    if (ltvBp <= 9000) {
      hundredths = 15;
      duration = "11-years";
    } else {
      hundredths = 40;
      duration = "life";
    }
  } else if (ltvBp <= 7800) {
    hundredths = 15;
    duration = "11-years";
  } else if (ltvBp <= 9000) {
    hundredths = 40;
    duration = "11-years";
  } else {
    hundredths = 65;
    duration = "life";
  }
  return { hundredths, duration };
}

function monthlyPremiumCents(baseCents, hundredths) {
  if (hundredths <= 0 || baseCents <= 0) return 0;
  const annualCents = Math.round((baseCents * hundredths) / 10_000);
  return Math.round(annualCents / 12);
}

function forEachMonth(loan, annualRatePercent, termYears, visit) {
  const months = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = annualRatePercent / 100 / 12;
  const payment = monthlyPrincipalAndInterest(loan, annualRatePercent, termYears);
  let balance = loan;
  for (let month = 1; month <= months && balance > 0.004; month += 1) {
    const interest = balance * monthlyRate;
    let principal = payment - interest;
    if (month === months || principal >= balance - 0.004) principal = balance;
    if (principal < 0) principal = 0;
    balance = Math.max(0, balance - principal);
    const stop = visit({ month, interest, principal, balance });
    if (stop) return;
  }
}

function buildSchedule(loan, annualRatePercent, termYears, price) {
  const years = [];
  let yearInterest = 0;
  let yearPrincipal = 0;
  let year = 1;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let cancelMonth = null;
  const target = price * 0.8;
  if (!(loan > 0)) {
    return { years, totalInterest: 0, totalPrincipal: 0, cancelMonth: null, firstMonth: { interest: 0, principal: 0 } };
  }
  let firstMonth = null;
  forEachMonth(loan, annualRatePercent, termYears, ({ month, interest, principal, balance }) => {
    if (!firstMonth) firstMonth = { interest: roundCents(interest), principal: roundCents(principal) };
    yearInterest += interest;
    yearPrincipal += principal;
    totalInterest += interest;
    totalPrincipal += principal;
    if (cancelMonth == null && balance <= target + 0.01) cancelMonth = month;
    if (month % 12 === 0 || balance <= 0.01) {
      years.push({
        year,
        interest: roundCents(yearInterest),
        principal: roundCents(yearPrincipal),
        balance: roundCents(balance),
      });
      year += 1;
      yearInterest = 0;
      yearPrincipal = 0;
    }
  });
  return {
    years,
    totalInterest: roundCents(totalInterest),
    totalPrincipal: roundCents(totalPrincipal),
    cancelMonth,
    firstMonth: firstMonth ?? { interest: 0, principal: 0 },
  };
}

/**
 * Equity if the home were sold. Extra principal shortens the loan.
 * Break-even is the first month sale proceeds cover the down payment,
 * buyer closing costs, and any extra principal paid by then.
 */
function projectEquity({
  loanAmount,
  annualRatePercent,
  termYears,
  price,
  extraMonthly,
  appreciationRate,
  sellingCostRate,
  cashInvested,
  scheduledInterest,
}) {
  const termMonths = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = annualRatePercent / 100 / 12;
  const scheduledPayment = monthlyPrincipalAndInterest(loanAmount, annualRatePercent, termYears);
  const extra = Math.max(0, extraMonthly);
  let balance = loanAmount;
  let totalInterest = 0;
  let totalExtra = 0;
  let payoffMonth = loanAmount > 0.004 ? null : 0;
  let positiveMonth = null;
  let breakEvenMonth = null;
  let breakEvenEquity = null;
  let principalLeadMonth = null;
  const points = [];
  const seen = new Set();

  function snapshot(month) {
    const value = price * (1 + appreciationRate) ** (month / 12);
    const saleEquity = value * (1 - sellingCostRate) - balance;
    const cashOut = cashInvested + totalExtra;
    if (positiveMonth == null && saleEquity >= -0.005) positiveMonth = month;
    if (breakEvenMonth == null && saleEquity + 0.005 >= cashOut) {
      breakEvenMonth = month;
      breakEvenEquity = saleEquity;
    }
    if (!seen.has(month)) {
      seen.add(month);
      points.push({
        month,
        year: month / 12,
        value: roundCents(value),
        balance: roundCents(Math.max(0, balance)),
        saleEquity: roundCents(saleEquity),
        cashOut: roundCents(cashOut),
      });
    }
  }

  snapshot(0);
  for (let month = 1; month <= termMonths; month += 1) {
    if (balance > 0.004) {
      const interest = balance * monthlyRate;
      const scheduledPrincipal = Math.max(0, scheduledPayment - interest);
      let principal = scheduledPrincipal + extra;
      if (principal > balance) principal = balance;
      if (principalLeadMonth == null && principal > interest + 0.005) principalLeadMonth = month;
      totalExtra += Math.max(0, principal - Math.min(scheduledPrincipal, balance));
      balance = Math.max(0, balance - principal);
      totalInterest += interest;
      if (payoffMonth == null && balance <= 0.01) payoffMonth = month;
    }
    snapshot(month);
  }

  return {
    extraMonthly: roundCents(extra),
    appreciationRate,
    sellingCostRate,
    cashInvested: roundCents(cashInvested),
    payoffMonth,
    contractualMonths: termMonths,
    interest: roundCents(totalInterest),
    interestSaved: roundCents(Math.max(0, scheduledInterest - totalInterest)),
    positiveMonth,
    breakEvenMonth,
    breakEvenEquity: breakEvenEquity == null ? null : roundCents(breakEvenEquity),
    principalLeadMonth,
    points,
  };
}

function money(amount, cents = false) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

function formatPct(fraction) {
  const rounded = Math.round(fraction * 1000) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function programName(program) {
  if (program === "fha") return "FHA";
  if (program === "va") return "VA";
  if (program === "usda") return "USDA";
  return "Conventional";
}

function benchmarkLabel(termYears) {
  if (termYears === 30) return "Freddie Mac 30-year average";
  if (termYears === 15) return "Freddie Mac 15-year average";
  if (termYears === 10) return "10-year, 0.20 points under the 15-year average";
  if (termYears === 20) return "20-year, between the 15- and 30-year averages";
  if (termYears < 15) return `${termYears}-year, stepped down from the 15-year average`;
  if (termYears > 30) return `${termYears}-year, using the 30-year average`;
  return `${termYears}-year, between the 15- and 30-year averages`;
}

function durationLabel(kind, duration, cancelMonth) {
  if (kind === "none") return "Not required at this down payment";
  if (duration === "11-years") return "Drops off after 11 years";
  if (duration === "life") return "Lasts for the life of the loan";
  if (cancelMonth == null) return "Until the balance reaches about 80% of the price";
  const years = Math.floor(cancelMonth / 12);
  const months = cancelMonth % 12;
  const when = years > 0 ? `about ${years} yr ${months} mo` : `about ${months} months`;
  return `Scheduled to reach 80% of the price in month ${cancelMonth} (${when})`;
}

function creditBandLabel(score) {
  if (score < 580) return "Below most mortgage minimums";
  if (score < 620) return "FHA range for many lenders";
  if (score < 660) return "Meets common minimums";
  if (score < 700) return "Fair pricing tier";
  if (score < 740) return "Solid pricing tier";
  if (score < 780) return "Strong pricing tier";
  return "Excellent pricing tier";
}

export function creditBand(score) {
  return creditBandLabel(score);
}

function minDownFraction(program, occupancy, creditScore) {
  if (program === "fha") return creditScore >= 580 ? 0.035 : 0.1;
  if (program === "va" || program === "usda") return 0;
  if (occupancy === "investment") return 0.15;
  if (occupancy === "second") return 0.1;
  return 0.03;
}

function screenProfile(ctx) {
  const hard = [];
  const stretch = [];
  const good = [];
  const notes = [];
  const {
    program,
    occupancy,
    creditScore,
    downCents,
    priceCents,
    downPct,
    ltvBp,
    jumbo,
    baseLoan,
    ratios,
    cashLeft,
    monthlyTotal,
    mi,
  } = ctx;
  const name = programName(program);
  const rules = GUIDELINES.dti[program];
  const incomeKnown = ratios != null;

  if (["fha", "va", "usda"].includes(program) && occupancy !== "primary") {
    hard.push(`${name} loans in this screener are for a primary residence.`);
  }

  if (program === "conventional" && creditScore < 620) {
    hard.push(`A ${creditScore} score is below the 620 minimum many conventional lenders use.`);
  } else if (program === "fha" && creditScore < 500) {
    hard.push("FHA loans in this screener need a credit score of at least 500.");
  } else if (program === "fha" && creditScore < 580 && downPct + 1e-8 < 0.1) {
    hard.push("FHA needs a 580 score for 3.5% down. At this score the usual path is 10% down.");
  } else if (program === "fha" && creditScore < 580) {
    stretch.push("Scores under 580 can use FHA with 10% down. Many lenders still ask for 580 or 620.");
  } else if (program === "fha" && creditScore < 620) {
    stretch.push(`${creditScore} meets the FHA 580 minimum. A lot of lenders still look for 620.`);
  } else if (program === "va" && creditScore < 580) {
    hard.push("Most VA lenders want at least a 580 score, and 620 is a common overlay.");
  } else if (program === "va" && creditScore < 620) {
    stretch.push(`${creditScore} can be approved on VA, though 620 is a common lender overlay.`);
  } else if (program === "usda" && creditScore < 640) {
    hard.push("USDA loans in this screener use a 640 credit minimum.");
  }

  const requiredDown = Math.round(priceCents * minDownFraction(program, occupancy, creditScore));
  if (baseLoan > 0 && downCents < requiredDown) {
    const minPct = requiredDown / priceCents;
    hard.push(`Down payment is ${formatPct(downPct)}. ${name} usually wants at least ${formatPct(minPct)} for this profile.`);
  }

  if (program === "conventional" && occupancy === "primary" && downCents >= requiredDown && downPct < 0.05 && !jumbo) {
    stretch.push("Down payments under 5% usually need a program such as HomeReady or Home Possible.");
  }
  if (program === "conventional" && occupancy === "investment" && downCents >= requiredDown && downPct < 0.2) {
    stretch.push("Many lenders want 20% down on an investment property.");
  }

  if (jumbo && program === "conventional") {
    notes.push(
      `The loan is above the 2026 baseline conforming limit of ${money(CONFORMING_LIMIT)}. High-cost counties go higher. Elsewhere this is a jumbo loan.`,
    );
    if (creditScore < 700) hard.push("Jumbo loans in this screener need a credit score of at least 700.");
    else if (creditScore < 720) stretch.push("Jumbo pricing is stronger at a 720 score or above.");
    if (downCents < Math.round(priceCents * 0.1)) hard.push("Jumbo loans in this screener need at least 10% down.");
    else if (downPct < 0.2) stretch.push("Jumbo loans are more widely available at 20% down.");
  }

  if (!incomeKnown && baseLoan > 0) {
    notes.push("Add gross income to judge debt-to-income.");
  } else if (incomeKnown) {
    const { backEnd, housing } = ratios;
    if (backEnd > rules.max) {
      hard.push(`Back-end debt-to-income is ${formatPct(backEnd)}. The ceiling used here for ${name} is ${formatPct(rules.max)}.`);
    } else if (backEnd > rules.preferred) {
      stretch.push(`Back-end debt-to-income is ${formatPct(backEnd)}. ${name} files are stronger at ${formatPct(rules.preferred)} or below.`);
    } else {
      good.push(`Back-end debt-to-income is ${formatPct(backEnd)}, inside the ${formatPct(rules.preferred)} line for ${name}.`);
    }
    if (housing > GUIDELINES.housingStretch) {
      stretch.push(`Housing alone is ${formatPct(housing)} of gross income. A common comfort line is ${formatPct(GUIDELINES.housingStretch)}.`);
    }
  }

  if (cashLeft != null && monthlyTotal > 0) {
    const months = cashLeft / monthlyTotal;
    const target = jumbo || occupancy !== "primary" ? 6 : 2;
    const shown = Math.round(months * 10) / 10;
    if (months + 0.05 < target) {
      stretch.push(`Cash left after closing covers about ${shown} months of the payment. ${target} months is a common reserve target here.`);
    } else {
      good.push(`Cash left after closing covers about ${shown} months of the payment.`);
    }
  }

  if (program === "conventional" && !jumbo && baseLoan > 0 && baseLoan <= CONFORMING_LIMIT) {
    good.push(`The loan is within the ${money(CONFORMING_LIMIT)} baseline conforming limit.`);
  }
  if (program === "conventional" && ltvBp <= 8000 && baseLoan > 0) {
    good.unshift("20% or more down removes private mortgage insurance.");
  }
  if (creditScore >= 740 && hard.length === 0) {
    good.push(`A ${creditScore} score sits in a strong pricing tier.`);
  }

  if (program === "va") {
    notes.push("VA pricing assumes a valid entitlement. Underwriters also test residual income, which this screener does not compute.");
  }
  if (program === "usda") {
    notes.push("USDA also requires a rural-eligible property and a household income within the area limit. Neither is checked here.");
  }
  if (program === "fha" && baseLoan > CONFORMING_LIMIT) {
    notes.push("This base loan is above the national conforming limit. The county FHA limit still has to allow it. The higher mortgage-insurance tier is included.");
  }
  if (program === "va" && baseLoan > CONFORMING_LIMIT) {
    notes.push("Above typical county limits, VA may require a down payment once entitlement is used up.");
  }
  if (program === "usda" && baseLoan > CONFORMING_LIMIT) {
    stretch.push("This amount is above many USDA area loan limits.");
  }
  if (mi.kind === "pmi" && ctx.termYears <= 20) {
    notes.push("This PMI figure uses the over-20-year rate card. A shorter term often costs less.");
  }
  if (mi.kind === "pmi" && occupancy !== "primary") {
    notes.push("Insurers often add a surcharge for this occupancy that is not in the base grid.");
  }

  let status = "likely";
  if (hard.length) status = "unlikely";
  else if (stretch.length) status = "possible";
  else if (!incomeKnown && baseLoan > 0) status = "incomplete";

  const titles = {
    likely: "Likely to qualify",
    possible: "Possible, with a stretch",
    unlikely: "Unlikely on these guidelines",
    incomplete: "Payment ready",
  };
  let summary;
  if (baseLoan <= 0) summary = "There is no mortgage. The monthly number is tax, insurance, and HOA.";
  else if (status === "unlikely") summary = hard[0];
  else if (status === "possible") summary = stretch[0];
  else if (status === "incomplete") summary = "Add gross income to judge debt-to-income.";
  else summary = `Credit, down payment, and debt-to-income sit inside common ${name} guidelines.`;

  const reasons = [
    ...hard.map((text) => ({ tone: "bad", text })),
    ...stretch.map((text) => ({ tone: "warn", text })),
    ...(hard.length ? [] : good.slice(0, 2).map((text) => ({ tone: "good", text }))),
    ...notes.map((text) => ({ tone: "info", text })),
  ];

  return { status, title: titles[status], summary, reasons };
}

function buildInsights(ctx) {
  const insights = [];
  const { program, priceCents, downCents, ltvBp, creditScore, miMonthly, baseLoan } = ctx;
  if (program === "conventional" && ltvBp > 8000 && baseLoan > 0) {
    const target = Math.round(priceCents * 0.2);
    const gapCents = target - downCents;
    if (gapCents > 0) {
      insights.push({
        id: "pmi-gap",
        text: `${money(gapCents / 100)} more down would reach 20% and remove about ${money(miMonthly, true)} a month of private mortgage insurance.`,
      });
    }
  }
  const boundaries = program === "conventional" ? [580, 620, 640, 660, 680, 700, 720, 740, 760] : [500, 580, 620, 640, 680, 720, 740, 760];
  const next = boundaries.find((boundary) => boundary > creditScore);
  if (next && next - creditScore <= 15 && baseLoan > 0) {
    const delta = creditRateBp(program, creditScore) - creditRateBp(program, next);
    if (delta >= 5) {
      insights.push({
        id: "credit-tier",
        text: `A credit score of ${next} would lower the modeled rate by ${(delta / 100).toFixed(2)} percentage points.`,
      });
    }
  }
  return insights;
}

function modelRate(input, backEnd, ltvBp, baseLoan) {
  const rows = [{ id: "benchmark", label: benchmarkLabel(input.termYears), bp: benchmarkRateBp(input.termYears), kind: "base" }];
  const credit = creditRateBp(input.program, input.creditScore);
  if (credit !== 0) rows.push({ id: "credit", label: `Credit score ${input.creditScore}`, bp: credit, kind: "adjust" });
  const ltv = ltvRateBp(input.program, ltvBp);
  if (ltv !== 0) rows.push({ id: "ltv", label: `${formatPct(ltvBp / 10_000)} loan-to-value`, bp: ltv, kind: "adjust" });
  const occupancy = occupancyRateBp(input.program, input.occupancy);
  if (occupancy !== 0) {
    const label = input.occupancy === "second" ? "Second home" : "Investment property";
    rows.push({ id: "occupancy", label, bp: occupancy, kind: "adjust" });
  }
  const dti = dtiRateBp(input.program, backEnd);
  if (dti !== 0) rows.push({ id: "dti", label: `Debt-to-income ${formatPct(backEnd)}`, bp: dti, kind: "adjust" });
  const jumbo = input.program === "conventional" && baseLoan > CONFORMING_LIMIT ? 40 : 0;
  if (jumbo !== 0) rows.push({ id: "jumbo", label: "Above the conforming limit", bp: jumbo, kind: "adjust" });
  const program = programRateBp(input.program);
  if (program !== 0) rows.push({ id: "program", label: `${programName(input.program)} program`, bp: program, kind: "adjust" });
  const modelRateBp = rows.reduce((sum, row) => sum + row.bp, 0);
  return { rows, modelRateBp };
}

function housingCents(parts) {
  return parts.pi + parts.mi + parts.tax + parts.insurance + parts.hoa;
}

/**
 * Full screening estimate. `customRate` is an annual percent the user typed.
 * Returns `{ ok: false, errors }` when the inputs cannot be priced.
 */
export function estimateScenario(raw = {}) {
  const input = { ...DEFAULTS, ...raw };
  const errors = [];
  const price = Number(input.purchasePrice);
  const down = Number(input.downPayment);
  const termYears = Number(input.termYears);
  const creditScore = Number(input.creditScore);
  const annualIncome = Number(input.annualIncome);
  const monthlyDebts = Number(input.monthlyDebts);
  const taxRate = Number(input.propertyTaxRate);
  const annualInsurance = Number(input.annualInsurance);
  const monthlyHoa = Number(input.monthlyHoa);
  const closingCostRate = Number(input.closingCostRate);
  const extraMonthlyPayment = Number(input.extraMonthlyPayment);
  const appreciationRate = Number(input.appreciationRate);
  const sellingCostRate = Number(input.sellingCostRate);

  if (!(price > 0)) errors.push("Enter a purchase price.");
  else if (price > 100_000_000) errors.push("Enter a purchase price under $100 million.");
  if (!(down >= 0)) errors.push("Down payment cannot be negative.");
  else if (price > 0 && down > price + 0.001) errors.push("Down payment is larger than the purchase price.");
  if (!(termYears >= 1 && termYears <= 40)) errors.push("Use a term from 1 to 40 years.");
  if (!(creditScore >= 300 && creditScore <= 850)) errors.push("Credit score needs to be from 300 to 850.");
  if (!(annualIncome >= 0)) errors.push("Income cannot be negative.");
  if (!(monthlyDebts >= 0)) errors.push("Monthly debts cannot be negative.");
  if (!(taxRate >= 0 && taxRate <= 0.05)) errors.push("Property tax rate needs to be between 0% and 5%.");
  if (!(annualInsurance >= 0)) errors.push("Insurance cannot be negative.");
  if (!(monthlyHoa >= 0)) errors.push("HOA dues cannot be negative.");
  if (!(closingCostRate >= 0 && closingCostRate <= 0.15)) errors.push("Closing-cost estimate needs to be between 0% and 15%.");
  if (!PROGRAMS.includes(input.program)) errors.push("Choose a loan program.");
  if (!OCCUPANCIES.includes(input.occupancy)) errors.push("Choose how the home will be used.");
  if (!VA_USES.includes(input.vaUse)) errors.push("Choose a VA funding-fee status.");
  if (input.cashLeftAfterClosing != null && !(Number(input.cashLeftAfterClosing) >= 0)) {
    errors.push("Cash left after closing cannot be negative.");
  }
  if (input.customRate != null) {
    const custom = Number(input.customRate);
    if (!(custom >= 0 && custom <= 25)) errors.push("A typed rate needs to be between 0% and 25%.");
  }
  if (!(extraMonthlyPayment >= 0 && extraMonthlyPayment <= 1_000_000)) {
    errors.push("Extra principal needs to be between $0 and $1,000,000 a month.");
  }
  if (!(appreciationRate >= -0.1 && appreciationRate <= 0.15)) {
    errors.push("Home appreciation needs to be between -10% and 15% a year.");
  }
  if (!(sellingCostRate >= 0 && sellingCostRate <= 0.15)) {
    errors.push("Selling costs need to be between 0% and 15%.");
  }
  if (errors.length) return { ok: false, errors };

  const priceCents = toCents(price);
  const downCents = Math.min(priceCents, toCents(down));
  const baseCents = priceCents - downCents;
  const ltvBp = priceCents > 0 ? Math.round((baseCents * 10_000) / priceCents) : 0;
  const downPct = priceCents > 0 ? downCents / priceCents : 0;
  const baseLoan = baseCents / 100;
  const jumbo = input.program === "conventional" && baseLoan > CONFORMING_LIMIT;

  const taxBp = Math.round(taxRate * 10_000);
  const annualTaxCents = Math.round((priceCents * taxBp) / 10_000);
  const taxMonthlyCents = Math.round(annualTaxCents / 12);
  const insuranceMonthlyCents = Math.round(toCents(annualInsurance) / 12);
  const hoaCents = toCents(monthlyHoa);
  const debtCents = toCents(monthlyDebts);
  const monthlyIncomeCents = Math.round(toCents(annualIncome) / 12);

  let upfrontBp = 0;
  let upfrontLabel = null;
  if (input.program === "fha") {
    upfrontBp = 175;
    upfrontLabel = "FHA upfront mortgage insurance";
  } else if (input.program === "va") {
    upfrontBp = vaFundingFeeBp(downCents, priceCents, input.vaUse);
    upfrontLabel = upfrontBp === 0 ? "VA funding fee exempt" : "VA funding fee";
  } else if (input.program === "usda") {
    upfrontBp = 100;
    upfrontLabel = "USDA upfront guarantee fee";
  }
  const upfrontCents = Math.round((baseCents * upfrontBp) / 10_000);
  const finance = input.financeUpfrontFee !== false && upfrontCents > 0;
  const loanCents = finance ? baseCents + upfrontCents : baseCents;
  const loanAmount = loanCents / 100;

  function miFor() {
    if (baseCents <= 0) {
      return { kind: "none", label: "No monthly mortgage insurance", hundredths: 0, duration: "none", cancelMonth: null };
    }
    if (input.program === "fha") {
      const quote = fhaMipFromCents(baseCents, ltvBp, termYears);
      return { kind: "fha", label: "FHA mortgage insurance", hundredths: quote.hundredths, duration: quote.duration, cancelMonth: null };
    }
    if (input.program === "usda") {
      return { kind: "usda", label: "USDA annual guarantee fee", hundredths: 35, duration: "life", cancelMonth: null };
    }
    if (input.program === "va") {
      return { kind: "none", label: "No monthly mortgage insurance", hundredths: 0, duration: "none", cancelMonth: null };
    }
    const hundredths = pmiHundredths(ltvBp, creditScore);
    return {
      kind: hundredths > 0 ? "pmi" : "none",
      label: hundredths > 0 ? "Private mortgage insurance" : "No monthly mortgage insurance",
      hundredths,
      duration: hundredths > 0 ? "pmi" : "none",
      cancelMonth: null,
    };
  }

  const miShape = miFor();

  function paymentAt(rate, cancelMonth) {
    const pi = toCents(roundCents(monthlyPrincipalAndInterest(loanAmount, rate, termYears)));
    const mi = monthlyPremiumCents(baseCents, miShape.hundredths);
    const parts = { pi, mi, tax: taxMonthlyCents, insurance: insuranceMonthlyCents, hoa: hoaCents };
    return { parts, total: housingCents(parts), cancelMonth };
  }

  let backEnd = annualIncome > 0 ? 0.36 : Number.NaN;
  let priced = modelRate(input, backEnd, ltvBp, baseLoan);
  let rate = input.customRate == null ? bpToPercent(priced.modelRateBp) : Number(input.customRate);
  let current = paymentAt(rate, null);

  if (annualIncome > 0) {
    for (let pass = 0; pass < 6; pass += 1) {
      const nextBackEnd = (current.total + debtCents) / monthlyIncomeCents;
      const nextPriced = modelRate(input, nextBackEnd, ltvBp, baseLoan);
      const nextRate = input.customRate == null ? bpToPercent(nextPriced.modelRateBp) : Number(input.customRate);
      const changed = nextPriced.modelRateBp !== priced.modelRateBp || Math.abs(nextBackEnd - backEnd) > 0.0005;
      backEnd = nextBackEnd;
      priced = nextPriced;
      rate = nextRate;
      current = paymentAt(rate, null);
      if (!changed) break;
    }
  }

  const schedule = buildSchedule(loanAmount, rate, termYears, price);
  if (miShape.kind === "pmi") miShape.cancelMonth = schedule.cancelMonth;

  const ratios =
    monthlyIncomeCents > 0
      ? {
          monthlyIncome: monthlyIncomeCents / 100,
          housing: current.total / monthlyIncomeCents,
          backEnd: (current.total + debtCents) / monthlyIncomeCents,
        }
      : null;

  const monthly = {
    principalAndInterest: current.parts.pi / 100,
    mortgageInsurance: current.parts.mi / 100,
    propertyTax: current.parts.tax / 100,
    homeownersInsurance: current.parts.insurance / 100,
    hoa: current.parts.hoa / 100,
    total: current.total / 100,
  };

  const prepaidsCents = (taxMonthlyCents + insuranceMonthlyCents) * 2;
  const closingCents = Math.round((baseCents * Math.round(closingCostRate * 10_000)) / 10_000);
  const upfrontCashCents = finance ? 0 : upfrontCents;
  const cash = {
    downPayment: downCents / 100,
    closingCosts: closingCents / 100,
    prepaids: prepaidsCents / 100,
    upfrontFee: upfrontCashCents / 100,
    total: (downCents + closingCents + prepaidsCents + upfrontCashCents) / 100,
  };

  const mi = {
    kind: miShape.kind,
    label: miShape.label,
    annualPercent: bpToPercent(miShape.hundredths),
    monthly: monthly.mortgageInsurance,
    duration: miShape.duration,
    durationLabel: durationLabel(miShape.kind, miShape.duration, miShape.cancelMonth),
    cancelMonth: miShape.cancelMonth,
  };

  const screening = screenProfile({
    program: input.program,
    occupancy: input.occupancy,
    creditScore,
    downCents,
    priceCents,
    downPct,
    ltvBp,
    jumbo,
    baseLoan,
    ratios,
    cashLeft: input.cashLeftAfterClosing == null ? null : Number(input.cashLeftAfterClosing),
    monthlyTotal: monthly.total,
    mi,
    termYears,
  });
  if (baseLoan <= 0) {
    screening.status = "likely";
    screening.title = "No loan";
    screening.summary = "There is no mortgage. The monthly number is tax, insurance, and HOA.";
    screening.reasons = [{ tone: "info", text: screening.summary }];
  }

  const lowBp = Math.max(0, priced.modelRateBp - 25);
  const highBp = priced.modelRateBp + 25;

  return {
    ok: true,
    errors: [],
    program: input.program,
    programLabel: programName(input.program),
    occupancy: input.occupancy,
    termYears,
    creditScore,
    purchasePrice: priceCents / 100,
    downPayment: downCents / 100,
    downPaymentPercent: downPct,
    baseLoan,
    loanAmount,
    ltv: ltvBp / 10_000,
    jumbo,
    conformingLimit: CONFORMING_LIMIT,
    hasLoan: loanAmount > 0,
    rate,
    rateIsCustom: input.customRate != null,
    modelRate: bpToPercent(priced.modelRateBp),
    modelRateBp: priced.modelRateBp,
    rateLow: bpToPercent(lowBp),
    rateHigh: bpToPercent(highBp),
    rateBuild: priced.rows,
    monthly,
    firstMonth: {
      interest: schedule.firstMonth.interest,
      principal: roundCents(monthly.principalAndInterest - schedule.firstMonth.interest),
    },
    mortgageInsurance: mi,
    upfrontFee: {
      label: upfrontLabel,
      percent: bpToPercent(upfrontBp),
      amount: upfrontCents / 100,
      financed: finance,
    },
    ratios,
    cashToClose: cash,
    totals: {
      interest: schedule.totalInterest,
      principal: schedule.totalPrincipal,
      months: Math.round(termYears * 12),
    },
    years: schedule.years,
    equity: loanAmount > 0
      ? projectEquity({
          loanAmount,
          annualRatePercent: rate,
          termYears,
          price: priceCents / 100,
          extraMonthly: extraMonthlyPayment,
          appreciationRate,
          sellingCostRate,
          cashInvested: (downCents + closingCents + upfrontCashCents) / 100,
          scheduledInterest: schedule.totalInterest,
        })
      : null,
    screening,
    insights: buildInsights({
      program: input.program,
      priceCents,
      downCents,
      ltvBp,
      creditScore,
      miMonthly: monthly.mortgageInsurance,
      baseLoan,
    }),
    benchmark: BENCHMARK,
    creditBand: creditBandLabel(creditScore),
  };
}
