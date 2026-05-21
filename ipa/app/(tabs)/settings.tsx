import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Switch 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTab } from '../context/TabContext'; 

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { tabState, toggleTab } = useTab(); 
  
  // State lưu trữ 2 đường link và lựa chọn hiện tại
  const [colabUrl, setColabUrl] = useState('');
  const [hfUrl, setHfUrl] = useState('');
  const [activeServer, setActiveServer] = useState<'colab' | 'hf'>('colab');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const cUrl = await AsyncStorage.getItem('COLAB_URL');
      if (cUrl) setColabUrl(cUrl);
      
      const hUrl = await AsyncStorage.getItem('HF_URL');
      if (hUrl) setHfUrl(hUrl);
      
      const active = await AsyncStorage.getItem('ACTIVE_SERVER');
      if (active === 'colab' || active === 'hf') {
        setActiveServer(active);
      }
    } catch (e) { 
      console.error('Lỗi load settings:', e); 
    }
  };

  // Các hàm lưu tự động ngay khi gõ
  const handleSaveColabUrl = async (text: string) => {
      setColabUrl(text);
      await AsyncStorage.setItem('COLAB_URL', text);
  };

  const handleSaveHfUrl = async (text: string) => {
      setHfUrl(text);
      await AsyncStorage.setItem('HF_URL', text);
  };

  // Hàm chuyển đổi máy chủ
  const handleSelectServer = async (server: 'colab' | 'hf') => {
      setActiveServer(server);
      await AsyncStorage.setItem('ACTIVE_SERVER', server);
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    sectionTitle: { fontSize: 13, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' as const },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 2, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.iconBg, justifyContent: 'center' as const, alignItems: 'center' as const },
    authInput: { backgroundColor: colors.iconBg, color: colors.text, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 5 },
    serverRow: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{padding: 15, alignItems:'center'}}><Text style={dynamicStyles.headerTitle}>Cài Đặt</Text></View>
        <View style={{paddingHorizontal: 15}}>
          
          {/* CHỌN MÁY CHỦ AI */}
          <Text style={dynamicStyles.sectionTitle}>🌐 MÁY CHỦ ĐẾM THÉP</Text>
          <View style={dynamicStyles.card}>
            
            {/* Colab Row */}
            <View style={dynamicStyles.serverRow}>
              <TouchableOpacity onPress={() => handleSelectServer('colab')} style={{ paddingRight: 15 }}>
                <Ionicons name={activeServer === 'colab' ? "radio-button-on" : "radio-button-off"} size={28} color={activeServer === 'colab' ? colors.primary : colors.subText} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: activeServer === 'colab' ? colors.primary : colors.text, fontWeight: 'bold' }}>Link Google Colab</Text>
                <TextInput 
                  style={[dynamicStyles.authInput, activeServer !== 'colab' && { opacity: 0.5 }]} 
                  placeholder="https://...ngrok-free.dev/predict" 
                  placeholderTextColor={colors.subText} 
                  value={colabUrl} 
                  onChangeText={handleSaveColabUrl} 
                />
              </View>
            </View>

            {/* Hugging Face Row */}
            <View style={[dynamicStyles.serverRow, { borderBottomWidth: 0 }]}>
              <TouchableOpacity onPress={() => handleSelectServer('hf')} style={{ paddingRight: 15 }}>
                <Ionicons name={activeServer === 'hf' ? "radio-button-on" : "radio-button-off"} size={28} color={activeServer === 'hf' ? colors.primary : colors.subText} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: activeServer === 'hf' ? colors.primary : colors.text, fontWeight: 'bold' }}>Link Hugging Face</Text>
                <TextInput 
                  style={[dynamicStyles.authInput, activeServer !== 'hf' && { opacity: 0.5 }]} 
                  placeholder="https://tên-space.hf.space/predict" 
                  placeholderTextColor={colors.subText} 
                  value={hfUrl} 
                  onChangeText={handleSaveHfUrl} 
                />
              </View>
            </View>

          </View>

          {/* GIAO DIỆN */}
          <Text style={dynamicStyles.sectionTitle}>🎨 GIAO DIỆN</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={dynamicStyles.iconBox}><Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={18} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} /></View>
                <Text style={[dynamicStyles.text, {marginLeft: 12, fontSize: 15, fontWeight: '500'}]}>{theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}</Text>
              </View>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
            </View>
          </View>

          {/* QUẢN LÝ TAB */}
          <Text style={dynamicStyles.sectionTitle}>👁️ QUẢN LÝ TAB</Text>
          <View style={dynamicStyles.card}>
            {[
              { key: 'calendar', label: 'Lịch làm việc', icon: 'calendar' },
              { key: 'notes', label: 'Ghi chú', icon: 'document-text' },
              { key: 'sheets', label: 'Trang tính', icon: 'grid' },
              { key: 'media', label: 'Media AI', icon: 'images' },
              { key: 'reminders', label: 'Nhắc nhở', icon: 'alarm' },
            ].map((item, index, arr) => (
              <View key={item.key} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10,
                  borderBottomWidth: index < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border
              }}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                   <View style={dynamicStyles.iconBox}><Ionicons name={item.icon as any} size={18} color={colors.primary} /></View>
                   <Text style={[dynamicStyles.text, {marginLeft: 12, fontSize: 15}]}>{item.label}</Text>
                </View>
                <Switch 
                  value={tabState[item.key as keyof typeof tabState]} 
                  onValueChange={() => toggleTab(item.key as any)} 
                  trackColor={{ false: "#E5E7EB", true: colors.primary }} 
                  thumbColor={"#fff"} 
                  style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} 
                />
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}