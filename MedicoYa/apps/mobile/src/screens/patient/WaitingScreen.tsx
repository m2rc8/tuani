import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function WaitingScreen() {
  return <View style={styles.c}><Text>Waiting...</Text></View>
}

const styles = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
