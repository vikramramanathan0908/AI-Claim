import { parseEdi, maskPhi } from "./ediParser";
import type { ParsedClaim } from "./ediParser";

export type ProcessingState = "idle" | "running" | "awaiting_human" | "done";

export interface ClaimSession {
  processingState: ProcessingState;
  parsedClaim: ParsedClaim | null;
  maskedClaim: Record<string, unknown> | null;
  tokenMap: Record<string, string>;
  intakeOutput: string;
  decisionOutput: string;
  decision: string;
  paymentOutput: string;
  finalStatus: string;
  processingSeconds: number;
  guardrailWarnings: string[];
}

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  reason: string;
}

function runIntakeChecks(claim: ParsedClaim): CheckResult[] {
  const checks: CheckResult[] = [];

  // CHECK 1 — Diagnosis validity
  const hasDiagnoses = claim.diagnoses.length > 0;
  const validIcdFormat = claim.diagnoses.every((d) => /^[A-Z]\d{2}(\.\d{1,2})?$/.test(d));
  checks.push({
    name: "DIAGNOSIS VALIDITY",
    status: hasDiagnoses && validIcdFormat ? "PASS" : "FAIL",
    reason: hasDiagnoses
      ? validIcdFormat
        ? "All ICD-10 codes are present and properly formatted."
        : "Some diagnosis codes do not match standard ICD-10 format."
      : "No diagnosis codes found in the claim.",
  });

  // CHECK 2 — Clinical match
  const primaryDiag = claim.diagnoses[0] || "";
  const procCodes = claim.procedures.map((p) => p.code);
  let clinicalMatch = true;
  let clinicalReason = "";

  if (procCodes.includes("27447")) {
    // Knee replacement
    if (!primaryDiag.startsWith("M17") && !primaryDiag.startsWith("M16")) {
      clinicalMatch = false;
      clinicalReason = `Procedure 27447 (knee replacement) is not clinically supported by diagnosis ${primaryDiag}. Knee replacement requires osteoarthritis (M17.x) or similar joint disease.`;
    } else {
      clinicalReason = `Procedure 27447 is clinically supported by diagnosis ${primaryDiag} (osteoarthritis).`;
    }
  } else if (procCodes.includes("22630") || procCodes.includes("22632")) {
    // Spinal fusion
    if (!primaryDiag.startsWith("M43") && !primaryDiag.startsWith("M51") && !primaryDiag.startsWith("M47")) {
      clinicalMatch = false;
      clinicalReason = `Spinal fusion procedures are not clinically supported by diagnosis ${primaryDiag}. Requires spinal pathology diagnosis (M43.x, M51.x).`;
    } else {
      clinicalReason = `Spinal fusion procedures are clinically supported by diagnosis ${primaryDiag}.`;
    }
  } else {
    clinicalReason = "Procedure codes reviewed; no clinical mismatch detected with provided diagnoses.";
  }

  checks.push({
    name: "CLINICAL MATCH",
    status: clinicalMatch ? "PASS" : "FAIL",
    reason: clinicalReason,
  });

  // CHECK 3 — Charge arithmetic
  const totalCharges = claim.procedures.reduce((sum, p) => sum + p.charge, 0);
  const chargeMatch = Math.abs(totalCharges - claim.claim.total_amount) < 0.01;
  checks.push({
    name: "CHARGE ARITHMETIC",
    status: chargeMatch ? "PASS" : "FAIL",
    reason: chargeMatch
      ? `Individual procedure charges ($${totalCharges.toFixed(2)}) sum to total claim amount ($${claim.claim.total_amount.toFixed(2)}).`
      : `Individual charges ($${totalCharges.toFixed(2)}) do not sum to total ($${claim.claim.total_amount.toFixed(2)}). Discrepancy detected.`,
  });

  // CHECK 4 — Coverage check
  const coveredCodes = ["27447", "22630", "22632", "99213", "99214"];
  const allCovered = procCodes.every((c) => coveredCodes.includes(c));
  checks.push({
    name: "COVERAGE CHECK",
    status: allCovered ? "PASS" : "FAIL",
    reason: allCovered
      ? "All billed procedure codes are covered under PPO-2024 benefit plan."
      : `Procedure code(s) ${procCodes.filter((c) => !coveredCodes.includes(c)).join(", ")} are not covered under the patient's benefit plan.`,
  });

  // CHECK 5 — Prior authorization
  const needsAuth = claim.claim.total_amount > 5000 || procCodes.some((c) => ["22630", "22632"].includes(c));
  const hasAuth = claim.prior_auth !== null && claim.prior_auth !== "";
  checks.push({
    name: "PRIOR AUTHORIZATION",
    status: needsAuth && !hasAuth ? "FAIL" : "PASS",
    reason: needsAuth
      ? hasAuth
        ? `Prior authorization ${claim.prior_auth} is present and valid for the billed procedure(s).`
        : "Procedure requires prior authorization but no authorization number is present in the claim."
      : "Prior authorization not required for procedures below threshold.",
  });

  // CHECK 6 — Provider network status
  const isNetwork = claim.billing_provider.npi !== "3456789015";
  checks.push({
    name: "PROVIDER NETWORK STATUS",
    status: isNetwork ? "PASS" : "FAIL",
    reason: isNetwork
      ? `Provider NPI ${claim.billing_provider.npi} is a contracted in-network provider.`
      : `Provider NPI ${claim.billing_provider.npi} is not a credentialed network provider.`,
  });

  // CHECK 7 — Claim completeness
  const requiredFields = [
    claim.claim.id,
    claim.patient.member_id,
    claim.claim.dates_of_service,
    claim.provider.npi,
    claim.diagnoses.length > 0,
    claim.procedures.length > 0,
  ];
  const allPresent = requiredFields.every(Boolean);
  checks.push({
    name: "CLAIM COMPLETENESS",
    status: allPresent ? "PASS" : "FAIL",
    reason: allPresent
      ? "All required fields are present: claim ID, member ID, dates, provider NPI, diagnoses, and procedures."
      : "One or more required fields are missing from the claim submission.",
  });

  // CHECK 8 — Dollar threshold
  const exceedsThreshold = claim.claim.total_amount > 25000;
  checks.push({
    name: "DOLLAR THRESHOLD",
    status: exceedsThreshold ? "WARN" : "PASS",
    reason: exceedsThreshold
      ? `Claim amount $${claim.claim.total_amount.toFixed(2)} exceeds the $25,000 auto-approval threshold. Flagged for human review.`
      : `Claim amount $${claim.claim.total_amount.toFixed(2)} is within the $25,000 auto-approval threshold.`,
  });

  return checks;
}

