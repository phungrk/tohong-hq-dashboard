# Tơ Hồng HQ – Dashboard

Dashboard live của công ty Tơ Hồng HQ, chạy trên GitHub Pages: https://phungrk.github.io/tohong-hq-dashboard/

- Trang tĩnh `index.html`, không cần build.
- Dữ liệu đọc từ `dashboard.json` trên nhánh `dashboard-data` của repo [phungrk/tohong-hq](https://github.com/phungrk/tohong-hq). Workflow "Xuất dữ liệu dashboard" của repo đó tạo lại file này mỗi khi `main` thay đổi.
- Trang tự tải lại dữ liệu mỗi phút. Dữ liệu có thể trễ vài phút do bộ nhớ đệm của raw.githubusercontent.com.
- Đây là bản công khai: không có nội dung chi tiết của defect, ghi chú hay đường dẫn file.

Khi chuyển sang Cloudflare Pages: deploy nguyên thư mục này, đổi `DATA_URL` trong `index.html` nếu nguồn dữ liệu đổi.

Kiểm nhân vật Bản đồ luồng (Playwright, dữ liệu và kênh live giả): `D3=/đường/dẫn/d3.min.js OUT=/thư/mục/ảnh node tests/characters.js`

Bảng **Mô hình Eval-Gated 2029** (ADR-010 của tohong-hq) đặt sổ cái lên sơ đồ vận hành: số trên khối là việc đang ở đó (theo `owner` + `state`), dot chạy theo sự kiện thật (live hoặc sự kiện mới sau mỗi lần tải), khối giữ màu từ lúc nhận dot tới lúc dot đi ra; bể đọc `model.invariants` trong `dashboard.json` (cần `export_dashboard.py` bản ADR-010; thiếu thì hiện 0). Kiểm: `D3=… OUT=… node tests/model.js`.
