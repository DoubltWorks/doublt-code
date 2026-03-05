import { useMemo } from 'react';
import { OverlayBackdrop } from './OverlayBackdrop';

interface PairingOverlayProps {
  serverUrl: string;
  tunnelUrl: string | null;
  tunnelStatus: string;
  onClose: () => void;
}

interface QRRect {
  x: number;
  y: number;
  size: number;
}

// Minimal QR placeholder using React SVG elements (no dangerouslySetInnerHTML)
function QRPlaceholder({ data }: { data: string }) {
  const size = 140;
  const cells = 21;
  const cellSize = size / cells;

  const rects = useMemo(() => {
    const result: QRRect[] = [];
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const isPositionMarker =
          (x < 7 && y < 7) ||
          (x >= cells - 7 && y < 7) ||
          (x < 7 && y >= cells - 7);
        const hash = (data.charCodeAt((x + y * cells) % data.length) || 0) + x * 31 + y * 37;
        const filled = isPositionMarker
          ? (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
          : hash % 3 === 0;
        if (filled) {
          result.push({ x: x * cellSize, y: y * cellSize, size: cellSize });
        }
      }
    }
    return result;
  }, [data, cellSize]);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.size} height={r.size} fill="currentColor" />
      ))}
    </svg>
  );
}

export function PairingOverlay({ serverUrl, tunnelUrl, tunnelStatus, onClose }: PairingOverlayProps) {
  const pairingUrl = tunnelUrl || serverUrl;
  const pairingCode = pairingUrl.split('//')[1]?.split('/')[0] || pairingUrl;

  return (
    <OverlayBackdrop onClose={onClose} width={380}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Mobile Pairing
      </div>

      <div
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* QR Code */}
        <div
          style={{
            width: 160,
            height: 160,
            padding: 10,
            background: '#fff',
            borderRadius: 8,
            color: '#000',
          }}
        >
          <QRPlaceholder data={pairingUrl} />
        </div>

        {/* Pairing URL */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Copy URL and open on your phone
          </div>
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--bg-surface)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--accent)',
              fontFamily: 'inherit',
              userSelect: 'all',
              cursor: 'text',
            }}
          >
            {pairingUrl}
          </div>
        </div>

        {/* Pairing code */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Or enter pairing code
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              color: 'var(--text-primary)',
            }}
          >
            {pairingCode.slice(0, 6).toUpperCase()}
          </div>
        </div>

        {/* Tunnel status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background:
                tunnelStatus === 'active'
                  ? 'var(--green)'
                  : tunnelStatus === 'error'
                    ? 'var(--red)'
                    : 'var(--text-muted)',
            }}
          />
          Tunnel: {tunnelStatus}
          {tunnelUrl && <span style={{ color: 'var(--text-muted)' }}>({tunnelUrl})</span>}
        </div>
      </div>
    </OverlayBackdrop>
  );
}
