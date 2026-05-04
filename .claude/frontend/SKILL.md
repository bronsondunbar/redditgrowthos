---
name: modern-ui-upgrade
description: Upgrade UI/UX to a modern, clean, production-quality interface. Remove clutter, improve spacing, hierarchy, typography, component consistency, enforce brand identity, and implement high-converting landing page layouts.
version: 1.4
---

# Modern UI Upgrade Skill

## Purpose

Transform existing UI from cluttered, inconsistent, or “vibe coded” styling into a **modern, clean, structured, production-ready interface** that uniquely reflects the product identity, enforces a **primary brand color**, and implements **landing page layouts optimized for engagement and conversions**.

Focus on:

- Visual hierarchy
- Spacing consistency
- Typography refinement
- Solid color discipline with a primary brand color
- Component consistency
- UX clarity
- Removing unnecessary visual noise
- Reinforcing project-specific identity
- Landing page layout for conversions

---

# Core Design Principles

## 1. Reduce Visual Noise

Remove:

- Excessive gradients
- Glows
- Heavy shadows
- Thick borders
- Overly decorative effects
- Random visual clutter

Prefer:

- Clean layouts
- Subtle shadow (`shadow-sm` / `shadow-md`)
- Rounded corners (`rounded-xl` / `rounded-2xl`)
- Neutral surfaces
- Clear hierarchy over decoration

> Every design element should serve hierarchy, clarity, or engagement.

---

## 2. Spacing System (Strict & Consistent)

- Use a consistent 4px / 8px spacing scale
- Utilities: `p-6`, `py-12`, `space-y-6`, `gap-6`, `max-w-5xl` / `max-w-6xl`, `mx-auto`
- Generous whitespace between sections
- Avoid cramped layouts
- Normalize padding across components
- Internal card padding minimum `p-6`

> Whitespace = clarity and calm

---

## 3. Typography Hierarchy

- H1: Large, bold, confident
- H2: Strong but secondary
- H3: Medium weight
- Body: Highly readable
- Muted text: Lower contrast, legible

Rules:

- Max 1–2 font families
- Avoid decorative fonts
- Use consistent font weights: 400,500,600,700
- Increased line-height for readability
- Hierarchy prioritized over decorative color

---

## 4. Color System & Primary Brand Color

### Primary Brand Color

- Must be **defined per project**
- Use consistently for:
  - CTAs
  - Interactive elements
  - Highlights
- Reinforce product identity and brand recognition

### Solid-Only Rule

- All structural UI elements must use solid colors
- Backgrounds, cards, sections, navbars, modals, sidebars, tables
- No gradients, neon transitions, multi-color accents, or animated gradients

### Semantic Colors

- Success, Error, Warning, Info
- Only use these for functional messaging

---

## 5. Modern Surface & Card Design

- Rounded corners (`rounded-xl` / `rounded-2xl`)
- Subtle shadow (`shadow-sm` / `shadow-md`)
- Internal padding (`p-6` minimum)
- Avoid heavy borders, nested cards without spacing, decorative backgrounds
- Maintain clarity and visual calm

---

## 6. Button System Standardization

- Three variants: Primary, Secondary, Ghost/Subtle
- Primary button uses **brand color**
- Consistent height, border-radius, hover/active state
- No gradients, glows, animations
- Buttons must communicate clear actions

---

## 7. Layout Structure & Landing Page Design

### High-Converting Landing Page Layout

1. **Hero Section**
   - Clear headline + value proposition
   - Strong CTA button in brand color
   - Visual or product illustration
2. **Feature Section**
   - 2–4 key features or benefits
   - Distinct visual blocks, consistent spacing
   - Highlight primary value props
3. **Social Proof Section**
   - Testimonials, reviews, client logos
   - Build trust and credibility
4. **CTA Section Near Bottom**
   - Reinforce action and conversion
   - Repeat primary CTA
5. **Responsive & Mobile Optimized**
   - Use flex/grid intentionally
   - Ensure all elements are accessible on small devices
6. **Visual Flow**
   - Guide user through content
   - Whitespace and hierarchy direct attention

> Avoid generic SaaS templates. Layouts must align with product identity and conversion goals.

---

## 8. UX Improvements

- Empty states: clear messaging and actionable steps
- Loading states: skeleton screens or subtle spinner
- Forms: proper spacing, labels, and validation
- Navigation: intuitive and discoverable
- Clickable elements: obvious affordance
- Accessibility: color contrast, readability, focus indicators
- Reduce cognitive overload and decision fatigue

---

# Project Identity & Distinctiveness

### Product Identity Enforcement

- UI must reflect product positioning, target user, emotional tone, and differentiators
- Visual design must reinforce brand personality and core product value
- Avoid generic SaaS layouts
- Include **at least one defining visual trait per page**:
  - Layout rhythm
  - Typography personality
  - Navigation structure
  - Accent treatment
- Every design decision must **signal uniqueness and purpose**

---

# Refactoring Strategy

1. Remove gradients and unnecessary decorative effects
2. Normalize spacing and layout
3. Standardize typography
4. Apply primary brand color consistently
5. Standardize buttons and cards
6. Reinforce product identity and distinctiveness
7. Use high-converting landing page layout for marketing pages
8. Ensure responsiveness, usability, and accessibility
9. Maintain functionality

Do NOT:

- Add flashy animations or gimmicks
- Overcomplicate layout
- Change business logic unnecessarily

---

# Design Goal

Final UI should feel:

- Modern, clean, structured, calm
- Enterprise-ready but unique to the product
- Visually balanced and conversion-optimized
- Reinforced by a strong primary brand color
- Timeless, intentional, and project-specific
