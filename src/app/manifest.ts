import type { MetadataRoute } from 'next';
import { PWA_BRAND_COLOR, PWA_CANVAS_COLOR } from '@/shared/lib/pwa-brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/login?source=pwa',
    name: 'خرجوک',
    short_name: 'خرجوک',
    description: 'مدیریت سبد دارایی و تراکنش‌ها',
    start_url: '/login?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: PWA_BRAND_COLOR,
    theme_color: PWA_CANVAS_COLOR,
    prefer_related_applications: false,
    lang: 'fa',
    dir: 'rtl',
    categories: ['finance', 'productivity'],
    // Share a bank SMS (or any text) to the app → filled add screen.
    share_target: {
      action: '/transactions/new',
      method: 'GET',
      params: { title: 'title', text: 'text' },
    },
    shortcuts: [
      {
        name: 'ثبت هزینه',
        short_name: 'هزینه',
        url: '/transactions/new?type=EXPENSE',
      },
      {
        name: 'ثبت درآمد',
        short_name: 'درآمد',
        url: '/transactions/new?type=INCOME',
      },
      {
        name: 'قیمت‌ها و نرخ‌ها',
        short_name: 'قیمت‌ها',
        url: '/prices',
      },
      {
        name: 'سررسیدها',
        short_name: 'سررسید',
        url: '/deadlines',
      },
    ],
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
