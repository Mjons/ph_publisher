import { ImageResponse } from 'next/og';
import { getComicBySlug } from '@/lib/comic-queries';

export const alt = 'Comic cover';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comic = await getComicBySlug(slug);

  if (!comic) {
    return new ImageResponse(
      (
        <div style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#09090b',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: 48, color: '#ffffff', fontWeight: 'bold' }}>
            PANEL HAUS
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const displayTitle = comic.series_name && comic.issue_number
    ? comic.series_name
    : comic.title;

  const subtitle = comic.series_name && comic.issue_number
    ? `Issue #${comic.issue_number}`
    : null;

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        padding: 60,
        alignItems: 'center',
        gap: 60,
      }}>
        <img
          src={comic.cover_url}
          width={340}
          height={510}
          style={{
            borderRadius: 8,
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.1)',
          }}
        />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          gap: 12,
        }}>
          {comic.brand_name && (
            <div style={{
              fontSize: 20,
              color: '#818cf8',
              textTransform: 'uppercase',
              letterSpacing: 4,
              fontWeight: 'bold',
            }}>
              {comic.brand_name}
            </div>
          )}
          <div style={{
            fontSize: 52,
            fontWeight: 'bold',
            color: '#ffffff',
            lineHeight: 1.1,
          }}>
            {displayTitle}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 32,
              color: '#a1a1aa',
            }}>
              {subtitle}
            </div>
          )}
          <div style={{
            fontSize: 20,
            color: '#a855f7',
            textTransform: 'uppercase',
            letterSpacing: 6,
            marginTop: 32,
            fontWeight: 'bold',
          }}>
            PANEL HAUS
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
