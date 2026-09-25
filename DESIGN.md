---
version: alpha
name: BCL WMS Operations Ledger
description: A structured warehouse workspace for stock, pallet maps, scanning and inventory workflows.
colors:
  primary: "#205943"
  primary-hover: "#164532"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  canvas: "#F2F5F0"
  canvas-dark: "#10261F"
  surface-dark: "#19372E"
  ink: "#18342D"
  ink-dark: "#F2F8F1"
  secondary: "#50675E"
  secondary-dark: "#C5D8CA"
  muted: "#667A70"
  border: "#D5E1D6"
  border-dark: "#365748"
  success: "#286B4D"
  warning: "#B47724"
  danger: "#AD4448"
  focus: "#A1C952"
typography:
  page-title:
    fontFamily: Noto Sans Thai
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  section-title:
    fontFamily: Noto Sans Thai
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: Noto Sans Thai
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Noto Sans Thai
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: Noto Sans Thai
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 8px
  md: 10px
  lg: 12px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  page-dark:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.ink-dark}"
  card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.secondary-dark}"
  helper-text:
    textColor: "{colors.muted}"
  divider:
    backgroundColor: "{colors.border}"
  divider-dark:
    backgroundColor: "{colors.border-dark}"
  success-badge:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
  warning-indicator:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.ink}"
  danger-badge:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
  focus-indicator:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.on-primary}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 44px
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 44px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

## Overview

This is a working warehouse interface. Staff must distinguish actions, stock status, scanned locations and document numbers quickly on desktop and mobile. The structure takes inspiration from the data-oriented [Airtable DESIGN.md in VoltAgent's collection](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/airtable), adapted to BCL's green logo and the needs of a Thai warehouse. The interface uses a forest-green navigation rail, pale work surface, crisp white modules and a lime active state. BCL's data, logo, Thai labels and task flows remain the source of content.

## Colors

Forest green identifies navigation and main actions. Lime highlights the active destination and total value; muted green means successful or available, and red means error or overdue. White cards sit on a pale sage canvas; dark mode uses deep green surfaces. Color accompanies text, never replaces it.

## Typography

Use Noto Sans Thai with system fallbacks. The dashboard overview title is large and calm; section titles remain compact. Labels stay close to their fields. Tabular numerals keep quantities, costs, document numbers and pallet counts easy to scan. Never shrink mobile form text below 16px, avoiding browser zoom on focus.

## Layout

Use a 4px spacing grid. Desktop has a 256px forest-green navigation rail and a fluid content area. The stock overview groups the building table beside age, capacity and value cards. Narrow screens use a horizontal tab rail and single-column forms. Keep related controls inside one panel. Preserve full-width maps, responsive data tables and 44px minimum interactive targets.

## Elevation & Depth

Use quiet 1px borders and almost no shadow on ordinary cards. Dialogs may cast a stronger shadow. Avoid gradients on ordinary cards and summary values.

## Shapes

Inputs and navigation tabs use 8px corners; panels use 12px corners. Only small status badges use pill shapes. Keep icon stroke weight and button heights consistent across workflows.

## Components

Buttons have primary, secondary, danger and disabled states. Inputs, search, select and scan fields share height, radius and a visible lime focus outline. Table headers use a subtle green wash; numerical cells use tabular figures. Panels, step cards, tables, empty states and status badges use the same surface and border tokens. Critical information is never conveyed by color alone.

## Do's and Don'ts

- Do keep quantity, location, product and document labels visible beside their data.
- Do use short Thai action labels and predictable spacing in receive, putaway, issue and print flows.
- Do preserve status text and keyboard focus when adding color.
- Don't center narrow forms inside a wide page or let controls use inconsistent heights.
- Don't apply decorative treatments to the CAD map, QR code or printed labels.
- Don't copy decorative sample metrics or warehouse counts from the reference image.
