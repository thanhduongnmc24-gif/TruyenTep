import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Image, ActivityIndicator, Alert, Platform, TouchableWithoutFeedback 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

type HistoryItem = {
  id: string;
  originalImage: string;
  processedImage?: string;
  count: number;
  date: string;
};

// Cấu trúc dữ liệu cho một bó thép đang xử lý trên màn hình
type BatchItem = {
  id: string;
  originalImage: string;
  processedImage: string | null;
  count: number | null;
  resultImages: { v1: string | null, v2: string | null, v3: string | null };
  status: 'loading' | 'success' | 'error' | 'idle';
};

// COMPONENT CON XỬ LÝ ZOOM ĐỘC LẬP - DIỆT TẬN GỐC LỖI CANH GÓC
function SteelImageViewer({ imageUri }: { imageUri: string }) {
  const [resetKey, setResetKey] = useState(0);
  const lastTap = useRef(0);

  // Cảm biến 1: Tự động reset đưa tọa độ về 0,0 ngay khi load ảnh bó thép mới
  useEffect(() => {
    setResetKey(prev => prev + 1);
  }, [imageUri]);

  // Cảm biến 2: Bắt nhịp gõ 2 cái (Double Tap) của anh hai
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { 
      // Nếu gõ 2 nhịp cách nhau dưới 300 mili-giây -> Đập đi xây lại khung ảnh
      setResetKey(prev => prev + 1); 
    }
    lastTap.current = now;
  };

  return (
    <ScrollView
      key={resetKey} // Chìa khóa vàng ép tọa độ và độ zoom về như thuở ban đầu
      maximumZoomScale={5}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      // [QUAN TRỌNG] Bỏ thuộc tính centerContent={true} để chống lỗi bị kéo tuột xuống góc
      style={styles.viewerScroll}
      // Dùng flexbox canh giữa trongcontentContainerStyle thay cho centerContent
      contentContainerStyle={styles.viewerContainer}
    >
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <Image source={{ uri: imageUri }} style={styles.mainImage} resizeMode="contain" />
      </TouchableWithoutFeedback>
    </ScrollView>
  );
}

