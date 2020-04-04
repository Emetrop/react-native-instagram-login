import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WebView } from 'react-native-webview';
import {
  StyleSheet,
  View,
  Alert,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';

import closeButton from './assets/close-button.png';

// code below fixes this issue
// https://github.com/hungdev/react-native-instagram-login/issues/16
const patchPostMessageJsCode = `(${String(() => {
  const originalPostMessage = window.postMessage;
  const patchedPostMessage = function (message, targetOrigin, transfer) {
    originalPostMessage(message, targetOrigin, transfer);
  };
  patchedPostMessage.toString = function () {
    return String(Object.hasOwnProperty)
      .replace('hasOwnProperty', 'postMessage');
  };
  window.postMessage = patchedPostMessage;
})})();`;

export default function InstagramOAuth({
  redirectUrl,
  appId,
  state,
  onLoginSuccess,
  onLoginFailure,
  scopes,
  wrapperStyle,
  containerStyle,
  closeStyle,
  webViewStyle,
  ...others
}) {
  const [isModalVisible, setIsModalVisible] = useState(others.isModalVisible);
  const [key, setKey] = useState(1);

  useEffect(() => setIsModalVisible(others.isModalVisible), [others.isModalVisible]);

  let webView;

  const onNavigationStateChange = ({ url, title }) => {
    if (title === 'Instagram' && url === 'https://www.instagram.com/') {
      // this key fixes
      // https://github.com/hungdev/react-native-instagram-login/issues/24
      setKey(key + 1);
    }

    if (!url || !url.startsWith(redirectUrl)) {
      return;
    }

    webView.stopLoading();

    if (url.indexOf('error=') !== -1) {
      onLoginFailure(url);
      return;
    }

    const match = url.match(/(?:\?|&)code=(.*)#_/);

    setIsModalVisible(false);

    if (match.length !== 2) {
      onLoginFailure(url);
    } else {
      onLoginSuccess(match[1], url);
    }
  };

  const onMessage = (reactMessage) => {
    try {
      const json = JSON.parse(reactMessage.nativeEvent.data);
      if (json && json.error_type) {
        setIsModalVisible(false);
        onLoginFailure(json);
      }
    } catch (err) { }
  };

  const onClose = () => {
    if (others.onClose) others.onClose();
    setIsModalVisible(false);
  };

  let uri = 'https://api.instagram.com/oauth/authorize/?';
  uri += `app_id=${appId}&`;
  uri += `redirect_uri=${redirectUrl}&`;
  uri += 'response_type=code&';
  uri += `scope=${scopes.join(',')}&`;
  uri += !state ? '' : `state=${state}`;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={isModalVisible}
      onRequestClose={() => setIsModalVisible(false)}
    >
      <View style={[styles.container, containerStyle]}>
        <View style={[styles.wrapper, wrapperStyle]}>
          <WebView
            incognito
            startInLoadingState
            key={key}
            cacheEnabled={false}
            thirdPartyCookiesEnabled={false}
            sharedCookiesEnabled={false}
            domStorageEnabled={false}
            containerStyle={containerStyle}
            onNavigationStateChange={onNavigationStateChange}
            onError={onNavigationStateChange}
            onMessage={onMessage}
            injectedJavaScript={patchPostMessageJsCode}
            source={{ uri }}
            style={[styles.webView, webViewStyle]}
            ref={(webViewRef) => { webView = webViewRef; }}
          />
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.close, closeStyle]}
          accessibilityComponentType="button"
          accessibilityTraits={['button']}
        >
          <Image
            source={closeButton}
            style={styles.imgClose}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

InstagramOAuth.propTypes = {
  appId: PropTypes.string.isRequired,
  redirectUrl: PropTypes.string.isRequired,
  scopes: PropTypes.arrayOf(PropTypes.oneOf(['user_media', 'user_profile'])).isRequired,
  state: PropTypes.string,
  onLoginSuccess: PropTypes.func,
  isModalVisible: PropTypes.bool,
  onLoginFailure: PropTypes.func,
  onClose: PropTypes.func,
  containerStyle: PropTypes.object,
  wrapperStyle: PropTypes.object,
  closeStyle: PropTypes.object,
  webViewStyle: PropTypes.object,
};

InstagramOAuth.defaultProps = {
  isModalVisible: true,
  onLoginFailure: console.debug,
  onLoginSuccess: (code) => {
    Alert.alert(
      'Instagram Login Success',
      `Code: ${code}`,
      [
        { text: 'OK' },
      ],
      { cancelable: false },
    );
  },
};

const styles = StyleSheet.create({
  webView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
  wrapper: {
    flex: 1,
    borderRadius: 5,
    borderWidth: 5,
    borderColor: 'rgba(0, 0, 0, 0.6)',
  },
  close: {
    position: 'absolute',
    top: 35,
    right: 5,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.4)',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  imgClose: {
    width: 30,
    height: 30,
  },
});
