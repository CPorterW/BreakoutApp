import React from 'react';
import { View, StyleSheet } from 'react-native';
import Game from './components/Game';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Game />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});