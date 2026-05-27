import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Image, ActivityIndicator, Alert, Platform, TouchableWithoutFeedback, TextInput, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const WORKSPACE_HEIGHT = SCREEN_HEIGHT * 0.6; 

type HistoryItem = {
  id: string;
  originalImage: string;
  processedImage?: string;
  count: number;
  date: string;
};

type BatchItem = {
  id: string;
  originalImage: string;
  processedImage: string | null;
  count: number | null;
  resultImages: { v1: string | null, v2: string | null, v3: string | null };
  status: 'loading' | 'success' | 'error' | 'idle';
};

function SteelImageViewer({ imageUri }: { imageUri: string }) {
  const [resetKey, setResetKey] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    setResetKey(prev => prev + 1);
  }, [imageUri]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { 
      setResetKey(prev => prev + 1); 
    }
    lastTap.current = now;
  };

  return (
    <ScrollView
      key={resetKey} 
      maximumZoomScale={5}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      centerContent={true}
      
      bounces={false} 
      bouncesZoom={false}
      alwaysBounceVertical={false}
      alwaysBounceHorizontal={false}
      contentInsetAdjustmentBehavior="never" 
      automaticallyAdjustContentInsets={false}

      style={styles.viewerScroll}
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

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentMode, setCurrentMode] = useState<number>(1);

  const [minConf, setMinConf] = useState<string>("0.15");
  const [alertConf, setAlertConf] = useState<string>("0.70");
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

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

  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
      allowsMultipleSelection: !useCamera,
      selectionLimit: 10,
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

      for (let i = 0; i < initialBatch.length; i++) {
          setActiveIndex(i);
          await processSingleImage(initialBatch[i].originalImage, i, isFiltering);
      }
    }
  };

  const processSingleImage = async (uri: string, targetIndex: number, currentFilterMode: boolean) => {
    setBatch(prev => {
        const newBatch = [...prev];
        newBatch[targetIndex].status = 'loading';
        return newBatch;
    });

    try {
      const activeServer = await AsyncStorage.getItem('ACTIVE_SERVER') || 'colab';
      let currentServerUrl = '';
      if (activeServer === 'colab') currentServerUrl = await AsyncStorage.getItem('COLAB_URL') || '';
      else if (activeServer === 'hf') currentServerUrl = await AsyncStorage.getItem('HF_URL') || '';
      else if (activeServer === 'kaggle') currentServerUrl = await AsyncStorage.getItem('KAGGLE_URL') || '';

      if (!currentServerUrl || currentServerUrl.trim() === '') {
        throw new Error('Chưa nhập link máy chủ Kaggle!');
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

      formData.append('min_conf', minConf);
      formData.append('alert_conf', alertConf);
      formData.append('is_filtering', currentFilterMode ? 'true' : 'false');

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

        if (fallbackUri && !currentFilterMode) {
             saveToHistory(uri, fallbackUri, data.count);
        }

      } else {
        throw new Error('Lỗi dữ liệu trả về!');
      }
    } catch (error: any) {
      console.log(error);
      setBatch(prev => {
          const newBatch = [...prev];
          newBatch[targetIndex].status = 'error';
          return newBatch;
      });
      if (batch.length === 1 || targetIndex === activeIndex) { 
          Alert.alert('Lỗi', error.message || 'Không thể kết nối máy chủ.');
      }
    }
  };

  const handleModeChange = (mode: number) => {
    setCurrentMode(mode);
  };

  const toggleFilter = () => {
      const newMode = !isFiltering;
      setIsFiltering(newMode);
      if (batch.length > 0 && activeIndex >= 0) {
          processSingleImage(batch[activeIndex].originalImage, activeIndex, newMode);
      }
  };

  const applyNewParams = () => {
      if (batch.length > 0 && activeIndex >= 0) {
          processSingleImage(batch[activeIndex].originalImage, activeIndex, isFiltering);
      } else {
          Alert.alert("Chưa có ảnh", "Anh hai chụp hoặc chọn ảnh đi rồi mới áp dụng được nhé!");
      }
  };

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
            <Text style={[styles.subtitle, { color: colors.subText }]}>Nguyễn Thanh Dương - HPDQ01016</Text>
          </View>

          {/* ============================================================== */}
          {/* KHU VỰC LÀM VIỆC CHÍNH (TỈ LỆ 9/1) */}
          {/* ============================================================== */}
          <View style={styles.mainWorkspace}>
            
            {/* CỘT TRÁI (TỈ LỆ 9): KHU VỰC HIỂN THỊ ẢNH THÉP */}
            <View style={[styles.imagePanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {isCurrentlyLoading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.text, marginTop: 10, textAlign: 'center' }}>Đang đếm thép...</Text>
                </View>
                ) : displayUri ? (
                <SteelImageViewer imageUri={displayUri} />
                ) : (
                <View style={styles.placeholderBox}>
                    <Ionicons name="image-outline" size={40} color={colors.subText} />
                    <Text style={{ color: colors.subText, marginTop: 10, textAlign: 'center' }}>Chưa có ảnh</Text>
                </View>
                )}
            </View>

            {/* CỘT PHẢI (TỈ LỆ 1): BẢNG ĐIỀU KHIỂN CỐ ĐỊNH, KHÔNG BỊ CUỘN MẤT NÚT */}
            <View style={styles.controlPanel}>
                
                {/* 1. KHU VỰC TRÊN CÙNG: CẤU HÌNH AI & LỌC */}
                <View style={[styles.sideGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    
                    {/* Ngưỡng Min */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.subText }]}>Min:</Text>
                        <TextInput 
                            style={[styles.sideInput, { color: colors.text, borderColor: colors.border }]} 
                            value={minConf} onChangeText={setMinConf} keyboardType="numeric" 
                        />
                    </View>

                    {/* Ngưỡng Lọc */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.subText }]}>Lọc:</Text>
                        <TextInput 
                            style={[styles.sideInput, { color: colors.text, borderColor: colors.border }]} 
                            value={alertConf} onChangeText={setAlertConf} keyboardType="numeric" 
                        />
                    </View>

                    {/* Nút Lọc */}
                    <TouchableOpacity 
                        style={[styles.sideBtn, { backgroundColor: isFiltering ? '#EAB308' : colors.iconBg, borderColor: isFiltering ? '#EAB308' : colors.border, borderWidth: 1 }]} 
                        onPress={toggleFilter}
                    >
                        <Text style={[styles.sideBtnText, { color: isFiltering ? 'white' : colors.text }]}>
                            {isFiltering ? 'Bật Lọc' : 'Không'}
                        </Text>
                    </TouchableOpacity>

                    {/* Nút Áp dụng */}
                    <TouchableOpacity 
                        style={[styles.sideBtn, { backgroundColor: colors.primary, marginBottom: 0 }]} 
                        onPress={applyNewParams}
                    >
                        <Text style={[styles.sideBtnText, { color: 'white' }]}>Áp dụng</Text>
                    </TouchableOpacity>

                </View>

                {/* 2. KHU VỰC DƯỚI ĐÁY: BỘ CÔNG TẮC HIỂN THỊ (LUÔN LUÔN HIỆN) */}
                <View style={{ marginBottom: 0 }}>
                    <TouchableOpacity 
                        style={[styles.modeBtn, { backgroundColor: currentMode === 1 ? colors.primary : colors.card, borderColor: currentMode === 1 ? colors.primary : colors.border }]} 
                        onPress={() => handleModeChange(1)}>
                        <Text style={[styles.sideBtnText, { color: currentMode === 1 ? 'white' : colors.text }]}>Khung</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.modeBtn, { backgroundColor: currentMode === 2 ? colors.primary : colors.card, borderColor: currentMode === 2 ? colors.primary : colors.border }]} 
                        onPress={() => handleModeChange(2)}>
                        <Text style={[styles.sideBtnText, { color: currentMode === 2 ? 'white' : colors.text }]}>K+Số</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.modeBtn, { backgroundColor: currentMode === 3 ? colors.primary : colors.card, borderColor: currentMode === 3 ? colors.primary : colors.border, marginBottom: 0 }]} 
                        onPress={() => handleModeChange(3)}>
                        <Text style={[styles.sideBtnText, { color: currentMode === 3 ? 'white' : colors.text }]}>Chỉ Số</Text>
                    </TouchableOpacity>
                </View>

            </View>

          </View>
          {/* ============================================================== */}


          {/* DẢI ẢNH THU NHỎ */}
          {batch.length > 1 && (
              <View style={styles.thumbnailContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {batch.map((item, idx) => (
                          <TouchableOpacity 
                              key={item.id} 
                              onPress={() => setActiveIndex(idx)}
                              style={[
                                  styles.thumbWrap, 
                                  { borderColor: activeIndex === idx ? colors.primary : 'transparent' },
                                  item.status === 'error' && { borderColor: colors.error }
                              ]}
                          >
                              <Image source={{ uri: item.processedImage || item.originalImage }} style={styles.thumbImage} />
                              
                              {item.status === 'loading' && (
                                  <View style={styles.thumbOverlay}>
                                      <ActivityIndicator size="small" color="white" />
                                  </View>
                              )}
                              
                              {item.status === 'success' && item.count !== null && (
                                  <View style={[styles.thumbBadge, { backgroundColor: colors.primary }]}>
                                      <Text style={styles.thumbBadgeText}>{item.count}</Text>
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
                {isFiltering ? `ĐANG LỌC: ${currentActiveItem.count} LỖI` : `Tổng: ${currentActiveItem.count} cây`}
              </Text>
            </View>
          )}

          {/* NÚT CHỤP / CHỌN ẢNH */}
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
            <Text style={{ color: colors.subText, fontStyle: 'italic', textAlign: 'center' }}>Chưa có lịch sử.</Text>
          ) : (
            history.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => viewHistoryItem(item)}>
                <Image source={{ uri: item.processedImage || item.originalImage }} style={styles.historyThumb} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyCount, { color: colors.primary }]}>{item.count} cây</Text>
                  <Text style={{ color: colors.subText, fontSize: 10 }}>
                    {format(new Date(item.date), 'HH:mm dd/MM/')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.subText} />
              </TouchableOpacity>
            ))
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 12, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 12, marginTop: 2 },
  
  // =========================================================
  // STYLE WORKSPACE (TỈ LỆ 9/1 ĐẢO NGƯỢC, PANEL ĐIỀU KHIỂN CỐ ĐỊNH)
  // =========================================================
  mainWorkspace: {
    flexDirection: 'row', 
    height: WORKSPACE_HEIGHT, 
    marginBottom: 10,
  },
  imagePanel: {
    flex: 9, 
    marginRight: 8, 
    borderRadius: 12, 
    borderWidth: 1, 
    overflow: 'hidden',
    justifyContent: 'center', 
    alignItems: 'center'
  },
  controlPanel: {
    flex: 1, 
    minWidth: 70, 
    justifyContent: 'space-between', // <--- Tuyệt chiêu đẩy cài đặt lên nóc, nút hiển thị xuống đáy!
  },
  
  sideGroup: {
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sideBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginBottom: 4,
  },
  sideBtnText: {
    fontSize: 9, 
    fontWeight: 'bold',
    textAlign: 'center'
  },
  
  modeBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,       
    borderWidth: 1,        
    marginBottom: 8,       
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 2,
  },
  
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 9, 
    fontWeight: 'bold',
    marginBottom: 2, 
    textAlign: 'center'
  },
  sideInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 10,
  },
  // =========================================================

  placeholderBox: { alignItems: 'center', justifyContent: 'center' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  
  viewerScroll: { width: '100%', height: '100%' },
  viewerContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  mainImage: { width: '100%', height: '100%' },

  thumbnailContainer: { marginBottom: 10, height: 60 },
  thumbWrap: {
      width: 50, height: 50, borderRadius: 6, borderWidth: 2, marginRight: 8, 
      overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center'
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center'
  },
  thumbBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 3, paddingVertical: 1, borderBottomLeftRadius: 5 },
  thumbBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },

  totalContainer: {
    alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 8, borderRadius: 10,
  },
  totalText: { fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },

  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginHorizontal: 4 },
  btnText: { fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  
  separator: { height: 1, backgroundColor: 'rgba(150,150,150,0.1)', marginVertical: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyTitle: { fontSize: 16, fontWeight: 'bold' },
  historyCard: { flexDirection: 'row', padding: 8, borderRadius: 10, borderWidth: 1, marginBottom: 8, alignItems: 'center' },
  historyThumb: { width: 45, height: 45, borderRadius: 6, marginRight: 10 },
  historyInfo: { flex: 1 },
  historyCount: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 }
});