import re
from typing import Optional


def parse_edi(edi_text: str) -> dict:
    """Parse an EDI 837 claim file into a structured dict."""
    segments = [s.strip() for s in edi_text.replace("\n", "").split("~") if s.strip()]
    elements = [seg.split("*") for seg in segments]

    claim = {
        "patient": {
            "name": "",
            "member_id": "",
            "address": "",
            "city": "",
            "state": "",
            "zip": "",
            "dob": "",
            "gender": "",
        },
        "claim": {
            "id": "",
            "total_amount": 0.0,
            "place_of_service": "",
            "dates_of_service": "",
        },
        "provider": {
            "name": "",
            "npi": "",
            "address": "",
            "city": "",
            "state": "",
            "zip": "",
        },
        "billing_provider": {
            "name": "",
            "npi": "",
        },
        "plan": {
            "name": "",
            "payer_id": "",
        },
        "diagnoses": [],
        "procedures": [],
        "prior_auth": None,
        "raw_segment_count": len(segments),
    }

    i = 0
    current_loop = None
    address_buffer = {}

    while i < len(elements):
        seg = elements[i]
        seg_id = seg[0]

        if seg_id == "NM1":
            entity_code = seg[1] if len(seg) > 1 else ""
            name_last = seg[3] if len(seg) > 3 else ""
            name_first = seg[4] if len(seg) > 4 else ""
            name_mi = seg[5] if len(seg) > 5 else ""
            id_qualifier = seg[8] if len(seg) > 8 else ""
            id_value = seg[9] if len(seg) > 9 else ""

            if entity_code == "IL":  # Subscriber / patient
                full_name = f"{name_first} {name_last}".strip()
                claim["patient"]["name"] = full_name
                if id_qualifier == "MI":
                    claim["patient"]["member_id"] = id_value
                current_loop = "patient"
            elif entity_code == "85":  # Billing provider
                claim["billing_provider"]["name"] = name_last  # org name in element 3
                if id_qualifier == "XX":
                    claim["billing_provider"]["npi"] = id_value
                current_loop = "billing_provider"
            elif entity_code == "82":  # Rendering provider
                full_name = f"{name_first} {name_last}".strip()
                claim["provider"]["name"] = full_name
                if id_qualifier == "XX":
                    claim["provider"]["npi"] = id_value
                current_loop = "rendering_provider"
            elif entity_code == "40" or entity_code == "PR":  # Payer
                claim["plan"]["name"] = name_last
                claim["plan"]["payer_id"] = id_value
                current_loop = "payer"

        elif seg_id == "N3":
            address = seg[1] if len(seg) > 1 else ""
            address_buffer["street"] = address

        elif seg_id == "N4":
            city = seg[1] if len(seg) > 1 else ""
            state = seg[2] if len(seg) > 2 else ""
            zip_code = seg[3] if len(seg) > 3 else ""
            address_buffer.update({"city": city, "state": state, "zip": zip_code})

            street = address_buffer.get("street", "")
            full_address = f"{street}, {city}, {state} {zip_code}".strip(", ")

            if current_loop == "patient":
                claim["patient"]["address"] = street
                claim["patient"]["city"] = city
                claim["patient"]["state"] = state
                claim["patient"]["zip"] = zip_code
            elif current_loop == "billing_provider":
                claim["billing_provider"]["address"] = full_address
            elif current_loop == "rendering_provider":
                claim["provider"]["address"] = full_address

            address_buffer = {}

        elif seg_id == "DMG":
            dob = seg[2] if len(seg) > 2 else ""
            gender = seg[3] if len(seg) > 3 else ""
            if len(dob) == 8:
                dob = f"{dob[:4]}-{dob[4:6]}-{dob[6:]}"
            claim["patient"]["dob"] = dob
            claim["patient"]["gender"] = gender

        elif seg_id == "CLM":
            claim["claim"]["id"] = seg[1] if len(seg) > 1 else ""
            try:
                claim["claim"]["total_amount"] = float(seg[2]) if len(seg) > 2 else 0.0
            except ValueError:
                claim["claim"]["total_amount"] = 0.0
            claim["claim"]["place_of_service"] = _parse_pos(seg[5]) if len(seg) > 5 else ""

        elif seg_id == "DTP":
            qualifier = seg[1] if len(seg) > 1 else ""
            if qualifier == "434":
                claim["claim"]["dates_of_service"] = seg[3] if len(seg) > 3 else ""

        elif seg_id == "REF":
            qualifier = seg[1] if len(seg) > 1 else ""
            value = seg[2] if len(seg) > 2 else ""
            if qualifier == "9F":  # Prior authorization number
                claim["prior_auth"] = value

        elif seg_id == "HI":
            for elem in seg[1:]:
                if elem:
                    parts = elem.split(":")
                    code = parts[1] if len(parts) > 1 else parts[0]
                    if code:
                        claim["diagnoses"].append(code.strip())

        elif seg_id == "SBR":
            plan_name = seg[3] if len(seg) > 3 else ""
            if plan_name:
                claim["plan"]["name"] = plan_name

        elif seg_id == "LX":
            current_loop = "service_line"

        elif seg_id == "SV1":
            proc_raw = seg[1] if len(seg) > 1 else ""
            charge = seg[3] if len(seg) > 3 else "0"
            units = seg[5] if len(seg) > 5 else "1"

            parts = proc_raw.split(":")
            qualifier = parts[0] if parts else ""
            proc_code = parts[1] if len(parts) > 1 else proc_raw

            try:
                charge_val = float(charge)
            except ValueError:
                charge_val = 0.0

            try:
                units_val = float(units)
            except ValueError:
                units_val = 1.0

            claim["procedures"].append({
                "code": proc_code.strip(),
                "qualifier": qualifier.strip(),
                "charge": charge_val,
                "units": units_val,
            })

        i += 1

    claim["diagnoses"] = list(dict.fromkeys(claim["diagnoses"]))
    return claim


def _parse_pos(pos_composite: str) -> str:
    """Extract place of service from composite element like '11:B:1'."""
    parts = pos_composite.split(":")
    pos_map = {
        "11": "Office",
        "21": "Inpatient Hospital",
        "22": "Outpatient Hospital",
        "23": "Emergency Room",
    }
    return pos_map.get(parts[0], parts[0]) if parts else pos_composite


def summarise_claim(parsed: dict) -> str:
    """Return a one-line human-readable summary of a parsed claim."""
    procs = ", ".join(p["code"] for p in parsed["procedures"])
    diags = ", ".join(parsed["diagnoses"])
    amount = parsed["claim"]["total_amount"]
    return (
        f"Claim {parsed['claim']['id']} | "
        f"Amount: ${amount:,.2f} | "
        f"Procedures: {procs} | "
        f"Diagnoses: {diags} | "
        f"Auth: {parsed['prior_auth'] or 'NONE'}"
    )
