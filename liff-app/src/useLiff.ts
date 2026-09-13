import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export function useLiff() {
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ref เก็บสถานะว่าเริ่ม init ไปแล้วหรือยัง — ไม่ทำให้ re-render เวลาเปลี่ยนค่า
  const hasInitialized = useRef(false);

  useEffect(() => {
    // ถ้า init ไปแล้ว (จาก StrictMode รันซ้ำ) ให้ข้ามทันที ไม่ต้องเรียก liff.init() ซ้ำ
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    async function initLiff() {
      try {
        await liff.init({ liffId: "2010692253-05gwqcyB" });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl,
        });
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "LIFF init failed");
      }
    }

    initLiff();
  }, []);

  return { profile, isReady, error };
}