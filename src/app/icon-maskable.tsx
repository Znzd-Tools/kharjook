import { renderPwaIcon } from '@/shared/lib/pwa-icon';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function IconMaskable() {
  return renderPwaIcon(512);
}
