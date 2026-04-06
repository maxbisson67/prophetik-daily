import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

if (!getApps().length) initializeApp();

const db = getFirestore();
const storage = getStorage();
const bucket = storage.bucket();

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function validateLastName(lastName) {
  const v = normalizeName(lastName);

  if (!v) {
    throw new HttpsError("invalid-argument", "Nom requis.");
  }

  if (v.length < 2 || v.length > 12) {
    throw new HttpsError("invalid-argument", "Le nom doit contenir entre 2 et 12 caractères.");
  }

  if (!/^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ' -]+$/u.test(v)) {
    throw new HttpsError("invalid-argument", "Le nom contient des caractères non permis.");
  }

  return v;
}

function validateNumber(numberValue) {
  const raw = String(numberValue ?? "").trim();

  if (!/^\d{1,2}$/.test(raw)) {
    throw new HttpsError("invalid-argument", "Le numéro doit être entre 0 et 99.");
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 99) {
    throw new HttpsError("invalid-argument", "Le numéro doit être entre 0 et 99.");
  }

  return String(n);
}

async function readStorageFileAsBuffer(path) {
  const file = bucket.file(path);
  const [exists] = await file.exists();

  if (!exists) {
    throw new HttpsError("not-found", `Fichier introuvable: ${path}`);
  }

  const [buf] = await file.download();
  return buf;
}

async function uploadBuffer({
  path,
  buffer,
  contentType = "image/png",
  metadata = {},
}) {
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public,max-age=3600",
      metadata,
    },
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: "2100-01-01",
  });

  return url;
}

