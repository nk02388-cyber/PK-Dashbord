---
version: alpha
name: BCL Packaging Operations
description: A warm, modular warehouse design system for stock, pallet maps, scanning and inventory workflows.
colors:
  primary: "#214E63"
  primary-hover: "#183F51"
  on-primary: "#FFFFFF"
  surface: "#FFFEFA"
  canvas: "#EBEDE4"
  canvas-dark: "#10232E"
  surface-dark: "#1B303B"
  ink: "#152B34"
  ink-dark: "#F6F4E9"
  secondary: "#52636A"
  secondary-dark: "#C5D3D0"
  muted: "#6D7B7D"
  border: "#DCE3DC"
  border-dark: "#385360"
  success: "#2D7758"
  warning: "#E0CE9C"
  danger: "#B84C4C"
  focus: "#214E63"
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
  sm: 11px
  md: 12px
  lg: 20px
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

This is a working warehouse interface. Staff must distinguish actions, stock status, scanned locations and document numbers quickly on desktop and mobile. The visual direction is inspired by [Beadaptify's Warehouse Inventory Dashboard on Dribbble](https://dribbble.com/shots/26587734-Warehouse-Inventory-Dashboard): a deep navy navigation rail, warm off-white workspace, golden active state and modular operational cards. BCL's data, logo, Thai labels and task flows remain the source of content.

## Colors

Deep blue identifies navigation and the main action. Gold highlights the active destination and total value; green means successful or available, and red means error or overdue. Warm white cards sit on a pale stone canvas; dark mode uses deep blue surfaces. Color accompanies text, never replaces it.

## Typography

Use Noto Sans Thai with system fallbacks. The dashboard overview title is large and calm; section titles remain compact. Labels stay close to their fields. Tabular numerals keep quantities, costs, document numbers and pallet counts easy to scan. Never shrink mobile form text below 16px, avoiding browser zoom on focus.

## Layout

Use a 4px spacing grid. Desktop has a 268px navy navigation rail and a fluid content area. The stock overview groups the building table beside age, capacity and value cards. Narrow screens use a horizontal tab rail and single-column forms. Keep related controls inside one panel. Preserve full-width maps, responsive data tables and 44px minimum interactive targets.

## Elevation & Depth

Use quiet 1px borders and a restrained soft shadow to lift white cards from the warm canvas. Dialogs may cast a stronger shadow. Avoid gradients on ordinary cards and summary values.

## Shapes

Inputs use 11px corners and panels use 20px corners. Navigation tabs, filter controls and status badges use pill shapes. Keep icon stroke weight and button heights consistent across workflows.

## Components

Buttons have primary, secondary, danger and disabled states. Inputs, search, select and scan fields share height, radius and a visible blue focus outline. Panels, step cards, tables, empty states and status badges use the same surface and border tokens. Critical information is never conveyed by color alone.

## Do's and Don'ts

- Do keep quantity, location, product and document labels visible beside their data.
- Do use short Thai action labels and predictable spacing in receive, putaway, issue and print flows.
- Do preserve status text and keyboard focus when adding color.
- Don't center narrow forms inside a wide page or let controls use inconsistent heights.
- Don't apply decorative treatments to the CAD map, QR code or printed labels.
- Don't copy decorative sample metrics or warehouse counts from the reference image.
