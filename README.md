# PK Dashboard

แดชบอร์ด Stock Inventory และ BOM PK สำหรับเผยแพร่ผ่าน GitHub Pages

## สิ่งที่อัปเดต

- ข้อมูล Stock ตั้งต้นจากไฟล์ `200, 201, 202, 204, 401, 800, 900.txt` ณ วันที่ 29 ส.ค. 69
- ปุ่ม **Update Stock** รองรับ `.xlsx`, `.xls`, `.csv` และ `.txt` รวมทั้งเลือกหลายไฟล์พร้อมกัน
- การคำนวณและเก็บ snapshot ทำผ่าน Supabase RPC
- กระบวนการ Stock แยกจาก `pallet_slots`, `receive_dates` และผัง Zone โดยสมบูรณ์
- หน้าจัดการสินค้าในตำแหน่งมีปุ่ม **รับคืน** ซึ่งเพิ่มยอดกลับเข้าคงเหลือและบันทึกประวัติ
- เมื่อเปิดงาน **แก้ไขรายการ**, **เบิก**, **รับคืน** หรือยืนยันลบ ปุ่มจัดการอื่นในแถวจะซ่อนชั่วคราวจนบันทึกหรือยกเลิก
- ชุดปุ่มจัดการและฟอร์มทั้งสามแบบใช้ขนาด ระยะ มุมโค้ง และสถานะ focus เดียวกัน พร้อมรองรับโหมดสว่าง/มืด

## ตั้งค่า Supabase (ครั้งเดียว)

1. เปิด Supabase Dashboard ของโปรเจกต์เดิม
2. ไปที่ **SQL Editor**
3. รันไฟล์ `supabase-stock.sql`
4. ตั้ง Update PIN โดยรันคำสั่งท้ายไฟล์ SQL หลังแทน `YOUR-PRIVATE-PIN` ด้วย PIN ส่วนตัว
5. เปิด `index.html` แล้วทดสอบปุ่ม **Update Stock**; ระบบจะถาม PIN ก่อนส่งข้อมูล

> หน้าเว็บมี Supabase URL และ publishable key เดิมอยู่แล้ว ไม่ต้องใส่ service-role key หรือ Update PIN ใน GitHub

## เปิด GitHub Pages

1. สร้าง repository ใหม่และอัปโหลดไฟล์ทั้งสามไฟล์ในโฟลเดอร์นี้
2. ไปที่ **Settings → Pages**
3. เลือก **Deploy from a branch**, branch `main`, folder `/ (root)`
4. บันทึก แล้วรอ GitHub แสดง URL ของเว็บไซต์

หน้าเว็บต้องต่ออินเทอร์เน็ตเพื่อโหลด SheetJS, Supabase client และข้อมูล Stock ล่าสุด
