import { useState, useRef, useEffect } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  LogBox,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { NavigationBar } from "expo-navigation-bar";
import { Paths } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { BUNDLED_HTML } from "./bundledHtml";

// Suppress benign JS circular dependency warnings in Metro
LogBox.ignoreLogs(["Require cycle:"]);

const DEFAULT_DEV_URL = "http://10.0.2.2:5173";
const WebViewComponent = WebView as any;

export default function ExpoApp() {
  const webViewRef = useRef<any>(null);
  const canGoBackRef = useRef<boolean>(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const onBackPress = () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, []);

  const colorScheme = useColorScheme();
  const isSystemDark = colorScheme === "dark";
  const [themeState, setThemeState] = useState<{
    isDark: boolean;
    surfaceColor: string;
    navBarColor: string;
  }>({
    isDark: isSystemDark,
    surfaceColor: isSystemDark ? "#111318" : "#ffffff",
    navBarColor: isSystemDark ? "#1d2024" : "#f1f5f9",
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        NavigationBar.setStyle(themeState.isDark ? "dark" : "light");
      } catch (err) {
        console.warn("Failed to set NavigationBar:", err);
      }
    }
  }, [themeState.isDark]);

  // Native Android / Mobile WebView Shell
  const [useLiveServer, setUseLiveServer] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_DEV_URL);
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_DEV_URL);
  const [hasError, setHasError] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const handleConnectLive = () => {
    setHasError(false);
    setCurrentUrl(serverUrl);
    setUseLiveServer(true);
  };

  const handleSwitchToBundled = () => {
    setHasError(false);
    setUseLiveServer(false);
  };

  const syncThemeFromWebView = () => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          var isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
          var style = window.getComputedStyle(document.documentElement);
          var surface = style.getPropertyValue("--md-sys-color-surface").trim() || (isDark ? "#111318" : "#ffffff");
          var navBar = style.getPropertyValue("--md-sys-color-surface-container").trim() || (isDark ? "#1d2024" : "#f1f5f9");
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "THEME_UPDATE",
              isDark: isDark,
              surfaceColor: surface,
              navBarColor: navBar
            }));
          }
        } catch (e) {}
      })();
      true;
    `);
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data || !data.type) return;

      if (data.type === "THEME_UPDATE") {
        const isDark = Boolean(data.isDark);
        const surfaceColor = data.surfaceColor || (isDark ? "#111318" : "#ffffff");
        const navBarColor = data.navBarColor || (isDark ? "#1d2024" : "#f1f5f9");
        setThemeState({
          isDark,
          surfaceColor,
          navBarColor,
        });
        if (Platform.OS === "android") {
          try {
            NavigationBar.setStyle(isDark ? "dark" : "light");
          } catch (err) {
            console.warn("Failed to set NavigationBar on THEME_UPDATE:", err);
          }
        }
        return;
      }

      if (data.type === "DOWNLOAD_START") {
        webViewRef.current = {
          ...webViewRef.current,
          _downloadState: {
            filename: data.filename,
            totalChunks: data.totalChunks,
            chunks: new Array(data.totalChunks),
          },
        };
      } else if (data.type === "DOWNLOAD_CHUNK" && webViewRef.current?._downloadState) {
        webViewRef.current._downloadState.chunks[data.index] = data.data;
      } else if (data.type === "DOWNLOAD_END" && webViewRef.current?._downloadState) {
        const state = webViewRef.current._downloadState;
        delete webViewRef.current._downloadState;
        try {
          const fullData = state.chunks.join("");
          const fileUri = `${Paths.cache.uri}${state.filename}`;
          await FileSystemLegacy.writeAsStringAsync(fileUri, fullData);
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: "Save SynthIQ Data",
          });
          const payload = JSON.stringify({
            id: data.id || "unknown",
            type: "DOWNLOAD_RESPONSE",
            success: true,
          });
          webViewRef.current?.injectJavaScript(`
            (function() {
              window.postMessage(${JSON.stringify(payload)}, "*");
            })();
            true;
          `);
        } catch (err) {
          console.error("Error handling download:", err);
          const payload = JSON.stringify({
            id: data.id || "unknown",
            type: "DOWNLOAD_RESPONSE",
            success: false,
            error: String(err),
          });
          webViewRef.current?.injectJavaScript(`
            (function() {
              window.postMessage(${JSON.stringify(payload)}, "*");
            })();
            true;
          `);
        }
      }
    } catch (err) {
      console.error("Error handling WebView storage message:", err);
    }
  };

  const webViewSource = useLiveServer
    ? { uri: currentUrl }
    : { html: BUNDLED_HTML, baseUrl: "https://synthiq.app" };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: themeState.surfaceColor }]}
      >
        <StatusBar
          barStyle={themeState.isDark ? "light-content" : "dark-content"}
          backgroundColor={themeState.surfaceColor}
          animated={true}
        />
        {Platform.OS === "android" && (
          <NavigationBar style={themeState.isDark ? "dark" : "light"} />
        )}

        {showConfig && (
          <View style={styles.configBar}>
            <Text style={styles.configLabel}>Live Server URL:</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.x:5173"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.button} onPress={handleConnectLive}>
              <Text style={styles.buttonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.webviewContainer}>
          {!hasError ? (
            <WebViewComponent
              ref={webViewRef}
              key={useLiveServer ? currentUrl : "bundled-html"}
              source={webViewSource}
              style={[styles.webview, { backgroundColor: themeState.surfaceColor }]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              mixedContentMode="always"
              originWhitelist={["*"]}
              onMessage={handleWebViewMessage}
              onLoadEnd={syncThemeFromWebView}
              onNavigationStateChange={(navState: any) => {
                canGoBackRef.current = navState.canGoBack;
              }}
              onError={() => setHasError(true)}
              renderLoading={() => (
                <View
                  style={[
                    styles.centerContainer,
                    { backgroundColor: themeState.surfaceColor },
                  ]}
                >
                  <ActivityIndicator
                    size="large"
                    color={themeState.isDark ? "#87cffc" : "#006590"}
                  />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: themeState.isDark ? "#f8fafc" : "#1e293b" },
                    ]}
                  >
                    Loading SynthIQ...
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.errorTitle}>Connection Failed</Text>
              <Text style={styles.errorText}>
                Unable to connect to live dev server at:
              </Text>
              <Text style={styles.urlText}>{currentUrl}</Text>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSwitchToBundled}
              >
                <Text style={styles.buttonText}>Use Standalone Offline Mode</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowConfig(!showConfig)}
              >
                <Text style={styles.secondaryButtonText}>
                  {showConfig ? "Hide Settings" : "Configure Live Server IP"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  centerContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorTitle: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  urlText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
    marginVertical: 8,
  },
  configBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#1e293b",
  },
  configLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginRight: 8,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#475569",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#94a3b8",
    fontWeight: "600",
    fontSize: 14,
  },
});
