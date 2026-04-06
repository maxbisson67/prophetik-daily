import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require("./capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function jerseyDoc({
  id,
  sort,
  name,
  primary,
  accent = "#ffffff",
  text = "#ffffff",
  logoVariant = "light", // light | dark
}) {
  return {
    id,
    data: {
      active: true,
      sort,
      sport: "hockey",
      name,

      previewFrontUrl: null,
      previewBackUrl: null,

      templateFrontPath: `jerseys/hockey/${id}_front.png`,
      templateBackPath: `jerseys/hockey/${id}_back.png`,
      templateProfilePath: `jerseys/hockey/${id}_front.png`,

      colors: {
        primary,
        accent,
        text,
      },

      textZones: {
        backName: {
          x: 325,
          y: 180,
          maxWidth: 260,
          fontSize: 38,
          color: "#ffffff",
        },
        backNumber: {
          x: 325,
          y: 320,
          fontSize: 135,
          color: "#ffffff",
        },
      },

      frontZones: {
        logo: {
          x: 325,
          y: 175,
          width: 84,
          height: 84,
          variant: logoVariant,
        },
        captainLetter: {
          x: 500,
          y: 155,
          fontSize: 58,
          color: text,
        },
        assistantLetter: {
          x: 500,
          y: 155,
          fontSize: 58,
          color: text,
        },
        badges: {
          x: 150,
          y: 185,
          lineHeight: 36,
          fontSize: 24,
          color: text,
        },
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

async function seedJerseys() {
  const jerseys = [
    jerseyDoc({
      id: "blue_1",
      sort: 1,
      name: "Bleu",
      primary: "#1e3a8a",
      accent: "#ef4444",
      text: "#ffffff",
      logoVariant: "light",
    }),
    jerseyDoc({
      id: "white_1",
      sort: 2,
      name: "Blanc",
      primary: "#f3f4f6",
      accent: "#ef4444",
      text: "#111111",
      logoVariant: "dark",
    }),
  ];

  for (const jersey of jerseys) {
    await db.collection("catalog_jerseys").doc(jersey.id).set(jersey.data, { merge: true });
    console.log(`✅ Created ${jersey.id}`);
  }

  console.log("🔥 Done seeding jerseys");
}

seedJerseys().catch(console.error);