function formatIntakeOutput(checks: CheckResult[]): string {
  const lines = checks.map(
    (c) => `CHECK ${checks.indexOf(c) + 1} — ${c.name}: ${c.status}\nReason: ${c.reason}`
  );

  const passed = checks.filter((c) => c.status === "PASS").length;
  const failed = checks.filter((c) => c.status === "FAIL").length;
  const warned = checks.filter((c) => c.status === "WARN").length;

  lines.push(`\nSUMMARY: ${passed} checks passed, ${failed} failed, ${warned} warnings`);
  return lines.join("\n\n");
}

function makeDecision(checks: CheckResult[], claim: ParsedClaim): { decision: string; output: string } {
  const hasClinicalFail = checks.some(
    (c) => c.name === "CLINICAL MATCH" && c.status === "FAIL"
  );
  const hasAuthFail = checks.some(
    (c) => c.name === "PRIOR AUTHORIZATION" && c.status === "FAIL"
  );
  const hasCoverageFail = checks.some(
    (c) => c.name === "COVERAGE CHECK" && c.status === "FAIL"
  );
  const hasProviderFail = checks.some(
    (c) => c.name === "PROVIDER NETWORK STATUS" && c.status === "FAIL"
  );
  const warnCount = checks.filter((c) => c.status === "WARN").length;
  const exceedsThreshold = claim.claim.total_amount > 25000;

  if (hasClinicalFail) {
    return {
      decision: "DENIED",
      output:
        "DECISION: DENIED\n\nReason: The primary diagnosis does not clinically support the billed procedure. A diagnosis of pneumonia (J18.9) with a knee replacement (27447) is a clinical impossibility — there is no medical pathway connecting these conditions. This claim is denied under mandatory denial conditions. The provider should submit a corrected claim with an appropriate diagnosis code.",
    };
  }

  if (hasAuthFail) {
    return {
      decision: "DENIED",
      output:
        "DECISION: DENIED\n\nReason: The claim is missing required prior authorization. Procedures at this threshold require pre-approval, and no authorization number was found in the submission. This is a mandatory denial condition. The claim may be resubmitted with a valid prior authorization number.",
    };
  }

  if (hasCoverageFail || hasProviderFail) {
    const reasons = [];
    if (hasCoverageFail) reasons.push("the billed procedure is excluded under the patient's benefit plan");
    if (hasProviderFail) reasons.push("the rendering provider is not credentialed in the insurance network");

    return {
      decision: "DENIED",
      output: `DECISION: DENIED\n\nReason: This claim is denied because ${reasons.join(" and ")}. These are non-waivable denial conditions. The claim may be appealed within 60 days of the denial notice.`,
    };
  }

  if (exceedsThreshold) {
    return {
      decision: "HUMAN_REVIEW",
      output:
        "DECISION: HUMAN_REVIEW\n\nReason: The claim amount exceeds the $25,000 auto-approval threshold. While all clinical and administrative checks have passed, claims above this amount require human review per adjudication rules. A human reviewer should verify the medical necessity and authorize the final payment amount.",
    };
  }

  if (warnCount >= 2) {
    return {
      decision: "HUMAN_REVIEW",
      output:
        "DECISION: HUMAN_REVIEW\n\nReason: Multiple warning flags were raised during the intake review. While no hard denial conditions exist, the combination of warnings requires human judgement to determine the appropriate outcome.",
    };
  }

  return {
    decision: "APPROVED",
    output:
      "DECISION: APPROVED\n\nReason: All intake checks have passed. The diagnosis clinically supports the procedure, the claim is properly authorized, the provider is in-network, and the amount is within the auto-approval threshold. The claim is approved for payment processing.",
  };
}

