// Plain <input type="file" capture> triggers iOS's system camera sheet by
// backgrounding the WebView, and on a Capacitor app that handoff can tear
// down the page's JS state hard enough that the app appears to close and
// reopen at its start screen (worse the heavier the page's memory use —
// e.g. a long multi-device home-service form). The fix is to not put the
// WebView through that handoff at all: @capacitor/camera drives the native
// camera/photo-library UI as a proper OS-level modal above the running app,
// so the WebView never backgrounds and never gets torn down.
//
// Imported statically (not a dynamic import()) — this file only ever runs
// inside the native app's WKWebView loading the live site over the
// network, and a dynamic import means fetching this chunk on demand right
// as the user taps "Add Photo"; any hiccup in that fetch fails the whole
// capture before the native picker ever appears, with no picker shown at
// all. A static import bundles it with the rest of the page up front.
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

// Returns a File so callers can still pipe it through compressImage(), or
// null if the user cancelled.
export async function captureNativePhoto(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    promptLabelHeader: "Photo of the Issue",
    promptLabelPhoto: "Choose from Library",
    promptLabelPicture: "Take Photo",
    quality: 80,
  });
  if (!photo.webPath) return null;
  const res = await fetch(photo.webPath);
  const blob = await res.blob();
  return new File([blob], `photo.${photo.format || "jpg"}`, { type: blob.type || `image/${photo.format || "jpeg"}` });
}
