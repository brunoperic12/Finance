import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BENCHMARK,
  CONFORMING_LIMIT,
  STATE_TAX_RATES,
  benchmarkRate,
  conventionalPmiPercent,
  estimateScenario,
  fhaMipQuote,
  monthlyPrincipalAndInterest,
  roundCents,
  vaFundingFeePercent,
} from "../src/mortgage.js";

const quiet = {
  annualIncome: 400_000,
  monthlyDebts: 0,
  propertyTaxRate: 0,
  annualInsurance: 0,
  monthlyHoa: 0,
  occupancy: "primary",
  financeUpfrontFee: true,
  cashLeftAfterClosing: null,
  customRate: null,
};

function dtiBp(program, dti) {
  if (!Number.isFinite(dti)) return 0;
  if (program === "conventional") {
    if (dti > 0.5) return 25;
    if (dti > 0.43) return 10;
    return 0;
  }
  if (dti > 0.5) return 15;
  if (dti > 0.43) return 5;
  return 0;
}

describe("payment math", () => {
  it("matches the standard 30-year payment", () => {
    const payment = monthlyPrincipalAndInterest(200_000, 6, 30);
    assert.ok(Math.abs(payment - 1199.101) < 0.001);
    assert.equal(roundCents(payment), 1199.1);
  });

  it("splits a zero-interest loan into equal principal", () => {
    assert.equal(monthlyPrincipalAndInterest(120_000, 0, 10), 1000);
  });

  it("returns zero when there is no loan", () => {
    assert.equal(monthlyPrincipalAndInterest(0, 6, 30), 0);
  });
});

describe("benchmark", () => {
  it("uses the November 12, 2026 survey anchors", () => {
    assert.equal(BENCHMARK.year30, 7.11);
    assert.equal(BENCHMARK.year15, 6.45);
    assert.equal(benchmarkRate(30), 7.11);
    assert.equal(benchmarkRate(15), 6.45);
    assert.equal(benchmarkRate(20), 6.67);
    assert.equal(benchmarkRate(10), 6.25);
  });
});

describe("mortgage insurance grids", () => {
  it("drops conventional PMI at 20% down", () => {
    assert.equal(conventionalPmiPercent(720, 0.8), 0);
    assert.equal(conventionalPmiPercent(620, 0.6), 0);
  });

  it("prices the published credit and LTV bands", () => {
    assert.equal(conventionalPmiPercent(760, 0.85), 0.19);
    assert.equal(conventionalPmiPercent(720, 0.9), 0.46);
    assert.equal(conventionalPmiPercent(760, 0.95), 0.38);
    assert.equal(conventionalPmiPercent(740, 0.97), 0.7);
    assert.equal(conventionalPmiPercent(620, 0.97), 1.86);
  });

  it("quotes FHA MIP by term, LTV, and loan size", () => {
    assert.deepEqual(fhaMipQuote(180_000, 0.9, 30), {
      annualPercent: 0.5,
      duration: "11-years",
      upfrontPercent: 1.75,
    });
    assert.equal(fhaMipQuote(180_000, 0.91, 30).duration, "life");
    assert.equal(fhaMipQuote(180_000, 0.965, 30).annualPercent, 0.55);
    assert.equal(fhaMipQuote(180_000, 0.9, 15).annualPercent, 0.15);
    assert.equal(fhaMipQuote(900_000, 0.965, 30).annualPercent, 0.75);
  });

  it("uses the VA purchase funding-fee schedule", () => {
    assert.equal(vaFundingFeePercent(0, "first"), 2.15);
    assert.equal(vaFundingFeePercent(0.05, "first"), 1.5);
    assert.equal(vaFundingFeePercent(0.1, "subsequent"), 1.25);
    assert.equal(vaFundingFeePercent(0, "subsequent"), 3.3);
    assert.equal(vaFundingFeePercent(0, "exempt"), 0);
  });
});

