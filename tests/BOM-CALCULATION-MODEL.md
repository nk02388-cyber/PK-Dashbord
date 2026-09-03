# BOM packaging-readiness calculation

## Scope

The dashboard reports **packaging readiness**, not complete production readiness. Component inclusion is controlled by `BOM_COMPONENT_TYPES`. The master was migrated on 2026-09-03 from the previously approved BOM-PK scope: components excluded by the old prefix-5 rule were classified `non_packaging`; remaining components were classified `packaging`. Runtime calculations do not inspect a code's prefix. A new code without an explicit type becomes `unknown` and prevents its FG from being marked ready.

Supported types:

- `packaging`: displayed and included in readiness.
- `non_packaging`: excluded from this packaging assessment.
- missing/other: displayed as needing classification and not reported ready.

This makes exceptions explicit. For example, a future packaging code beginning with 5 can be classified as `packaging`, while raw material with any other prefix can be classified `non_packaging`.

## Units

Stock is aggregated only after matching its unit to the BOM line unit. Safe textual aliases such as `pcs`/`ชิ้น` and `kg`/`กก.` normalize to the same unit. No numeric conversion ratio is inferred from a product name.

Each different-unit conversion in `BOM_UNIT_CONVERSIONS` must specify:

```js
{ code:'PRODUCT-CODE', from:'ม้วน', to:'ซอง', factor:5700, source:'Document name/revision approved by owner' }
```

`factor` means BOM units per one stock unit. It must be a finite positive number. `source` is mandatory. There must be exactly one matching rule. A missing, invalid, duplicate or unsourced rule leaves the FG in **ยังประเมินไม่ได้** instead of using an invented quantity.

The embedded stock snapshot has 18 FG requiring review (live totals may differ after stock updates), including stock `ม้วน` against BOM `ซอง` and stock `ชิ้น` against BOM `แผ่น`. The dashboard displays the precise mismatch on each affected component. Enter conversions only after obtaining an approved specification.

## Conservative readiness

An FG is reported ready only if every included packaging line has an explicit component type, valid BOM unit, finite positive usage quantity, valid stock quantity and compatible unit. One incomplete line makes the whole FG **ยังประเมินไม่ได้**. Zero compatible stock is a valid calculation and reports the FG as not ready.

Warehouses 800 and 900 remain excluded. Their quantities are shown using their native units and never silently added to production-eligible stock.
