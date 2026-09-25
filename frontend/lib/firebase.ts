import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const hasFirebaseConfig = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID
);

export const isDemoMode = !hasFirebaseConfig;

const app = getApps()[0] ?? initializeApp(
  hasFirebaseConfig
    ? {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
    : {
      apiKey: "demo",
      authDomain: "demo.local",
      projectId: "demo",
      storageBucket: "demo.appspot.com",
      appId: "demo",
    }
);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");

export const auth = getAuth(app);

// Local testing only: NEXT_PUBLIC_AUTH_EMULATOR=1 points Auth at the Firebase Auth emulator (no SMS, no reCAPTCHA),
// so the phone-OTP flow can be exercised without real phone numbers. Never set in production.
if (process.env.NEXT_PUBLIC_AUTH_EMULATOR === "1" && typeof window !== "undefined") {
  const g = globalThis as { __authEmulator?: boolean };
  if (!g.__authEmulator) {
    g.__authEmulator = true;
    auth.settings.appVerificationDisabledForTesting = true;
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
}
