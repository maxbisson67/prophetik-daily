import React, { useState } from "react";
import { View } from "react-native";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";
import JerseyPlaceholder from "@src/ui/JerseyPlaceholder";
import JerseyImage from "@src/ui/JerseyImage";
import LegacyAvatar from "@src/ui/LegacyAvatar";
import {
  hasCompleteJersey,
  hasJerseyFrontOnly,
  shouldShowLegacyAvatar,
  resolveCatalogAvatarUrl,
} from "@src/ui/resolveJerseyAvatar";

export default function ParticipantAvatar({
  photoURL,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
  avatarKind,
  name,
  size = 40,
  colors = {},
  squareJersey = true,
}) {
  const [frontFailed, setFrontFailed] = useState(false);
  const front = jerseyFrontUrl || null;
  const back = jerseyBackUrl || null;
  const catalogUrl = resolveCatalogAvatarUrl({ avatarKind, avatarUrl, photoURL });
  const showLegacy = shouldShowLegacyAvatar({
    avatarKind,
    avatarUrl: catalogUrl,
    jerseyFrontUrl: front,
    jerseyBackUrl: back,
  });
  const borderColor = colors.border || "#e5e7eb";
  const backgroundColor = colors.card2 || colors.border || "#f3f4f6";
  const frameRadius = squareJersey ? Math.max(6, Math.round(size * 0.22)) : size / 2;

  if (hasCompleteJersey(front, back)) {
    const jerseySize = squareJersey ? size - 4 : size;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: frameRadius,
          overflow: "hidden",
          backgroundColor,
          borderWidth: 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        }}
        collapsable={false}
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

  if (hasJerseyFrontOnly(front, back)) {
    if (frontFailed) {
      return (
        <JerseyPlaceholder
          size={size}
          colors={colors}
          name={name}
          borderRadius={frameRadius}
          square={squareJersey}
        />
      );
    }

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: frameRadius,
          overflow: "hidden",
          backgroundColor,
          borderWidth: 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        }}
        collapsable={false}
      >
        <JerseyImage
          uri={front}
          size={size - 4}
          onError={() => setFrontFailed(true)}
        />
      </View>
    );
  }

  if (showLegacy) {
    return (
      <LegacyAvatar uri={catalogUrl} name={name} size={size} colors={colors} />
    );
  }

  return (
    <JerseyPlaceholder
      size={size}
      colors={colors}
      name={name}
      borderRadius={frameRadius}
      square={squareJersey}
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
    size,
  };
}
