import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { MeterProvider } from "./src/context/MeterContext";
import LiveMeterScreen from "./src/screens/LiveMeterScreen";
import CalibrationScreen from "./src/screens/CalibrationScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <MeterProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: "#0B0F1A", borderTopColor: "#1E293B" },
            tabBarActiveTintColor: "#F59E0B",
            tabBarInactiveTintColor: "#64748B"
          }}
        >
          <Tab.Screen name="Meter" component={LiveMeterScreen} />
          <Tab.Screen name="Calibrate" component={CalibrationScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </MeterProvider>
  );
}
