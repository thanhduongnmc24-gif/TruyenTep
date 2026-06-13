import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  PcMessage,
  PcPendingFile,
  downloadFileFromPc,
  getPcUrl,
  getPendingFilesFromPc,
  pullMessagesFromPc,
  sendTextToPc,
  uploadFileToPc,
} from "../../services/pcApi";

type TimelineItem =
  | {
      id: string;
      kind: "text";
      sender: "iphone" | "pc";
      content: string;
      createdAt: string;
      createdAtMs: number;
    }
  | {
      id: string;
      kind: "file";
      sender: "iphone" | "pc";
      fileName: string;
      size?: number;
      file?: PcPendingFile;
      createdAt: string;
      createdAtMs: number;
    };

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("Chưa kết nối PC");

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const pcUrl = await getPcUrl();

        if (!pcUrl) {
          setStatus("Chưa nhập địa chỉ PC");
          return;
        }

        await pullMessages();
        await loadFiles();
      } catch {
        // Không để polling làm app crash
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, [timeline]);

  function nowText() {
    return new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function parseTime(value: string) {
    const parsed = Date.parse(value.replace(" ", "T"));
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  function addItems(items: TimelineItem[]) {
    setTimeline((old) => {
      const ids = new Set(old.map((x) => x.id));
      const filtered = items.filter((x) => !ids.has(x.id));

      if (filtered.length === 0) {
        return old;
      }

      return [...old, ...filtered].sort(
        (a, b) => a.createdAtMs - b.createdAtMs
      );
    });
  }

  async function sendText() {
    const content = text.trim();

    if (!content) {
      return;
    }

    try {
      const result = await sendTextToPc(content);

      if (result.ok) {
        const createdAtMs = Date.now();

        addItems([
          {
            id: `iphone_text_${createdAtMs}`,
            kind: "text",
            sender: "iphone",
            content,
            createdAt: nowText(),
            createdAtMs,
          },
        ]);

        setText("");
        setStatus("Đã gửi tin nhắn");
      } else {
        Alert.alert("Lỗi", result.error ?? "Không gửi được tin nhắn.");
      }
    } catch (error: any) {
      Alert.alert("Lỗi gửi text", error.message);
    }
  }

  async function pullMessages() {
    try {
      const data: PcMessage[] = await pullMessagesFromPc();

      if (data.length === 0) {
        return;
      }

      addItems(
        data.map((m) => ({
          id: `pc_text_${m.id}`,
          kind: "text",
          sender: "pc",
          content: m.content,
          createdAt: m.createdAt,
          createdAtMs: parseTime(m.createdAt),
        }))
      );

      setStatus(`Nhận ${data.length} tin nhắn từ PC`);
    } catch {
      // Không để app crash
    }
  }

  async function loadFiles() {
    try {
      const files = await getPendingFilesFromPc();

      if (files.length === 0) {
        return;
      }

      addItems(
        files.map((f) => ({
          id: `pc_file_${f.id}`,
          kind: "file",
          sender: "pc",
          fileName: f.fileName,
          size: f.size,
          file: f,
          createdAt: f.createdAt,
          createdAtMs: parseTime(f.createdAt),
        }))
      );

      setStatus(`Có ${files.length} file từ PC`);
    } catch {
      // Không để app crash
    }
  }

  async function sendFile() {
  try {
    const pcUrl = await getPcUrl();

    if (!pcUrl) {
      Alert.alert("Chưa có địa chỉ PC", "Vào tab Cài đặt nhập địa chỉ PC trước.");
      return;
    }

    const DocumentPicker = await import("expo-document-picker");

    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const pickedFile = result.assets[0];

    const upload = await uploadFileToPc({
      uri: pickedFile.uri,
      name: pickedFile.name,
      mimeType: pickedFile.mimeType,
    });

    if (upload.ok) {
      const createdAtMs = Date.now();

      addItems([
        {
          id: `iphone_file_${createdAtMs}`,
          kind: "file",
          sender: "iphone",
          fileName: upload.fileName ?? pickedFile.name,
          size: upload.size,
          createdAt: nowText(),
          createdAtMs,
        },
      ]);

      setStatus("Đã gửi file sang PC");
    } else {
      Alert.alert("Lỗi", upload.error ?? "Không gửi được file.");
    }
  } catch (error: any) {
    Alert.alert("Lỗi gửi file", error?.message ?? "Không gửi được file.");
  }
}

  async function downloadFile(file: PcPendingFile) {
    try {
      await downloadFileFromPc(file);
    } catch (error: any) {
      Alert.alert("Lỗi tải file", error.message);
    }
  }

  async function copyTextToClipboard(content: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(content);
    Alert.alert("Đã copy", "Đã copy nội dung tin nhắn.");
  } catch {
    Alert.alert("Không copy được", "Thiếu module expo-clipboard hoặc thiết bị không hỗ trợ.");
  }
}

 
function toggle(id: string) {
  setExpanded((old) => {
    const next = { ...old };
    next[id] = !old[id];
    return next;
  });
}


  function formatSize(size?: number) {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Truyền Tệp</Text>
          <Text style={styles.subtitle}>Chat PC ↔ iPhone</Text>
        </View>

        <View style={styles.statusPill}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusText}>LAN</Text>
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
      >
        {timeline.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
            <Text style={styles.emptyText}>
              Vào Cài đặt nhập IP PC, sau đó nhắn tin tại đây.
            </Text>
          </View>
        ) : null}

        {timeline.map((item) => {
          const isMine = item.sender === "iphone";

          if (item.kind === "file") {
            return (
              <View
                key={item.id}
                style={[styles.row, isMine ? styles.right : styles.left]}
              >
                <View
                  style={[
                    styles.fileBubble,
                    isMine ? styles.myFileBubble : styles.pcFileBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.fileText,
                      isMine ? styles.myFileText : styles.pcFileText,
                    ]}
                    numberOfLines={2}
                  >
                    📄 {item.fileName}
                  </Text>

                  <Text
                    style={[
                      styles.fileMeta,
                      isMine ? styles.myTimeText : styles.pcTimeText,
                    ]}
                  >
                    {formatSize(item.size)} • {item.createdAt}
                  </Text>

                  {!isMine && item.file ? (
                    <Pressable
                      style={styles.downloadButton}
                      onPress={() => downloadFile(item.file!)}
                    >
                      <Text style={styles.downloadText}>Tải file</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }

          return (
            <View
              key={item.id}
              style={[styles.row, isMine ? styles.right : styles.left]}
            >
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.myBubble : styles.pcBubble,
                ]}
              >
                <Text
                  numberOfLines={expanded[item.id] ? undefined : 5}
                  style={[
                    styles.messageText,
                    isMine ? styles.myMessageText : styles.pcMessageText,
                  ]}
                >
                  {item.content}
                </Text>

                {item.content.length > 160 ? (
                  <Pressable onPress={() => toggle(item.id)}>
                    <Text
                      style={[
                        styles.moreText,
                        isMine ? styles.moreTextMine : styles.moreTextPc,
                      ]}
                    >
                      {expanded[item.id] ? "Thu gọn" : "Xem thêm"}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.messageFooter}>
                  <Text
                    style={[
                      styles.timeText,
                      isMine ? styles.myTimeText : styles.pcTimeText,
                    ]}
                  >
                    {item.createdAt}
                  </Text>

                  {!isMine ? (
                    <Pressable onPress={() => copyTextToClipboard(item.content)}>
                     <Text style={styles.copyText}>Copy</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputBox}>
        <Pressable style={styles.fileButton} onPress={sendFile}>
          <Text style={styles.fileButtonText}>📎</Text>
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nhắn tin..."
          placeholderTextColor="#94a3b8"
          multiline
          style={styles.input}
        />

        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={sendText}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
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
    fontWeight: "900",
    fontSize: 12,
  },
  status: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  emptyBox: {
    marginTop: 90,
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  emptyText: {
    marginTop: 4,
    color: "#64748b",
    textAlign: "center",
  },
  row: {
    marginVertical: 5,
    width: "100%",
  },
  left: {
    alignItems: "flex-start",
  },
  right: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 6,
  },
  pcBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: "#ffffff",
  },
  pcMessageText: {
    color: "#0f172a",
  },
  moreText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "900",
  },
  moreTextMine: {
    color: "#dbeafe",
  },
  moreTextPc: {
    color: "#2563eb",
  },
  messageFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  myTimeText: {
    color: "#dbeafe",
  },
  pcTimeText: {
    color: "#94a3b8",
  },
  copyText: {
    color: "#0369a1",
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fileBubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 18,
    marginVertical: 5,
  },
  myFileBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 6,
  },
  pcFileBubble: {
    backgroundColor: "#fef3c7",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  fileText: {
    fontSize: 15,
    fontWeight: "900",
  },
  myFileText: {
    color: "#ffffff",
  },
  pcFileText: {
    color: "#78350f",
  },
  fileMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  downloadButton: {
    marginTop: 9,
    alignSelf: "flex-start",
    backgroundColor: "#f59e0b",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  downloadText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  fileButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  fileButtonText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    fontSize: 16,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#bfdbfe",
  },
  sendText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
});