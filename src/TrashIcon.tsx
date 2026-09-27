import { StyleSheet, View } from 'react-native';

/**
 * A trash can drawn from plain views, so the package needs no SVG library:
 * `left={{ icon: <TrashIcon />, label: 'Delete', onAction }}`. Any other icon
 * set works the same way.
 */
export function TrashIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const stroke = Math.max(1.5, Math.round(size / 10));
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.34,
          height: size * 0.14,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderTopLeftRadius: stroke,
          borderTopRightRadius: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{ width: size * 0.84, height: stroke, borderRadius: stroke, backgroundColor: color }}
      />
      <View
        style={{
          width: size * 0.62,
          flex: 1,
          marginTop: stroke * 0.5,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderBottomLeftRadius: stroke * 1.5,
          borderBottomRightRadius: stroke * 1.5,
          borderColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 1 },
});
