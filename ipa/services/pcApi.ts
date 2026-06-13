import { Platform, Linking } from "react-native";
import * as SecureStore from "expo-secure-store";

const PC_URL_KEY = "pc_server_url";

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

async function setStorageValue(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getStorageValue(key: string) {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
}

export async function savePcUrl(url: string) {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  await setStorageValue(PC_URL_KEY, cleanUrl);
}

export async function getPcUrl() {
  return await getStorageValue(PC_URL_KEY);
}

export async function pingPc() {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  const res = await fetch(`${pcUrl}/api/ping`);

  if (!res.ok) {
    throw new Error(`Không kết nối được PC. HTTP ${res.status}`);
  }

  return await res.json();
}

export async function sendTextToPc(content: string) {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  const res = await fetch(`${pcUrl}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      content,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gửi text thất bại. HTTP ${res.status}`);
  }

  return await res.json();
}

export async function pullMessagesFromPc(): Promise<PcMessage[]> {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    return [];
  }

  const res = await fetch(`${pcUrl}/api/messages/pull`);

  if (!res.ok) {
    throw new Error(`Kéo tin nhắn thất bại. HTTP ${res.status}`);
  }

  const json = await res.json();

  if (!json.ok) {
    return [];
  }

  return json.messages ?? [];
}

export async function uploadFileToPc(file: {
  uri: string;
  name: string;
  mimeType?: string | null;
}) {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

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
    throw new Error(`Upload file thất bại. HTTP ${res.status}`);
  }

  return await res.json();
}

export async function getPendingFilesFromPc(): Promise<PcPendingFile[]> {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  const res = await fetch(`${pcUrl}/api/files/pending`);

  if (!res.ok) {
    throw new Error(`Không lấy được danh sách file. HTTP ${res.status}`);
  }

  const json = await res.json();

  if (!json.ok) {
    return [];
  }

  return json.files ?? [];
}

export async function downloadFileFromPc(file: PcPendingFile) {
  const pcUrl = await getPcUrl();

  if (!pcUrl) {
    throw new Error("Chưa nhập địa chỉ PC");
  }

  const downloadUrl = `${pcUrl}/api/files/download/${file.id}`;

  if (Platform.OS === "web") {
    const res = await fetch(downloadUrl);

    if (!res.ok) {
      throw new Error(`Tải file thất bại. HTTP ${res.status}`);
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

    return {
      ok: true,
      mode: "web",
    };
  }

  await Linking.openURL(downloadUrl);

  return {
    ok: true,
    mode: "native",
  };
}