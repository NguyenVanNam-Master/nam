#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PORT="${1:-8080}"

echo
echo "===================================================="
echo "               FINCHI.GAME LAUNCHER"
echo "===================================================="
echo
echo "Đang kiểm tra Java..."
command -v java >/dev/null 2>&1 || { echo "[LỖI] Không tìm thấy lệnh java. Hãy cài JDK 21 và thêm vào PATH."; exit 1; }
command -v javac >/dev/null 2>&1 || { echo "[LỖI] Không tìm thấy lệnh javac. Hãy cài JDK 21 và thêm vào PATH."; exit 1; }

echo "Đang biên dịch source..."
rm -rf out
mkdir -p out
javac -encoding UTF-8 -d out src/main/java/com/finchi/FinchiApplication.java

LOCAL_URL="http://localhost:${PORT}"
HEALTH_URL="${LOCAL_URL}/api/health"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo
echo "===================================================="
echo " Mở ngay trên máy này:"
echo "   ${LOCAL_URL}"
echo " Kiểm tra server:"
echo "   ${HEALTH_URL}"
if [[ -n "${LAN_IP}" ]]; then
  echo " Mở từ thiết bị khác cùng mạng:"
  echo "   http://${LAN_IP}:${PORT}"
fi
echo "===================================================="
echo
echo "Nhấn Ctrl + C để dừng server."
echo

java -cp out:src/main/resources com.finchi.FinchiApplication "${PORT}"
