import React, { useState, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  LogBox,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BrowserRouter } from "react-router";
import App from "./App";
import { BUNDLED_HTML } from "./bundledHtml";
import "./index.css";

// Suppress benign JS circular dependency warnings in Metro
LogBox.ignoreLogs(["Require cycle:"]);

const DEFAULT_DEV_URL = "http://10.0.2.2:5173";
const WebViewComponent = WebView as any;

export default function ExpoApp() {
  const webViewRef = useRef<any>(null);

  // Direct Web browser platform rendering
  if (Platform.OS === "web") {
    return (
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  }

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

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data || !data.type || !data.id) return;

      if (data.type === "ASYNC_STORAGE_GET") {
        const val = await AsyncStorage.getItem(data.key);
        const payload = JSON.stringify({
          id: data.id,
          type: "ASYNC_STORAGE_RESPONSE",
          value: val,
        });
        webViewRef.current?.injectJavaScript(`
          (function() {
            window.postMessage(${JSON.stringify(payload)}, "*");
          })();
          true;
        `);
      } else if (data.type === "ASYNC_STORAGE_SET") {
        await AsyncStorage.setItem(data.key, data.value);
        const payload = JSON.stringify({
          id: data.id,
          type: "ASYNC_STORAGE_RESPONSE",
          success: true,
        });
        webViewRef.current?.injectJavaScript(`
          (function() {
            window.postMessage(${JSON.stringify(payload)}, "*");
          })();
          true;
        `);
      } else if (data.type === "ASYNC_STORAGE_CLEAR") {
        await AsyncStorage.clear();
        const payload = JSON.stringify({
          id: data.id,
          type: "ASYNC_STORAGE_RESPONSE",
          success: true,
        });
        webViewRef.current?.injectJavaScript(`
          (function() {
            window.postMessage(${JSON.stringify(payload)}, "*");
          })();
          true;
        `);
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
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

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
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              mixedContentMode="always"
              originWhitelist={["*"]}
              onMessage={handleWebViewMessage}
              onError={() => setHasError(true)}
              renderLoading={() => (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.loadingText}>Loading SynthIQ...</Text>
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
    backgroundColor: "#0f172a",
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  centerContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#f8fafc",
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