export default function DemThepScreen() {
  const { colors } = useTheme(); 
  const mainScrollRef = useRef<ScrollView>(null); 

  // Danh sách Batch (chứa nhiều ảnh)
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewerKey, setViewerKey] = useState<string>(Date.now().toString());
  const [currentMode, setCurrentMode] = useState<number>(1);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('DEMTHEP_HISTORY');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (error) {
      console.log('Lỗi tải lịch sử:', error);
    }
  };

  const saveToHistory = async (original: string, processed: string | undefined, count: number) => {
    try {
      const newItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(),
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
    const clearLogic = async () => {
        await AsyncStorage.removeItem('DEMTHEP_HISTORY');
        setHistory([]);
    }
    if (Platform.OS === 'web') {
        if (window.confirm('Anh hai có chắc muốn xóa hết lịch sử đếm không?')) clearLogic();
    } else {
        Alert.alert('Xóa lịch sử', 'Anh hai có chắc muốn xóa hết lịch sử đếm không?', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa sạch', style: 'destructive', onPress: clearLogic }
        ]);
    }
  };

  const viewHistoryItem = (item: HistoryItem) => {
    // Ép lịch sử vào định dạng Batch để hiển thị chung logic
    setBatch([{
        id: item.id,
        originalImage: item.originalImage,
        processedImage: item.processedImage || null,
        count: item.count,
        resultImages: { v1: item.processedImage || null, v2: null, v3: null },
        status: 'success'
    }]);
    setActiveIndex(0);
    setCurrentMode(1);
    setViewerKey('hist_' + item.id + '_' + Date.now());
    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const resizeImage = async (uri: string) => {
    try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        return manipResult.uri;
      } catch (e) {
        return uri;
      }
  }

  // LOGIC CHỌN ẢNH (HỖ TRỢ NHIỀU ẢNH CHO THƯ VIỆN)
  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
      allowsMultipleSelection: !useCamera, // NẾU LÀ THƯ VIỆN THÌ MỞ CHỌN NHIỀU
      selectionLimit: 10, // Max 10 ảnh 1 lúc
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
      // 1. Tạo mảng BatchItem mới trạng thái 'loading'
      const initialBatch: BatchItem[] = await Promise.all(result.assets.map(async (asset, index) => {
          const resized = await resizeImage(asset.uri);
          return {
              id: Date.now().toString() + index,
              originalImage: resized,
              processedImage: null,
              count: null,
              resultImages: { v1: null, v2: null, v3: null },
              status: 'loading'
          };
      }));

      setBatch(initialBatch);
      setActiveIndex(0);
      setCurrentMode(1);
      setViewerKey('pick_' + Date.now());

      // 2. Chạy vòng lặp đẩy tuần tự từng ảnh lên server
      for (let i = 0; i < initialBatch.length; i++) {
          setActiveIndex(i); // Tự động nhảy focus tới ảnh đang xử lý
          await processSingleImage(initialBatch[i].originalImage, i);
      }
    }
  };

  // Hàm xử lý độc lập từng ảnh
  const processSingleImage = async (uri: string, targetIndex: number) => {
    try {
      const activeServer = await AsyncStorage.getItem('ACTIVE_SERVER') || 'colab';
      let currentServerUrl = '';
      if (activeServer === 'colab') currentServerUrl = await AsyncStorage.getItem('COLAB_URL') || '';
      else if (activeServer === 'hf') currentServerUrl = await AsyncStorage.getItem('HF_URL') || '';
      else if (activeServer === 'kaggle') currentServerUrl = await AsyncStorage.getItem('KAGGLE_URL') || '';

      if (!currentServerUrl || currentServerUrl.trim() === '') {
        throw new Error('Chưa nhập link máy chủ!');
      }

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        formData.append('file', blob, 'image.jpg');
      } else {
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append('file', { uri, name: filename, type });
      }

      const response = await fetch(currentServerUrl, {
        method: 'POST',
        body: formData,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      if (!response.ok) throw new Error('Máy chủ phản hồi lỗi!');
      const data = await response.json();
      
      if (data.count !== undefined) {
        const uri1 = data.image_v1 ? `data:image/jpeg;base64,${data.image_v1}` : null;
        const fallbackUri = uri1 || (data.image_base64 ? `data:image/jpeg;base64,${data.image_base64}` : null);
        
        // Cập nhật trạng thái thành công cho tấm ảnh hiện tại
        setBatch(prev => {
            const newBatch = [...prev];
            newBatch[targetIndex] = {
                ...newBatch[targetIndex],
                count: data.count,
                resultImages: {
                    v1: uri1,
                    v2: data.image_v2 ? `data:image/jpeg;base64,${data.image_v2}` : null,
                    v3: data.image_v3 ? `data:image/jpeg;base64,${data.image_v3}` : null
                },
                processedImage: fallbackUri,
                status: 'success'
            };
            return newBatch;
        });

        // Chỉ những tấm thành công mới lưu vào lịch sử
        if (fallbackUri) {
             saveToHistory(uri, fallbackUri, data.count);
        }
        setViewerKey('ai_' + targetIndex + '_' + Date.now());

      } else {
        throw new Error('Lỗi dữ liệu trả về!');
      }
    } catch (error: any) {
      console.log(error);
      // Báo lỗi cho tấm ảnh đó
      setBatch(prev => {
          const newBatch = [...prev];
          newBatch[targetIndex].status = 'error';
          return newBatch;
      });
      if (batch.length === 1) { // Nếu chỉ đếm 1 tấm thì quăng thông báo luôn
          Alert.alert('Lỗi', error.message || 'Không thể kết nối máy chủ.');
      }
    }
  };

  const handleModeChange = (mode: number) => {
    setCurrentMode(mode);
    setViewerKey('mode_' + mode + '_' + Date.now());
  };

  // Lấy dữ liệu của tấm ảnh đang được Active để hiển thị lên màn hình lớn
  const currentActiveItem = batch[activeIndex];
  
  const getDisplayImage = () => {
    if (!currentActiveItem) return null;
    if (currentMode === 1 && currentActiveItem.resultImages.v1) return currentActiveItem.resultImages.v1;
    if (currentMode === 2 && currentActiveItem.resultImages.v2) return currentActiveItem.resultImages.v2;
    if (currentMode === 3 && currentActiveItem.resultImages.v3) return currentActiveItem.resultImages.v3;
    return currentActiveItem.processedImage || currentActiveItem.originalImage;
  };

  const bgColors = [colors.bg, colors.bg] as [string, string, ...string[]];
  const displayUri = getDisplayImage();
  const isCurrentlyLoading = currentActiveItem?.status === 'loading';

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView ref={mainScrollRef} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Thần Nhãn Đếm Thép</Text>
            {/* Đổi tên anh hai và mã số xịn */}
            <Text style={[styles.subtitle, { color: colors.subText }]}>Nguyễn Thanh Dương - HPDQ01016</Text>
          </View>

          {/* KHU VỰC HIỂN THỊ ẢNH LỚN */}
          <View style={[styles.imageContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {isCurrentlyLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                {/* Đổi chữ băm thép thành chữ đếm thép thân thiện */}
                <Text style={{ color: colors.text, marginTop: 10, textAlign: 'center' }}>Đang nhờ AI đếm thép, chờ xíu nhé...</Text>
              </View>
            ) : displayUri ? (
              <SteelImageViewer key={viewerKey} imageUri={displayUri} />
            ) : (
              <View style={styles.placeholderBox}>
                <Ionicons name="image-outline" size={60} color={colors.subText} />
                <Text style={{ color: colors.subText, marginTop: 10 }}>Chưa có ảnh nào được chọn</Text>
              </View>
            )}
          </View>

          {/* DẢI ẢNH THU NHỎ QUẸT NGANG KHI CHỌN NHIỀU ẢNH */}
          {batch.length > 1 && (
              <View style={styles.thumbnailContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {batch.map((item, idx) => (
                          <TouchableOpacity 
                              key={item.id} 
                              onPress={() => {
                                  setActiveIndex(idx);
                                  setViewerKey('thumb_' + idx);
                              }}
                              style={[
                                  styles.thumbWrap, 
                                  { borderColor: activeIndex === idx ? colors.primary : 'transparent' },
                                  item.status === 'error' && { borderColor: colors.error }
                              ]}
                          >
                              <Image source={{ uri: item.processedImage || item.originalImage }} style={styles.thumbImage} />
                              
                              {/* Overlay đang tải */}
                              {item.status === 'loading' && (
                                  <View style={styles.thumbOverlay}>
                                      <ActivityIndicator size="small" color="white" />
                                  </View>
                              )}
                              
                              {/* Huy hiệu số lượng đếm được */}
                              {item.status === 'success' && item.count !== null && (
                                  <View style={[styles.thumbBadge, { backgroundColor: colors.primary }]}>
                                      <Text style={styles.thumbBadgeText}>{item.count}</Text>
                                  </View>
                              )}
                              
                              {/* Huy hiệu Lỗi */}
                              {item.status === 'error' && (
                                  <View style={[styles.thumbBadge, { backgroundColor: colors.error }]}>
                                      <Ionicons name="warning" size={10} color="white" />
                                  </View>
                              )}
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
              </View>
          )}

          {/* KẾT QUẢ ĐẾM THÉP */}
          {currentActiveItem?.status === 'success' && currentActiveItem?.count !== null && (
            <View style={styles.totalContainer}>
              <Text style={[styles.totalText, { color: colors.primary }]}>
                Tổng: {currentActiveItem.count} cây
              </Text>
            </View>
          )}

          {/* BỘ 3 CÔNG TẮC ĐIỀU KHIỂN HIỂN THỊ */}
          {currentActiveItem?.status === 'success' && (currentActiveItem.resultImages.v1 || currentActiveItem.processedImage) && (
            <View style={[styles.toggleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity style={[styles.toggleBtn, currentMode === 1 && { backgroundColor: colors.primary }]} onPress={() => handleModeChange(1)}>
                <Text style={[styles.toggleText, currentMode === 1 ? { color: 'white' } : { color: colors.subText }]}>Chỉ Khung</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, currentMode === 2 && { backgroundColor: colors.primary }]} onPress={() => handleModeChange(2)}>
                <Text style={[styles.toggleText, currentMode === 2 ? { color: 'white' } : { color: colors.subText }]}>Khung + Số</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, currentMode === 3 && { backgroundColor: colors.primary }]} onPress={() => handleModeChange(3)}>
                <Text style={[styles.toggleText, currentMode === 3 ? { color: 'white' } : { color: colors.subText }]}>Chỉ Số</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* HAI NÚT THAO TÁC CƠ BẢN */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={24} color="white" />
              <Text style={styles.btnText}>Chụp Ảnh</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.iconBg, borderWidth: 1, borderColor: colors.border }]} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={24} color={colors.text} />
              <Text style={[styles.btnText, { color: colors.text }]}>Chọn Ảnh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          {/* LỊCH SỬ ĐẾM GẦN ĐÂY */}
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
              <TouchableOpacity key={item.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => viewHistoryItem(item)}>
                <Image source={{ uri: item.processedImage || item.originalImage }} style={styles.historyThumb} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyCount, { color: colors.primary }]}>{item.count} cây thép</Text>
                  <Text style={{ color: colors.subText, fontSize: 12 }}>
                    {format(new Date(item.date), 'HH:mm - dd/MM/yyyy')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.subText} />
              </TouchableOpacity>
            ))
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 15, paddingBottom: 80 },
  header: { alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  
  imageContainer: { 
    width: '100%', height: 320, borderRadius: 16, 
    borderWidth: 1, overflow: 'hidden', marginBottom: 10,
    justifyContent: 'center', alignItems: 'center'
  },
  placeholderBox: { alignItems: 'center', justifyContent: 'center' },
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  
  viewerScroll: { width: '100%', height: '100%' },
  // Dùng flexbox canh giữa trong contentContainerStyle để thay thế centerContent={true}
  viewerContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  mainImage: { width: '100%', height: '100%' },

  // STYLE CHO THANH THUMBNAIL (QUẸT ẢNH MỚI)
  thumbnailContainer: {
      marginBottom: 15,
      height: 70,
  },
  thumbWrap: {
      width: 60, height: 60, borderRadius: 8, borderWidth: 2,
      marginRight: 10, overflow: 'hidden', position: 'relative',
      justifyContent: 'center', alignItems: 'center'
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center'
  },
  thumbBadge: {
      position: 'absolute', top: 0, right: 0,
      paddingHorizontal: 4, paddingVertical: 2,
      borderBottomLeftRadius: 6,
  },
  thumbBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  totalContainer: {
    alignItems: 'center', marginBottom: 15, backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 10, borderRadius: 12,
  },
  totalText: { fontSize: 22, fontWeight: '900', textTransform: 'uppercase' },

  toggleContainer: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1,
    padding: 4, marginBottom: 20, justifyContent: 'space-between',
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleText: { fontSize: 14, fontWeight: 'bold' },
  
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  actionBtn: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'center', padding: 15, borderRadius: 12, marginHorizontal: 5 
  },
  btnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  
  separator: { height: 1, backgroundColor: 'rgba(150,150,150,0.2)', marginVertical: 10 },
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