import { Linking, Platform } from "react-native";

const PC_URL_KEY = "pc_server_url";

// Storage đơn giản, tránh SecureStore để loại trừ crash native lúc mở app
const memoryStorage: Record<string, string> = {};

export type PcMessage = {
  id: string;
  content: string;
  createdAt: string;
};

export type PcPendingFile = {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
};

function safeGetLocalStorage(key: string): string | null {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    return null;
  }

  return null;
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // bỏ qua
  }
}

export function savePcUrl(url: string) {
  const cleanUrl = url.trim().replace(/\/+$/, "");

  if (Platform.OS === "web") {
    safeSetLocalStorage(PC_URL_KEY, cleanUrl);
  }

  memoryStorage[PC_URL_KEY] = cleanUrl;
}

export function getPcUrl(): string | null {
  if (memoryStorage[PC_URL_KEY]) {
    return memoryStorage[PC_URL_KEY];
  }

  const webValue = safeGetLocalStorage(PC_URL_KEY);

  if (webValue) {
    memoryStorage[PC_URL_KEY] = webValue;
    return webValue;
  }

  return null;
}

export async function pingPc() {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  try {
    const res = await fetch(`${pcUrl}/api/ping`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch {
    throw new Error("Không kết nối được PC. Kiểm tra IP, Wi-Fi, Firewall hoặc PC Server.");
  }
}

export async function sendTextToPc(content: string) {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  try {
    const res = await fetch(`${pcUrl}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch {
    throw new Error("Gửi text thất bại. Kiểm tra PC Server.");
  }
}

export async function pullMessagesFromPc(): Promise<PcMessage[]> {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    return [];
  }

  try {
    const res = await fetch(`${pcUrl}/api/messages/pull`);

    if (!res.ok) {
      return [];
    }

    const json = await res.json();

    return json.messages ?? [];
  } catch {
    // Quan trọng: không throw để app không crash
    return [];
  }
}

export async function uploadFileToPc(file: {
  uri: string;
  name: string;
  mimeType?: string | null;
}) {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  try {
    const formData = new FormData();

    if (Platform.OS === "web") {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append("file", blob, file.name);
    } else {
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
    }

    const res = await fetch(`${pcUrl}/api/files/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch {
    throw new Error("Upload file thất bại. Kiểm tra PC Server.");
  }
}

export async function getPendingFilesFromPc(): Promise<PcPendingFile[]> {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    return [];
  }

  try {
    const res = await fetch(`${pcUrl}/api/files/pending`);

    if (!res.ok) {
      return [];
    }

    const json = await res.json();

    return json.files ?? [];
  } catch {
    // Quan trọng: không throw để app không crash
    return [];
  }
}

export async function downloadFileFromPc(file: PcPendingFile) {
  const pcUrl = getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  const url = `${pcUrl}/api/files/download/${file.id}`;

  try {
    if (Platform.OS === "web") {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);

      return { ok: true };
    }

    await Linking.openURL(url);

    return { ok: true };
  } catch {
    throw new Error("Tải file thất bại.");
  }
}