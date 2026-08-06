import React, { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { normalizeJerseyUrl } from "@src/ui/jerseyImageUtils";
import { resolveJerseyDownloadUrl } from "@src/ui/resolveJerseyDownloadUrl";

/**
 * Remote jersey PNG loader. Resolves legacy GCS signed URLs via Firebase Storage when needed.
 */
export default function JerseyImage({
  uri,
  size,
  width,
  height,
  style,
  onError,
  accessibilityLabel,
}) {
  const [failed, setFailed] = useState(false);
  const [resolvedUri, setResolvedUri] = useState(null);
  const normalizedUri = useMemo(() => normalizeJerseyUrl(uri), [uri]);
  const w = width ?? size;
  const h = height ?? size;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!normalizedUri) {
      setResolvedUri(null);
      return undefined;
    }

    resolveJerseyDownloadUrl(normalizedUri).then((nextUri) => {
      if (!cancelled) setResolvedUri(nextUri);
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedUri]);

  if (!resolvedUri || failed) {
    return <View style={[{ width: w, height: h }, style]} />;
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={[{ width: w, height: h }, style]}
      resizeMode="contain"
      fadeDuration={0}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

export function prefetchJerseyUrl(uri) {
  const normalized = normalizeJerseyUrl(uri);
  if (!normalized) return Promise.resolve(false);
  return resolveJerseyDownloadUrl(normalized)
    .then((resolved) => (resolved ? Image.prefetch(resolved) : false))
    .catch(() => false);
}
