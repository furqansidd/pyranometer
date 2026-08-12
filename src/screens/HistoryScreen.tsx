import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { loadReadings, clearReadings, exportReadingsCSV } from "../utils/storage";
import { IrradianceReading } from "../types";

export default function HistoryScreen() {
  const [readings, setReadings] = useState<IrradianceReading[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadReadings().then(setReadings);
    }, [])
  );

  const handleClear = () => {
    Alert.alert("Clear reading history?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearReadings();
          setReadings([]);
        }
      }
    ]);
  };

  const handleExport = async () => {
    if (readings.length === 0) return;
    await exportReadingsCSV(readings);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Text style={styles.actionText}>Export CSV</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.clearButton]} onPress={handleClear}>
            <Text style={styles.actionText}>Clear</Text>
          </Pressable>
        </View>

        <FlatList
          data={readings}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
              <Text style={styles.value}>
                {item.irradianceWm2.toFixed(0)} W/m² {item.extrapolated ? "⚠" : ""}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No logged readings yet. Start logging from the Meter tab.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionButton: { backgroundColor: "#F59E0B", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  clearButton: { backgroundColor: "#1E293B" },
  actionText: { color: "#0B0F1A", fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomColor: "#1E293B",
    borderBottomWidth: 1
  },
  time: { color: "#94A3B8", fontSize: 12 },
  value: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 20 }
});