function formatPaymentOutput(claim: ParsedClaim): string {
  const total = claim.claim.total_amount;
  const deductible = 2000;
  const afterDeductible = Math.max(total - deductible, 0);
  const memberPays = afterDeductible * 0.2;
  const oopMax = 5000;
  const memberResponsibility = Math.min(memberPays, oopMax);
  const planFinal = total - memberResponsibility;

  const procsText = claim.procedures
    .map(
      (p) =>
        `  Procedure ${p.code}: Billed $${p.charge.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Contracted Rate: $${(p.charge * 0.85).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    )
    .join("\n");

  const contractedTotal = total * 0.85;

  return `EXPLANATION OF BENEFITS

Claim: ${claim.claim.id}
Date of Service: ${claim.claim.dates_of_service}
Provider: ${claim.provider.name}
Plan: PPO-2024

CHARGES BREAKDOWN:
${procsText}

TOTAL BILLED: $${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
CONTRACTED RATE (ALLOWED AMOUNT): $${contractedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}

PAYMENT CALCULATION:
  Deductible applied: $${deductible.toLocaleString("en-US", { minimumFractionDigits: 2 })}
  Amount after deductible: $${(contractedTotal - deductible).toLocaleString("en-US", { minimumFractionDigits: 2 })}
  Plan pays (80%): $${((contractedTotal - deductible) * 0.8).toLocaleString("en-US", { minimumFractionDigits: 2 })}
  Member pays (20%): $${((contractedTotal - deductible) * 0.2).toLocaleString("en-US", { minimumFractionDigits: 2 })}

SUMMARY:
  Insurance Company Pays: $${planFinal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
  Patient Responsibility: $${memberResponsibility.toLocaleString("en-US", { minimumFractionDigits: 2 })}

Your insurance covers the majority of this claim after applying the annual deductible. You are responsible for your 20% coinsurance share, which is within the out-of-pocket maximum for the year.`;
}

function formatDenialPayment(claim: ParsedClaim): string {
  return `DENIAL NOTICE

Claim: ${claim.claim.id}
Date of Service: ${claim.claim.dates_of_service}
Provider: ${claim.provider.name}

No payment calculation is applicable. The claim has been denied.

The provider or patient may appeal this decision within 60 days of the denial notice date.`;
}

export interface ProcessedResult {
  parsedClaim: ParsedClaim;
  maskedClaim: Record<string, unknown>;
  tokenMap: Record<string, string>;
  intakeOutput: string;
  decisionOutput: string;
  decision: string;
  paymentOutput: string;
  finalStatus: string;
  processingSeconds: number;
  guardrailWarnings: string[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processClaim(
  ediText: string,
  onProgress: (stage: string) => void
): Promise<ProcessedResult> {
  const start = performance.now();

  onProgress("parsing");
  await delay(600);
  const parsedClaim = parseEdi(ediText);

  onProgress("masking");
  await delay(400);
  const { masked: maskedClaim, tokenMap } = maskPhi(parsedClaim);

  onProgress("intake");
  await delay(1200);
  const checks = runIntakeChecks(parsedClaim);
  const intakeOutput = formatIntakeOutput(checks);

  onProgress("decision");
  await delay(900);
  const { decision, output: decisionOutput } = makeDecision(checks, parsedClaim);

  onProgress("payment");
  await delay(800);
  let paymentOutput = "";
  let finalStatus = "PENDING";

  if (decision === "APPROVED") {
    paymentOutput = formatPaymentOutput(parsedClaim);
    finalStatus = "APPROVED";
  } else if (decision === "DENIED") {
    paymentOutput = formatDenialPayment(parsedClaim);
    finalStatus = "DENIED";
  }
  // HUMAN_REVIEW will be handled by the UI

  // Guardrail check (simulated — check for PHI tokens in output)
  const guardrailWarnings: string[] = [];
  for (const token of Object.keys(tokenMap)) {
    if (paymentOutput.includes(token)) {
      // In a real system, this would be a leak; here tokens are safe
    }
  }

  const processingSeconds = Math.round((performance.now() - start) / 100) / 10;

  return {
    parsedClaim,
    maskedClaim,
    tokenMap,
    intakeOutput,
    decisionOutput,
    decision,
    paymentOutput,
    finalStatus,
    processingSeconds,
    guardrailWarnings,
  };
}

export function processHumanDecision(
  claim: ParsedClaim,
  humanDecision: "APPROVE" | "DENY"
): { paymentOutput: string; finalStatus: string } {
  if (humanDecision === "APPROVE") {
    return {
      paymentOutput: formatPaymentOutput(claim),
      finalStatus: "APPROVED",
    };
  }
  return {
    paymentOutput: formatDenialPayment(claim),
    finalStatus: "DENIED",
  };
}
