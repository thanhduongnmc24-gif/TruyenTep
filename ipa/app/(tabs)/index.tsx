import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";

import {
  PcMessage,
  PcPendingFile,
  downloadFileFromPc,
  getPendingFilesFromPc,
  pullMessagesFromPc,
  sendTextToPc,
  uploadFileToPc,
} from "../../services/pcApi";

type AppButtonVariant = "primary" | "secondary" | "success" | "purple" | "danger";

function AppButton({
  title,
  icon,
  variant = "primary",
  onPress,
}: {
  title: string;
  icon?: string;
  variant?: AppButtonVariant;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.appButton,
        styles[`button_${variant}`],
        pressed && styles.appButtonPressed,
      ]}
    >
      <Text style={styles.appButtonIcon}>{icon}</Text>
      <Text style={styles.appButtonText}>{title}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<PcMessage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PcPendingFile[]>([]);
  const [status, setStatus] = useState("Sẵn sàng kết nối PC");

  useEffect(() => {
    const timer = setInterval(() => {
      handlePullMessages(false);
      handleLoadPendingFiles(false);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  async function handleSendText() {
    if (!text.trim()) {
      Alert.alert("Thiếu nội dung", "Nhập text trước khi gửi.");
      return;
    }

    try {
      const result = await sendTextToPc(text.trim());

      if (result.ok) {
        setText("");
        setStatus("Đã gửi text sang PC");
      } else {
        Alert.alert("Lỗi", result.error ?? "Không gửi được text.");
      }
    } catch (error: any) {
      Alert.alert("Lỗi gửi text", error.message);
    }
  }

  async function handlePullMessages(showAlert = true) {
    try {
      const newMessages = await pullMessagesFromPc();

      if (newMessages.length > 0) {
        setMessages((old) => [...newMessages, ...old]);
        setStatus(`Vừa nhận ${newMessages.length} tin nhắn từ PC`);
      } else {
        setStatus("Không có tin nhắn mới");
      }

      if (showAlert) {
        Alert.alert("Hoàn tất", `Nhận ${newMessages.length} tin nhắn.`);
      }
    } catch (error: any) {
      setStatus("Lỗi kéo dữ liệu");

      if (showAlert) {
        Alert.alert("Lỗi kéo dữ liệu", error.message);
      }
    }
  }

  async function handleCopyText(content: string) {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert("Đã copy", "Nội dung đã được copy vào clipboard.");
    } catch (error: any) {
      Alert.alert("Lỗi copy", error.message);
    }
  }

  async function handlePickAndUploadFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      const uploadResult = await uploadFileToPc({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      });

      if (uploadResult.ok) {
        setStatus(`Đã gửi file: ${uploadResult.fileName}`);
        Alert.alert(
          "Đã gửi file",
          `File đã gửi sang PC:\n${uploadResult.fileName}`
        );
      } else {
        Alert.alert("Lỗi", uploadResult.error ?? "Không gửi được file.");
      }
    } catch (error: any) {
      Alert.alert("Lỗi gửi file", error.message);
    }
  }

  async function handleLoadPendingFiles(showAlert = true) {
    try {
      const files = await getPendingFilesFromPc();
      setPendingFiles(files);
      setStatus(`Có ${files.length} file từ PC`);

      if (showAlert) {
        Alert.alert("Hoàn tất", `Có ${files.length} file từ PC.`);
      }
    } catch (error: any) {
      if (showAlert) {
        Alert.alert("Lỗi lấy file", error.message);
      }
    }
  }

  async function handleDownloadFile(file: PcPendingFile) {
    try {
      await downloadFileFromPc(file);

      Alert.alert(
        "Đang tải file",
        `File: ${file.fileName}\nNếu chạy trên web, file sẽ tải xuống trình duyệt. Nếu chạy trên iPhone, hệ thống sẽ mở link tải.`
      );
    } catch (error: any) {
      Alert.alert("Lỗi tải file", error.message);
    }
  }

  function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Truyền Tệp</Text>
          <Text style={styles.subtitle}>PC ↔ iPhone</Text>
        </View>

        <View style={styles.statusPill}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusText}>LAN</Text>
        </View>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Trạng thái</Text>
        <Text style={styles.statusValue}>{status}</Text>
      </View>

      <View style={styles.composeCard}>
        <View style={styles.composeLeft}>
          <Text style={styles.cardTitle}>Gửi text sang PC</Text>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Nhập nội dung cần gửi..."
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.input}
          />
        </View>

        <View style={styles.composeRight}>
          <AppButton
            icon="➤"
            title="Gửi"
            variant="primary"
            onPress={handleSendText}
          />

          <AppButton
            icon="↧"
            title="Kéo text"
            variant="secondary"
            onPress={() => handlePullMessages(true)}
          />

          <AppButton
            icon="📎"
            title="Gửi file"
            variant="success"
            onPress={handlePickAndUploadFile}
          />

          <AppButton
            icon="☁"
            title="File PC"
            variant="purple"
            onPress={() => handleLoadPendingFiles(true)}
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>File từ PC</Text>
        <Text style={styles.sectionCount}>{pendingFiles.length}</Text>
      </View>

      {pendingFiles.length === 0 ? (
        <Text style={styles.empty}>Chưa có file nào từ PC.</Text>
      ) : (
        pendingFiles.map((item) => (
          <View key={item.id} style={styles.fileItem}>
            <View style={styles.fileIconBox}>
              <Text style={styles.fileIcon}>📄</Text>
            </View>

            <View style={styles.fileContent}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.fileName}
              </Text>
              <Text style={styles.messageTime}>
                {formatSize(item.size)} • {item.createdAt}
              </Text>
            </View>

            <Pressable
              onPress={() => handleDownloadFile(item)}
              style={({ pressed }) => [
                styles.downloadButton,
                pressed && styles.smallPressed,
              ]}
            >
              <Text style={styles.downloadButtonText}>Tải</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tin nhắn nhận từ PC</Text>
        <Text style={styles.sectionCount}>{messages.length}</Text>
      </View>

      {messages.length === 0 ? (
        <Text style={styles.empty}>Chưa có tin nhắn nào.</Text>
      ) : (
        messages.map((item) => (
          <View key={item.id} style={styles.messageItem}>
            <Text style={styles.messageText}>{item.content}</Text>

            <View style={styles.messageFooter}>
              <Text style={styles.messageTime}>{item.createdAt}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed && styles.smallPressed,
                ]}
                onPress={() => handleCopyText(item.content)}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
  },

  header: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 15,
    color: "#64748b",
    fontWeight: "600",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  statusDot: {
    color: "#16a34a",
    fontSize: 10,
  },
  statusText: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 12,
  },

  statusCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statusLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },

  composeCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  composeLeft: {
    flex: 1,
  },
  composeRight: {
    width: 112,
    gap: 8,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    minHeight: 148,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 16,
    padding: 13,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    textAlignVertical: "top",
  },

  appButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  appButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.88,
  },
  appButtonIcon: {
    fontSize: 13,
  },
  appButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  button_primary: {
    backgroundColor: "#2563eb",
  },
  button_secondary: {
    backgroundColor: "#0f172a",
  },
  button_success: {
    backgroundColor: "#16a34a",
  },
  button_purple: {
    backgroundColor: "#7c3aed",
  },
  button_danger: {
    backgroundColor: "#dc2626",
  },

  sectionHeader: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  sectionCount: {
    minWidth: 28,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    color: "#334155",
    fontWeight: "900",
    fontSize: 12,
  },
  empty: {
    color: "#64748b",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
  },

  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  fileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  fileIcon: {
    fontSize: 22,
  },
  fileContent: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1e3a8a",
  },
  downloadButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  downloadButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  messageItem: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    backgroundColor: "#ffffff",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 23,
    color: "#0f172a",
    fontWeight: "500",
  },
  messageFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  messageTime: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0369a1",
  },
  smallPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
});