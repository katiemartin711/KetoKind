import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import type { Palette } from '../../theme';
import { round1, shortDayLabel } from '../../trendsStats';
import type { WeightPoint } from '../../trendsStats';

interface Props {
  points: WeightPoint[];
  colors: Palette;
}

/** Hand-rolled SVG line chart (react-native-svg ships in Expo Go, so this
 *  adds no native risk — unlike chart libraries that need extra native
 *  modules). Min/max/current points are marked; themed via the palette. */
export default function WeightChart({ points, colors }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(280, windowWidth - 64);
  const height = 190;
  const pad = { left: 12, right: 12, top: 20, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const weights = points.map((p) => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const n = points.length;
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * innerH;

  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  const areaPts =
    `${pad.left},${(pad.top + innerH).toFixed(1)} ` +
    linePts +
    ` ${(pad.left + innerW).toFixed(1)},${(pad.top + innerH).toFixed(1)}`;

  const minIdx = weights.indexOf(Math.min(...weights));
  const maxIdx = weights.indexOf(Math.max(...weights));
  const lastIdx = n - 1;

  return (
    <View>
      <Svg width={width} height={height} accessibilityRole="image" accessibilityLabel="Weight trend graph">
        <Polygon points={areaPts} fill={colors.accent} opacity={0.12} />
        <Polyline points={linePts} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        {/* Dots only when the chart isn't crowded — the line carries it past ~30 points. */}
        {points.length <= 30 &&
          points.map((p, i) => (
            <Circle key={i} cx={x(i)} cy={y(p.weight)} r={3} fill={colors.accent} />
          ))}
        {/* min / max markers */}
        <Circle cx={x(minIdx)} cy={y(weights[minIdx])} r={5} fill="none" stroke={colors.muted} strokeWidth={2} />
        <SvgText
          x={x(minIdx)}
          y={y(weights[minIdx]) - 10}
          fontSize={10}
          fill={colors.muted}
          textAnchor="middle"
        >
          {`low ${round1(weights[minIdx])}`}
        </SvgText>
        <Circle cx={x(maxIdx)} cy={y(weights[maxIdx])} r={5} fill="none" stroke={colors.muted} strokeWidth={2} />
        <SvgText
          x={x(maxIdx)}
          y={y(weights[maxIdx]) - 10}
          fontSize={10}
          fill={colors.muted}
          textAnchor="middle"
        >
          {`high ${round1(weights[maxIdx])}`}
        </SvgText>
        {/* current marker */}
        <Circle cx={x(lastIdx)} cy={y(weights[lastIdx])} r={5.5} fill={colors.accent} />
        <SvgText
          x={x(lastIdx)}
          y={y(weights[lastIdx]) + 18}
          fontSize={11}
          fontWeight="700"
          fill={colors.text}
          textAnchor="middle"
        >
          {round1(weights[lastIdx])}
        </SvgText>
        {/* x-axis day labels */}
        <SvgText x={pad.left} y={height - 8} fontSize={10} fill={colors.muted}>
          {shortDayLabel(points[0].day)}
        </SvgText>
        {n > 1 && (
          <SvgText
            x={pad.left + innerW}
            y={height - 8}
            fontSize={10}
            fill={colors.muted}
            textAnchor="end"
          >
            {shortDayLabel(points[lastIdx].day)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
