#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
WS="$(cd "$ROOT/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-/tmp/android-sdk}"
BT="$SDK/android-14"
ANDROID_JAR="$SDK/android-34/android.jar"
BUILD="$ROOT/build"
ASSETS="$ROOT/assets/www"
OUT_APK="$WS/artifacts/SandeshDo.apk"

if [[ ! -x "$BT/aapt2" || ! -f "$ANDROID_JAR" ]]; then
  echo "Android SDK tools missing at $SDK" >&2
  exit 1
fi

rm -rf "$BUILD"
mkdir -p "$BUILD/res-compiled" "$BUILD/classes" "$BUILD/apk" "$ASSETS"

python3 - <<'PY'
from pathlib import Path
from PIL import Image
src = Path("/workspace/public/icon-512.png")
img = Image.open(src).convert("RGBA")
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
root = Path("/workspace/android/res")
for folder, size in sizes.items():
    dest_dir = root / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(dest_dir / "ic_launcher.png")
PY

# Package the production web app into the APK.
rm -rf "$ASSETS"
mkdir -p "$ASSETS"
cp -a "$WS/.vercel/output/static/." "$ASSETS/"
find "$ASSETS" -name '*.apk' -delete
# Fallback shell if preview HTML is unavailable.
if [[ ! -f "$ASSETS/index.html" ]]; then
  JS="$(basename "$ASSETS"/assets/index-*.js)"
  CSS="$(basename "$ASSETS"/assets/styles-*.css)"
  cat > "$ASSETS/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>SandeshDo</title>
  <meta name="theme-color" content="#0B6B58"/>
  <link rel="stylesheet" href="/assets/${CSS}"/>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"/>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <script>(function(){try{var raw=localStorage.getItem("sandeshdo-v2");var t=raw?JSON.parse(raw).state.settings.theme:null;var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");}catch(e){}})();</script>
</head>
<body class="bg-bg text-fg antialiased">
  <div id="root"></div>
  <script type="module" src="/assets/${JS}"></script>
</body>
</html>
EOF
fi

# Compile resources
find "$ROOT/res" -type f | while read -r file; do
  "$BT/aapt2" compile -o "$BUILD/res-compiled/" "$file"
done

"$BT/aapt2" link \
  -o "$BUILD/base.apk" \
  --manifest "$ROOT/AndroidManifest.xml" \
  -I "$ANDROID_JAR" \
  --java "$BUILD/gen" \
  --auto-add-overlay \
  -A "$ROOT/assets" \
  $(find "$BUILD/res-compiled" -name '*.flat' | sed 's/^/-R /')

# Java -> DEX
find "$BUILD/gen" -name '*.java' | sort > "$BUILD/sources.txt"
find "$ROOT/src" -name '*.java' | sort >> "$BUILD/sources.txt"
javac -encoding UTF-8 -source 1.8 -target 1.8 \
  -bootclasspath "$ANDROID_JAR" \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  @"$BUILD/sources.txt"

"$BT/d8" --min-api 24 --lib "$ANDROID_JAR" --output "$BUILD" \
  $(find "$BUILD/classes" -name '*.class')

# Merge dex into apk
python3 - <<'PY'
import zipfile, shutil
from pathlib import Path
base = Path("/workspace/android/build/base.apk")
dex = Path("/workspace/android/build/classes.dex")
out = Path("/workspace/android/build/unsigned.apk")
shutil.copy(base, out)
with zipfile.ZipFile(out, "a", compression=zipfile.ZIP_DEFLATED) as z:
    if "classes.dex" not in z.namelist():
        z.write(dex, "classes.dex")
PY

"$BT/zipalign" -p -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [[ ! -f "$ROOT/keystore.jks" ]]; then
  keytool -genkeypair -v \
    -keystore "$ROOT/keystore.jks" \
    -alias sandeshdo \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass sandeshdo \
    -keypass sandeshdo \
    -dname "CN=SandeshDo, OU=Sandesh, O=Sandesh, L=Mumbai, ST=Maharashtra, C=IN"
fi

"$BT/apksigner" sign \
  --ks "$ROOT/keystore.jks" \
  --ks-key-alias sandeshdo \
  --ks-pass pass:sandeshdo \
  --key-pass pass:sandeshdo \
  --out "$BUILD/signed.apk" \
  "$BUILD/aligned.apk"

"$BT/apksigner" verify "$BUILD/signed.apk"
mkdir -p "$(dirname "$OUT_APK")"
cp "$BUILD/signed.apk" "$OUT_APK"
cp "$BUILD/signed.apk" "$WS/public/SandeshDo.apk"
ls -lh "$OUT_APK"
echo "APK_READY $OUT_APK"
