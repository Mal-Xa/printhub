/**
 * Capacitor-ready native bridge. Today returns web fallbacks; in a future
 * native build, swap the bodies to call @capacitor/* plugins.
 */
export const native = {
  isNative(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  },
  async takePhoto(): Promise<string | null> {
    // Future: Capacitor.Camera.getPhoto(); today: returns null so the UI can fall back to <input type="file" />.
    return null;
  },
  async saveFile(_name: string, _data: Blob): Promise<void> {
    // Future: Capacitor.Filesystem.writeFile()
  },
  async requestNotifications(): Promise<boolean> {
    // Future: Capacitor.PushNotifications.register()
    return false;
  },
};
