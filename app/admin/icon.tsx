/**
 * ADMIN layer — white-label favicon. Generated from adminConfig, not a
 * static asset, so rebranding (brand name, primary color) never requires
 * touching this file.
 */
import { ImageResponse } from 'next/og';
import { adminConfig } from './config';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: adminConfig.primaryColorHex,
          borderRadius: 7,
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        {adminConfig.brandName.trim().charAt(0).toUpperCase()}
      </div>
    ),
    { ...size },
  );
}
