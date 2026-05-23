import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableWithoutFeedback,
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

type BatchItem = {
  id: string;
  originalImage: string;
  processedImage: string | null;
  count: number | null;
  resultImages: {
    v1: string | null;
    v2: string | null;
    v3: string | null;
  };
  status: 'loading' | 'success' | 'error' | 'idle';
};





// ======================================================
// FIX HOÀN CHỈNH VIEWER
// ======================================================

function SteelImageViewer({ imageUri }: { imageUri: string }) {

  const [resetKey, setResetKey] = useState(0);

  const lastTap = useRef(0);

  const scrollRef = useRef<ScrollView>(null);



  // RESET KHI ĐỔI ẢNH
  useEffect(() => {

    setResetKey(prev => prev + 1);

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: 0,
        y: 0,
        animated: false,
      });
    }, 50);

  }, [imageUri]);



  // DOUBLE TAP RESET
  const handleDoubleTap = () => {

    const now = Date.now();

    if (now - lastTap.current < 300) {

      setResetKey(prev => prev + 1);

      setTimeout(() => {
        scrollRef.current?.scrollTo({
          x: 0,
          y: 0,
          animated: false,
        });
      }, 50);
    }

    lastTap.current = now;
  };



  return (

    <ScrollView
      ref={scrollRef}
      key={resetKey}

      maximumZoomScale={5}
      minimumZoomScale={1}

      contentOffset={{ x: 0, y: 0 }}

      bounces={false}
      bouncesZoom={false}
      alwaysBounceVertical={false}
      alwaysBounceHorizontal={false}

      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}

      style={styles.viewerScroll}
      contentContainerStyle={styles.viewerContainer}
    >

      <TouchableWithoutFeedback onPress={handleDoubleTap}>

        <Image
          source={{ uri: imageUri }}
          style={styles.mainImage}
          resizeMode="contain"
        />

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

  const [viewerKey, setViewerKey] = useState<string>(
    Date.now().toString()
  );

  const [currentMode, setCurrentMode] = useState<number>(1);



  useEffect(() => {
    loadHistory();
  }, []);




  const loadHistory = async () => {

    try {

      const savedHistory = await AsyncStorage.getItem(
        'DEMTHEP_HISTORY'
      );

      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }

    } catch (error) {

      console.log('Lỗi tải lịch sử:', error);

    }
  };



  const saveToHistory = async (
    original: string,
    processed: string | undefined,
    count: number
  ) => {

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

      await AsyncStorage.setItem(
        'DEMTHEP_HISTORY',
        JSON.stringify(newHistory)
      );

    } catch (error) {

      console.log('Lỗi lưu lịch sử:', error);

    }
  };




  const clearHistory = async () => {

    const clearLogic = async () => {

      await AsyncStorage.removeItem('DEMTHEP_HISTORY');

      setHistory([]);

    };



    if (Platform.OS === 'web') {

      if (
        window.confirm(
          'Anh hai có chắc muốn xóa hết lịch sử đếm không?'
        )
      ) {
        clearLogic();
      }

    } else {

      Alert.alert(
        'Xóa lịch sử',
        'Anh hai có chắc muốn xóa hết lịch sử đếm không?',
        [
          {
            text: 'Hủy',
            style: 'cancel',
          },
          {
            text: 'Xóa sạch',
            style: 'destructive',
            onPress: clearLogic,
          },
        ]
      );
    }
  };



  const viewHistoryItem = (item: HistoryItem) => {

    setBatch([
      {
        id: item.id,
        originalImage: item.originalImage,
        processedImage: item.processedImage || null,
        count: item.count,
        resultImages: {
          v1: item.processedImage || null,
          v2: null,
          v3: null,
        },
        status: 'success',
      },
    ]);

    setActiveIndex(0);

    setCurrentMode(1);

    setViewerKey('hist_' + item.id + '_' + Date.now());

    mainScrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  };




  const resizeImage = async (uri: string) => {

    try {

      const manipResult =
        await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

      return manipResult.uri;

    } catch (e) {

      return uri;

    }
  };



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

      result =
        await ImagePicker.launchImageLibraryAsync(options);
    }



    if (
      !result.canceled &&
      result.assets &&
      result.assets.length > 0
    ) {

      const initialBatch: BatchItem[] =
        await Promise.all(
          result.assets.map(async (asset, index) => {

            const resized = await resizeImage(asset.uri);

            return {
              id: Date.now().toString() + index,
              originalImage: resized,
              processedImage: null,
              count: null,
              resultImages: {
                v1: null,
                v2: null,
                v3: null,
              },
              status: 'loading',
            };
          })
        );



      setBatch(initialBatch);

      setActiveIndex(0);

      setCurrentMode(1);

      setViewerKey('pick_' + Date.now());



      for (let i = 0; i < initialBatch.length; i++) {

        setActiveIndex(i);

        await processSingleImage(
          initialBatch[i].originalImage,
          i
        );
      }
    }
  };




  const processSingleImage = async (
    uri: string,
    targetIndex: number
  ) => {

    try {

      const activeServer =
        (await AsyncStorage.getItem('ACTIVE_SERVER')) ||
        'colab';

      let currentServerUrl = '';

      if (activeServer === 'colab') {
        currentServerUrl =
          (await AsyncStorage.getItem('COLAB_URL')) || '';
      }

      if (activeServer === 'hf') {
        currentServerUrl =
          (await AsyncStorage.getItem('HF_URL')) || '';
      }

      if (activeServer === 'kaggle') {
        currentServerUrl =
          (await AsyncStorage.getItem('KAGGLE_URL')) || '';
      }



      if (
        !currentServerUrl ||
        currentServerUrl.trim() === ''
      ) {
        throw new Error('Chưa nhập link máy chủ!');
      }



      const formData = new FormData();

      if (Platform.OS === 'web') {

        const res = await fetch(uri);

        const blob = await res.blob();

        formData.append('file', blob, 'image.jpg');

      } else {

        const filename =
          uri.split('/').pop() || 'image.jpg';

        const match = /\.(\w+)$/.exec(filename);

        const type = match
          ? `image/${match[1]}`
          : `image`;

        // @ts-ignore
        formData.append('file', {
          uri,
          name: filename,
          type,
        });
      }



      const response = await fetch(currentServerUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });



      if (!response.ok) {
        throw new Error('Máy chủ phản hồi lỗi!');
      }



      const data = await response.json();



      if (data.count !== undefined) {

        const uri1 = data.image_v1
          ? `data:image/jpeg;base64,${data.image_v1}`
          : null;

        const fallbackUri =
          uri1 ||
          (data.image_base64
            ? `data:image/jpeg;base64,${data.image_base64}`
            : null);



        setBatch(prev => {

          const newBatch = [...prev];

          newBatch[targetIndex] = {
            ...newBatch[targetIndex],

            count: data.count,

            resultImages: {
              v1: uri1,
              v2: data.image_v2
                ? `data:image/jpeg;base64,${data.image_v2}`
                : null,
              v3: data.image_v3
                ? `data:image/jpeg;base64,${data.image_v3}`
                : null,
            },

            processedImage: fallbackUri,

            status: 'success',
          };

          return newBatch;
        });



        if (fallbackUri) {

          saveToHistory(
            uri,
            fallbackUri,
            data.count
          );
        }



        setViewerKey(
          'ai_' + targetIndex + '_' + Date.now()
        );

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



      if (batch.length === 1) {

        Alert.alert(
          'Lỗi',
          error.message ||
            'Không thể kết nối máy chủ.'
        );
      }
    }
  };



  const handleModeChange = (mode: number) => {

    setCurrentMode(mode);

    setViewerKey(
      'mode_' + mode + '_' + Date.now()
    );
  };



  const currentActiveItem = batch[activeIndex];



  const getDisplayImage = () => {

    if (!currentActiveItem) return null;

    if (
      currentMode === 1 &&
      currentActiveItem.resultImages.v1
    ) {
      return currentActiveItem.resultImages.v1;
    }

    if (
      currentMode === 2 &&
      currentActiveItem.resultImages.v2
    ) {
      return currentActiveItem.resultImages.v2;
    }

    if (
      currentMode === 3 &&
      currentActiveItem.resultImages.v3
    ) {
      return currentActiveItem.resultImages.v3;
    }

    return (
      currentActiveItem.processedImage ||
      currentActiveItem.originalImage
    );
  };



  const bgColors = [
    colors.bg,
    colors.bg,
  ] as [string, string, ...string[]];



  const displayUri = getDisplayImage();



  const isCurrentlyLoading =
    currentActiveItem?.status === 'loading';




  return (

    <LinearGradient
      colors={bgColors}
      style={{ flex: 1 }}
    >

      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top']}
      >

        <ScrollView
          ref={mainScrollRef}
          contentContainerStyle={styles.scrollContent}
        >

          <View style={styles.header}>

            <Text
              style={[
                styles.title,
                { color: colors.text },
              ]}
            >
              Thần Nhãn Đếm Thép
            </Text>

            <Text
              style={[
                styles.subtitle,
                { color: colors.subText },
              ]}
            >
              Nguyễn Thanh Dương - HPDQ01016
            </Text>

          </View>




          <View
            style={[
              styles.imageContainer,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >

            {isCurrentlyLoading ? (

              <View style={styles.loadingBox}>

                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />

                <Text
                  style={{
                    color: colors.text,
                    marginTop: 10,
                    textAlign: 'center',
                  }}
                >
                  Đang nhờ AI đếm thép...
                </Text>

              </View>

            ) : displayUri ? (

              <SteelImageViewer
                key={viewerKey}
                imageUri={displayUri}
              />

            ) : (

              <View style={styles.placeholderBox}>

                <Ionicons
                  name="image-outline"
                  size={60}
                  color={colors.subText}
                />

                <Text
                  style={{
                    color: colors.subText,
                    marginTop: 10,
                  }}
                >
                  Chưa có ảnh nào
                </Text>

              </View>
            )}
          </View>

        </ScrollView>

      </SafeAreaView>

    </LinearGradient>
  );
}






const styles = StyleSheet.create({

  scrollContent: {
    padding: 15,
    paddingBottom: 80,
  },

  header: {
    alignItems: 'center',
    marginBottom: 15,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },



  imageContainer: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },



  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },



  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },



  viewerScroll: {
    width: '100%',
    height: '100%',
  },



  viewerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },



  // FIX CHÍNH
  mainImage: {
    width: 320,
    height: 320,
  },

});