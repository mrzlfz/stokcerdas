# 📱 Panduan Aplikasi Mobile StokCerdas

**Aplikasi Mobile untuk Manajemen Inventori Real-time**

---

## 📋 Daftar Isi

1. [Download & Instalasi](#download--instalasi)
2. [Setup Awal](#setup-awal)
3. [Navigasi Aplikasi](#navigasi-aplikasi)
4. [Fitur Dashboard](#fitur-dashboard)
5. [Manajemen Produk](#manajemen-produk)
6. [Scanner Barcode](#scanner-barcode)
7. [Tracking Inventori](#tracking-inventori)
8. [Laporan Mobile](#laporan-mobile)
9. [Notifikasi & Alerts](#notifikasi--alerts)
10. [Mode Offline](#mode-offline)
11. [Tips & Tricks](#tips--tricks)
12. [Troubleshooting](#troubleshooting)

---

## 📲 Download & Instalasi

### **Download Aplikasi**

#### **Android (Google Play Store):**
1. Buka **Google Play Store**
2. Search **"StokCerdas"**
3. Tap **"Install"** pada aplikasi StokCerdas
4. Tunggu download selesai
5. Tap **"Open"** untuk membuka aplikasi

#### **iOS (App Store):**
1. Buka **App Store**
2. Search **"StokCerdas"**  
3. Tap **"Get"** pada aplikasi StokCerdas
4. Gunakan Face ID/Touch ID untuk konfirmasi
5. Tunggu download selesai
6. Tap **"Open"** untuk membuka aplikasi

#### **APK Direct Download (Android):**
Jika tidak bisa akses Play Store:
1. Kunjungi **https://download.stokcerdas.com/android**
2. Download file **StokCerdas.apk**
3. Enable **"Unknown Sources"** di Settings > Security
4. Tap file APK untuk install
5. Ikuti petunjuk instalasi

### **System Requirements**

#### **Android:**
- **OS Version**: Android 8.0+ (API Level 26)
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: 100MB free space
- **Camera**: For barcode scanning
- **Internet**: WiFi or Mobile Data

#### **iOS:**
- **OS Version**: iOS 12.0+
- **Device**: iPhone 6s or newer, iPad Air 2 or newer
- **Storage**: 100MB free space
- **Camera**: For barcode scanning
- **Internet**: WiFi or Cellular Data

---

## ⚙️ Setup Awal

### **Langkah 1: Login/Register**

#### **Login dengan Akun Existing:**
1. **Buka aplikasi** StokCerdas
2. **Tap "Masuk"** di halaman welcome
3. **Input email** dan **password**
4. **Tap "Masuk"** untuk login
5. **Setup biometric** jika diminta (opsional)

#### **Register Akun Baru:**
1. **Tap "Daftar"** di halaman welcome
2. **Isi form registrasi:**
   - Email aktif
   - Password (min. 8 karakter)
   - Nama lengkap
   - Nama bisnis
   - Nomor WhatsApp
3. **Tap "Daftar"**
4. **Cek email** untuk verifikasi
5. **Tap link verifikasi** di email
6. **Login** dengan akun yang sudah diverifikasi

### **Langkah 2: Setup Profil Bisnis**

#### **Informasi Bisnis:**
```
📝 Nama Bisnis: Toko ABC
🏪 Jenis Usaha: Fashion Retail
📍 Alamat: Jl. Sudirman No. 123, Jakarta
📞 Telepon: +62-21-1234-5678
🌐 Website: www.tokoabc.com (opsional)
```

#### **Pengaturan Operasional:**
```
💰 Mata Uang: IDR (Rupiah)
🕐 Timezone: Asia/Jakarta (WIB)
📅 Jam Operasional: 
   - Senin-Sabtu: 08:00 - 17:00
   - Minggu: Tutup
🏪 Tipe Bisnis: Retail
```

### **Langkah 3: Setup Lokasi Inventori**

#### **Tambah Lokasi Pertama:**
1. **Tap "Lokasi"** di menu Settings
2. **Tap "+" untuk tambah lokasi**
3. **Isi data lokasi:**
   ```
   📍 Nama: Gudang Utama
   📍 Tipe: Warehouse
   📍 Alamat: Jl. Industri No. 45, Jakarta
   📍 PIC: John Manager
   📍 Telepon: +62-811-1234-5678
   ```
4. **Tap "Simpan"**

#### **Setup Multiple Lokasi (Opsional):**
- **Cabang/Outlet**: Lokasi penjualan
- **Gudang**: Lokasi penyimpanan
- **Konsinyasi**: Stock di tempat partner
- **Virtual**: Untuk marketplace allocation

---

## 🧭 Navigasi Aplikasi

### **Bottom Navigation (Tab Bar)**

#### **🏠 Dashboard**
- Overview bisnis harian
- KPI dan metrics penting
- Quick actions
- Recent activities

#### **📦 Produk**
- Daftar semua produk
- Search dan filter
- Tambah/edit produk
- Manajemen kategori

#### **📊 Inventori**
- Stock levels real-time
- Stock movements
- Transfer antar lokasi
- Stock adjustments

#### **📋 Laporan**
- Inventory reports
- Sales analytics
- Export data
- Custom reports

#### **⚙️ Pengaturan**
- Profil pengguna
- Pengaturan bisnis
- Integrasi
- Support

### **Top Navigation Elements**

#### **Header Components:**
```
🏢 [Nama Bisnis]    🔔 [Notifications]    👤 [Profile]
```

#### **Search & Filter:**
- **Global Search**: Cari produk, order, supplier
- **Quick Filters**: Kategori, status, lokasi
- **Advanced Filters**: Range harga, tanggal, dll

### **Gesture Navigation**

#### **Common Gestures:**
- **Swipe Left**: Back navigation
- **Swipe Right**: Forward navigation  
- **Pull Down**: Refresh data
- **Long Press**: Context menu
- **Pinch Zoom**: Pada images/charts

---

## 📊 Fitur Dashboard

### **Layout Dashboard Mobile**

#### **Header KPI Cards:**
```
┌─────────────┬─────────────┐
│ 💰 Revenue  │ 📦 Products │
│ Rp 25.5M   │    1,250    │
│ +15.3% ↗️   │   +5 new    │
├─────────────┼─────────────┤
│ ⚠️ Low Stock│ 🚚 Orders   │
│   23 items  │     156     │
│    -5 ↘️     │   +12.1% ↗️  │
└─────────────┴─────────────┘
```

#### **Main Content Sections:**

**1. Sales Chart (30 days)**
- Line chart penjualan harian
- Toggle view: Revenue/Units/Orders
- Zoom in/out untuk detail
- Tap titik untuk detail hari

**2. Quick Actions Grid**
```
┌──────────┬──────────┐
│ 📱 Scan  │ 📦 Add   │
│ Barcode  │ Product  │
├──────────┼──────────┤
│ 📋 Stock │ 📊 View  │
│ Check    │ Reports  │
└──────────┴──────────┘
```

**3. Today's Highlights**
- Top selling products hari ini
- Recent stock movements
- Pending approvals
- System alerts

**4. Recent Activities Feed**
```
🕐 10:30 - Stock adjusted: Kaos Polo +50 pcs
🕐 10:25 - New order: #SO-001 from Shopee
🕐 10:20 - Low stock alert: Celana Jeans
🕐 10:15 - Sync completed: Tokopedia products
```

### **Interactive Elements**

#### **Real-time Updates:**
- **Auto-refresh**: Setiap 30 detik
- **WebSocket**: Real-time notifications
- **Pull-to-refresh**: Manual refresh
- **Background sync**: Update saat app inactive

#### **Quick Actions:**
- **Tap KPI card**: Drill-down detail
- **Tap chart**: Detail breakdown
- **Tap alert**: Go to relevant screen
- **Long press**: Additional options

### **Customizable Dashboard**

#### **Widget Configuration:**
1. **Tap "Customize"** di header dashboard
2. **Drag & drop** untuk reorder widgets
3. **Toggle on/off** widget yang diinginkan
4. **Tap "Save"** untuk simpan layout

#### **Available Widgets:**
- Revenue Chart (daily/weekly/monthly)
- Top Products List
- Low Stock Alerts
- Recent Orders
- Inventory Value
- Channel Performance
- Supplier Performance
- Custom Metrics

---

## 📦 Manajemen Produk

### **Product List Screen**

#### **View Modes:**
```
📋 List View:
┌─────────────────────────────────┐
│ 📸 [Image] Kaos Polo Premium    │
│    SKU: KPP-001 | Stock: 150   │
│    Rp 85,000 | Cat: Fashion    │
└─────────────────────────────────┘

🔲 Grid View:
┌──────────┬──────────┬──────────┐
│ 📸 Kaos  │ 📸 Celana│ 📸 Sepatu│
│ Polo     │ Jeans    │ Sneakers │
│ Rp 85K   │ Rp 120K  │ Rp 250K  │
│ Stock:150│ Stock: 75│ Stock: 45│
└──────────┴──────────┴──────────┘
```

#### **Search & Filter:**
- **Search bar**: Nama, SKU, barcode
- **Category filter**: Dropdown kategori
- **Status filter**: Active, Inactive, Low Stock
- **Sort options**: Name, Price, Stock, Date
- **Quick filters**: Low Stock, New Products, Best Sellers

#### **Bulk Operations:**
1. **Tap "Select"** di header
2. **Pilih multiple products** dengan checkbox
3. **Tap action** di bottom bar:
   - Export selected
   - Bulk edit prices
   - Change categories
   - Update status
   - Delete products

### **Add/Edit Product Screen**

#### **Product Information Form:**
```
📸 Upload Foto (max 5 foto):
   [+] [Photo1] [Photo2] [Photo3]

📝 Basic Info:
   Nama Produk: _________________
   SKU: _________ (auto-generate ✓)
   Barcode: ___________________
   Kategori: [Dropdown] Fashion ▼

💰 Pricing:
   Harga Beli: Rp _____________
   Harga Jual: Rp _____________
   Margin: ___% (auto-calculate)

📏 Dimensi:
   Panjang: _____ cm
   Lebar: ______ cm  
   Tinggi: _____ cm
   Berat: ______ gram

📝 Deskripsi:
   ________________________________
   ________________________________
   ________________________________

🏷️ Tags: [fashion] [premium] [cotton] [+]
```

#### **Inventory Settings:**
```
📦 Stock Awal:
   Lokasi: [Dropdown] Gudang Utama ▼
   Qty: _________ pcs
   
⚠️ Reorder Settings:
   Reorder Point: _____ pcs
   EOQ: __________ pcs (auto-calculate)
   
📅 Expiry (opsional):
   Tanggal Expired: [Date Picker]
   Batch Number: _______________
```

#### **Variant Management:**
```
🎨 Product Variants:
   
   Attribute 1: Size
   Values: [S] [M] [L] [XL] [+Add]
   
   Attribute 2: Color  
   Values: [Red] [Blue] [White] [+Add]
   
   📊 Generated Variants (12):
   ┌─────┬─────┬────────┬───────┐
   │Size │Color│  SKU   │ Stock │
   ├─────┼─────┼────────┼───────┤
   │  S  │ Red │KP-S-R  │  25   │
   │  S  │Blue │KP-S-B  │  30   │
   │  M  │ Red │KP-M-R  │  40   │
   └─────┴─────┴────────┴───────┘
```

### **Product Detail Screen**

#### **Product Overview:**
```
📸 [Product Images Carousel]
   ← Photo 1/5 →

📝 Kaos Polo Premium
   SKU: KPP-001
   📂 Fashion > Kaos
   ⭐ 4.8/5 (124 reviews)

💰 Pricing:
   Harga Jual: Rp 85,000
   Harga Beli: Rp 45,000
   Margin: 47.1%

📊 Stock Summary:
   Total Stock: 150 pcs
   Available: 135 pcs
   Reserved: 15 pcs
   Reorder Point: 50 pcs
```

#### **Quick Actions:**
```
[📝 Edit] [📋 Adjust Stock] [📊 View Report]
[📷 Scan] [🚚 Transfer] [📤 Export]
```

#### **Stock by Location:**
```
📍 Stock per Lokasi:
┌─────────────────┬───────┬─────────┐
│    Lokasi       │ Stock │ Status  │
├─────────────────┼───────┼─────────┤
│ Gudang Utama    │  100  │ ✅ Good │
│ Cabang Jakarta  │   30  │ ⚠️ Low  │
│ Cabang Surabaya │   20  │ ✅ Good │
└─────────────────┴───────┴─────────┘
```

#### **Recent Movements:**
```
📋 Recent Stock Movements:
🕐 10:30 - Sale: -5 pcs (Order #SO-001)
🕐 09:15 - Adjustment: +10 pcs (Found)  
🕐 08:45 - Transfer: -25 pcs (to Jakarta)
🕐 Yesterday - Purchase: +100 pcs (PO-001)
```

---

## 📷 Scanner Barcode

### **Barcode Scanner Interface**

#### **Camera View:**
```
┌─────────────────────────────────┐
│                                 │
│     📷 CAMERA VIEWFINDER        │
│                                 │
│    ┌─────────────────────┐      │
│    │                     │      │ 
│    │   SCAN AREA FRAME   │      │
│    │                     │      │
│    └─────────────────────┘      │
│                                 │
│  [💡] [📚 Manual] [⚙️ Settings] │
└─────────────────────────────────┘
```

#### **Scanner Controls:**
- **💡 Flashlight**: Toggle camera flash
- **📚 Manual Entry**: Input barcode manually
- **⚙️ Settings**: Scanner preferences
- **🔄 Switch Camera**: Front/back camera (jika ada)

### **Scanning Process**

#### **Langkah Scanning:**
1. **Tap "Scanner"** di dashboard/bottom nav
2. **Allow camera permission** jika belum
3. **Arahkan kamera** ke barcode
4. **Tunggu auto-detect** (1-2 detik)
5. **Konfirmasi produk** yang muncul
6. **Pilih action** yang diinginkan

#### **Supported Barcode Formats:**
- **QR Code**: Quick response codes
- **Code 128**: Most common linear barcode
- **EAN-13**: International product barcodes
- **EAN-8**: Short version of EAN-13
- **UPC-A**: North American products
- **UPC-E**: Compressed UPC-A
- **Code 39**: Alphanumeric barcodes
- **ITF**: Interleaved 2 of 5

### **Scan Result Actions**

#### **Product Found:**
```
✅ Product Ditemukan:

📸 [Product Image]
📝 Kaos Polo Premium
📊 SKU: KPP-001
📦 Stock: 150 pcs (Gudang Utama)
💰 Rp 85,000

🎯 Quick Actions:
[📋 Stock Check] [📝 Adjust] [🚚 Transfer]
[👁️ View Detail] [📊 Report] [🔄 Scan Again]
```

#### **Product Not Found:**
```
❌ Produk Tidak Ditemukan

🔍 Barcode: 1234567890123

🎯 Actions:
[➕ Add New Product]
[🔍 Search Manual]  
[📝 Manual Entry]
[🔄 Scan Again]
```

#### **Multiple Products Found:**
```
🔍 Multiple Results:

📋 Select Product:
┌─────────────────────────────────┐
│ ✓ Kaos Polo Premium - Red (S)   │
│   Kaos Polo Premium - Red (M)   │  
│   Kaos Polo Premium - Red (L)   │
└─────────────────────────────────┘

[✅ Confirm] [🔄 Scan Again]
```

### **Batch Scanning Mode**

#### **Enable Batch Mode:**
1. **Tap "Batch Mode"** di scanner settings
2. **Scan multiple items** secara berurutan
3. **Review batch list** sebelum submit
4. **Confirm batch operation**

#### **Batch Operations:**
- **Stock Take**: Count multiple items sekaligus
- **Bulk Adjustment**: Adjust stock multiple products
- **Quick Inventory**: Fast inventory checking
- **Bulk Transfer**: Transfer multiple items

#### **Batch List View:**
```
📋 Batch Scan Results (5 items):

┌─────────────────────────────────┐
│ ✓ Kaos Polo - KPP-001    Qty: 2│
│ ✓ Celana Jeans - CJ-001  Qty: 1│
│ ✓ Sepatu Sneakers - SS-001 Qty:3│
│ ✓ Tas Backpack - TB-001  Qty: 1│
│ ✓ Topi Baseball - TBB-001 Qty:2│
└─────────────────────────────────┘

[📝 Edit Qty] [🗑️ Remove] [✅ Process]
```

### **Manual Entry Fallback**

#### **Manual Entry Screen:**
```
📝 Manual Barcode Entry:

🔍 Barcode/SKU:
   _________________________

📊 Product Search:
   [🔍 Search] [📷 Scan Again]

📋 Recent Scans:
   • KPP-001 (10:30)
   • CJ-001 (10:25)  
   • SS-001 (10:20)

[✅ Search] [🚫 Cancel]
```

---

## 📊 Tracking Inventori

### **Inventory List Screen**

#### **Inventory Overview:**
```
📊 Inventory Summary:
💰 Total Value: Rp 275,000,000
📦 Total Items: 1,250 products
⚠️ Low Stock: 23 items
🔴 Out of Stock: 5 items
```

#### **Inventory List View:**
```
📋 Inventory Items:

🔍 [Search] [🔽 Filter] [📊 Sort]

┌─────────────────────────────────┐
│ 📸 Kaos Polo Premium            │
│ SKU: KPP-001 | Gudang Utama     │
│ Stock: 150 pcs | Rp 1,275,000   │
│ Status: ✅ Good                  │
├─────────────────────────────────┤
│ 📸 Celana Jeans Slim            │ 
│ SKU: CJS-001 | Gudang Utama     │
│ Stock: 25 pcs | Rp 750,000      │
│ Status: ⚠️ Low Stock             │
└─────────────────────────────────┘
```

#### **Filter Options:**
- **Location**: All, Gudang Utama, Cabang Jakarta
- **Status**: All, Good, Low Stock, Out of Stock
- **Category**: All, Fashion, Electronics, FMCG
- **Value Range**: Min - Max value
- **Last Movement**: Today, Week, Month

### **Stock Adjustment Screen**

#### **Adjustment Form:**
```
📝 Stock Adjustment:

📦 Product:
   Kaos Polo Premium (KPP-001)
   Current Stock: 150 pcs

📍 Location:
   [Dropdown] Gudang Utama ▼

🔢 Adjustment:
   Type: [🔴 Decrease] [🟢 Increase]
   Quantity: _______ pcs
   
   New Stock: _______ pcs (auto-calc)

📋 Reason:
   [Dropdown] Stock Opname ▼
   • Stock Opname
   • Damaged Goods
   • Expired Products  
   • Theft/Loss
   • Found Stock
   • Production

📝 Notes (opsional):
   _________________________
   _________________________

💰 Cost Impact:
   Value Change: Rp _______
   
[✅ Submit] [🚫 Cancel]
```

#### **Batch Adjustment:**
```
📋 Bulk Stock Adjustment:

📤 Upload Excel Template:
   [📄 Download Template]
   [📁 Upload File]

📊 Or Add Items Manually:
   [➕ Add Item]

📋 Items to Adjust (3):
┌─────────────────────────────────┐
│ KPP-001 | +10 pcs | Stock Opname│
│ CJS-001 | -5 pcs  | Damaged     │  
│ SS-001  | +25 pcs | Found       │
└─────────────────────────────────┘

💰 Total Impact: +Rp 125,000

[✅ Process All] [📝 Edit] [🗑️ Clear]
```

### **Stock Transfer Screen**

#### **Transfer Form:**
```
🚚 Stock Transfer:

📦 Product:
   [🔍 Search] Kaos Polo Premium
   Current Stock: 100 pcs (Gudang Utama)

📍 From Location:
   [Dropdown] Gudang Utama ▼

📍 To Location:  
   [Dropdown] Cabang Jakarta ▼

🔢 Transfer Quantity:
   _______ pcs (max: 100)

📋 Transfer Type:
   • Immediate (langsung)
   • Scheduled (dijadwalkan)
   • Approval Required

📅 Scheduled Date (jika scheduled):
   [Date Picker]

🚚 Shipping Info (opsional):
   Carrier: [Dropdown] JNE ▼
   Service: [Dropdown] REG ▼
   Tracking: _______________

📝 Notes:
   _________________________

[✅ Create Transfer] [🚫 Cancel]
```

#### **Transfer Tracking:**
```
📋 Active Transfers:

┌─────────────────────────────────┐
│ 🚚 Transfer #TRF-001            │
│ KPP-001: 25 pcs                 │
│ From: Gudang → Jakarta          │
│ Status: 🚛 In Transit           │
│ ETA: 2025-07-06                 │
│ Track: JNE123456789             │
├─────────────────────────────────┤
│ 🚚 Transfer #TRF-002            │
│ CJS-001: 15 pcs                 │  
│ From: Jakarta → Surabaya        │
│ Status: ⏳ Pending Approval     │
│ Requested: 2025-07-04           │
└─────────────────────────────────┘

[👁️ View Details] [📋 Track Shipment]
```

### **Stock Movement History**

#### **Movement Log:**
```
📋 Stock Movement History:

🔍 [Search] [📅 Date Range] [🔽 Filter]

🕐 Today:
┌─────────────────────────────────┐
│ 10:30 📦 Sale                   │
│ KPP-001: -5 pcs (Order #SO-001)│
│ By: John Staff                  │
├─────────────────────────────────┤
│ 09:15 📝 Adjustment             │
│ CJS-001: +10 pcs (Found Stock) │
│ By: Manager Admin               │
├─────────────────────────────────┤  
│ 08:45 🚚 Transfer Out           │
│ SS-001: -25 pcs (To Jakarta)   │
│ TRF: #TRF-001                   │
└─────────────────────────────────┘

🕐 Yesterday:
┌─────────────────────────────────┐
│ 16:30 📦 Purchase               │
│ KPP-001: +100 pcs (PO #PO-001) │
│ Supplier: CV Garment Indo       │
└─────────────────────────────────┘
```

#### **Movement Analysis:**
```
📊 Movement Summary (30 days):

📈 Stock In: 2,450 pcs
   • Purchases: 2,100 pcs (86%)
   • Transfers In: 200 pcs (8%)
   • Adjustments: 150 pcs (6%)

📉 Stock Out: 2,280 pcs  
   • Sales: 2,150 pcs (94%)
   • Transfers Out: 80 pcs (4%)
   • Adjustments: 50 pcs (2%)

📊 Net Change: +170 pcs
📊 Turnover Rate: 2.4x (Good)
```

---

## 📈 Laporan Mobile

### **Report Dashboard**

#### **Report Categories:**
```
📊 Report Categories:

┌──────────┬──────────┐
│ 📦 Inventory │ 💰 Sales   │
│ Reports      │ Analytics  │
├──────────────┼────────────┤
│ 🚚 Movement  │ 🏪 Location│
│ Reports      │ Reports    │
├──────────────┼────────────┤
│ 📈 Predictive│ 🎯 Custom  │
│ Analytics    │ Reports    │
└──────────────┴────────────┘
```

### **Inventory Reports**

#### **Inventory Valuation:**
```
💰 Inventory Valuation Report

📅 Period: July 1-4, 2025

📊 Summary:
┌─────────────────────────────────┐
│ Total Inventory Value           │
│ Rp 275,000,000                  │
│                                 │
│ By Category:                    │
│ 👕 Fashion: Rp 110M (40%)       │
│ 📱 Electronics: Rp 82M (30%)    │
│ 🍫 FMCG: Rp 83M (30%)          │
│                                 │
│ By Location:                    │
│ 🏪 Gudang Utama: Rp 165M (60%)  │
│ 🏪 Jakarta: Rp 66M (24%)       │
│ 🏪 Surabaya: Rp 44M (16%)      │
└─────────────────────────────────┘

[📊 View Chart] [📤 Export] [📧 Email]
```

#### **ABC Analysis:**
```
📊 ABC Analysis Report

🅰️ A-Items (20% items, 80% value):
┌─────────────────────────────────┐
│ 📱 Smartphone Premium - Rp 45M  │
│ 👔 Kemeja Premium - Rp 25M      │
│ 👟 Sepatu Brand - Rp 18M        │
│ ... 15 more items               │
└─────────────────────────────────┘

🅱️ B-Items (30% items, 15% value):
┌─────────────────────────────────┐
│ 👕 Kaos Cotton - Rp 12M         │
│ 👖 Celana Casual - Rp 8M        │
│ ... 32 more items               │
└─────────────────────────────────┘

💡 Recommendations:
• Focus tight control on A-items
• Weekly monitoring for B-items  
• Monthly review for C-items

[📊 View Details] [📱 Set Alerts]
```

#### **Stock Movement Report:**
```
🔄 Stock Movement Report

📅 Period: Last 30 Days

📊 Movement Summary:
┌─────────────────────────────────┐
│ Opening Stock: 10,250 pcs       │
│ Stock In: +2,450 pcs            │
│ Stock Out: -2,280 pcs           │
│ Closing Stock: 10,420 pcs       │
│                                 │
│ Net Change: +170 pcs            │
│ Turnover: 2.4x                  │
│ Fill Rate: 96.5%                │
└─────────────────────────────────┘

📈 Top Movers:
1. Kaos Polo: 450 pcs out
2. Celana Jeans: 380 pcs out
3. Sepatu Sneakers: 320 pcs out

📉 Slow Movers:
1. Tas Kulit: 5 pcs out
2. Aksesoris Vintage: 8 pcs out

[📊 View Chart] [🔍 Drill Down]
```

### **Sales Analytics**

#### **Sales Performance:**
```
💰 Sales Performance

📅 Period: This Month vs Last Month

📊 Key Metrics:
┌─────────────────────────────────┐
│ Revenue: Rp 125M (+15.3% ↗️)    │
│ Orders: 2,500 (+12.1% ↗️)       │
│ Units: 5,200 (+8.7% ↗️)         │
│ AOV: Rp 50K (+6.2% ↗️)          │
└─────────────────────────────────┘

📊 Channel Breakdown:
🥇 Shopee: 45% (Rp 56.25M)
🥈 Tokopedia: 30% (Rp 37.5M)  
🥉 Offline: 25% (Rp 31.25M)

📈 Growth Trends:
• Shopee: +18% MoM
• Tokopedia: +12% MoM
• Offline: +10% MoM
```

#### **Top Products:**
```
🏆 Top Performing Products

📅 This Month:

┌─────────────────────────────────┐
│ 1. 👕 Kaos Polo Premium         │
│    Revenue: Rp 12.5M            │
│    Units: 250 pcs               │
│    Growth: +22% ↗️               │
├─────────────────────────────────┤
│ 2. 👖 Celana Jeans Slim         │
│    Revenue: Rp 8.9M             │
│    Units: 148 pcs               │
│    Growth: +15% ↗️               │
├─────────────────────────────────┤
│ 3. 👟 Sepatu Sneakers           │
│    Revenue: Rp 7.2M             │
│    Units: 96 pcs                │
│    Growth: +8% ↗️                │
└─────────────────────────────────┘

[📊 View All] [📈 Trend Analysis]
```

### **Custom Reports**

#### **Report Builder:**
```
🛠️ Custom Report Builder

📊 Report Type:
   [📋 Table] [📈 Chart] [📊 Dashboard]

📂 Data Sources:
   ☑️ Products
   ☑️ Inventory  
   ☐ Orders
   ☐ Suppliers
   ☐ Sales

📅 Date Range:
   From: [Date Picker] 2025-06-01
   To: [Date Picker] 2025-07-04

🔍 Filters:
   Category: [All] ▼
   Location: [All] ▼
   Status: [All] ▼

📊 Metrics:
   ☑️ Stock Quantity
   ☑️ Stock Value
   ☐ Turnover Rate
   ☐ Movement Count

📈 Grouping:
   Group By: [Category] ▼
   Sort By: [Value] ▼ [DESC] ▼

[👁️ Preview] [💾 Save] [📤 Export]
```

### **Export & Sharing**

#### **Export Options:**
```
📤 Export Report:

📋 Format:
   [📄 PDF] [📊 Excel] [📧 Email]

📧 Email Options:
   To: _____________________
   Subject: Monthly Inventory Report
   
   ☑️ Attach raw data (Excel)
   ☑️ Include summary (PDF)
   ☐ Schedule monthly

📅 Schedule:
   ☐ Daily
   ☑️ Weekly (Monday)
   ☐ Monthly (1st)

[📤 Send Now] [📅 Schedule] [💾 Save Draft]
```

---

## 🔔 Notifikasi & Alerts

### **Notification Center**

#### **Notification Types:**
```
🔔 Notification Center (24)

📋 Categories:
┌─────────────────────────────────┐
│ ⚠️ Stock Alerts (8)             │
│ 📦 Order Updates (5)            │
│ 🔄 Sync Status (3)              │
│ 💰 Financial (2)                │
│ 🔧 System Updates (6)           │
└─────────────────────────────────┘
```

#### **Recent Notifications:**
```
🕐 Today:
┌─────────────────────────────────┐
│ ⚠️ 10:30 - Low Stock Alert      │
│ Kaos Polo: 25 pcs remaining     │
│ Below reorder point (50 pcs)    │
├─────────────────────────────────┤
│ 📦 10:25 - New Order Received   │
│ Order #SO-001 from Shopee       │
│ Value: Rp 125,000 (2 items)     │
├─────────────────────────────────┤
│ 🔄 10:20 - Sync Completed       │
│ Tokopedia product sync          │
│ 15 products updated              │
└─────────────────────────────────┘

🕐 Yesterday:
┌─────────────────────────────────┐
│ 💰 16:30 - Payment Received     │
│ Invoice #INV-001 paid            │
│ Amount: Rp 5,000,000            │
└─────────────────────────────────┘
```

### **Alert Configuration**

#### **Stock Alert Settings:**
```
⚠️ Stock Alert Configuration:

📦 Low Stock Alerts:
   ☑️ Enable low stock alerts
   📊 Threshold: When stock ≤ reorder point
   
   📱 Notification Methods:
   ☑️ Push notification
   ☑️ Email notification  
   ☐ SMS notification
   
   ⏰ Frequency:
   • Real-time (immediate)
   • Hourly digest
   • Daily summary

📅 Expiry Alerts:
   ☑️ Enable expiry warnings
   ⏰ Warning period: 30 days before
   
   📧 Email Recipients:
   • manager@company.com
   • warehouse@company.com

🔄 Auto Actions:
   ☑️ Auto-create reorder suggestions
   ☐ Auto-create purchase orders
   ☑️ Auto-notify suppliers
```

#### **Business Alert Settings:**
```
💼 Business Alerts:

📈 Sales Alerts:
   ☑️ Daily sales target missed
   Target: Rp 5,000,000/day
   
   ☑️ High demand spike detected
   Threshold: +50% vs avg

📦 Order Alerts:
   ☑️ New orders received
   ☑️ Failed order fulfillment
   ☑️ Shipping delays

🔄 Sync Alerts:
   ☑️ Marketplace sync failures
   ☑️ Inventory mismatch detected
   ☑️ API connection issues

💰 Financial Alerts:
   ☑️ Low inventory value
   ☑️ High carrying costs
   ☑️ Payment overdue
```

### **Push Notification Settings**

#### **Notification Preferences:**
```
📱 Push Notification Settings:

🔊 Sound & Vibration:
   Sound: [Default] ▼
   ☑️ Vibrate
   ☑️ LED indicator

⏰ Quiet Hours:
   ☑️ Enable quiet hours
   From: 22:00 To: 07:00
   
   Exception for Critical Alerts:
   ☑️ Stock outages
   ☑️ System failures
   ☐ Order issues

📊 Grouping:
   ☑️ Group similar notifications
   ☑️ Show notification badges
   Batch timing: 5 minutes

🎯 Priority Levels:
   🔴 Critical: Always show
   🟡 Important: Show during business hours  
   🟢 Info: Show in notification center only
```

### **Notification History**

#### **History View:**
```
📋 Notification History:

🔍 [Search] [📅 Date Filter] [🔽 Type Filter]

📅 July 4, 2025:
┌─────────────────────────────────┐
│ 10:30 ⚠️ Low Stock Alert (Read) │
│ 10:25 📦 New Order (Read)       │
│ 10:20 🔄 Sync Complete (Read)   │
│ 09:15 📝 Stock Adjusted (Read)  │
└─────────────────────────────────┘

📅 July 3, 2025:
┌─────────────────────────────────┐
│ 16:30 💰 Payment Received       │
│ 15:45 🚚 Shipment Delivered     │
│ 14:20 📦 Order Shipped          │
└─────────────────────────────────┘

📊 Statistics:
• Total Notifications: 156
• Read: 142 (91%)
• Unread: 14 (9%)
• Actions Taken: 38

[🗑️ Clear All] [📧 Export] [⚙️ Settings]
```

---

## 📴 Mode Offline

### **Offline Capabilities**

#### **What Works Offline:**
```
✅ Available Offline:
• View product catalog
• Check current stock levels
• Record stock adjustments
• Scan barcodes
• Take photos
• Create new products
• View recent reports
• Access notification history

❌ Requires Internet:
• Real-time stock sync
• Order processing
• Payment transactions
• Analytics/forecasting
• Integration sync
• Live chat support
```

#### **Sync Queue System:**
```
🔄 Pending Sync (5 items):

📋 Queue:
┌─────────────────────────────────┐
│ ⏳ Stock Adjustment             │
│ KPP-001: +10 pcs (Stock Opname)│
│ Timestamp: 10:30                │
├─────────────────────────────────┤
│ ⏳ New Product                  │
│ Kaos Vintage (KV-001)          │
│ Timestamp: 10:25                │
├─────────────────────────────────┤
│ ⏳ Photo Upload                 │
│ Product: SS-001 (3 photos)     │
│ Timestamp: 10:20                │
└─────────────────────────────────┘

📶 Connection Status: 🔴 Offline
🔄 Auto-sync when connected: ✅ Enabled

[🔄 Retry Now] [👁️ View Details] [🗑️ Clear Queue]
```

### **Offline Data Storage**

#### **Local Database:**
```
💾 Local Storage Status:

📊 Storage Usage:
┌─────────────────────────────────┐
│ Products: 15.2 MB (1,250 items)│
│ Images: 45.8 MB (2,100 files)  │
│ Transactions: 8.4 MB           │
│ Cache: 12.1 MB                 │
│ Total: 81.5 MB / 500 MB        │
└─────────────────────────────────┘

📅 Last Full Sync: July 4, 10:00
🔄 Next Scheduled Sync: July 4, 18:00

📱 Device Storage:
Available: 2.3 GB
Required: 100 MB minimum

[🧹 Clear Cache] [📥 Download All] [⚙️ Settings]
```

#### **Sync Settings:**
```
⚙️ Offline Sync Settings:

📱 Data Download:
   ☑️ Download all products
   ☑️ Download product images
   ☑️ Download stock levels
   ☐ Download full transaction history
   
   📊 Image Quality:
   • High (original size)
   • Medium (compressed)
   • Low (thumbnails only)

🔄 Auto-Sync:
   ☑️ Sync when WiFi available
   ☐ Sync on mobile data
   ☑️ Background sync
   
   ⏰ Sync Schedule:
   • Every 15 minutes (WiFi)
   • Every hour (mobile data)
   • Manual only

⚠️ Conflict Resolution:
   Server wins: Business data
   Local wins: Stock adjustments
   Ask user: Product information
```

### **Offline Workflows**

#### **Stock Taking Offline:**
```
📋 Offline Stock Taking:

🎯 Process:
1. Download latest inventory data
2. Start stock take session
3. Scan/count items offline
4. Record variances locally
5. Sync when connection returns

📊 Current Session:
Started: July 4, 08:00
Items Counted: 156 / 1,250
Variances Found: 8

📋 Offline Actions Recorded:
┌─────────────────────────────────┐
│ ✓ KPP-001: Count 147 (vs 150)  │
│ ✓ CJS-001: Count 23 (vs 25)    │
│ ✓ SS-001: Count 48 (vs 45)     │
│ ... 5 more items               │
└─────────────────────────────────┘

[💾 Save Session] [📤 Queue for Sync] [🔄 Continue]
```

#### **Offline Sales Recording:**
```
💰 Offline Sales Entry:

📝 Manual Sale Entry:
┌─────────────────────────────────┐
│ Product: Kaos Polo Premium      │
│ SKU: KPP-001                    │
│ Qty: 2 pcs                      │
│ Price: Rp 85,000 each          │
│ Total: Rp 170,000              │
│                                 │
│ Customer: Walk-in customer      │
│ Payment: Cash                   │
│ Notes: Size M, Red color        │
└─────────────────────────────────┘

⚠️ Offline Mode:
• Stock will be deducted locally
• Sale will sync when online
• Receipt can be printed locally

[💾 Record Sale] [🧾 Print Receipt] [🚫 Cancel]
```

---

## 💡 Tips & Tricks

### **Productivity Tips**

#### **Quick Navigation:**
```
⚡ Keyboard Shortcuts:
• Search: Swipe down on any screen
• Scanner: Long press scan icon
• Refresh: Pull down to refresh
• Back: Swipe from left edge
• Menu: Long press bottom nav icons

🎯 Quick Actions:
• Double tap product: Quick stock check
• Long press product: Context menu
• Swipe left on item: Quick actions
• Swipe right on item: More details
• Pinch on charts: Zoom in/out
```

#### **Batch Operations:**
```
📋 Efficient Bulk Work:

Stock Take Session:
1. Start session mode
2. Use batch scanner
3. Count systematically by location
4. Review variances before commit
5. Apply adjustments in bulk

Price Updates:
1. Export current price list
2. Edit in Excel with formulas
3. Import updated prices
4. Preview changes before apply
5. Schedule marketplace sync

Category Management:
1. Use drag & drop to reorganize
2. Apply changes to multiple products
3. Use tags for cross-categorization
4. Set up automation rules
```

### **Performance Optimization**

#### **App Performance:**
```
🚀 Speed Up Your App:

📱 Regular Maintenance:
• Restart app weekly
• Clear cache monthly
• Update to latest version
• Free up device storage

📊 Data Management:
• Archive old transactions
• Optimize image storage
• Use selective sync
• Clean up duplicate entries

🔄 Sync Optimization:
• Sync during WiFi only
• Use incremental sync
• Schedule sync off-peak hours
• Monitor sync errors
```

#### **Battery Optimization:**
```
🔋 Battery Saving Tips:

⚙️ App Settings:
• Reduce background sync
• Lower image quality
• Disable location services
• Use dark mode theme

📱 Device Settings:
• Enable battery optimization for StokCerdas
• Reduce screen brightness
• Close other apps when using scanner
• Use WiFi instead of mobile data

⏰ Usage Patterns:
• Batch operations together
• Use offline mode for field work
• Sync data once per hour
• Turn off push notifications during inventory
```

### **Inventory Best Practices**

#### **Stock Organization:**
```
📦 Organize Your Inventory:

🏷️ SKU Best Practices:
• Use consistent format: CATEGORY-TYPE-SIZE
• Example: SHIRT-POLO-M, PANTS-JEANS-32
• Include variant info in SKU
• Avoid special characters

📍 Location Setup:
• Create logical location hierarchy
• Use descriptive names
• Include capacity information
• Set up default locations per category

📊 Categorization:
• Start with broad categories
• Create subcategories as needed
• Use tags for cross-cutting attributes
• Maintain category hierarchy
```

#### **Cycle Counting:**
```
📋 Effective Cycle Counting:

🗓️ Schedule:
• A-items: Weekly count
• B-items: Monthly count  
• C-items: Quarterly count
• Full count: Annually

📱 Mobile Process:
1. Select items to count
2. Print count sheets or use mobile
3. Scan barcodes for accuracy
4. Record actual counts
5. Investigate variances >5%
6. Adjust system quantities

📊 Analysis:
• Track count accuracy by counter
• Identify problem areas
• Investigate root causes
• Improve processes based on findings
```

### **Mobile-Specific Tips**

#### **Camera & Scanning:**
```
📷 Scanner Optimization:

💡 Lighting Tips:
• Use good lighting for scanning
• Avoid glare and shadows
• Use flashlight in dark areas
• Clean camera lens regularly

🎯 Scanning Technique:
• Hold steady for 1-2 seconds
• Keep barcode in frame center
• Scan from 6-12 inches away
• Try different angles if not working

📱 Device Tips:
• Update camera drivers
• Close other camera apps
• Restart if scanner not working
• Check camera permissions
```

#### **Data Entry Shortcuts:**
```
⌨️ Input Efficiency:

📝 Text Input:
• Use voice-to-text for descriptions
• Set up text shortcuts for common phrases
• Use copy/paste for repeated information
• Enable predictive text

🔢 Number Input:
• Use number pad for quantities
• Set up common values as shortcuts
• Use calculator app for complex calculations
• Double-check decimal points

📋 Form Completion:
• Use auto-complete features
• Save templates for similar products
• Use copy/duplicate for variants
• Review before submitting
```

---

## 🔧 Troubleshooting

### **Common Issues**

#### **Login & Authentication:**
```
❌ Problem: Cannot login
✅ Solutions:
1. Check email/password spelling
2. Ensure caps lock is off
3. Reset password if forgotten
4. Check internet connection
5. Clear app cache and retry
6. Update app to latest version

❌ Problem: "Session expired" error
✅ Solutions:
1. Close and reopen app
2. Login again with credentials
3. Check device time/date settings
4. Contact support if persists
```

#### **Sync Issues:**
```
❌ Problem: Data not syncing
✅ Solutions:
1. Check internet connectivity
2. Force refresh (pull down)
3. Check sync settings
4. Logout and login again
5. Clear cache and retry
6. Check if server is down

❌ Problem: Inventory numbers wrong
✅ Solutions:
1. Check pending sync queue
2. Wait for sync completion
3. Compare with web version
4. Report discrepancy to support
5. Force full sync
```

#### **Scanner Problems:**
```
❌ Problem: Barcode scanner not working
✅ Solutions:
1. Check camera permissions
2. Clean camera lens
3. Improve lighting conditions
4. Try manual barcode entry
5. Restart the app
6. Check if barcode format supported

❌ Problem: Wrong product scanned
✅ Solutions:
1. Check barcode assignment
2. Verify product database
3. Update product information
4. Report incorrect mapping
5. Use manual search instead
```

#### **Performance Issues:**
```
❌ Problem: App running slowly
✅ Solutions:
1. Close other apps
2. Restart the device
3. Clear app cache
4. Update to latest version
5. Free up device storage
6. Check available RAM

❌ Problem: App crashes frequently
✅ Solutions:
1. Force close and reopen
2. Restart device
3. Update app
4. Report crash to support
5. Reinstall app if necessary
```

### **Error Messages**

#### **Common Error Codes:**
```
🔴 ERR_001: Network timeout
   • Check internet connection
   • Try again in a few minutes
   • Switch to WiFi if on mobile data

🔴 ERR_002: Invalid credentials
   • Verify email and password
   • Reset password if needed
   • Contact admin for account issues

🔴 ERR_003: Permission denied
   • Check user permissions
   • Contact admin for access
   • Verify account status

🔴 ERR_004: Server maintenance
   • Check status page
   • Try again later
   • Use offline mode

🔴 ERR_005: Data validation error
   • Check input format
   • Verify required fields
   • Use valid data ranges
```

### **Contact Support**

#### **Before Contacting Support:**
```
📋 Information to Prepare:

📱 Device Info:
• Device model and OS version
• App version number
• Available storage space
• Network connection type

🔍 Issue Details:
• Exact error message
• Steps to reproduce
• When issue first occurred
• Screenshots if helpful

👤 Account Info:
• Email address
• Company name
• User role/permissions
• Last successful operation
```

#### **Support Channels:**
```
📞 Contact Methods:

💬 In-App Support:
   Settings → Help & Support → Chat
   Response: Within 2 hours

📧 Email Support:
   mobile-support@stokcerdas.com
   Response: Within 4 hours

📱 WhatsApp:
   +62-811-1234-5678
   Business hours: 08:00-17:00 WIB

🆘 Emergency Support:
   For critical issues affecting business
   Call: (021) 1234-5678
   Available 24/7 for Enterprise users
```

### **Self-Help Resources**

#### **Available Resources:**
```
📚 Help Resources:

🎥 Video Tutorials:
   Settings → Help → Video Guides
   • Getting started (5 mins)
   • Scanning products (3 mins)
   • Stock adjustment (4 mins)
   • Report generation (6 mins)

📖 User Manual:
   Settings → Help → User Guide
   Complete PDF manual download

❓ FAQ:
   Settings → Help → FAQ
   100+ common questions answered

💬 Community:
   Settings → Help → Community Forum
   Connect with other users
```

#### **Status & Updates:**
```
📊 System Status:
   Check: status.stokcerdas.com
   
   Current Status: ✅ All Systems Operational
   Last Update: July 4, 2025 10:30 WIB
   
   Scheduled Maintenance:
   Next: Sunday, July 7, 2025 02:00-04:00 WIB

📱 App Updates:
   Current Version: 2.1.4
   Last Update: June 28, 2025
   
   What's New:
   • Improved scanner accuracy
   • Faster sync performance
   • New report templates
   • Bug fixes and improvements

🔔 Notifications:
   Subscribe to status updates:
   Settings → Notifications → System Updates
```

---

## 🎓 Training & Resources

### **Getting Started Training**

#### **New User Onboarding:**
```
🎯 30-Minute Quick Start:

📚 Module 1: Basic Navigation (5 min)
   • App layout overview
   • Bottom navigation
   • Main features tour

📚 Module 2: Product Setup (10 min)
   • Add your first product
   • Product categories
   • Basic inventory setup

📚 Module 3: Scanner Usage (10 min)
   • Barcode scanning tutorial
   • Manual entry fallback
   • Batch scanning intro

📚 Module 4: Daily Operations (5 min)
   • Dashboard overview
   • Quick actions
   • Basic reporting

✅ Completion Certificate Available
```

#### **Advanced Features Training:**
```
🎓 Advanced User Course (2 hours):

📚 Module 1: Inventory Management
   • Multi-location setup
   • Stock transfers
   • Cycle counting
   • Reorder point optimization

📚 Module 2: Reporting & Analytics
   • Custom report building
   • Data interpretation
   • Export and sharing
   • Performance metrics

📚 Module 3: Integration Setup
   • Marketplace connections
   • Automation rules
   • Webhook configuration
   • Troubleshooting sync

📚 Module 4: Mobile Optimization
   • Offline workflows
   • Batch operations
   • Performance tuning
   • Best practices
```

### **Industry-Specific Guides**

#### **Fashion Retail:**
```
👗 Fashion Business Setup:

📦 Product Structure:
   • Parent-child relationships
   • Size/color variants
   • Seasonal categorization
   • Style code management

📊 Inventory Strategy:
   • Size curve optimization
   • Seasonal stock planning
   • Fashion cycle management
   • Clearance workflows

🔄 Operations:
   • Fast fashion turnover
   • Trend-based forecasting
   • Size-specific reordering
   • Style performance tracking
```

#### **Electronics Retail:**
```
📱 Electronics Business Setup:

📦 Product Management:
   • Model/variant tracking
   • Warranty information
   • Serial number management
   • Accessory bundling

📊 Inventory Control:
   • High-value item security
   • Technology lifecycle
   • Obsolescence management
   • Supplier lead times

🔄 Operations:
   • Price volatility handling
   • Pre-order management
   • Return/refurbishment flow
   • Technical specifications
```

### **Best Practice Library**

#### **Inventory Optimization:**
```
📚 Best Practice Collection:

📊 Stock Level Optimization:
   • Safety stock calculations
   • Reorder point formulas
   • EOQ implementation
   • ABC analysis setup

🔄 Process Improvement:
   • Cycle counting procedures
   • Receiving workflows
   • Pick/pack optimization
   • Quality control checks

📈 Performance Monitoring:
   • KPI dashboards
   • Variance analysis
   • Trend identification
   • Action planning
```

---

**📱 Selamat menggunakan StokCerdas Mobile App! 🇮🇩**

*Panduan ini akan terus diperbarui. Terakhir diupdate: Juli 2025*