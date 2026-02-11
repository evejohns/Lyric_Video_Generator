import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Audio } from 'remotion';
import { templates } from './templates';

interface LyricLine {
  text: string;
  start_time: number | null;
  end_time: number | null;
}

interface LyricVideoProps {
  lyrics: LyricLine[];
  audioUrl: string;
  template: any;
  config: any; // Full VideoConfig with background, text, effects, etc.
  albumArtUrl?: string; // Album cover art URL
}

export const LyricVideo: React.FC<LyricVideoProps> = ({
  lyrics,
  audioUrl,
  template,
  config,
  albumArtUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Convert frame to seconds
  const currentTime = frame / fps;

  // Find current lyric based on time
  const currentLyric = lyrics.find((lyric) => {
    if (!lyric.start_time) return false;
    const endTime = lyric.end_time || lyric.start_time + 5;
    return currentTime >= lyric.start_time && currentTime < endTime;
  });

  // Look up template by ID (same as VideoPreview does)
  const templateData: any = templates.find((t: any) => t.id === config.template) || templates[0];

  // Use template data for rendering (same as preview)
  const backgroundColors = templateData.gradient.join(', ');
  const backgroundType = templateData.config.background?.gradientType || 'linear';
  const backgroundPattern = templateData.config.background?.pattern || '';
  const decorativeElements = templateData.config.effects?.decorativeShapes || [];

  // Calculate optimal text color
  const calculateLuminance = (hexColor: string): number => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
  };

  // Use template colors for luminance calculation
  const luminances = templateData.gradient.map((color: string) => calculateLuminance(color));
  const maxLuminance = Math.max(...luminances);

  // Use template text settings with refined styling
  const textColor = templateData.config.text?.color || (maxLuminance < 0.35 ? '#FFFFFF' : '#000000');
  const outlineColor = maxLuminance < 0.35 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';

  // More subtle, professional shadows
  const textShadow = maxLuminance < 0.35
    ? '0 4px 12px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)'
    : '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)';

  // Only show text if there's a current lyric
  const displayText = currentLyric?.text || '';

  // Get background effects from config
  const backgroundEffects = config.backgroundEffects || [];

  // Animation calculations based on frame
  // Gradient Shift: 8 seconds cycle = 240 frames at 30fps
  const gradientShiftProgress = (frame % (fps * 8)) / (fps * 8);
  const gradientPosition = Math.sin(gradientShiftProgress * Math.PI * 2) * 50 + 50;

  // Color Wave: 10 seconds cycle = 300 frames at 30fps
  const colorWaveProgress = (frame % (fps * 10)) / (fps * 10);
  const hueRotation = colorWaveProgress * 360;
  const saturation = 1 + Math.sin(colorWaveProgress * Math.PI * 2) * 0.2;

  // Apply background animations
  const hasGradientShift = backgroundEffects.includes('gradient-shift');
  const hasColorWave = backgroundEffects.includes('color-wave');

  // Build filter string for color wave
  const backgroundFilter = hasColorWave
    ? `hue-rotate(${hueRotation}deg) saturate(${saturation})`
    : 'none';

  return (
    <AbsoluteFill>
      {/* Audio */}
      <Audio src={audioUrl} />

      {/* Background Gradient */}
      <AbsoluteFill
        style={{
          background:
            backgroundType === 'radial'
              ? `radial-gradient(circle, ${backgroundColors})`
              : `linear-gradient(135deg, ${backgroundColors})`,
          backgroundSize: hasGradientShift ? '200% 200%' : '100% 100%',
          backgroundPosition: hasGradientShift ? `${gradientPosition}% 50%` : '0% 0%',
          filter: backgroundFilter,
        }}
      />

      {/* Pattern Overlay */}
      {backgroundPattern && (
        <AbsoluteFill
          style={{
            opacity: 0.3,
            backgroundImage: backgroundPattern.includes('grid')
              ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      )}

      {/* Decorative Elements */}
      {decorativeElements.map((shape: any, index: number) => {
        // Float animation: 15 seconds cycle = 450 frames at 30fps
        const floatCycleDuration = fps * 15;
        const floatProgress = ((frame + index * fps * 2) % floatCycleDuration) / floatCycleDuration;

        // Calculate floating motion
        const floatX = Math.sin(floatProgress * Math.PI * 2) * 20;
        const floatY = Math.cos(floatProgress * Math.PI * 2) * 30 - 30;
        const floatRotate = floatProgress * 360;
        const floatOpacity = 0.3 + Math.sin(floatProgress * Math.PI * 2) * 0.3;

        const baseRotation = shape.rotate || 0;

        const shapeStyle: React.CSSProperties = {
          position: 'absolute',
          top: shape.top || '10%',
          left: shape.left || '10%',
          width: shape.size || '200px',
          height: shape.size || '200px',
          borderRadius: shape.type === 'circle' ? '50%' : '0',
          backgroundColor: shape.color || 'rgba(255,255,255,0.1)',
          opacity: floatOpacity * 0.4,
          transform: `translate(${floatX}px, ${floatY}px) rotate(${baseRotation + floatRotate}deg)`,
        };

        // Handle different shape types
        if (shape.type === 'emoji' || shape.type === 'star') {
          // Render emoji or star as text
          const displayChar = shape.type === 'star' ? '★' : shape.emoji || '⭐';
          return (
            <div
              key={index}
              style={{
                ...shapeStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: shape.size || '80px',
                backgroundColor: 'transparent',
              }}
            >
              {displayChar}
            </div>
          );
        }

        if (shape.type === 'triangle') {
          shapeStyle.width = '0';
          shapeStyle.height = '0';
          shapeStyle.borderLeft = `${parseInt(shape.size || '100') / 2}px solid transparent`;
          shapeStyle.borderRight = `${parseInt(shape.size || '100') / 2}px solid transparent`;
          shapeStyle.borderBottom = `${shape.size || '100px'} solid ${shape.color || 'rgba(255,255,255,0.1)'}`;
          shapeStyle.backgroundColor = 'transparent';
        }

        return <div key={index} style={shapeStyle} />;
      })}

      {/* Lyrics Text */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
        }}
      >
        <div
          style={{
            fontFamily: templateData.config.text?.font || 'Inter, Arial, sans-serif',
            fontSize: `${templateData.config.text?.size || 64}px`,
            color: textColor,
            fontWeight: templateData.config.text?.weight || '800',
            textAlign: 'center',
            textShadow,
            WebkitTextStroke: `2px ${outlineColor}`,
            paintOrder: 'stroke fill',
            maxWidth: '90%',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
          }}
        >
          {displayText}
        </div>
      </AbsoluteFill>

      {/* Album Art - Bottom Right Corner */}
      {albumArtUrl && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '40px',
            pointerEvents: 'none',
          }}
        >
          <img
            src={albumArtUrl}
            alt="Album Art"
            style={{
              width: '200px',
              height: '200px',
              borderRadius: '12px',
              objectFit: 'cover',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)',
              border: '3px solid rgba(255, 255, 255, 0.2)',
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
