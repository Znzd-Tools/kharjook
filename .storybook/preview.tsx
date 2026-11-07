import type { Decorator, Preview } from '@storybook/nextjs-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { DesignSystemProvider } from '../src/design-system';
import './preview.css';

const withApp: Decorator = (Story, ctx) => {
  const layout = ctx.parameters.layout as string | undefined;
  const look = (ctx.globals.look as string | undefined) ?? 'base';
  if (typeof document !== 'undefined') document.documentElement.dataset.look = look;
  return (
    <DesignSystemProvider>
      <div
        dir="rtl"
        lang="fa"
        className="ss02 bg-canvas font-sans text-fg antialiased"
        style={
          layout === 'fullscreen'
            ? { minHeight: '100dvh' }
            : { maxWidth: 'var(--ds-max-width)', margin: '0 auto', padding: '1.5rem 1rem', minHeight: '100%' }
        }
      >
        <Story />
      </div>
    </DesignSystemProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    look: {
      description: 'Visual direction (exploration)',
      toolbar: {
        title: 'Look',
        icon: 'paintbrush',
        items: [
          { value: 'base', title: 'Base (v1)' },
          { value: 'pastel', title: 'A — Pastel' },
          { value: 'candy', title: 'B — Candy dark' },
          { value: 'bento', title: 'C — Bento' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    withApp,
    withThemeByDataAttribute({
      themes: { dark: 'dark', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
      parentSelector: 'html',
    }),
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    backgrounds: { disable: true },
    a11y: { test: 'todo' },
    nextjs: { appDirectory: true },
    viewport: {
      options: {
        iphone15: { name: 'iPhone 15', styles: { width: '393px', height: '852px' } },
        android: { name: 'Android (Pixel 8)', styles: { width: '412px', height: '915px' } },
      },
    },
    options: {
      storySort: {
        order: ['Introduction', 'Foundations', ['Colors', 'Typography', 'Spacing & Layout', 'Radius & Elevation', 'Motion', 'Iconography'], 'Actions', 'Data Display', 'Forms', 'Feedback', 'Overlays', 'Navigation', 'Charts', 'Patterns'],
      },
    },
  },
  initialGlobals: { viewport: { value: 'iphone15', isRotated: false }, look: 'base' },
  tags: ['autodocs'],
};

export default preview;
