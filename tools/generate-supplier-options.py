"""Export product-to-supplier options from the supplied receipt summary workbook."""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(__file__).resolve().parents[1] / "supplier-options-data.js"
    workbook = load_workbook(source, read_only=True, data_only=True)
    sheet = workbook["รายละเอียด"]
    expected = ("รหัสสินค้า", "ชื่อสินค้า", "เจ้าหนี้ (ซัพพลายเออร์)", "จำนวนรายการรับสินค้า")
    rows = sheet.values
    if tuple(str(value or "").strip() for value in next(rows)) != expected:
        raise ValueError("Unexpected supplier detail columns")

    suppliers = defaultdict(list)
    for row in rows:
        code = str(row[0] or "").strip().upper()
        name = str(row[2] or "").strip()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9./-]*", code) or not name:
            continue
        count = int(row[3] or 0)
        suppliers[code].append((name, count))
    if len(suppliers) < 500:
        raise ValueError("Supplier export has fewer product codes than expected")

    options = {
        code: [name for name, _ in sorted(items, key=lambda item: (-item[1], item[0]))]
        for code, items in sorted(suppliers.items())
    }
    destination.write_text(
        "// Product supplier choices from the supplied receipt-count workbook.\n"
        "const PK_SUPPLIER_OPTIONS = "
        + json.dumps(options, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(options)} product codes and {sum(map(len, options.values()))} supplier choices")


if __name__ == "__main__":
    main()
