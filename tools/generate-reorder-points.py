"""Export reviewed reorder-point thresholds from the supplied workbook."""

import json
import math
import re
import sys
from pathlib import Path

from openpyxl import load_workbook


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(__file__).resolve().parents[1] / "reorder-points-data.js"
    sheet = load_workbook(source, read_only=True, data_only=True)["จุดสั่งซื้อ"]
    rows = sheet.values
    for _ in range(3):
        next(rows)
    header = next(rows)
    if str(header[0]).strip() != "รหัสสินค้า" or "ROP" not in str(header[7]):
        raise ValueError("Unexpected reorder-point workbook columns")

    records = []
    seen = set()
    for row in rows:
        code = str(row[0] or "").strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9./-]*", code):
            continue
        if code in seen:
            raise ValueError(f"Duplicate product code: {code}")
        seen.add(code)
        rop = row[7]
        if not isinstance(rop, (int, float)) or not math.isfinite(rop) or rop <= 0:
            raise ValueError(f"Invalid ROP for {code}")
        records.append({
            "code": code,
            "name": str(row[1] or "").strip(),
            "unit": str(row[2] or "").strip(),
            "supplier": str(row[3] or "").strip(),
            "pattern": str(row[4] or "").strip(),
            "rop": rop,
            "historyWeeks": row[13] if isinstance(row[13], (int, float)) else None,
        })
    if len(records) < 900:
        raise ValueError("Reorder-point export has too few product rows")

    destination.write_text(
        "// Reorder-point snapshot from the supplied workbook, analysis through 24 Sep 2026.\n"
        "const PK_ROP_DATA = "
        + json.dumps(records, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(records)} reorder-point records")


if __name__ == "__main__":
    main()
