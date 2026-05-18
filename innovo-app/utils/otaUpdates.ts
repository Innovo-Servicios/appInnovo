import { useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

const MIN_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const useAutoApplyUpdates = () => {
  const isCheckingRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web") {
      return;
    }

    const checkAndApplyUpdate = async (force = false) => {
      if (isCheckingRef.current || !Updates.isEnabled) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastCheckAtRef.current < MIN_UPDATE_CHECK_INTERVAL_MS) {
        return;
      }

      isCheckingRef.current = true;
      lastCheckAtRef.current = now;

      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.warn("No se pudo aplicar una actualización OTA", error);
      } finally {
        isCheckingRef.current = false;
      }
    };

    void checkAndApplyUpdate(true);

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          void checkAndApplyUpdate();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
};
