/**
 * The downloadable Android app (a Trusted Web Activity: the site itself, full
 * screen, in Chrome). Built outside this repo in C:\CLIENT FILES\LUXXE4LESS\android-app
 * with `bash build.sh <version>`, which copies the signed APK to
 * public/downloads/luxx4less.apk. After a new build, update these four values
 * from the script's output.
 */
export const ANDROID_APP = {
  version: "1.0.0",
  sizeBytes: 1_504_142,
  sha256: "19cbc27fa40634cf6442ab98d05fd5adaf5424a640dc8243a80b519d9bce147c",
  href: "/downloads/luxx4less.apk",
  packageName: "ph.luxx4less.app",
  minAndroid: "Android 7",
} as const;
