import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, G, Line } from "react-native-svg";

type Props = {
  value: number;      // W/m²
  max?: number;        // gauge ceiling
  extrapolated?: boolean;
};

const SIZE = 260;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const START_ANGLE = -220; // degrees, gauge sweep
const SWEEP = 260;

function polarToCartesian(angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(angleRad),
    y: CENTER + RADIUS * Math.sin(angleRad)
  };
}

function describeArc(startDeg: number, endDeg: number) {
  const start = polarToCartesian(endDeg);
  const end = polarToCartesian(startDeg);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function GaugeView({ value, max = 1200, extrapolated }: Props) {
  const clamped = Math.min(Math.max(value, 0), max);
  const fraction = clamped / max;
  const needleAngle = START_ANGLE + fraction * SWEEP;

  const zones = [
    { from: 0, to: 0.25, color: "#3B82F6" },   // low light - blue
    { from: 0.25, to: 0.55, color: "#22C55E" }, // moderate - green
    { from: 0.55, to: 0.8, color: "#F59E0B" },  // bright - amber
    { from: 0.8, to: 1, color: "#EF4444" }      // full sun - red
  ];

  const needleTip = polarToCartesian(needleAngle);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {zones.map((z, i) => (
          <Path
            key={i}
            d={describeArc(START_ANGLE + z.from * SWEEP, START_ANGLE + z.to * SWEEP)}
            stroke={z.color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="butt"
          />
        ))}
        <G>
          <Line
            x1={CENTER}
            y1={CENTER}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={extrapolated ? "#94A3B8" : "#FFFFFF"}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx={CENTER} cy={CENTER} r={8} fill="#475569" />
        </G>
      </Svg>
      <View style={styles.readout}>
        <Text style={styles.value}>{clamped.toFixed(0)}</Text>
        <Text style={styles.unit}>W/m²</Text>
        {extrapolated && <Text style={styles.warning}>outside calibrated range</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  readout: { position: "absolute", alignItems: "center", top: SIZE * 0.55 },
  value: { fontSize: 44, fontWeight: "700", color: "#FFFFFF" },
  unit: { fontSize: 14, color: "#94A3B8", marginTop: -4 },
  warning: { fontSize: 11, color: "#F59E0B", marginTop: 6 }
});

