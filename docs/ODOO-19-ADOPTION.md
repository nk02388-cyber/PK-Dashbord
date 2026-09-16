# ใช้ Odoo 19 Community กับ PK Dashboard

ไฟล์ `odoo-19.0.zip` ที่แนบเป็น **ซอร์ส Odoo Community** (LICENSE ระบุ LGPLv3) ไม่ใช่ข้อมูลพาเลตหรือโปรแกรมติดตั้งสำเร็จรูป เครื่องนี้ยังไม่มี PostgreSQL, Docker และ Python runtime ที่พร้อมใช้ จึงยังไม่ได้เปิด Odoo server หรือย้ายข้อมูลเข้าฐาน Odoo จริง

## การจับคู่ข้อมูล

| งานปัจจุบัน | Odoo 19 |
| --- | --- |
| รหัส/ชื่อสินค้าและหน่วย | Products (`product.product`) และ Units of Measure |
| โซน/ตำแหน่งพาเลต | Internal Locations (`stock.location`) ใต้คลัง PK |
| ยอดพาเลตตามรหัส/ล็อต | Physical Inventory (`stock.quant`) แบบ Counted Quantity |
| รับเข้า/เบิก/ย้ายพาเลตครั้งใหม่ | Receipts / Deliveries / Internal Transfers (`stock.picking`) |
| สูตร BOM PK | Bill of Materials (`mrp.bom`) |

ตั้ง Odoo Community บนเซิร์ฟเวอร์ที่มี PostgreSQL และใช้ Inventory, Manufacturing; เปิด Storage Locations และ Lots ก่อนนำข้อมูลเข้า กำหนดหนึ่งตำแหน่ง Odoo ต่อหนึ่ง `โซน/ช่องพาเลต` และกำหนดหน่วย Odoo ที่ตรงกับข้อมูลเดิม ห้ามแปลงหน่วยโดยเดาจากชื่อไทย

## เตรียมยอดเปิด

1. ที่หน้า **ผังพื้นที่ชั้น 2** กด **ส่งออกข้อมูลพาเลต** เพื่อได้ `pallet_status_YYYYMMDD.json` จากข้อมูลล่าสุด
2. รัน `node tools/odoo-pallet-export.mjs pallet_status_YYYYMMDD.json odoo-output`
3. ตรวจ `review.csv` ต้องไม่มีแถวปัญหา และเทียบผลรวม `opening-counts.csv` กับรายงาน Excel ของพาเลต (รหัสและหน่วยเดียวกัน)
4. ใช้ `products.csv` สร้าง/จับคู่สินค้าและหน่วยใน Odoo ก่อน จากนั้นสร้างตำแหน่งภายในจาก `locations.csv` ใต้คลัง PK
5. ใช้ `opening-counts.csv` เป็น **รายการเตรียมนับ** โดยจับคู่สินค้า/ตำแหน่ง/ล็อตกับ ID ในฐาน Odoo ของคุณ แล้วนำเข้า Physical Inventory หรือกรอก Counted Quantity ผ่าน UI; ตรวจ Preview/Test ก่อน Apply ทุกครั้ง

ไฟล์ทั้งสามเป็น **staging CSV** สำหรับจับคู่ข้อมูล ไม่ใช่ไฟล์ที่กด Import Odoo ได้โดยไม่ตั้งค่าสินค้า ตำแหน่ง และหน่วยก่อน ชื่อคอลัมน์ในหน้าจอ Import อาจต่างกันตามภาษาและโมดูลที่ติดตั้ง ให้ส่งออก import-compatible template จากฐาน Odoo ของคุณ แล้วนำข้อมูล staging ไปเติมตาม template นั้น หาก Odoo มีสต็อกอยู่แล้ว ต้องกระทบยอดก่อน Apply เพราะ Inventory Adjustment อาจเปลี่ยนยอดและมูลค่าสินค้า

ประวัติ STOCK CARD ในระบบเดิมเก็บไว้เป็นหลักฐานอ้างอิง **ไม่สร้าง move ย้อนหลัง** จากประวัตินั้น หลังวันที่เริ่มใช้ Odoo ให้รับ เบิก และย้ายผ่าน Odoo เป็นแหล่งข้อมูลหลักเพียงแห่งเดียว แล้วจึงออกแบบตัวเชื่อมแบบอ่านอย่างเดียวกลับไปยังแดชบอร์ดเมื่อมีฐาน Odoo ที่เข้าถึงได้ การบันทึกธุรกรรมเดียวกันใน Odoo และ Supabase พร้อมกันจะทำให้ยอดซ้ำ

## สิ่งที่ต้องมีก่อนเปิดใช้งานจริง

ต้องมี URL/ฐานข้อมูล Odoo Community ที่ติดตั้งแล้ว, คลังกายภาพ PK, รายการหน่วยและล็อตที่ผ่านการตรวจ, วันตัดยอด, และคนรับผิดชอบกระทบยอด ก่อนทำการ import หรือเปิดแดชบอร์ดให้ดึงยอด Odoo อัตโนมัติ
