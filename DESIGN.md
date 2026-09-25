---
version: alpha
name: BCL WMS Carbon Operations
description: A flat, square warehouse workspace based on IBM Carbon principles for stock, pallet maps, scanning and inventory workflows.
colors:
  primary: "#0F62FE"
  primary-hover: "#0050E6"
  on-primary: "#FFFFFF"
  surface: "#F4F4F4"
  canvas: "#FFFFFF"
  canvas-dark: "#161616"
  surface-dark: "#262626"
  ink: "#161616"
  ink-dark: "#F4F4F4"
  secondary: "#525252"
  secondary-dark: "#C6C6C6"
  muted: "#6F6F6F"
  border: "#D7D7D7"
  border-dark: "#474747"
  success: "#198038"
  warning: "#806000"
  danger: "#B81922"
  focus: "#0F62FE"
typography:
  page-title:
    fontFamily: IBM Plex Sans Thai
    fontSize: 24px
    fontWeight: 300
    lineHeight: 1.3
  section-title:
    fontFamily: IBM Plex Sans Thai
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: IBM Plex Sans Thai
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: IBM Plex Sans Thai
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: IBM Plex Sans Thai
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 0px
  md: 0px
  lg: 0px
  pill: 0px
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

This is a working warehouse interface. Staff must distinguish actions, stock status, scanned locations and document numbers quickly on desktop and mobile. The visual direction adapts [IBM's DESIGN.md in VoltAgent's collection](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/ibm): white and gray surfaces, charcoal navigation, IBM Blue as the action accent, square controls and hairline borders. BCL's data, logo, Thai labels and task flows remain the source of content.

## Colors

Charcoal identifies navigation and IBM Blue identifies active destinations and main actions. Green means successful or available; yellow indicates caution; red means error or overdue. Light-gray modules sit on a white canvas; dark mode uses charcoal and graphite surfaces. Color accompanies text, never replaces it.

## Typography

Use IBM Plex Sans Thai and IBM Plex Sans with Noto Sans Thai and system fallbacks. Display text is light in weight; section titles use medium weight. Labels stay close to their fields. Tabular numerals keep quantities, costs, document numbers and pallet counts easy to scan. Never shrink mobile form text below 16px, avoiding browser zoom on focus.

## Layout

Use a 4px spacing grid. Desktop has a 256px charcoal navigation rail and a fluid content area. The stock overview groups the building table beside age, capacity and value cards. Narrow screens use a horizontal tab rail and single-column forms. Keep related controls inside one panel. Preserve full-width maps, responsive data tables and 44px minimum interactive targets.

## Elevation & Depth

Use 1px gray borders and flat surface changes instead of shadows on ordinary cards. Dialogs may cast a stronger shadow. Avoid gradients on ordinary cards and summary values.

## Shapes

Inputs, buttons, tabs, cards and panels use square corners. Keep icon stroke weight and button heights consistent across workflows.

## Components

Buttons have primary, secondary, danger and disabled states. Inputs, search, select and scan fields share height, a square bottom-rule treatment and a visible blue focus outline. Table headers use a neutral gray wash; numerical cells use tabular figures. Panels, step cards, tables, empty states and status badges use the same surface and border tokens. Critical information is never conveyed by color alone.

## Do's and Don'ts

- Do keep quantity, location, product and document labels visible beside their data.
- Do use short Thai action labels and predictable spacing in receive, putaway, issue and print flows.
- Do preserve status text and keyboard focus when adding color.
- Don't center narrow forms inside a wide page or let controls use inconsistent heights.
- Don't apply decorative treatments to the CAD map, QR code or printed labels.
- Don't copy decorative sample metrics or warehouse counts from the reference image.
