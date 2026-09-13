import { useState } from "react";
import { useLiff } from "./useLiff";

// mock รายชื่อวัคซีนไว้ก่อน (ทีหลังจะดึงจาก Supabase จริงใน Week 5-6)
const availableVaccines = [
  { id: "v001", name: "วัคซีนไข้หวัดใหญ่", price: 590 },
  { id: "v002", name: "วัคซีนไอกรน", price: 1200 },
  { id: "v003", name: "วัคซีนตับอักเสบบี", price: 850 },
];

function BookingForm() {
  const { profile, isReady, error } = useLiff();   // ← เพิ่มบรรทัดนี้
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleVaccine(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((v) => v !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  const total = availableVaccines
    .filter((v) => selectedIds.includes(v.id))
    .reduce((sum, v) => sum + v.price, 0);

    if (error) {
        return <p>เกิดข้อผิดพลาด: {error}</p>;
    }

    if (!isReady) {
        return <p>กำลังโหลด...</p>;
    }
    return (
    <div>
      <p>สวัสดีคุณ {profile?.displayName}</p>  
      <h2>เลือกวัคซีนที่ต้องการฉีด</h2>
      {availableVaccines.map((vaccine) => (
        <label key={vaccine.id} style={{ display: "block", margin: "8px 0" }}>
          <input
            type="checkbox"
            checked={selectedIds.includes(vaccine.id)}
            onChange={() => toggleVaccine(vaccine.id)}
          />
          {vaccine.name} — {vaccine.price} บาท
        </label>
      ))}
      <hr />
      <p>ยอดรวม: {total} บาท</p>
    </div>
  );
}

export default BookingForm;