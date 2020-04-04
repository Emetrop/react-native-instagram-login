import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import qs from 'qs'
import axios from 'axios'
import { WebView } from "react-native-webview"
import {
  StyleSheet,
  View,
  Alert,
  Modal,
  TouchableOpacity,
  Image
} from 'react-native'

const patchPostMessageJsCode = `(${String(function () {
  var originalPostMessage = window.postMessage
  var patchedPostMessage = function (message, targetOrigin, transfer) {
    originalPostMessage(message, targetOrigin, transfer)
  }
  patchedPostMessage.toString = function () {
    return String(Object.hasOwnProperty).replace('hasOwnProperty', 'postMessage')
  }
  window.postMessage = patchedPostMessage
})})();`

export default function Instagram({
  redirectUrl,
  appId,
  appSecret,
  responseType,
  onLoginSuccess,
  onLoginFailure,
  renderClose,
  onClose,
  scopes,
  wrapperStyle,
  containerStyle,
  closeStyle,
  webViewStyle,
  ...others
}) {
  const [modalVisible, setModalVisible] = useState(others.modalVisible)
  const [key, setKey] = useState(1)

  useEffect(() => setModalVisible(others.modalVisible), [others.modalVisible])

  let webView

  const _onNavigationStateChange = async (webViewState) => {
    const { url } = webViewState

    if (webViewState.title === 'Instagram' && webViewState.url === 'https://www.instagram.com/') {
      setKey(key + 1)
    }

    if (!url || !url.startsWith(redirectUrl)) {
      return
    }

    webView.stopLoading()

    const match = url.match(/(#|\?)(.*)/)
    const results = qs.parse(match[2])

    setModalVisible(false)

    if (results.access_token) {
      // Keeping this to keep it backwards compatible,
      // but also returning raw results to account for future changes.
      onLoginSuccess(results.access_token, results)
      return
    }

    if (!results.code) {
      onLoginFailure(results)
      return
    }

    //Fetching to get token with appId, appSecret and code
    let { code } = results
    code = code.split('#_').join('')

    if (responseType === 'code') {
      if (code) {
        onLoginSuccess(code, results)
      } else {
        onLoginFailure(results)
      }
      return
    }

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const http = axios.create({ baseURL: 'https://api.instagram.com/oauth/access_token',  headers })

    let form = new FormData()
    form.append( 'app_id', appId )
    form.append( 'app_secret', appSecret )
    form.append( 'grant_type', 'authorization_code' )
    form.append( 'redirect_uri', redirectUrl )
    form.append( 'code', code )

    const res = await http.post( '/', form )
      .catch((error) => {
        console.log( error.response )
        return false
      })

    if (res) {
      onLoginSuccess(res.data, results)
    } else {
      onLoginFailure(results)
    }
  }

  const _onMessage = (reactMessage) => {
    try {
      const json = JSON.parse(reactMessage.nativeEvent.data)
      if (json && json.error_type) {
        setModalVisible(false)
        onLoginFailure(json)
      }
    } catch (err) { }
  }

  const onPressClose = () => {
    if (onClose) onClose()
    setModalVisible(false)
  }

  const renderWebview = () => {
    let uri = "https://api.instagram.com/oauth/authorize/?";
    uri += `app_id=${appId}&`;
    uri += `redirect_uri=${redirectUrl}&`;
    uri += `response_type=${responseType}&`;
    uri += `scope=${scopes.join(',')}`;

    return (
      <WebView
        key={key}
        incognito
        startInLoadingState
        cacheEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        domStorageEnabled={false}
        containerStyle={containerStyle}
        source={{ uri }}
        style={[styles.webView, webViewStyle]}
        onNavigationStateChange={_onNavigationStateChange}
        onError={_onNavigationStateChange}
        onMessage={_onMessage}
        ref={webViewRef => { webView = webViewRef }}
        injectedJavaScript={patchPostMessageJsCode}
      />
    )
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={[styles.container, containerStyle]}>
        <View style={[styles.wrapper, wrapperStyle]}>
          {renderWebview()}
        </View>
        <TouchableOpacity
          onPress={onPressClose}
          style={[styles.close, closeStyle]}
          accessibilityComponentType={'button'}
          accessibilityTraits={['button']}
        >
          {renderClose ? renderClose() : (
            <Image
              source={require('./assets/close-button.png')}
              style={styles.imgClose}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

Instagram.propTypes = {
  appId: PropTypes.string.isRequired,
  appSecret: PropTypes.string.isRequired,
  redirectUrl: PropTypes.string,
  scopes: PropTypes.array,
  onLoginSuccess: PropTypes.func,
  modalVisible: PropTypes.bool,
  onLoginFailure: PropTypes.func,
  onClose: PropTypes.func,
  responseType: PropTypes.oneOf(['code', 'token']),
  containerStyle: PropTypes.object,
  wrapperStyle: PropTypes.object,
  closeStyle: PropTypes.object,
  webViewStyle: PropTypes.object,
}

Instagram.defaultProps = {
  redirectUrl: 'https://google.com',
  responseType: 'code',
  scopes: ['basic'],
  onClose: null,
  onLoginFailure: console.debug,
  onLoginSuccess: (token) => {
    Alert.alert(
      'Alert Title',
      'Token: ' + token,
      [
        { text: 'OK' }
      ],
      { cancelable: false }
    )
  }
}

const styles = StyleSheet.create({
  webView: {
    flex: 1
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
    borderRadius: 15
  },
  imgClose: {
    width: 30,
    height: 30,
  }
})
