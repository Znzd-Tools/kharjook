/** Token catalog for docs. Keep in sync with styles/tokens.css. */

export const colorGroups = [
  {
    name: 'Surfaces',
    description: 'Layers from back to front. Most screens need only canvas + panel.',
    tokens: [
      { name: 'canvas', use: 'Page background' },
      { name: 'sunken', use: 'Inputs, segmented track, inset areas' },
      { name: 'panel', use: 'Cards, lists, sheets, tab bar' },
      { name: 'elevated', use: 'Popovers, menus, dialogs, toasts' },
      { name: 'hover', use: 'Hover overlay / neutral fill' },
      { name: 'pressed', use: 'Pressed overlay' },
      { name: 'scrim', use: 'Backdrop behind overlays' },
    ],
  },
  {
    name: 'Text',
    description: 'Four steps. Never use a color as the only text cue.',
    tokens: [
      { name: 'fg', use: 'Primary text, numbers' },
      { name: 'fg-muted', use: 'Secondary text, labels' },
      { name: 'fg-subtle', use: 'Captions, meta, placeholders' },
      { name: 'fg-disabled', use: 'Disabled text' },
      { name: 'fg-on-accent', use: 'Text on accent fills' },
    ],
  },
  {
    name: 'Lines',
    description: 'Dividers and outlines. Prefer space over lines.',
    tokens: [
      { name: 'line', use: 'Dividers, outline cards' },
      { name: 'line-strong', use: 'Control borders, switch track' },
    ],
  },
  {
    name: 'Accent',
    description: 'Brand violet. Only for the main action, active state and focus.',
    tokens: [
      { name: 'accent', use: 'Primary button, FAB, active indicator' },
      { name: 'accent-hover', use: 'Hover on accent fills' },
      { name: 'accent-soft', use: 'Selected item background' },
      { name: 'accent-ink', use: 'Accent text and links' },
      { name: 'focus', use: 'Focus ring' },
    ],
  },
  {
    name: 'Status',
    description: 'Meaning, not decoration. Always pair with an icon or text.',
    tokens: [
      { name: 'positive', use: 'Income, profit, done' },
      { name: 'positive-soft', use: 'Positive background' },
      { name: 'positive-ink', use: 'Positive text' },
      { name: 'negative', use: 'Expense, loss, error, overdue' },
      { name: 'negative-soft', use: 'Negative background' },
      { name: 'negative-ink', use: 'Negative text' },
      { name: 'warning', use: 'Due soon, near budget cap' },
      { name: 'warning-soft', use: 'Warning background' },
      { name: 'warning-ink', use: 'Warning text' },
      { name: 'info', use: 'Neutral notice' },
      { name: 'info-soft', use: 'Info background' },
      { name: 'info-ink', use: 'Info text' },
    ],
  },
  {
    name: 'Pastel tints',
    description: 'Identity for entities (categories, wallets, assets). Bright pastel with dark ink, also in dark mode. Never for status.',
    tokens: (['rose', 'peach', 'lemon', 'mint', 'sky', 'lilac'] as const).flatMap((t) => [
      { name: `tint-${t}-soft`, use: `${t} tile background` },
      { name: `tint-${t}-ink`, use: `${t} icon / text on tile` },
    ]),
  },
  {
    name: 'Charts',
    description: 'Categorical, fixed order, never cycled. 9th+ series → "سایر" (chart-other).',
    tokens: [
      ...Array.from({ length: 8 }, (_, i) => ({ name: `chart-${i + 1}`, use: `Series ${i + 1}` })),
      { name: 'chart-other', use: 'Folded "سایر" series' },
    ],
  },
] as const;

export const typeScale = [
  { name: 'display', size: '32 / 44', weight: 800, use: 'Hero number (net worth)' },
  { name: 'headline', size: '24 / 34', weight: 800, use: 'Large page title, big amounts' },
  { name: 'title', size: '18 / 28', weight: 600, use: 'Sheet and dialog titles' },
  { name: 'body', size: '15 / 24', weight: 400, use: 'Default text, inputs' },
  { name: 'callout', size: '13 / 22', weight: 400, use: 'List titles, buttons, section titles' },
  { name: 'caption', size: '12 / 18', weight: 400, use: 'Subtitles, hints, meta' },
  { name: 'micro', size: '11 / 16', weight: 500, use: 'Tab labels, badges, axis labels' },
] as const;

export const radii = [
  { name: 'control', value: '18px', use: 'Inputs, menu items, small tiles' },
  { name: 'card', value: '28px', use: 'Cards, lists, stat tiles, hero' },
  { name: 'sheet', value: '36px', use: 'Sheets, dialogs' },
  { name: 'full', value: '9999px', use: 'Buttons, chips, segmented, avatars, FAB' },
] as const;

export const shadows = [
  { name: 'raised', use: 'Selected segment, switch thumb' },
  { name: 'hero', use: 'Hero card only' },
  { name: 'overlay', use: 'Sheets, menus, dialogs, toasts' },
  { name: 'fab', use: 'Floating action button only' },
] as const;

export const spacing = [
  { token: '1', px: 4, use: 'Icon to text (tight)' },
  { token: '2', px: 8, use: 'Chip gaps, icon to text' },
  { token: '3', px: 12, use: 'Row gap, list item gap' },
  { token: '4', px: 16, use: 'Page gutter, card padding' },
  { token: '6', px: 24, use: 'Between sections' },
  { token: '8', px: 32, use: 'Large section breaks' },
] as const;

export const motion = [
  { name: '--ds-duration-instant', value: '80ms', use: 'Press feedback' },
  { name: '--ds-duration-fast', value: '150ms', use: 'Hover, color changes' },
  { name: '--ds-duration-base', value: '220ms', use: 'Toggles, tabs, expand' },
  { name: '--ds-duration-slow', value: '350ms', use: 'Entrances, progress' },
  { name: 'ease-standard', value: 'cubic-bezier(0.2, 0, 0, 1)', use: 'Most transitions' },
  { name: 'ease-emphasized', value: 'cubic-bezier(0.32, 0.72, 0, 1)', use: 'Sheets, sliding indicators' },
  { name: 'ease-exit', value: 'cubic-bezier(0.4, 0, 1, 1)', use: 'Leaving elements' },
] as const;
