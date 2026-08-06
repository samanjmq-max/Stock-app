"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: "inherit",
          borderRadius: "0.75rem",
        },
      }}
    />
  );
}
