import React, { useEffect, useRef, useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import {
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
  VideoSourceType,
} from 'react-native-agora'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens
const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? ''

export default function VideoCallScreen({ navigation, route }: any) {
  const { consultationId } = route.params as { consultationId: string }
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const engine = useRef<IRtcEngine | null>(null)
  const [joined,    setJoined]    = useState(false)
  const [remoteUid, setRemoteUid] = useState<number | null>(null)
  const [muted,     setMuted]     = useState(false)
  const [videoOff,  setVideoOff]  = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data } = await api.post<{ token: string; channel: string; uid: number; appId: string }>(
          `/api/consultations/${consultationId}/video-token`
        )

        const rtc = createAgoraRtcEngine()
        engine.current = rtc
        rtc.initialize({ appId: data.appId || AGORA_APP_ID })
        rtc.enableVideo()

        rtc.addListener('onJoinChannelSuccess', () => { if (mounted) setJoined(true) })
        rtc.addListener('onUserJoined', (_conn: any, uid: number) => { if (mounted) setRemoteUid(uid) })
        rtc.addListener('onUserOffline', () => { if (mounted) setRemoteUid(null) })
        rtc.addListener('onError', (err: number) => {
          if (mounted) Alert.alert(t('common.error_generic'), String(err))
        })

        rtc.startPreview()
        rtc.joinChannel(data.token, data.channel, data.uid, {
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        })

        if (mounted) setLoading(false)
      } catch {
        if (mounted) {
          Alert.alert(t('common.error_generic'))
          navigation.goBack()
        }
      }
    }

    init()

    return () => {
      mounted = false
      engine.current?.leaveChannel()
      engine.current?.release()
      engine.current = null
    }
  }, [consultationId])

  function endCall() {
    engine.current?.leaveChannel()
    navigation.goBack()
  }

  function toggleMute() {
    engine.current?.muteLocalAudioStream(!muted)
    setMuted(m => !m)
  }

  function toggleVideo() {
    engine.current?.muteLocalVideoStream(!videoOff)
    setVideoOff(v => !v)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.green400} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Remote video fullscreen */}
      {remoteUid !== null ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.waitingOverlay]}>
          <Text style={styles.waitingText}>{t('consultation.video_waiting')}</Text>
        </View>
      )}

      {/* Local video PiP */}
      {joined && (
        <View style={[styles.localContainer, { top: insets.top + spacing[4] }]}>
          <RtcSurfaceView
            style={styles.localVideo}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
          />
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing[4] }]}>
        <TouchableOpacity style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]} onPress={toggleMute}>
          <Text style={styles.ctrlIcon}>{muted ? '🔇' : '🎙️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <Text style={styles.endBtnText}>{t('consultation.video_end')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrlBtn, videoOff && styles.ctrlBtnActive]} onPress={toggleVideo}>
          <Text style={styles.ctrlIcon}>{videoOff ? '🚫' : '📹'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  waitingOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  waitingText:    { color: colors.text.secondary, fontSize: typography.size.base, fontFamily: 'DMSans' },
  localContainer: { position: 'absolute', right: spacing[4], width: 100, height: 140, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface.border },
  localVideo:     { flex: 1 },
  controls:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing[6], padding: spacing[4], backgroundColor: 'rgba(0,0,0,0.6)' },
  ctrlBtn:        { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnActive:  { backgroundColor: colors.status.amber + '66' },
  ctrlIcon:       { fontSize: 22 },
  endBtn:         { backgroundColor: colors.status.red, borderRadius: radius.full, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  endBtnText:     { color: '#fff', fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
})
