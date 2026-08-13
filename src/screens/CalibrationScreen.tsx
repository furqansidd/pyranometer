import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, SafeAreaView, Alert, Keyboard } from "react-native";
import { useMeter } from "../context/MeterContext";
import { CalibrationPoint } from "../types";

export default function CalibrationScreen() {
  const { ev100, points, fit, addCalibrationPoint, removeCalibrationPoint, clearCalibrationPoints } = useMeter();
  const [refValue, setRefValue] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const samplesRef = useRef<number[]>([]);
  const ev100Ref = useRef(ev100);

  useEffect(() => {
    ev100Ref.current = ev100;
  }, [ev100]);

  // Collect samples while measuring is active
  useEffect(() => {
    if (measuring) {
      samplesRef.current.push(ev100);
    }
  }, [ev100, measuring]);

  // Countdown timer loop
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setMeasuring(false);
      setCountdown(null);

      const samples = samplesRef.current;
      const avgEv100 = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : ev100Ref.current;
      
      const parsed = parseFloat(refValue);
      addCalibrationPoint(parsed, avgEv100);
      setRefValue("");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleAdd = async () => {
    const parsed = parseFloat(refValue);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert("Enter a valid W/m² reading from your reference pyranometer.");
      return;
    }
    Keyboard.dismiss();
    samplesRef.current = [];
    setCountdown(5);
    setMeasuring(true);
  };

  const handleClear = () => {
    Alert.alert("Clear all calibration points?", "This resets the fit entirely.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearCalibrationPoints }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Calibrate</Text>
        <Text style={styles.instructions}>
          Point the phone at the same target your reference pyranometer is reading, at the
          same moment. Enter its W/m² value and tap Add Point. Hold the phone still next to the
          reference pyranometer during the 5-second countdown to record a stable reading.
        </Text>

        <View style={styles.liveBox}>
          <Text style={styles.liveLabel}>Current camera EV100</Text>
          <Text style={styles.liveValue}>{ev100.toFixed(2)}</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, measuring && styles.inputDisabled]}
            placeholder="Reference W/m²"
            placeholderTextColor="#64748B"
            keyboardType="decimal-pad"
            value={refValue}
            onChangeText={setRefValue}
            editable={!measuring}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
          {isInputFocused && (
            <Pressable style={styles.doneButton} onPress={() => Keyboard.dismiss()}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.addButton, measuring && styles.addButtonMeasuring]}
            onPress={handleAdd}
            disabled={measuring}
          >
            <Text style={styles.addButtonText}>
              {measuring ? `Measuring (${countdown}s)` : "Add Point"}
            </Text>
          </Pressable>
        </View>

        {fit && (
          <View style={styles.fitBox}>
            <Text style={styles.fitText}>
              Fit: log10(W/m²) = {fit.slope.toFixed(4)} × EV100 + {fit.intercept.toFixed(4)}
            </Text>
            <Text style={styles.fitText}>R² = {fit.rSquared.toFixed(4)} · Range EV100 [{fit.minEv100.toFixed(1)}, {fit.maxEv100.toFixed(1)}]</Text>
            {fit.rSquared < 0.9 && (
              <Text style={styles.warn}>
                R² below 0.9 — readings are noisy or the range is too narrow. Add more spread-out points.
              </Text>
            )}
          </View>
        )}

        <FlatList
          data={[...points].sort((a, b) => b.timestamp - a.timestamp)}
          keyExtractor={(p) => p.id}
          style={styles.list}
          renderItem={({ item }: { item: CalibrationPoint }) => (
            <View style={styles.pointRow}>
              <Text style={styles.pointText}>
                EV100 {item.ev100.toFixed(2)} → {item.referenceIrradiance.toFixed(0)} W/m²
              </Text>
              <Pressable onPress={() => removeCalibrationPoint(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No calibration points yet.</Text>}
        />

        {points.length > 0 && (
          <Pressable style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", marginBottom: 8 },
  instructions: { color: "#94A3B8", fontSize: 13, marginBottom: 16, lineHeight: 18 },
  liveBox: { backgroundColor: "#141B2D", borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 16 },
  liveLabel: { color: "#94A3B8", fontSize: 12 },
  liveValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: "#141B2D",
    color: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputDisabled: { opacity: 0.5 },
  doneButton: { backgroundColor: "#1E293B", borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  doneButtonText: { color: "#FFFFFF", fontWeight: "700" },
  addButton: { backgroundColor: "#F59E0B", borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  addButtonMeasuring: { backgroundColor: "#475569" },
  addButtonText: { color: "#0B0F1A", fontWeight: "700" },
  fitBox: { backgroundColor: "#141B2D", borderRadius: 12, padding: 14, marginBottom: 16 },
  fitText: { color: "#94A3B8", fontSize: 12 },
  warn: { color: "#F59E0B", fontSize: 12, marginTop: 6 },
  list: { flex: 1 },
  pointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: "#1E293B",
    borderBottomWidth: 1
  },
  pointText: { color: "#FFFFFF", fontSize: 13 },
  remove: { color: "#EF4444", fontSize: 13 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 20 },
  clearButton: { marginTop: 12, alignSelf: "center" },
  clearButtonText: { color: "#EF4444", fontSize: 13 }
});
