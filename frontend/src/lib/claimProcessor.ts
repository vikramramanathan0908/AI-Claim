export interface Procedure {
  code: string;
  qualifier: string;
  charge: number;
  units: number;
}

export interface ParsedClaim {
  patient: {
    name: string;
    member_id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dob: string;
    gender: string;
  };
  claim: {
    id: string;
    total_amount: number;
    place_of_service: string;
    dates_of_service: string;
  };
  provider: {
    name: string;
    npi: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  billing_provider: {
    name: string;
    npi: string;
  };
  plan: {
    name: string;
    payer_id: string;
  };
  diagnoses: string[];
  procedures: Procedure[];
  prior_auth: string | null;
  raw_segment_count: number;
}

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
  threadId?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function parseSseChunk(raw: string): { type: string; data: unknown } | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function readSseStream(
  response: Response,
  onEvent: (type: string, data: unknown) => void
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const chunk of lines) {
      const event = parseSseChunk(chunk);
      if (event) onEvent(event.type, event.data);
    }
  }
}

export async function processClaim(
  ediText: string,
  onProgress: (stage: string) => void
): Promise<ProcessedResult> {
  const start = performance.now();

  let parsedClaim: ParsedClaim | null = null;
  let maskedClaim: Record<string, unknown> | null = null;
  let tokenMap: Record<string, string> = {};
  let intakeOutput = "";
  let decisionOutput = "";
  let decision = "";
  let paymentOutput = "";
  let finalStatus = "PENDING";
  let processingSeconds = 0;
  const guardrailWarnings: string[] = [];
  let threadId: string | undefined;

  onProgress("parsing");

  const response = await fetch(`${API_BASE}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edi_text: ediText }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  await readSseStream(response, (type, data) => {
    const d = data as Record<string, unknown>;
    if (type === "parsed") {
      parsedClaim = d.parsed_claim as ParsedClaim;
      maskedClaim = d.masked_claim as Record<string, unknown>;
      tokenMap = d.token_map as Record<string, string>;
      onProgress("intake");
    } else if (type === "thread_id") {
      threadId = d.thread_id as string;
    } else if (type === "node") {
      const node = d.node as string;
      const state = d.state as Record<string, unknown>;
      if (node === "intake" && state.intake_output) {
        intakeOutput = state.intake_output as string;
        onProgress("decision");
      } else if (node === "decision" && state.decision_output) {
        decisionOutput = state.decision_output as string;
        decision = state.decision as string;
        onProgress("payment");
      } else if (node === "payment" && state.payment_output) {
        paymentOutput = state.payment_output as string;
      }
    } else if (type === "interrupted") {
      decision = "HUMAN_REVIEW";
      decisionOutput = (d.decision_output as string) || decisionOutput;
    } else if (type === "done") {
      finalStatus = (d.final_status as string) ?? "PENDING";
      processingSeconds = (d.processing_seconds as number) ?? 0;
      const state = (d.state as Record<string, unknown>) ?? {};
      if (!paymentOutput && state.payment_output) {
        paymentOutput = state.payment_output as string;
      }
    }
  });

  processingSeconds = processingSeconds || Math.round((performance.now() - start) / 100) / 10;

  return {
    parsedClaim: parsedClaim!,
    maskedClaim: maskedClaim!,
    tokenMap,
    intakeOutput,
    decisionOutput,
    decision,
    paymentOutput,
    finalStatus,
    processingSeconds,
    guardrailWarnings,
    threadId,
  };
}

export async function processHumanDecision(
  threadId: string,
  humanDecision: "APPROVE" | "DENY",
  onProgress: (stage: string) => void
): Promise<{ paymentOutput: string; finalStatus: string; processingSeconds: number }> {
  let paymentOutput = "";
  let finalStatus = humanDecision === "APPROVE" ? "APPROVED" : "DENIED";
  let processingSeconds = 0;

  onProgress("payment");

  const response = await fetch(`${API_BASE}/api/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId, human_decision: humanDecision }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  await readSseStream(response, (type, data) => {
    const d = data as Record<string, unknown>;
    if (type === "node") {
      const state = (d.state as Record<string, unknown>) ?? {};
      if (state.payment_output) paymentOutput = state.payment_output as string;
    } else if (type === "done") {
      finalStatus = (d.final_status as string) ?? finalStatus;
      processingSeconds = (d.processing_seconds as number) ?? 0;
      const state = (d.state as Record<string, unknown>) ?? {};
      if (!paymentOutput && state.payment_output) {
        paymentOutput = state.payment_output as string;
      }
    }
  });

  return { paymentOutput, finalStatus, processingSeconds };
}
