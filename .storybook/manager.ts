import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'dark',
    brandTitle: 'Kharjook Design System',
    colorPrimary: '#7c3aed',
    colorSecondary: '#7c3aed',
  }),
  sidebar: { showRoots: true },
});
