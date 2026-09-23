import React, { Fragment } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import type { Palette } from '../../theme';
import { shortDayLabel } from '../../trendsStats';
import type { SymptomDay } from '../../trendsStats';

interface Props {
  days: SymptomDay[];
  colors: Palette;
}

/** Symptom severity over time: one dot per logged day (1–5), connected in
 *  time order. Hand-rolled SVG like WeightChart — no extra native modules. */
export default function SymptomHistoryChart({ days, colors }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(280, windowWidth - 64);
  const height = 180;
  const pad = { left: 28, right: 12, top: 16, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const n = days.length;
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  // Severity 1 at the bottom, 5 at the top.
  const y = (sev: number) => pad.top + (1 - (sev - 1) / 4) * innerH;

  const linePts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.severity).toFixed(1)}`).join(' ');
  const sevs = days.map((d) => d.severity);
  const low = Math.min(...sevs);
  const high = Math.max(...sevs);
  const latest = sevs[n - 1];
  const a11yLabel = `Symptom history chart: ${n} days, severity low ${low}, high ${high}, latest ${latest}`;

  return (
    <View>
      <Svg width={width} height={height} accessibilityRole="image" accessibilityLabel={a11yLabel}>
        {/* severity gridlines 1–5 */}
        {[1, 2, 3, 4, 5].map((sev) => (
          <Fragment key={sev}>
            <Polyline
              points={`${pad.left},${y(sev).toFixed(1)} ${(pad.left + innerW).toFixed(1)},${y(sev).toFixed(1)}`}
              fill="none"
              stroke={colors.border}
              strokeWidth={sev === 3 ? 1 : 0.5}
              opacity={0.6}
            />
            <SvgText x={pad.left - 6} y={y(sev) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
              {sev}
            </SvgText>
          </Fragment>
        ))}
        {n > 1 && (
          <Polyline points={linePts} fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.7} />
        )}
        {/* Dots only when the chart isn't crowded — the line carries it past ~30 points. */}
        {n <= 30 &&
          days.map((d, i) => (
            <Circle key={`${d.day}-${i}`} cx={x(i)} cy={y(d.severity)} r={4} fill={colors.accent} />
          ))}
        <SvgText x={pad.left} y={height - 8} fontSize={10} fill={colors.muted}>
          {shortDayLabel(days[0].day)}
        </SvgText>
        {n > 1 && (
          <SvgText
            x={pad.left + innerW}
            y={height - 8}
            fontSize={10}
            fill={colors.muted}
            textAnchor="end"
          >
            {shortDayLabel(days[n - 1].day)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
