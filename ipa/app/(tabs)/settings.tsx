import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getPcUrl, pingPc, savePcUrl } from "../../services/pcApi";

export default function SettingsScreen() {
  const [pcUrl, setPcUrl] = useState("");
  const [status, setStatus] = useState("Chưa kiểm tra kết nối");

  useEffect(() => {
    loadSavedUrl();
  }, []);

  async function loadSavedUrl() {
    const saved = await getPcUrl();

    if (saved) {
      setPcUrl(saved);
      setStatus("Đã tải địa chỉ PC đã lưu");
    }
  }

  async function handleSave() {
    const cleanUrl = pcUrl.trim().replace(/\/+$/, "");

    if (!cleanUrl) {
      Alert.alert("Thiếu địa chỉ", "Nhập địa chỉ PC trước.");
      return;
    }

    await savePcUrl(cleanUrl);
    setPcUrl(cleanUrl);
    setStatus("Đã lưu địa chỉ PC");

    Alert.alert("Đã lưu", cleanUrl);
  }

  async function handlePing() {
    try {
      const cleanUrl = pcUrl.trim().replace(/\/+$/, "");

      if (!cleanUrl) {
        Alert.alert("Thiếu địa chỉ", "Nhập địa chỉ PC trước.");
        return;
      }

      await savePcUrl(cleanUrl);
      setPcUrl(cleanUrl);

      const result = await pingPc();

      setStatus("Kết nối PC thành công");

      Alert.alert(
        "Kết nối thành công",
        `Server: ${result.server ?? result.serverUrl ?? cleanUrl}`
      );
    } catch (error: any) {
      setStatus("Kết nối PC thất bại");
      Alert.alert("Kết nối thất bại", error.message);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Cài đặt kết nối PC</Text>

      <Text style={styles.label}>Địa chỉ PC</Text>

      <TextInput
        value={pcUrl}
        onChangeText={setPcUrl}
        placeholder="Ví dụ: http://192.168.1.217:8787"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      <Text style={styles.status}>{status}</Text>

      <Pressable style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonText}>Lưu địa chỉ</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handlePing}>
        <Text style={styles.secondaryButtonText}>Test kết nối PC</Text>
      </Pressable>

      <Text style={styles.note}>
        PC và iPhone phải cùng Wi‑Fi. Nếu PC khởi động lại và đổi IP, hãy nhập
        lại địa chỉ mới tại đây.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 18,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  status: {
    marginTop: 10,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#38bdf8",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0369a1",
    fontWeight: "900",
    fontSize: 15,
  },
  note: {
    marginTop: 18,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
  },
});