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

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      pullMessages();
      loadFiles();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, [timeline]);

  function now() {
    return new Date().toLocaleTimeString();
  }

  function parseTime(t: string) {
    const d = Date.parse(t.replace(" ", "T"));
    return isNaN(d) ? Date.now() : d;
  }

  function addItems(items: TimelineItem[]) {
    setTimeline((old) => {
      const ids = new Set(old.map((x) => x.id));
      const filtered = items.filter((x) => !ids.has(x.id));
      return [...old, ...filtered].sort((a, b) => a.createdAtMs - b.createdAtMs);
    });
  }

  async function sendText() {
    const content = text.trim();
    if (!content) return;

    const res = await sendTextToPc(content);

    if (res.ok) {
      addItems([
        {
          id: "iphone_" + Date.now(),
          kind: "text",
          sender: "iphone",
          content,
          createdAt: now(),
          createdAtMs: Date.now(),
        },
      ]);
      setText("");
    }
  }

  async function pullMessages() {
    const data: PcMessage[] = await pullMessagesFromPc();

    if (data.length > 0) {
      addItems(
        data.map((m) => ({
          id: "pc_" + m.id,
          kind: "text",
          sender: "pc",
          content: m.content,
          createdAt: m.createdAt,
          createdAtMs: parseTime(m.createdAt),
        }))
      );
    }
  }

  async function loadFiles() {
    const files = await getPendingFilesFromPc();

    if (files.length > 0) {
      addItems(
        files.map((f) => ({
          id: "pc_file_" + f.id,
          kind: "file",
          sender: "pc",
          fileName: f.fileName,
          size: f.size,
          file: f,
          createdAt: f.createdAt,
          createdAtMs: parseTime(f.createdAt),
        }))
      );
    }
  }

  async function sendFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*" });

    if (res.canceled) return;

    const file = res.assets[0];

    const upload = await uploadFileToPc({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
    });

    if (upload.ok) {
      addItems([
        {
          id: "iphone_file_" + Date.now(),
          kind: "file",
          sender: "iphone",
          fileName: upload.fileName,
          size: upload.size,
          createdAt: now(),
          createdAtMs: Date.now(),
        },
      ]);
    }
  }

  async function downloadFile(f: PcPendingFile) {
    await downloadFileFromPc(f);
  }

  function toggle(id: string) {
    setExpanded((old) => ({ ...old, [id]: !old[id] }));
  }

  async function copy(text: string) {
    await Clipboard.setStringAsync(text);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView ref={scrollRef} style={styles.chat}>
        {timeline.map((item) => {
          const isMine = item.sender === "iphone";

          if (item.kind === "file") {
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  isMine ? styles.right : styles.left,
                ]}
              >
                <View
                  style={[
                    styles.fileBubble,
                    isMine ? styles.blue : styles.yellow,
                  ]}
                >
                  <Text style={styles.fileText}>
                    📄 {item.fileName}
                  </Text>

                  {!isMine && item.file && (
                    <Pressable onPress={() => downloadFile(item.file!)}>
                      <Text style={styles.download}>Tải file</Text>
                    </Pressable>
                  )}
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
                  isMine ? styles.blue : styles.white,
                ]}
              >
                <Text
                  numberOfLines={expanded[item.id] ? 0 : 5}
                  style={[
                    styles.text,
                    isMine ? styles.whiteText : styles.blackText,
                  ]}
                >
                  {item.content}
                </Text>

                {item.content.length > 200 && (
                  <Pressable onPress={() => toggle(item.id)}>
                    <Text style={styles.more}>
                      {expanded[item.id] ? "Thu gọn" : "Xem thêm"}
                    </Text>
                  </Pressable>
                )}

                {!isMine && (
                  <Pressable onPress={() => copy(item.content)}>
                    <Text style={styles.copy}>Copy</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputBox}>
        <Pressable style={styles.btn} onPress={sendFile}>
          <Text>📎</Text>
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nhắn tin..."
          style={styles.input}
        />

        <Pressable style={styles.send} onPress={sendText}>
          <Text style={{ color: "#fff" }}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },

  chat: { flex: 1, padding: 10 },

  row: { marginVertical: 5 },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },

  bubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 15,
  },

  blue: { backgroundColor: "#2563eb" },
  white: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  text: { fontSize: 15 },
  whiteText: { color: "#fff" },
  blackText: { color: "#000" },

  more: {
    marginTop: 4,
    fontSize: 12,
    color: "#999",
  },

  copy: {
    marginTop: 4,
    fontSize: 10,
    color: "#4f46e5",
  },

  fileBubble: {
    padding: 10,

    borderRadius: 15,
  },
  yellow: { backgroundColor: "#fde68a" },

  fileText: { fontWeight: "bold" },

  download: {
    marginTop: 6,
    color: "#fff",
    backgroundColor: "#f59e0b",
    padding: 5,
    borderRadius: 5,
    alignSelf: "flex-start",
  },

  inputBox: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
  },

  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    padding: 10,
    marginHorizontal: 8,
  },

  btn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  send: {
    width: 40,
    backgroundColor: "#2563eb",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});