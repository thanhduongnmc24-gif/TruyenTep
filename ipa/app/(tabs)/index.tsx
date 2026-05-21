import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Image, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

const SERVER_URL = 'https://lakeesha-nonautonomous-catarina.ngrok-free.dev/predict'; 

type HistoryItem = {
  id: string;
  originalImage: string;
  processedImage?: string;
  count: number;
  date: string;
};

export default function DemThepScreen() {
  const { colors, theme } = useTheme(); 
  const [image, setImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [steelCount, setSteelCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('DEMTHEP_HISTORY');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.log('Lỗi tải lịch sử:', error);
    }
  };

  const saveToHistory = async (original: string, processed: string | undefined, count: number) => {
    try {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        originalImage: original,
        processedImage: processed,
        count: count,
        date: new Date().toISOString(),
      };
      const newHistory = [newItem, ...history];
      setHistory(newHistory);
      await AsyncStorage.setItem('DEMTHEP_HISTORY', JSON.stringify(newHistory));
    } catch (error) {
      console.log('Lỗi lưu lịch sử:', error);
    }
  };

  const clearHistory = async () => {
    if (Platform.OS === 'web') {
        // [Suy luận] Trên web hàm Alert.alert thỉnh thoảng hoạt động không chuẩn, dùng window.confirm sẽ an toàn hơn
        if (window.confirm('Anh hai có chắc muốn xóa hết lịch sử đếm không?')) {
            await AsyncStorage.removeItem('DEMTHEP_HISTORY');
            setHistory([]);
        }
    } else {
        Alert.alert('Xóa lịch sử', 'Anh hai có chắc muốn xóa hết lịch sử đếm không?', [
        { text: 'Hủy', style: 'cancel' },
        { 
            text: 'Xóa sạch', 
            style: 'destructive',
            onPress: async () => {
            await AsyncStorage.removeItem('DEMTHEP_HISTORY');
            setHistory([]);
            }
        }
        ]);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    };

    let result;
    if (useCamera) {
      await ImagePicker.requestCameraPermissionsAsync();
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      setImage(selectedUri);
      setResultImage(null);
      setSteelCount(null);
      uploadToServer(selectedUri);
    }
  };

  const uploadToServer = async (uri: string) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // Xử lý biến đổi ảnh thành Blob dành riêng cho môi trường Web
        const res = await fetch(uri);
        const blob = await res.blob();
        formData.append('file', blob, 'image.jpg');
      } else {
        // Xử lý chuẩn cho iOS / Android
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append('file', { uri, name: filename, type });
      }

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        body: formData,
        headers: {
          // Bỏ 'Content-Type' đi để trình duyệt tự xử lý boundary
          // Thêm cờ này để đi xuyên qua màn hình cảnh báo của Ngrok
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error('Server phản hồi lỗi!');
      }

      const data = await response.json();
      
      if (data.count !== undefined) {
        setSteelCount(data.count);
        const processedUri = data.image_base64 ? `data:image/jpeg;base64,${data.image_base64}` : undefined;
        if (processedUri) setResultImage(processedUri);
        
        saveToHistory(uri, processedUri, data.count);
      } else {
        if (Platform.OS === 'web') alert('Không nhận được dữ liệu số lượng từ server.');
        else Alert.alert('Lỗi', 'Không nhận được dữ liệu số lượng từ server.');
      }
    } catch (error) {
      console.log(error);
      if (Platform.OS === 'web') alert('Lỗi kết nối. Anh hai xem lại Colab hoặc đường link Ngrok nhé!');
      else Alert.alert('Lỗi kết nối', 'Không thể gửi ảnh lên server. Anh hai kiểm tra lại đường truyền nhé!');
    } finally {
      setIsLoading(false);
    }
  };

  const bgColors = [colors.bg, colors.bg] as [string, string, ...string[]];

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Thần Nhãn Đếm Thép</Text>
            <Text style={[styles.subtitle, { color: colors.subText }]}>Năng suất x100 lần</Text>
          </View>

          {/* KHU VỰC HIỂN THỊ ẢNH & KẾT QUẢ */}
          <View style={[styles.imageContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 10 }}>Đang nhờ AI đếm thử, chờ xíu...</Text>
              </View>
            ) : resultImage || image ? (
              <>
                <Image source={{ uri: resultImage || image! }} style={styles.previewImage} resizeMode="contain" />
                {steelCount !== null && (
                  <View style={[styles.resultBadge, { backgroundColor: colors.primary }]}>
                     <Text style={styles.resultText}>Tổng: {steelCount} cây</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.placeholderBox}>
                <Ionicons name="image-outline" size={60} color={colors.subText} />
                <Text style={{ color: colors.subText, marginTop: 10 }}>Chưa có ảnh nào được chọn</Text>
              </View>
            )}
          </View>

          {/* NÚT THAO TÁC */}
          <View style={styles.buttonRow}>
            {/* Trên Web thì API Camera đôi khi không support tốt nên cứ để đó, ta test bằng Thư Viện là chính */}
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.primary }]} 
              onPress={() => pickImage(true)}
            >
              <Ionicons name="camera" size={24} color="white" />
              <Text style={styles.btnText}>Chụp Ảnh</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.iconBg }]} 
              onPress={() => pickImage(false)}
            >
              <Ionicons name="images" size={24} color={colors.text} />
              <Text style={[styles.btnText, { color: colors.text }]}>Thư Viện</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          {/* LỊCH SỬ ĐẾM */}
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>Lịch Sử Đếm Gần Đây</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <Text style={{ color: colors.subText, fontStyle: 'italic', textAlign: 'center' }}>Chưa có lịch sử đếm nào.</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image source={{ uri: item.processedImage || item.originalImage }} style={styles.historyThumb} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyCount, { color: colors.primary }]}>{item.count} cây thép</Text>
                  <Text style={{ color: colors.subText, fontSize: 12 }}>
                    {format(new Date(item.date), 'HH:mm - dd/MM/yyyy')}
                  </Text>
                </View>
              </View>
            ))
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 80 },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  imageContainer: { 
    width: '100%', height: 300, borderRadius: 16, 
    borderWidth: 1, overflow: 'hidden', marginBottom: 20,
    justifyContent: 'center', alignItems: 'center'
  },
  previewImage: { width: '100%', height: '100%' },
  placeholderBox: { alignItems: 'center', justifyContent: 'center' },
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  resultBadge: { 
    position: 'absolute', bottom: 10, right: 10, 
    paddingHorizontal: 15, paddingVertical: 8, 
    borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.3, 
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 
  },
  resultText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actionBtn: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'center', padding: 15, borderRadius: 12, marginHorizontal: 5 
  },
  btnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  separator: { height: 1, backgroundColor: 'rgba(150,150,150,0.2)', marginVertical: 20 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  historyTitle: { fontSize: 18, fontWeight: 'bold' },
  historyCard: { 
    flexDirection: 'row', padding: 10, borderRadius: 12, 
    borderWidth: 1, marginBottom: 10, alignItems: 'center' 
  },
  historyThumb: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  historyInfo: { flex: 1 },
  historyCount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 }
});