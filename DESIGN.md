---
version: alpha
name: BCL Packaging Operations
description: A clear, compact design system for warehouse stock, pallet maps, scanning and inventory workflows.
colors:
  primary: "#1E40AF"
  primary-hover: "#1B378F"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  canvas: "#F3F6FB"
  canvas-dark: "#081321"
  surface-dark: "#122238"
  ink: "#12233D"
  ink-dark: "#F4F7FC"
  secondary: "#425670"
  secondary-dark: "#C5D2E4"
  muted: "#62748B"
  border: "#D7E1EE"
  border-dark: "#31445F"
  success: "#15803D"
  warning: "#F59E0B"
  danger: "#C62836"
  focus: "#2563EB"
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
  md: 12px
  lg: 16px
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

This is a working warehouse interface. Staff must distinguish actions, stock status, scanned locations and document numbers quickly on desktop and mobile. Use calm navy surfaces, one blue action color and restrained semantic status colors. Keep the existing BCL mark and Thai-first labels.

## Colors

Blue identifies navigation and the main action. Green means successful or available, amber means attention or a highlighted inventory total, and red means error or overdue. White cards sit on a cool, low-contrast canvas; the dark theme uses the same semantic hierarchy.

## Typography

Use Noto Sans Thai with system fallbacks. Page and section titles identify place and task; labels stay close to their fields. Tabular numerals keep quantities, costs, document numbers and pallet counts easy to scan. Never shrink mobile form text below 16px, avoiding browser zoom on focus.

## Layout

Use a 4px spacing grid. Desktop has a 320px navigation rail and a fluid content area. Narrow screens use a horizontal tab rail and single-column forms. Keep related controls inside one panel. Preserve full-width maps, responsive data tables and 44px minimum interactive targets.

## Elevation & Depth

Use one subtle card shadow and a stronger dialog shadow. Borders define groups before shadows do. Avoid gradients on ordinary cards; reserve a restrained accent treatment for high-level summary values.

## Shapes

Inputs and buttons use 8px corners; panels and dialogs use 16px corners. Status badges may be pill-shaped. Keep icon stroke weight and button heights consistent across workflows.

## Components

Buttons have primary, secondary, danger and disabled states. Inputs, search, select and scan fields share height, radius and focus treatment. Panels, step cards, tables, empty states and status badges use the same surface and border tokens. Critical information is never conveyed by color alone.

## Do's and Don'ts

- Do keep quantity, location, product and document labels visible beside their data.
- Do use short Thai action labels and predictable spacing in receive, putaway, issue and print flows.
- Do preserve status text and keyboard focus when adding color.
- Don't center narrow forms inside a wide page or let controls use inconsistent heights.
- Don't apply decorative treatments to the CAD map, QR code or printed labels.
