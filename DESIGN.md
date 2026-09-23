---
version: alpha
name: BCL Packaging Operations
description: A structured, flat design system for warehouse stock, pallet maps, scanning and inventory workflows.
colors:
  primary: "#0F62FE"
  primary-hover: "#0050E6"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  canvas: "#F4F4F4"
  canvas-dark: "#161616"
  surface-dark: "#262626"
  ink: "#161616"
  ink-dark: "#F4F4F4"
  secondary: "#525252"
  secondary-dark: "#C6C6C6"
  muted: "#6F6F6F"
  border: "#D4D4D4"
  border-dark: "#525252"
  success: "#198038"
  warning: "#F1C21B"
  danger: "#DA1E28"
  focus: "#0F62FE"
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
  sm: 4px
  md: 6px
  lg: 8px
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

This is a working warehouse interface. Staff must distinguish actions, stock status, scanned locations and document numbers quickly on desktop and mobile. The structure is informed by the [IBM example in VoltAgent's awesome-design-md collection](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/ibm): flat surfaces, clear hairlines, compact spacing and one confident blue action color. It is adapted for BCL branding, Thai text and operational screens rather than copied as an IBM page.

## Colors

Blue identifies navigation and the main action. Green means successful or available, yellow means attention or a highlighted inventory total, and red means error or overdue. White cards sit on a neutral gray canvas; dark mode uses charcoal surfaces. Color accompanies text, never replaces it.

## Typography

Use Noto Sans Thai with system fallbacks instead of IBM's Latin-first typeface. Page and section titles identify place and task; labels stay close to their fields. Tabular numerals keep quantities, costs, document numbers and pallet counts easy to scan. Never shrink mobile form text below 16px, avoiding browser zoom on focus.

## Layout

Use a 4px spacing grid. Desktop has a 300px navigation rail and a fluid content area. Narrow screens use a horizontal tab rail and single-column forms. Keep related controls inside one panel. Preserve full-width maps, responsive data tables and 44px minimum interactive targets.

## Elevation & Depth

Use 1px hairlines and small surface changes to separate content. Regular cards and controls have no shadow. Only elevated dialogs may cast a shadow. Avoid gradients on ordinary cards and summary values.

## Shapes

Inputs and buttons use 4px corners; panels use 8px corners. Status badges may be pill-shaped when space is tight. Keep icon stroke weight and button heights consistent across workflows.

## Components

Buttons have primary, secondary, danger and disabled states. Inputs, search, select and scan fields share height, radius and a visible blue focus outline. Panels, step cards, tables, empty states and status badges use the same surface and border tokens. Critical information is never conveyed by color alone.

## Do's and Don'ts

- Do keep quantity, location, product and document labels visible beside their data.
- Do use short Thai action labels and predictable spacing in receive, putaway, issue and print flows.
- Do preserve status text and keyboard focus when adding color.
- Don't center narrow forms inside a wide page or let controls use inconsistent heights.
- Don't apply decorative treatments to the CAD map, QR code or printed labels.
- Don't add atmospheric gradients, glass effects or card shadows to routine work surfaces.
