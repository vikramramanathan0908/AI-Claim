export const CLAIM_FILES: Record<string, string> = {
  "Clean Claim — Knee Replacement ($8,500)": "claim_clean.edi",
  "Flagged Claim — Spinal Fusion ($42,000)": "claim_flagged.edi",
  "Fraud Claim — Impossible Diagnosis ($35,000)": "claim_fraud.edi",
};

export type ClaimTag = "clean" | "flagged" | "fraud";

export interface ClaimMeta {
  file: string;
  title: string;
  procedure: string;
  amount: number;
  tag: ClaimTag;
  tagLabel: string;
  blurb: string;
  expected: string;
}

export const CLAIMS: ClaimMeta[] = [
  {
    file: "claim_clean.edi",
    title: "Knee Replacement",
    procedure: "CPT 27447 · M17.11",
    amount: 8500,
    tag: "clean",
    tagLabel: "Clean",
    blurb: "Well-formed claim with valid prior auth and matching diagnosis. Should sail through to approval.",
    expected: "Auto-approve",
  },
  {
    file: "claim_flagged.edi",
    title: "Spinal Fusion",
    procedure: "CPT 22630/22632 · M43.16",
    amount: 42000,
    tag: "flagged",
    tagLabel: "High-Dollar",
    blurb: "Exceeds the $25k auto-approval threshold, so the pipeline escalates it for human sign-off.",
    expected: "Human review",
  },
  {
    file: "claim_fraud.edi",
    title: "Impossible Diagnosis",
    procedure: "CPT 27447 · J18.9",
    amount: 35000,
    tag: "fraud",
    tagLabel: "Suspicious",
    blurb: "Bills a knee replacement against a pneumonia diagnosis — a clinical mismatch the intake agent flags.",
    expected: "Likely deny",
  },
];

export const CLAIM_RAW: Record<string, string> = {
  claim_clean: `ISA*00*          *00*          *ZZ*VALLEYORTHOPED  *ZZ*BLUEINSURANCE  *240115*0900*^*00501*000000001*0*P*:~
GS*HC*VALLEYORTHO*BLUEINS*20240115*0900*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BPR*I*8500.00*C*ACH*CCP*01*071000013*DA*1234567890*1512345678**01*071000013*DA*9876543210*20240115~
NM1*41*2*VALLEY ORTHOPEDIC CENTER*****XX*1234567893~
PER*IC*BILLING DEPT*TE*5551234567~
NM1*40*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*1**20*1~
NM1*85*2*VALLEY ORTHOPEDIC CENTER*****XX*1234567893~
N3*4500 Medical Drive*Suite 200~
N4*Sacramento*CA*95816~
REF*EI*123456789~
HL*2*1*22*1~
SBR*P*18*PPO-2024**COM****MA~
NM1*IL*1*SMITH*JOHN*A**MR*MI*PPO202400123~
N3*742 Evergreen Terrace~
N4*Springfield*CA*94305~
DMG*D8*19680315*M~
NM1*PR*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*3*2*23*0~
PAT*19~
CLM*CLM-2024-0001*8500.00***11:B:1*Y*A*Y*I~
DTP*434*RD8*20240110-20240110~
REF*9F*AUTH-2024-7821~
HI*ABK:M17.11~
NM1*82*1*JOHNSON*ROBERT***MD*XX*9876543210~
LX*1~
SV1*HC:27447**8500.00*UN*1***1~
DTP*472*D8*20240110~
SE*28*0001~
GE*1*1~
IEA*1*000000001~`,

  claim_flagged: `ISA*00*          *00*          *ZZ*REGIONALSPINE   *ZZ*BLUEINSURANCE  *240118*1030*^*00501*000000002*0*P*:~
GS*HC*REGIONSPINE*BLUEINS*20240118*1030*2*X*005010X222A1~
ST*837*0002*005010X222A1~
BPR*I*42000.00*C*ACH*CCP*01*071000013*DA*1234567890*1512345679**01*071000013*DA*9876543211*20240118~
NM1*41*2*REGIONAL SPINE CENTER*****XX*2345678904~
PER*IC*BILLING DEPT*TE*5552345678~
NM1*40*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*1**20*1~
NM1*85*2*REGIONAL SPINE CENTER*****XX*2345678904~
N3*1200 Spine Institute Blvd*Suite 500~
N4*San Francisco*CA*94102~
REF*EI*234567890~
HL*2*1*22*1~
SBR*P*18*PPO-2024**COM****MA~
NM1*IL*1*JOHNSON*MARIA*L**MS*MI*PPO202400456~
N3*1600 Pennsylvania Avenue~
N4*Washington*DC*20500~
DMG*D8*19750622*F~
NM1*PR*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*3*2*23*0~
PAT*19~
CLM*CLM-2024-0002*42000.00***21:B:1*Y*A*Y*I~
DTP*434*RD8*20240115-20240117~
REF*9F*AUTH-2024-3341~
HI*ABK:M43.16:ABF:M51.17~
NM1*82*1*PATEL*ANANYA***MD*XX*8765432109~
LX*1~
SV1*HC:22630**32000.00*UN*1***1~
DTP*472*D8*20240115~
LX*2~
SV1*HC:22632**10000.00*UN*1***1~
DTP*472*D8*20240115~
SE*32*0002~
GE*1*2~
IEA*1*000000002~`,

  claim_fraud: `ISA*00*          *00*          *ZZ*QUICKMEDCLINIC  *ZZ*BLUEINSURANCE  *240120*1400*^*00501*000000003*0*P*:~
GS*HC*QUICKMED*BLUEINS*20240120*1400*3*X*005010X222A1~
ST*837*0003*005010X222A1~
BPR*I*35000.00*C*ACH*CCP*01*071000013*DA*1234567890*1512345680**01*071000013*DA*9876543212*20240120~
NM1*41*2*QUICK MEDICAL CLINIC*****XX*3456789015~
PER*IC*BILLING DEPT*TE*5553456789~
NM1*40*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*1**20*1~
NM1*85*2*QUICK MEDICAL CLINIC*****XX*3456789015~
N3*999 Shady Lane*Unit 1~
N4*Los Angeles*CA*90001~
REF*EI*345678901~
HL*2*1*22*1~
SBR*P*18*PPO-2024**COM****MA~
NM1*IL*1*WILLIAMS*ROBERT*J**MR*MI*PPO202400789~
N3*221B Baker Street~
N4*Los Angeles*CA*90001~
DMG*D8*19550908*M~
NM1*PR*2*BLUE SHIELD INSURANCE*****PI*BLUEINS001~
HL*3*2*23*0~
PAT*19~
CLM*CLM-2024-0003*35000.00***11:B:1*Y*A*Y*I~
DTP*434*RD8*20240118-20240118~
HI*ABK:J18.9~
NM1*82*1*NGUYEN*JAMES***MD*XX*7654321098~
LX*1~
SV1*HC:27447**35000.00*UN*1***1~
DTP*472*D8*20240118~
SE*27*0003~
GE*1*3~
IEA*1*000000003~`,
};

function getKey(filename: string): string {
  return filename.replace(".edi", "");
}

export function getRawEdi(filename: string): string {
  return CLAIM_RAW[getKey(filename)] || "";
}