describe("estimateScenario", () => {
  it("lands a strong conforming file on the survey rate", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 80_000,
      termYears: 30,
      program: "conventional",
    });
    assert.equal(result.ok, true);
    assert.equal(result.modelRate, 7.11);
    assert.equal(result.rate, 7.11);
    assert.equal(result.loanAmount, 320_000);
    assert.equal(result.ltv, 0.8);
    assert.equal(result.monthly.mortgageInsurance, 0);
    assert.equal(result.jumbo, false);
    assert.equal(
      result.monthly.principalAndInterest,
      roundCents(monthlyPrincipalAndInterest(320_000, 7.11, 30)),
    );
    assert.equal(result.monthly.total, result.monthly.principalAndInterest);
    assert.equal(result.screening.status, "likely");
    assert.equal(
      result.rateBuild.reduce((sum, row) => sum + row.bp, 0),
      result.modelRateBp,
    );
    assert.ok(Math.abs(result.totals.principal - 320_000) < 1);
    assert.equal(result.years.at(-1).balance, 0);
    assert.equal(result.cashToClose.downPayment, 80_000);
    assert.equal(result.cashToClose.closingCosts, 8_000);
    assert.equal(result.cashToClose.total, 88_000);
  });

  it("adds credit and loan-to-value adjustments and PMI", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 720,
      purchasePrice: 450_000,
      downPayment: 45_000,
      termYears: 30,
      program: "conventional",
      propertyTaxRate: 0.011,
      annualInsurance: 1_575,
    });
    assert.equal(result.mortgageInsurance.annualPercent, 0.46);
    assert.equal(result.monthly.mortgageInsurance, 155.25);
    assert.equal(result.monthly.propertyTax, 412.5);
    assert.equal(result.monthly.homeownersInsurance, 131.25);
    const appliedDti = result.rateBuild.find((row) => row.id === "dti")?.bp ?? 0;
    assert.equal(appliedDti, dtiBp("conventional", result.ratios.backEnd));
    assert.equal(result.modelRateBp, 711 + 15 + 30 + appliedDti);
    assert.ok(result.mortgageInsurance.cancelMonth > 0);
    assert.match(result.insights.map((item) => item.text).join(" "), /20%/);
  });

  it("keeps the debt-to-income adjustment on the same band as the final ratio", () => {
    for (const annualIncome of [60_000, 90_000, 120_000, 150_000, 200_000, 300_000]) {
      const result = estimateScenario({
        creditScore: 720,
        annualIncome,
        monthlyDebts: 800,
        purchasePrice: 450_000,
        downPayment: 45_000,
        termYears: 30,
        program: "conventional",
        occupancy: "primary",
        propertyTaxRate: 0.011,
        annualInsurance: 1_575,
        monthlyHoa: 0,
      });
      const applied = result.rateBuild.find((row) => row.id === "dti")?.bp ?? 0;
      assert.equal(applied, dtiBp("conventional", result.ratios.backEnd));
      assert.equal(
        roundCents(
          result.monthly.principalAndInterest +
            result.monthly.mortgageInsurance +
            result.monthly.propertyTax +
            result.monthly.homeownersInsurance +
            result.monthly.hoa,
        ),
        result.monthly.total,
      );
    }
  });

  it("raises the rate when debts push the ratio over 43%", () => {
    const easy = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "conventional",
    });
    const tight = estimateScenario({
      creditScore: 740,
      annualIncome: 70_000,
      monthlyDebts: 2_000,
      purchasePrice: 500_000,
      downPayment: 50_000,
      termYears: 30,
      program: "conventional",
      occupancy: "primary",
      propertyTaxRate: 0.02,
      annualInsurance: 2_400,
      monthlyHoa: 0,
    });
    assert.ok(tight.ratios.backEnd > 0.43);
    assert.ok(tight.modelRate > easy.modelRate);
    assert.equal(tight.screening.status, "unlikely");
  });

  it("prices a 15-year loan from the 15-year survey and cuts total interest", () => {
    const shared = {
      ...quiet,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "conventional",
    };
    const long = estimateScenario({ ...shared, termYears: 30 });
    const short = estimateScenario({ ...shared, termYears: 15 });
    assert.equal(short.modelRate, 6.45);
    assert.ok(short.monthly.principalAndInterest > long.monthly.principalAndInterest);
    assert.ok(short.totals.interest < long.totals.interest);
  });

  it("marks a jumbo loan and adds jumbo pricing", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 760,
      purchasePrice: 1_200_000,
      downPayment: 240_000,
      program: "conventional",
    });
    assert.equal(result.jumbo, true);
    assert.ok(result.baseLoan > CONFORMING_LIMIT);
    assert.equal(result.rateBuild.find((row) => row.id === "jumbo").bp, 40);
    assert.equal(result.screening.status, "likely");
  });

  it("rejects a jumbo file with a thin down payment", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 1_000_000,
      downPayment: 50_000,
      program: "conventional",
    });
    assert.equal(result.screening.status, "unlikely");
    assert.match(result.screening.reasons.map((reason) => reason.text).join(" "), /10%/);
  });

  it("finances FHA upfront mortgage insurance and charges annual MIP", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 14_000,
      termYears: 30,
      program: "fha",
    });
    assert.equal(result.baseLoan, 386_000);
    assert.equal(result.upfrontFee.amount, 6_755);
    assert.equal(result.upfrontFee.financed, true);
    assert.equal(result.loanAmount, 392_755);
    assert.equal(result.mortgageInsurance.annualPercent, 0.55);
    assert.equal(result.mortgageInsurance.duration, "life");
    assert.equal(result.monthly.mortgageInsurance, 176.92);
    assert.equal(result.modelRate, 6.96);
    assert.equal(result.screening.status, "likely");
  });

  it("uses the 11-year FHA period at 10% down and can leave the fee in cash", () => {
    const financed = estimateScenario({
      ...quiet,
      creditScore: 700,
      purchasePrice: 200_000,
      downPayment: 20_000,
      termYears: 30,
      program: "fha",
    });
    assert.equal(financed.mortgageInsurance.duration, "11-years");
    assert.equal(financed.monthly.mortgageInsurance, 75);
    assert.equal(financed.loanAmount, 183_150);

    const cashFee = estimateScenario({
      ...quiet,
      creditScore: 700,
      purchasePrice: 200_000,
      downPayment: 20_000,
      termYears: 30,
      program: "fha",
      financeUpfrontFee: false,
    });
    assert.equal(cashFee.loanAmount, 180_000);
    assert.equal(cashFee.cashToClose.upfrontFee, 3_150);
    assert.ok(cashFee.cashToClose.total > cashFee.cashToClose.downPayment + 3_000);
  });

  it("blocks FHA 3.5% down below a 580 score and allows 10% down", () => {
    const lowDown = estimateScenario({
      ...quiet,
      creditScore: 560,
      purchasePrice: 300_000,
      downPayment: 10_500,
      program: "fha",
    });
    assert.equal(lowDown.screening.status, "unlikely");
    const tenDown = estimateScenario({
      ...quiet,
      creditScore: 560,
      purchasePrice: 300_000,
      downPayment: 30_000,
      program: "fha",
    });
    assert.notEqual(tenDown.screening.status, "unlikely");
  });

  it("prices a VA loan with a funding fee and no monthly insurance", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 250_000,
      downPayment: 0,
      program: "va",
      vaUse: "first",
    });
    assert.equal(result.upfrontFee.amount, 5_375);
    assert.equal(result.loanAmount, 255_375);
    assert.equal(result.monthly.mortgageInsurance, 0);
    assert.equal(result.modelRate, 6.76);
    assert.equal(result.screening.status, "likely");
    assert.match(result.screening.reasons.map((reason) => reason.text).join(" "), /entitlement/);

    const exempt = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 250_000,
      downPayment: 0,
      program: "va",
      vaUse: "exempt",
    });
    assert.equal(exempt.upfrontFee.amount, 0);
    assert.equal(exempt.loanAmount, 250_000);
  });

  it("prices USDA with both guarantee fees", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 680,
      purchasePrice: 300_000,
      downPayment: 0,
      program: "usda",
    });
    assert.equal(result.upfrontFee.amount, 3_000);
    assert.equal(result.loanAmount, 303_000);
    assert.equal(result.mortgageInsurance.annualPercent, 0.35);
    assert.equal(result.monthly.mortgageInsurance, 87.5);
    assert.equal(result.screening.status, "likely");
    assert.match(result.screening.reasons.map((reason) => reason.text).join(" "), /rural/);
  });

  it("rejects investment and second-home use of government loans", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 760,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "fha",
      occupancy: "investment",
    });
    assert.equal(result.screening.status, "unlikely");
  });

  it("prices an investment property above the conforming baseline adjustments", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 760,
      purchasePrice: 500_000,
      downPayment: 125_000,
      program: "conventional",
      occupancy: "investment",
    });
    assert.equal(result.rateBuild.find((row) => row.id === "occupancy").bp, 65);
    assert.equal(result.monthly.mortgageInsurance, 0);
    assert.equal(result.screening.status, "likely");
  });

  it("uses a typed rate for the payment and still reports the model", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "conventional",
      customRate: 6,
    });
    assert.equal(result.rate, 6);
    assert.equal(result.modelRate, 7.11);
    assert.equal(result.rateIsCustom, true);
    assert.equal(
      result.monthly.principalAndInterest,
      roundCents(monthlyPrincipalAndInterest(320_000, 6, 30)),
    );
    assert.equal(
      roundCents(result.firstMonth.interest + result.firstMonth.principal),
      result.monthly.principalAndInterest,
    );
  });

  it("asks for income without inventing a debt ratio", () => {
    const result = estimateScenario({
      ...quiet,
      annualIncome: 0,
      creditScore: 740,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "conventional",
    });
    assert.equal(result.ok, true);
    assert.equal(result.ratios, null);
    assert.equal(result.screening.status, "incomplete");
    assert.ok(result.monthly.total > 0);
  });

  it("treats a 100% down purchase as cash", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 500,
      purchasePrice: 300_000,
      downPayment: 300_000,
      propertyTaxRate: 0.01,
      annualInsurance: 1_200,
    });
    assert.equal(result.hasLoan, false);
    assert.equal(result.monthly.principalAndInterest, 0);
    assert.equal(result.monthly.total, roundCents(300_000 * 0.01 / 12 + 1_200 / 12));
    assert.equal(result.screening.title, "No loan");
  });

  it("flags a conventional score under 620 and a down payment that is too small", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 600,
      purchasePrice: 350_000,
      downPayment: 7_000,
      program: "conventional",
    });
    assert.equal(result.screening.status, "unlikely");
    const text = result.screening.reasons.map((reason) => reason.text).join(" ");
    assert.match(text, /620/);
    assert.match(text, /Down payment/);
  });

  it("returns input errors instead of a fake payment", () => {
    const result = estimateScenario({
      purchasePrice: 250_000,
      downPayment: 300_000,
      creditScore: 700,
      termYears: 30,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /larger than the purchase price/);
  });

  it("mentions a nearby credit tier", () => {
    const result = estimateScenario({
      ...quiet,
      creditScore: 735,
      purchasePrice: 400_000,
      downPayment: 80_000,
      program: "conventional",
    });
    assert.match(result.insights.map((item) => item.text).join(" "), /740/);
  });
});

describe("state tax presets", () => {
  it("includes a national preset and the states", () => {
    const codes = STATE_TAX_RATES.map((state) => state.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(codes.includes("US"));
    assert.ok(codes.includes("CA"));
    assert.ok(codes.includes("DC"));
    assert.equal(codes.length, 52);
    for (const state of STATE_TAX_RATES) {
      assert.ok(state.rate > 0.002 && state.rate < 0.03);
    }
  });
});
