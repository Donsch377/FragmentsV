let barcodeModulePromise:
  | Promise<typeof import("expo-barcode-scanner")>
  | null = null;
let imagePickerModulePromise:
  | Promise<typeof import("expo-image-picker")>
  | null = null;

const loadBarcodeModule = async () => {
  if (!barcodeModulePromise) {
    barcodeModulePromise = import("expo-barcode-scanner");
  }
  return barcodeModulePromise;
};

const loadImagePickerModule = async () => {
  if (!imagePickerModulePromise) {
    imagePickerModulePromise = import("expo-image-picker");
  }
  return imagePickerModulePromise;
};

export const requestBarcodePermission = async () => {
  try {
    const { BarCodeScanner } = await loadBarcodeModule();
    const response = await BarCodeScanner.requestPermissionsAsync();
    return response.status === "granted";
  } catch (error) {
    console.warn("Barcode scanner unavailable:", error);
    return false;
  }
};

export const scanOnce = async (): Promise<string | null> => {
  try {
    const ok = await requestBarcodePermission();
    if (!ok) {
      return null;
    }
    // Placeholder for future scanner UI.
    return `stub-${Date.now().toString(36)}`;
  } catch (error) {
    console.warn("Falling back to stub barcode:", error);
    return `stub-${Date.now().toString(36)}`;
  }
};

export const pickImage = async (): Promise<string | null> => {
  try {
    const ImagePicker = await loadImagePickerModule();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    return result.assets[0]?.uri ?? null;
  } catch (error) {
    console.warn("Image picker unavailable:", error);
    return null;
  }
};
