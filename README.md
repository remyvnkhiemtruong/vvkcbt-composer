# VVKCBT Composer

Soạn đề và xuất gói thi USB (format v1.2) cho hệ thống Edge LAN **VVKCBT**.

## Khởi chạy

```bash
npm install
cp .env.example .env
npm run dev
```

- Web: http://localhost:5176
- API: http://localhost:3100

## Luồng wizard (USB niêm phong từng môn)

1. **Cấu hình ca thi** — `packageId`, GK/CK
2. **Chọn môn & lịch** — một môn active mỗi lần
3. **Danh sách thí sinh** — Excel `DanhSachThiSinh` (cột Lớp bắt buộc cho SBD)
4. **Soạn & ghép đề** — blueprint QĐ764
5. **SBD & xuất USB** — xếp SBD (khối+4 số), tài khoản 6 số, PIN 8 số → in phiếu môn → xuất 1 ZIP

Lặp bước 2–5 cho từng môn. Tất cả ZIP dùng **cùng `packageId`**.

## Quy tắc credential

| Trường | Quy tắc |
|--------|---------|
| SBD | `KKNNNN` từ cột Lớp + thứ tự họ tên trong khối |
| Tài khoản | 6 số ngẫu nhiên |
| PIN | 8 số ngẫu nhiên |

## Build & test

```bash
npm run build
npm test
```

Đồng bộ kit với Edge: từ repo `VNU`, chạy `node scripts/kit-sync-check.mjs` (cần sibling `vnu-composer`).

## Font offline

Đặt `BeVietnamPro-*.woff2` vào `apps/web/public/fonts/` — xem `scripts/download-fonts.mjs` trong repo VNU Edge.
