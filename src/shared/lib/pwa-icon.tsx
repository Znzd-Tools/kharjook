import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { PWA_BRAND_COLOR } from '@/shared/lib/pwa-brand';

const LOGO_PATH = join(process.cwd(), 'public/logo.png');

let logoDataUrl: string | null = null;

async function getLogoDataUrl() {
  if (!logoDataUrl) {
    const data = await readFile(LOGO_PATH);
    logoDataUrl = `data:image/jpeg;base64,${data.toString('base64')}`;
  }
  return logoDataUrl;
}

export async function renderPwaIcon(size: number) {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PWA_BRAND_COLOR,
        }}
      >
        <img src={logoSrc} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
