import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SecrétariatPro';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: 'white',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 900,
            }}
          >
            SP
          </div>
          <span style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.02em' }}>
            SecrétariatPro
          </span>
        </div>
        <p
          style={{
            fontSize: '28px',
            fontWeight: 500,
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
            opacity: 0.9,
          }}
        >
          Mise en relation sécurisée entre entreprises exigeantes et secrétaires qualifiées.
        </p>
      </div>
    ),
    { ...size }
  );
}
