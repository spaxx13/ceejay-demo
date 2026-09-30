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
    // Uri mode hands back a capacitor://localhost/_capacitor_file_... path
    // — but this app's server.url points at the live HTTPS site, so that
    // path is cross-origin from WKWebView's point of view and fetch()-ing
    // it gets blocked as mixed content ("insecure content", "access
    // control checks"). Base64 mode returns the image data directly in
    // the plugin result instead, no follow-up fetch needed.
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt,
    promptLabelHeader: "Photo of the Issue",
    promptLabelPhoto: "Choose from Library",
    promptLabelPicture: "Take Photo",
    quality: 80,
  });
  if (!photo.base64String) return null;
  const format = photo.format || "jpeg";
  const binary = atob(photo.base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], `photo.${format}`, { type: `image/${format}` });
}
