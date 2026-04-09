export type GradientPreset = {
  key: string;
  label: string;
  css: string;
  // Swatch colors for the preview pill (from → to)
  from: string;
  to: string;
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    key: 'navy',
    label: 'Navy Blue',
    css: 'linear-gradient(to bottom right, #1a2332, #1e3a5f, #2271b1)',
    from: '#1a2332',
    to: '#2271b1',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    css: 'linear-gradient(to bottom right, #0f0f1a, #1a1a3e, #2d2d6b)',
    from: '#0f0f1a',
    to: '#2d2d6b',
  },
  {
    key: 'forest',
    label: 'Forest',
    css: 'linear-gradient(to bottom right, #0d2b1a, #1a4a2e, #276642)',
    from: '#0d2b1a',
    to: '#276642',
  },
  {
    key: 'emerald',
    label: 'Emerald',
    css: 'linear-gradient(to bottom right, #064e3b, #065f46, #047857)',
    from: '#064e3b',
    to: '#047857',
  },
  {
    key: 'crimson',
    label: 'Crimson',
    css: 'linear-gradient(to bottom right, #3b0a0a, #7f1d1d, #b91c1c)',
    from: '#3b0a0a',
    to: '#b91c1c',
  },
  {
    key: 'burgundy',
    label: 'Burgundy',
    css: 'linear-gradient(to bottom right, #2d0a1a, #6b1a3a, #9d174d)',
    from: '#2d0a1a',
    to: '#9d174d',
  },
  {
    key: 'purple',
    label: 'Purple',
    css: 'linear-gradient(to bottom right, #1e0a3c, #3b0764, #6d28d9)',
    from: '#1e0a3c',
    to: '#6d28d9',
  },
  {
    key: 'slate',
    label: 'Slate',
    css: 'linear-gradient(to bottom right, #0f172a, #1e293b, #334155)',
    from: '#0f172a',
    to: '#334155',
  },
  {
    key: 'charcoal',
    label: 'Charcoal',
    css: 'linear-gradient(to bottom right, #111111, #222222, #3a3a3a)',
    from: '#111111',
    to: '#3a3a3a',
  },
  {
    key: 'teal',
    label: 'Teal',
    css: 'linear-gradient(to bottom right, #042f2e, #134e4a, #0f766e)',
    from: '#042f2e',
    to: '#0f766e',
  },
  {
    key: 'ocean',
    label: 'Ocean',
    css: 'linear-gradient(to bottom right, #0c1445, #0e3a8c, #0284c7)',
    from: '#0c1445',
    to: '#0284c7',
  },
  {
    key: 'sunset',
    label: 'Sunset',
    css: 'linear-gradient(to bottom right, #1a0533, #7c1d6f, #c2410c)',
    from: '#1a0533',
    to: '#c2410c',
  },
];

export const DEFAULT_GRADIENT_KEY = 'navy';

export function getGradientCss(key: string | null | undefined): string {
  const preset = GRADIENT_PRESETS.find((g) => g.key === key);
  return preset?.css ?? GRADIENT_PRESETS[0].css;
}

/** Build the full hero background style — image with overlay, or plain gradient */
export function heroBackground(imageUrl: string | null | undefined, gradientKey: string | null | undefined): string {
  const gradient = getGradientCss(gradientKey);
  if (imageUrl) {
    // Dark overlay so text stays readable over any photo
    return `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%), url(${imageUrl}) center/cover no-repeat`;
  }
  return gradient;
}
