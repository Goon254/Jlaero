# Jlaero mobile design system

Everything visual flows from `lib/tokens.ts` and the kit in `components/ui/`.
Screens never hardcode hex values; they read `colors` from `useTheme()`.

## Direction

Quiet luxury. Editorial serif headings (Playfair Display) over a clean sans
body (Inter), deep navy ink in dark mode and warm ivory in light mode, with a
single gold accent used sparingly for emphasis and primary actions.

## Theme

- `ThemeProvider` in `lib/theme.tsx` resolves the scheme from the user's saved
  preference (Auto / Light / Dark, persisted in AsyncStorage under
  `jlaero.theme`) and the OS setting.
- Palettes live in `lib/tokens.ts` as semantic tokens: `bg`, `surface`,
  `surfaceRaised`, `surfaceSunken`, `border`, `text`, `textSecondary`,
  `textTertiary`, `accent`, `accentText`, semantic tones, `scrim`, `skeleton`.
- `accent` (#c9a24b) is for fills such as buttons and pills. `accentText` is
  the gold that is safe as text on the current background (lighter in dark
  mode, darker in light mode). Never put `accent` text directly on a light
  surface.
- Every text and background pair clears WCAG AA (4.5:1) in both palettes;
  tertiary text is at least 4.2:1 on any surface.

## Typography

`Text` variants: `display`, `title` (serif), `headline`, `subhead`, `body`,
`bodyStrong`, `caption`, `captionStrong`, `label` (uppercase eyebrow). Display
and title cap the Dynamic Type multiplier so hero layouts do not break; all
other variants scale freely.

## Kit

`Button`, `IconButton`, `Card`, `PressableCard`, `Input`, `Segmented`,
`Pill`, `StatusPill`, `ListRow`, `EmptyState`, `Skeleton`, `Avatar`,
`Screen`, `ScreenHeader`, `SectionTitle`, `Icon`, `Pressable`.

- `Pressable` gives every tappable a 120 ms scale and opacity press state, an
  optional haptic, and honours Reduce Motion.
- Icons are Ionicons only (outline at rest, filled when a tab is active).
  Never use emoji as icons.
- Touch targets are at least 48 pt (`touchTarget`).
- Spacing follows the 4 pt scale in `space`; radii in `radius`.

## Adding a screen

1. Wrap in `Screen`; use `ScreenHeader` for tab roots, native header for
   pushed screens.
2. Pull colors from `useTheme()` and text from `Text`.
3. Loading uses `Skeleton`, empty uses `EmptyState`.
4. Check the screen in both Light and Dark from Account > Appearance.