function svgTextOverlay({
  width,
  height,
  text,
  x,
  y,
  fontSize,
  color = "#ffffff",
  stroke = "#111111",
  strokeWidth = 8,
  fontWeight = 900,
  anchor = "middle",
  family = "Arial",
}) {
  const safe = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${x}"
        y="${y}"
        fill="${color}"
        stroke="${stroke}"
        stroke-width="${strokeWidth}"
        paint-order="stroke fill"
        font-size="${fontSize}"
        font-family="${family}"
        font-weight="${fontWeight}"
        text-anchor="${anchor}"
        dominant-baseline="middle"
      >${safe}</text>
    </svg>
  `);
}

function centeredImagePlacement({ x, y, width, height }) {
  return {
    left: Math.round(x - width / 2),
    top: Math.round(y - height / 2),
  };
}

async function composeBack({ templateBuffer, name, number, textZones }) {
  const base = sharp(templateBuffer);
  const meta = await base.metadata();

  const width = meta.width || 650;
  const height = meta.height || 650;

  logger.info("[composeBack] meta", {
    width,
    height,
    name,
    number,
    textZones,
  });

  const overlays = [];

  if (textZones?.backName) {
    overlays.push({
      input: svgTextOverlay({
        width,
        height,
        text: name,
        x: textZones.backName.x,
        y: textZones.backName.y,
        fontSize: textZones.backName.fontSize || 38,
        color: textZones.backName.color || "#ffffff",
        stroke: textZones.backName.strokeColor || "#111111",
        strokeWidth: textZones.backName.strokeWidth || 6,
      }),
      top: 0,
      left: 0,
    });
  }

  if (textZones?.backNumber) {
    overlays.push({
      input: svgTextOverlay({
        width,
        height,
        text: number,
        x: textZones.backNumber.x,
        y: textZones.backNumber.y,
        fontSize: textZones.backNumber.fontSize || 135,
        color: textZones.backNumber.color || "#ffffff",
        stroke: textZones.backNumber.strokeColor || "#111111",
        strokeWidth: textZones.backNumber.strokeWidth || 10,
      }),
      top: 0,
      left: 0,
    });
  }

  return await base.composite(overlays).png().toBuffer();
}

async function composeFront({ templateBuffer, frontZones }) {
  const base = sharp(templateBuffer);
  const meta = await base.metadata();

  const width = meta.width || 650;
  const height = meta.height || 650;

  const overlays = [];
  const logoCfg = frontZones?.logo || null;

  if (logoCfg?.variant) {
    const logoPath =
      logoCfg.variant === "dark"
        ? "branding/prophetik/logo_dark.png"
        : "branding/prophetik/logo_light.png";

    logger.info("[composeFront] logo", {
      width,
      height,
      logoPath,
      logoCfg,
    });

    const logoBufferRaw = await readStorageFileAsBuffer(logoPath);
    const logoW = logoCfg.width || 84;
    const logoH = logoCfg.height || 84;

    const logoBuffer = await sharp(logoBufferRaw)
      .resize({
        width: logoW,
        height: logoH,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const pos = centeredImagePlacement({
      x: logoCfg.x || Math.round(width / 2),
      y: logoCfg.y || 175,
      width: logoW,
      height: logoH,
    });

    overlays.push({
      input: logoBuffer,
      left: pos.left,
      top: pos.top,
    });
  }

  return await base.composite(overlays).png().toBuffer();
}

async function composeProfile({ templateBuffer }) {
  return await sharp(templateBuffer).png().toBuffer();
}

export const generateUserJersey = onCall(
  { region: "us-central1", timeoutSeconds: 540, memory: "1GiB" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const jerseyId = String(req.data?.jerseyId || "").trim();
    const rawLastName = req.data?.lastName;
    const rawNumber = req.data?.number;

    if (!jerseyId) {
      throw new HttpsError("invalid-argument", "jerseyId requis.");
    }

    const lastName = validateLastName(rawLastName);
    const number = validateNumber(rawNumber);

    logger.info("[generateUserJersey] start", {
      uid,
      jerseyId,
      lastName,
      number,
    });

    const participantRef = db.doc(`participants/${uid}`);
    const participantSnap = await participantRef.get();
    const participantData = participantSnap.data() || {};
    const oldVersion = String(participantData.jerseyVersion || "").trim();

    const jerseyRef = db.collection("catalog_jerseys").doc(jerseyId);
    const jerseySnap = await jerseyRef.get();

    if (!jerseySnap.exists) {
      throw new HttpsError("not-found", "Jersey introuvable.");
    }

    const jersey = jerseySnap.data() || {};

    if (jersey.active === false) {
      throw new HttpsError("failed-precondition", "Ce jersey n'est pas actif.");
    }

    const sport = String(jersey.sport || "").toLowerCase();
    if (sport !== "hockey") {
      throw new HttpsError("failed-precondition", "Seul le hockey est supporté pour l'instant.");
    }

    const frontPath = String(jersey.templateFrontPath || "").trim();
    const backPath = String(jersey.templateBackPath || "").trim();
    const profilePath = String(jersey.templateProfilePath || frontPath).trim();

    if (!frontPath || !backPath) {
      throw new HttpsError("failed-precondition", "Templates incomplets dans catalog_jerseys.");
    }

    const [frontTemplate, backTemplate, profileTemplate] = await Promise.all([
      readStorageFileAsBuffer(frontPath),
      readStorageFileAsBuffer(backPath),
      readStorageFileAsBuffer(profilePath),
    ]);

    const [frontBuffer, backBuffer, profileBuffer] = await Promise.all([
      composeFront({
        templateBuffer: frontTemplate,
        frontZones: jersey.frontZones || {},
      }),
      composeBack({
        templateBuffer: backTemplate,
        name: lastName,
        number,
        textZones: jersey.textZones || {},
      }),
      composeProfile({
        templateBuffer: profileTemplate,
      }),
    ]);

    const version = String(Date.now());
    const basePath = `jerseys/generated/${uid}/${version}`;

    const [jerseyFrontUrl, jerseyBackUrl, jerseyProfileUrl] = await Promise.all([
      uploadBuffer({
        path: `${basePath}/front.png`,
        buffer: frontBuffer,
        metadata: { uid, jerseyId, side: "front", version },
      }),
      uploadBuffer({
        path: `${basePath}/back.png`,
        buffer: backBuffer,
        metadata: { uid, jerseyId, side: "back", version },
      }),
      uploadBuffer({
        path: `${basePath}/profile.png`,
        buffer: profileBuffer,
        metadata: { uid, jerseyId, side: "profile", version },
      }),
    ]);

    const avatarUrl = jerseyFrontUrl;

    const publicPayload = {
      avatarKind: "jersey",
      avatarUrl,
      photoURL: avatarUrl,
      jerseyId,
      jerseySport: sport,
      jerseyName: lastName,
      jerseyNumber: number,
      jerseyFrontUrl,
      jerseyBackUrl,
      jerseyProfileUrl,
      jerseyVersion: version,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      db.doc(`participants/${uid}`).set(publicPayload, { merge: true }),
      db.doc(`profiles_public/${uid}`).set(publicPayload, { merge: true }),
    ]);

    if (oldVersion && oldVersion !== version) {
      try {
        await bucket.deleteFiles({
          prefix: `jerseys/generated/${uid}/${oldVersion}/`,
        });

        logger.info("[generateUserJersey] old version deleted", {
          uid,
          oldVersion,
        });
      } catch (e) {
        logger.warn("[generateUserJersey] old version delete failed", {
          uid,
          oldVersion,
          message: String(e?.message || e),
        });
      }
    }

    logger.info("[generateUserJersey] success", {
      uid,
      jerseyId,
      version,
      oldVersion,
      avatarUrl,
    });

    return {
      ok: true,
      avatarUrl,
      jerseyFrontUrl,
      jerseyBackUrl,
      jerseyProfileUrl,
      jerseyId,
      jerseyName: lastName,
      jerseyNumber: number,
      jerseyVersion: version,
    };
  }
);