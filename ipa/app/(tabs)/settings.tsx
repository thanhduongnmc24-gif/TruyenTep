import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getPcUrl, pingPc, savePcUrl } from "../../services/pcApi";

export default function SettingsScreen() {
  const [pcUrl, setPcUrl] = useState("");

  useEffect(() => {
    loadSavedUrl();
  }, []);

  async function loadSavedUrl() {
    const saved = await getPcUrl();

    if (saved) {
      setPcUrl(saved);
    }
  }

  async function handleSave() {
    if (!pcUrl.trim()) {
      Alert.alert("Thiếu địa chỉ", "Nhập địa chỉ PC trước.");
      return;
    }

    await savePcUrl(pcUrl);

    Alert.alert("Đã lưu", "Đã lưu địa chỉ PC.");
  }

  async function handlePing() {
    try {
      await savePcUrl(pcUrl);

      const result = await pingPc();

      Alert.alert(
        "Kết nối thành công",
        `PC: ${result.pcName}\nServer: ${result.serverUrl}`
      );
    } catch (error: any) {
      Alert.alert("Kết nối thất bại", error.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cài đặt kết nối PC</Text>

      <Text style={styles.label}>Địa chỉ PC</Text>

      <TextInput
        value={pcUrl}
        onChangeText={setPcUrl}
        placeholder="Ví dụ: http://192.168.1.208:8787"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      <View style={styles.buttonBox}>
        <Button title="Lưu địa chỉ" onPress={handleSave} />
      </View>

      <View style={styles.buttonBox}>
        <Button title="Test kết nối PC" onPress={handlePing} />
      </View>

      <Text style={styles.note}>
        PC và iPhone phải cùng Wi-Fi. Nếu không kết nối được, kiểm tra Firewall
        Windows và IP PC.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonBox: {
    marginTop: 4,
  },
  note: {
    marginTop: 16,
    color: "#666",
    lineHeight: 20,
  },
});