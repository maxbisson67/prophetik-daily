import { View } from "react-native";

export default function FormSectionSeparator({ colors, marginVertical = 8 }) {
  return (
    <View
      style={{
        height: 3,
        backgroundColor: colors.border,
        marginVertical,
        borderRadius: 1,
        opacity: 1,
      }}
    />
  );
}
