import React from "react";
import { View, Image } from "react-native";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

function withCacheBust(url, version) {
  if (!url) return null;
  const v = Number.isFinite(version) ? version : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

export default function ParticipantAvatar({
  photoURL,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
  avatarKind,
  name,
  size = 40,
  colors = {},
  version,
  squareJersey = true,
}) {
  const front = jerseyFrontUrl || null;
  const back = jerseyBackUrl || null;
  const fallbackUri = photoURL || avatarUrl || front || null;
  const uri = withCacheBust(fallbackUri, version);
  const isJersey = avatarKind === "jersey" || !!front;
  const borderColor = colors.border || "#e5e7eb";
  const backgroundColor = colors.card2 || colors.border || "#f3f4f6";

  if (isJersey && front && back) {
    const jerseySize = squareJersey ? size - 4 : size;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: squareJersey ? 8 : size / 2,
          overflow: "hidden",
          backgroundColor,
          borderWidth: 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <JerseyFlipAvatar
          frontUrl={front}
          backUrl={back}
          size={jerseySize}
          holdMs={2200}
          fadeDurationMs={450}
          backgroundColor={backgroundColor}
        />
      </View>
    );
  }

  if (isJersey && front) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: squareJersey ? 8 : size / 2,
          overflow: "hidden",
          backgroundColor,
          borderWidth: 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={{ uri: withCacheBust(front, version) }}
          style={{ width: size - 4, height: size - 4 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <Image
      source={uri ? { uri } : AVATAR_PLACEHOLDER}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        borderWidth: 1,
        borderColor,
      }}
      accessibilityLabel={name || "avatar"}
    />
  );
}

export function participantInfoToAvatarProps(info = {}, size) {
  return {
    photoURL: info.photoURL || null,
    avatarUrl: info.avatarUrl || null,
    jerseyFrontUrl: info.jerseyFrontUrl || null,
    jerseyBackUrl: info.jerseyBackUrl || null,
    avatarKind: info.avatarKind || null,
    version: info.version,
    size,
  };
}
