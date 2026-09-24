"""Convert the latest-received supplier workbook into a static dashboard snapshot."""

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(__file__).resolve().parents[1] / "latest-suppliers.js"
    sheet = load_workbook(source, read_only=True, data_only=True).active
    rows = list(sheet.values)
    expected = ("รหัสสินค้า", "ชื่อสินค้า", "หน่วยนับ", "เจ้าหนี้ (ซัพพลายเออร์) ล่าสุดที่รับเข้า")
    if tuple(str(value or "").strip() for value in rows[0][:4]) != expected:
        raise ValueError("Unexpected workbook columns; check the supplier export before publishing")

    suppliers = {}
    for row in rows[1:]:
        code = str(row[0] or "").strip().upper()
        supplier = str(row[3] or "").strip()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9./-]*", code) or not supplier or supplier == "-":
            continue
        if code in suppliers:
            raise ValueError(f"Duplicate product code: {code}")
        suppliers[code] = {
            "name": str(row[1] or "").strip(),
            "supplier": supplier,
            "receivedOn": str(row[4] or "").strip(),
            "receipt": str(row[5] or "").strip(),
            "invoice": str(row[6] or "").strip(),
        }

    if not suppliers:
        raise ValueError("No supplier records found")
    payload = json.dumps(suppliers, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    destination.write_text(
        "// Snapshot from the supplied latest-received supplier workbook.\n"
        f"const PK_LATEST_SUPPLIERS = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(suppliers)} products to {destination}")


if __name__ == "__main__":
    main()
