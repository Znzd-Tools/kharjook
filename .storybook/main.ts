import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/design-system/**/*.mdx', '../src/design-system/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: { name: '@storybook/nextjs-vite', options: {} },
  staticDirs: [{ from: '../src/app/fonts', to: '/fonts' }],
  core: { disableTelemetry: true },
};

export default config;
