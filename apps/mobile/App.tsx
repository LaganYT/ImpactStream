import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "@impactstream/shared";

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>MOBILE</Text>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.copy}>
          Expo is wired into the monorepo. Build native browsing, playback, profiles,
          and downloads here while sharing platform-neutral contracts from packages/shared.
        </Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080808" },
  container: { flex: 1, justifyContent: "center", padding: 28, gap: 10 },
  eyebrow: { color: "#9ca3af", fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#ffffff", fontSize: 40, fontWeight: "800" },
  copy: { color: "#d1d5db", fontSize: 17, lineHeight: 25 }
});
