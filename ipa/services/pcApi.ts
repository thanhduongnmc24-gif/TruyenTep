import { Platform, Linking } from "react-native";

const PC_URL_KEY = "pc_server_url";

// ✅ tạo storage riêng (type-safe)
const storage: Record<string, string> = {};

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

// ✅ set storage
function setStorageValue(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    storage[key] = value;
  }
}

// ✅ get storage
function getStorageValue(key: string): string | null {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return storage[key] || null;
}

export function savePcUrl(url: string) {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  setStorageValue(PC_URL_KEY, cleanUrl);
}

export function getPcUrl() {
  return getStorageValue(PC_URL_KEY);
}

// ✅ ping PC
export async function pingPc() {
  const pcUrl = getPcUrl();

  if (!pcUrl) throw new Error("Chưa nhập địa chỉ PC");

  const res = await fetch(`${pcUrl}/api/ping`);

  if (!res.ok) throw new Error("Không kết nối được PC");

  return await res.json();
}

// ✅ gửi text
export async function sendTextToPc(content: string) {
  const pcUrl = getPcUrl();

  if (!pcUrl) throw new Error("Chưa nhập địa chỉ PC");

  const res = await fetch(`${pcUrl}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error("Gửi text thất bại");

  return await res.json();
}

// ✅ pull text
export async function pullMessagesFromPc(): Promise<PcMessage[]> {
  const pcUrl = getPcUrl();

  if (!pcUrl) return [];

  const res = await fetch(`${pcUrl}/api/messages/pull`);

  if (!res.ok) throw new Error("Lỗi kéo tin");

  const json = await res.json();

  return json.messages ?? [];
}

// ✅ upload file (SAFE iOS)
export async function uploadFileToPc(file: {
  uri: string;
  name: string;
  mimeType?: string | null;
}) {
  const pcUrl = getPcUrl();

  if (!pcUrl) throw new Error("Chưa nhập địa chỉ PC");

  const formData = new FormData();

  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as any);

  const res = await fetch(`${pcUrl}/api/files/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload thất bại");

  return await res.json();
}

// ✅ lấy danh sách file
export async function getPendingFilesFromPc(): Promise<PcPendingFile[]> {
  const pcUrl = getPcUrl();

  if (!pcUrl) return [];

  const res = await fetch(`${pcUrl}/api/files/pending`);

  if (!res.ok) throw new Error("Không lấy file");

  const json = await res.json();

  return json.files ?? [];
}

// ✅ tải file
export async function downloadFileFromPc(file: PcPendingFile) {
  const pcUrl = getPcUrl();

  if (!pcUrl) throw new Error("Chưa nhập địa chỉ PC");

  const url = `${pcUrl}/api/files/download/${file.id}`;

  await Linking.openURL(url);

  return { ok: true };
}