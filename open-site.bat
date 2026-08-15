@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在整理網站檔案，請稍候...
npm run build

if errorlevel 1 (
  echo.
  echo 產生網站檔案時發生問題。
  echo 請確認這台電腦已安裝 Node.js，或把錯誤畫面傳給我看。
  echo.
  pause
  exit /b 1
)

echo.
echo 已完成，正在啟動本機網站...
echo 如果瀏覽器沒有自動開啟，請前往 http://localhost:3000
start "" "http://localhost:3000"
npm start
