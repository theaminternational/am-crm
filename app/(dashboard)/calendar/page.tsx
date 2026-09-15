"use client";
import { CalendarDays, X, Trash2 } from "lucide-react";


import { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const EVENT_TYPES = [
  { key: "post", label: "Post", color: "#1d4ed8", bg: "#dbeafe" },
  { key: "reel", label: "Reel", color: "#7c3aed", bg: "#ede9fe" },
  { key: "story", label: "Story", color: "#db2777", bg: "#fce7f3" },
  { key: "meeting", label: "Meeting", color: "#059669", bg: "#d1fae5" },
  { key: "deadline", label: "Deadline", color: "#dc2626", bg: "#fee2e2" },
  { key: "campaign", label: "Campaign", color: "#d97706", bg: "#fef3c7" },
  { key: "other", label: "Other", color: "#6b7280", bg: "#f3f4f6" },
];

const PLATFORMS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Twitter/X",
  "YouTube",
  "WhatsApp",
  "Website",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const HOLIDAYS: Record<string, { date: string; label: string }[]> = {
  IND: [
    // 2026
    { date: "2026-06-26", label: "Muharram/Ashura" },
    { date: "2026-07-16", label: "Rath Yatra" },
    { date: "2026-08-15", label: "Independence Day" },
    { date: "2026-08-26", label: "Milad un-Nabi" },
    { date: "2026-08-26", label: "Onam" },
    { date: "2026-08-28", label: "Raksha Bandhan" },
    { date: "2026-09-04", label: "Janmashtami" },
    { date: "2026-09-14", label: "Ganesh Chaturthi" },
    { date: "2026-10-02", label: "Mahatma Gandhi Jayanti" },
    { date: "2026-10-11", label: "Sharad Navratri Start" },
    { date: "2026-10-17", label: "Durga Puja Start" },
    { date: "2026-10-18", label: "Maha Saptami" },
    { date: "2026-10-19", label: "Maha Ashtami" },
    { date: "2026-10-20", label: "Dussehra" },
    { date: "2026-10-26", label: "Maharishi Valmiki Jayanti" },
    { date: "2026-10-29", label: "Karaka Chaturthi" },
    { date: "2026-11-08", label: "Diwali/Deepavali" },
    { date: "2026-11-09", label: "Govardhan Puja" },
    { date: "2026-11-11", label: "Bhai Duj" },
    { date: "2026-11-15", label: "Chhat Puja" },
    { date: "2026-11-24", label: "Guru Nanak Jayanti" },
    { date: "2026-12-23", label: "Hazarat Ali's Birthday" },
    { date: "2026-12-25", label: "Christmas" },
    // 2027
    { date: "2027-01-01", label: "New Year's Day" },
    { date: "2027-01-15", label: "Makar Sankranti/Pongal" },
    { date: "2027-01-26", label: "Republic Day" },
    { date: "2027-02-09", label: "Ramadan Start" },
    { date: "2027-02-11", label: "Vasant Panchami" },
    { date: "2027-02-19", label: "Shivaji Jayanti" },
    { date: "2027-03-06", label: "Maha Shivaratri" },
    { date: "2027-03-10", label: "Ramzan Id" },
    { date: "2027-03-22", label: "Holi" },
    { date: "2027-03-26", label: "Good Friday" },
    { date: "2027-04-07", label: "Gudi Padwa/Ugadi" },
    { date: "2027-04-14", label: "Ambedkar Jayanti" },
    { date: "2027-04-15", label: "Rama Navami" },
    { date: "2027-05-17", label: "Bakrid" },
    { date: "2027-06-16", label: "Muharram/Ashura" },
    { date: "2027-07-05", label: "Rath Yatra" },
    { date: "2027-08-15", label: "Independence Day" },
    { date: "2027-08-17", label: "Raksha Bandhan" },
    { date: "2027-08-25", label: "Janmashtami" },
    { date: "2027-09-04", label: "Ganesh Chaturthi" },
    { date: "2027-09-12", label: "Onam" },
    { date: "2027-09-30", label: "Sharad Navratri Start" },
    { date: "2027-10-02", label: "Mahatma Gandhi Jayanti" },
    { date: "2027-10-05", label: "Durga Puja Start" },
    { date: "2027-10-09", label: "Dussehra" },
    { date: "2027-10-18", label: "Karaka Chaturthi" },
    { date: "2027-10-29", label: "Diwali" },
    { date: "2027-10-31", label: "Bhai Duj" },
    { date: "2027-11-04", label: "Chhat Puja" },
    { date: "2027-12-12", label: "Hazarat Ali's Birthday" },
    { date: "2027-12-25", label: "Christmas" },
    // 2028
    { date: "2028-01-01", label: "New Year's Day" },
    { date: "2028-01-15", label: "Makar Sankranti/Pongal" },
    { date: "2028-01-26", label: "Republic Day" },
    { date: "2028-01-29", label: "Ramadan Start" },
    { date: "2028-01-31", label: "Vasant Panchami" },
    { date: "2028-02-19", label: "Shivaji Jayanti" },
    { date: "2028-02-23", label: "Maha Shivaratri" },
    { date: "2028-02-27", label: "Ramzan Id" },
    { date: "2028-03-11", label: "Holi" },
    { date: "2028-03-27", label: "Gudi Padwa/Ugadi" },
    { date: "2028-04-03", label: "Rama Navami" },
    { date: "2028-04-14", label: "Good Friday/Ambedkar Jayanti" },
    { date: "2028-05-06", label: "Bakrid" },
    { date: "2028-06-04", label: "Muharram/Ashura" },
    { date: "2028-06-24", label: "Rath Yatra" },
    { date: "2028-08-05", label: "Raksha Bandhan" },
    { date: "2028-08-13", label: "Janmashtami" },
    { date: "2028-08-15", label: "Independence Day" },
    { date: "2028-08-23", label: "Ganesh Chaturthi" },
    { date: "2028-09-01", label: "Onam" },
    { date: "2028-09-19", label: "Sharad Navratri Start" },
    { date: "2028-09-24", label: "Durga Puja Start" },
    { date: "2028-09-27", label: "Dussehra" },
    { date: "2028-10-02", label: "Mahatma Gandhi Jayanti" },
    { date: "2028-10-07", label: "Karaka Chaturthi" },
    { date: "2028-10-17", label: "Diwali" },
    { date: "2028-10-19", label: "Bhai Duj" },
    { date: "2028-10-23", label: "Chhat Puja" },
    { date: "2028-12-01", label: "Hazarat Ali's Birthday" },
    { date: "2028-12-25", label: "Christmas" },
    // 2029
    { date: "2029-01-01", label: "New Year's Day" },
    { date: "2029-01-14", label: "Makar Sankranti/Pongal" },
    { date: "2029-01-17", label: "Ramadan Start" },
    { date: "2029-01-19", label: "Vasant Panchami" },
    { date: "2029-01-26", label: "Republic Day" },
    { date: "2029-02-11", label: "Maha Shivaratri" },
    { date: "2029-02-15", label: "Ramzan Id" },
    { date: "2029-02-19", label: "Shivaji Jayanti" },
    { date: "2029-03-01", label: "Holi" },
    { date: "2029-03-30", label: "Good Friday" },
    { date: "2029-04-14", label: "Gudi Padwa/Ugadi/Ambedkar Jayanti" },
    { date: "2029-04-22", label: "Rama Navami" },
    { date: "2029-04-25", label: "Bakrid" },
    { date: "2029-05-25", label: "Muharram/Ashura" },
  ],
  USA: [
    // 2026
    { date: "2026-06-14", label: "Flag Day" },
    { date: "2026-06-19", label: "Juneteenth" },
    { date: "2026-06-21", label: "Father's Day" },
    { date: "2026-07-03", label: "Independence Day (Observed)" },
    { date: "2026-07-04", label: "Independence Day" },
    { date: "2026-09-07", label: "Labor Day" },
    { date: "2026-10-12", label: "Columbus Day" },
    { date: "2026-10-31", label: "Halloween" },
    { date: "2026-11-03", label: "Election Day" },
    { date: "2026-11-11", label: "Veterans Day" },
    { date: "2026-11-26", label: "Thanksgiving Day" },
    { date: "2026-11-27", label: "Black Friday" },
    { date: "2026-12-24", label: "Christmas Eve" },
    { date: "2026-12-25", label: "Christmas Day" },
    { date: "2026-12-31", label: "New Year's Eve" },
    // 2027
    { date: "2027-01-01", label: "New Year's Day" },
    { date: "2027-01-18", label: "Martin Luther King Jr. Day" },
    { date: "2027-02-14", label: "Valentine's Day" },
    { date: "2027-02-15", label: "President's Day" },
    { date: "2027-03-17", label: "St. Patrick's Day" },
    { date: "2027-03-28", label: "Easter Sunday" },
    { date: "2027-04-15", label: "Tax Day" },
    { date: "2027-05-05", label: "Cinco de Mayo" },
    { date: "2027-05-09", label: "Mother's Day" },
    { date: "2027-05-31", label: "Memorial Day" },
    { date: "2027-06-14", label: "Flag Day" },
    { date: "2027-06-18", label: "Juneteenth (Observed)" },
    { date: "2027-06-19", label: "Juneteenth" },
    { date: "2027-06-20", label: "Father's Day" },
    { date: "2027-07-04", label: "Independence Day" },
    { date: "2027-07-05", label: "Independence Day (Observed)" },
    { date: "2027-09-06", label: "Labor Day" },
    { date: "2027-10-11", label: "Columbus Day" },
    { date: "2027-10-31", label: "Halloween" },
    { date: "2027-11-02", label: "Election Day" },
    { date: "2027-11-11", label: "Veterans Day" },
    { date: "2027-11-25", label: "Thanksgiving Day" },
    { date: "2027-11-26", label: "Black Friday" },
    { date: "2027-12-24", label: "Christmas Eve/Day (Observed)" },
    { date: "2027-12-25", label: "Christmas Day" },
    { date: "2027-12-31", label: "New Year's Day (Observed)" },
    // 2028
    { date: "2028-01-01", label: "New Year's Day" },
    { date: "2028-01-17", label: "Martin Luther King Jr. Day" },
    { date: "2028-02-14", label: "Valentine's Day" },
    { date: "2028-02-21", label: "President's Day" },
    { date: "2028-03-17", label: "St. Patrick's Day" },
    { date: "2028-04-16", label: "Easter Sunday" },
    { date: "2028-04-18", label: "Tax Day" },
    { date: "2028-05-05", label: "Cinco de Mayo" },
    { date: "2028-05-14", label: "Mother's Day" },
    { date: "2028-05-29", label: "Memorial Day" },
    { date: "2028-06-14", label: "Flag Day" },
    { date: "2028-06-18", label: "Father's Day" },
    { date: "2028-06-19", label: "Juneteenth" },
    { date: "2028-07-04", label: "Independence Day" },
    { date: "2028-09-04", label: "Labor Day" },
    { date: "2028-10-09", label: "Columbus Day" },
    { date: "2028-10-31", label: "Halloween" },
    { date: "2028-11-07", label: "Election Day" },
    { date: "2028-11-10", label: "Veterans Day (Observed)" },
    { date: "2028-11-11", label: "Veterans Day" },
    { date: "2028-11-23", label: "Thanksgiving Day" },
    { date: "2028-11-24", label: "Black Friday" },
    { date: "2028-12-24", label: "Christmas Eve" },
    { date: "2028-12-25", label: "Christmas Day" },
    { date: "2028-12-31", label: "New Year's Eve" },
    // 2029
    { date: "2029-01-01", label: "New Year's Day" },
    { date: "2029-01-15", label: "Martin Luther King Jr. Day" },
    { date: "2029-01-20", label: "Inauguration Day" },
    { date: "2029-02-14", label: "Valentine's Day" },
    { date: "2029-02-19", label: "President's Day" },
    { date: "2029-03-17", label: "St. Patrick's Day" },
    { date: "2029-04-01", label: "Easter Sunday" },
    { date: "2029-04-17", label: "Tax Day" },
    { date: "2029-05-05", label: "Cinco de Mayo" },
    { date: "2029-05-13", label: "Mother's Day" },
    { date: "2029-05-28", label: "Memorial Day" },
  ],
};

const EMPTY_FORM = {
  title: "",
  type: "post",
  date: "",
  time: "09:00",
  assignedTo: "",
  assignedToName: "",
  platform: "",
  notes: "",
  customType: "",
};

export default function CalendarPage() {
  const { crmUser } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [today] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [showIND, setShowIND] = useState(true);
  const [showUSA, setShowUSA] = useState(true);

  // Add a local flag for "Other" platform
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);

  useEffect(() => {
    const unsubEvents = onSnapshot(
      query(collection(db, "calendar_events"), orderBy("date", "asc")),
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
    );
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubEvents();
      unsubUsers();
    };
  }, []);

  function openAdd(date?: string) {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      date: date ?? "",
      assignedTo: crmUser?.uid ?? "",
    });
    setIsCustomPlatform(false);
    setShowModal(true);
  }

  function openEdit(ev: any) {
    setEditing(ev);
    setForm({
      title: ev.title,
      type: ev.type,
      date: ev.date,
      time: ev.time ?? "09:00",
      assignedTo: ev.assignedTo ?? "",
      assignedToName: ev.assignedToName ?? "",
      platform: ev.platform ?? "",
      notes: ev.notes ?? "",
      customType: ev.customType ?? "",
    });
    setIsCustomPlatform(ev.platform && !PLATFORMS.includes(ev.platform));
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const member = members.find((m) => m.uid === form.assignedTo);
      const payload = {
        ...form,
        assignedToName: member?.name ?? form.assignedToName,
      };

      if (editing) {
        await updateDoc(doc(db, "calendar_events", editing.id), payload);
      } else {
        await addDoc(collection(db, "calendar_events"), {
          ...payload,
          createdBy: crmUser?.uid,
          createdAt: now,
        });
      }

      // Notification
      if (member?.email) {
        try {
          const typeLabel =
            EVENT_TYPES.find((t) => t.key === form.type)?.label || form.type;
          const displayType =
            form.type === "other" ? form.customType : typeLabel;
          const dueDateTime = `${form.date} ${form.time}`;

          const html = `
            <div style="background:#f8f9fc;padding:40px 20px;font-family:Arial,sans-serif;">
              <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <div style="background:var(--navy);padding:32px;text-align:center;">
                  <h1 style="color:#C9A84C;margin:0;font-size:24px;letter-spacing:1px;">A&M CRM</h1>
                  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">Task Assigned</p>
                </div>
                <div style="padding:32px;">
                  <p style="color:#1a1a2e;font-size:16px;margin-bottom:12px;">Hi <strong>${member.name}</strong>,</p>
                  <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">A new task has been assigned to you in the CRM.</p>

                  <div style="background:#f8f9fc;border-left:4px solid #C9A84C;padding:24px;border-radius:0 8px 8px 0;">
                    <h3 style="color:#0D1B3E;margin:0 0 8px;font-size:18px;">${form.title}</h3>
                    <p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Type:</strong> ${displayType}</p>
                    <p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Due:</strong> ${dueDateTime}</p>
                    ${form.platform ? `<p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Platform:</strong> ${form.platform}</p>` : ""}
                    ${form.notes ? `<p style="color:#4b5563;font-size:13px;margin:12px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;"><strong>Notes:</strong> ${form.notes}</p>` : ""}
                  </div>
                  
                  <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:40px;">The A&M Internationals FZC · Elevating the World, Elegantly</p>
                </div>
              </div>
            </div>
          `;

          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [member.email],
              subject: `CRM Task Assigned: ${form.title}`,
              html,
            }),
          });
        } catch (e) {
          console.error(e);
        }
      }

      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "calendar_events", id));
  }

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1,
  );
  while (cells.length % 7 !== 0) cells.push(null);

  function getEventsForDay(day: number) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const evs = events.filter((e) => e.date === dateStr);

    if (showIND) {
      const indHols = HOLIDAYS.IND.filter((h) => h.date === dateStr);
      indHols.forEach((h) =>
        evs.push({
          id: `ind-${h.date}`,
          title: h.label,
          type: "holiday-ind",
          isHoliday: true,
        }),
      );
    }
    if (showUSA) {
      const usaHols = HOLIDAYS.USA.filter((h) => h.date === dateStr);
      usaHols.forEach((h) =>
        evs.push({
          id: `usa-${h.date}`,
          title: h.label,
          type: "holiday-usa",
          isHoliday: true,
        }),
      );
    }

    return evs;
  }

  function typeInfo(key: string) {
    if (key === "holiday-ind")
      return {
        key: "holiday-ind",
        label: "IND Holiday",
        color: "#ea580c",
        bg: "#ffedd5",
      };
    if (key === "holiday-usa")
      return {
        key: "holiday-usa",
        label: "USA Holiday",
        color: "#1e40af",
        bg: "#dbeafe",
      };
    return EVENT_TYPES.find((t) => t.key === key) ?? EVENT_TYPES[6];
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else setCurrentMonth((m) => m + 1);
  }

  const selectedDateStr = selectedDay
    ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">

          <h1 className="page-title flex items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Content Calendar
        </h1>

        <p className="page-subtitle">
          Schedule posts, reels, meetings & deadlines
        </p>
        </div>
        <div className="flex gap-3">
          {/* Toggles */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#e8e8f0]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIND}
                onChange={(e) => setShowIND(e.target.checked)}
                className="w-4 h-4 rounded text-[#ea580c] focus:ring-[#ea580c]"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "#4b5563" }}
              >
                IND Tracks
              </span>
            </label>
            <div className="w-[1px] h-4 bg-gray-200 mx-1" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showUSA}
                onChange={(e) => setShowUSA(e.target.checked)}
                className="w-4 h-4 rounded text-[#1e40af] focus:ring-[#1e40af]"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "#4b5563" }}
              >
                USA Tracks
              </span>
            </label>
          </div>

          <button
            onClick={() => openAdd(selectedDateStr || undefined)}
            className="btn-primary"
          >
            <span className="text-base">+</span> Add Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 crm-card p-0 overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "#f0f0f5" }}
          >
            <button onClick={prevMonth} className="text-2xl font-bold">
              ‹
            </button>
            <h2 className="text-base font-bold">
              {MONTHS_FULL[currentMonth]} {currentYear}
            </h2>
            <button onClick={nextMonth} className="text-2xl font-bold">
              ›
            </button>
          </div>
          <div
            className="grid grid-cols-7 border-b text-center py-2 text-xs font-bold uppercase"
            style={{ color: "#9ca3af" }}
          >
            {DAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day)
                return (
                  <div
                    key={idx}
                    className="border-b border-r min-h-[80px]"
                    style={{ borderColor: "#f8f8fc" }}
                  />
                );
              const dayEvents = getEventsForDay(day);
              const isToday =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <div
                  key={idx}
                  className="border-b border-r min-h-[80px] p-1.5 cursor-pointer"
                  style={{ background: isSelected ? "#f0f4ff" : "white" }}
                  onClick={() =>
                    setSelectedDay(day === selectedDay ? null : day)
                  }
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${isToday ? "bg-[#0D1B3E] text-white" : ""}`}
                  >
                    {day}
                  </div>
                  {dayEvents.slice(0, 3).map((ev) => {
                    const t = typeInfo(ev.type);

                    return (
                      <div
                        key={ev.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-md mb-0.5 truncate font-medium"
                        style={{ background: t.bg, color: t.color }}
                      >
                        {ev.isHoliday ? (
                          <>
                            🏝️{" "}
                            <CalendarDays className="inline-block w-3 h-3 shrink-0 mr-1" />
                          </>
                        ) : null}
                        {ev.title}
                      </div>
                    );

                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div>
          {selectedDay ? (
            <div className="crm-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold">
                  {selectedDay} {MONTHS_FULL[currentMonth]}
                </h3>
              </div>
              <div className="space-y-2">
                {selectedEvents.map((ev) => {
                  const t = typeInfo(ev.type);
                  return (

                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border ${
                        ev.isHoliday ? "" : "cursor-pointer"
                      }`}
                      style={{
                        borderColor: t.color + "33",
                        background: t.bg + "55",
                      }}
                      onClick={() => !ev.isHoliday && openEdit(ev)}
                    >
                      <p className="text-sm font-semibold">
                        {ev.isHoliday ? (
                          <>
                            <CalendarDays className="inline-block w-4 h-4 shrink-0 mr-1" />
                          </>
                        ) : null}
                        {ev.title}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span
                          className="badge"
                          style={{
                            background: t.bg,
                            color: t.color,
                            fontSize: "10px",
                          }}
                        >
                          {ev.type === "other" && ev.customType
                            ? ev.customType
                            : t.label}
                        </span>
                        {ev.platform && (
                          <span className="text-xs text-gray-400">
                            {ev.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {selectedEvents.length === 0 && (
                  <p className="text-xs text-gray-400">
                    No events for this day.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="crm-card">
              <h3 className="text-sm font-bold mb-3">Upcoming</h3>
              <div className="space-y-2">
                {events
                  .filter((e) => new Date(e.date) >= new Date())
                  .slice(0, 8)
                  .map((ev) => {
                    const t = typeInfo(ev.type);
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50"
                        onClick={() => openEdit(ev)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: t.bg, color: t.color }}
                        >
                          {new Date(ev.date).getDate()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {ev.title}
                          </p>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: t.bg,
                            color: t.color,
                            fontSize: "10px",
                          }}
                        >
                          {ev.type === "other" && ev.customType
                            ? ev.customType
                            : t.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-5">

              <h2 className="modal-title mb-0">{editing ? "Edit Event" : "Add Event"}</h2>
              <button onClick={() => setShowModal(false)}><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>

            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Event title"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Type</label>
                  <select
                    className="form-input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Time *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              {form.type === "other" && (
                <div>
                  <label className="form-label">Custom Category Name</label>
                  <input
                    className="form-input"
                    autoFocus
                    value={form.customType}
                    onChange={(e) =>
                      setForm({ ...form, customType: e.target.value })
                    }
                    placeholder="Shoot, Trip, etc."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Assign To</label>
                  <select
                    className="form-input"
                    value={form.assignedTo}
                    onChange={(e) => {
                      const m = members.find((x) => x.uid === e.target.value);
                      setForm({
                        ...form,
                        assignedTo: e.target.value,
                        assignedToName: m?.name ?? "",
                      });
                    }}
                  >
                    <option value="">Select...</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Platform</label>
                  <select
                    className="form-input"
                    value={
                      isCustomPlatform
                        ? "Other"
                        : PLATFORMS.includes(form.platform)
                          ? form.platform
                          : ""
                    }
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        setIsCustomPlatform(true);
                        setForm({ ...form, platform: "" });
                      } else {
                        setIsCustomPlatform(false);
                        setForm({ ...form, platform: e.target.value });
                      }
                    }}
                  >
                    <option value="">Select...</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="Other">Other...</option>
                  </select>
                </div>
              </div>

              {(form.type === "other" || isCustomPlatform) && (
                <div className="grid grid-cols-2 gap-3">
                  {form.type === "other" && (
                    <div>
                      <label className="form-label">Custom Category Name</label>
                      <input
                        className="form-input"
                        autoFocus
                        value={form.customType}
                        onChange={(e) =>
                          setForm({ ...form, customType: e.target.value })
                        }
                        placeholder="Shoot, Trip, etc."
                      />
                    </div>
                  )}
                  {isCustomPlatform && (
                    <div>
                      <label className="form-label">Custom Platform Name</label>
                      <input
                        className="form-input"
                        autoFocus
                        value={form.platform}
                        onChange={(e) =>
                          setForm({ ...form, platform: e.target.value })
                        }
                        placeholder="TikTok, Threads, etc."
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {editing && (

                <button
                  onClick={() => {
                    deleteEvent(editing.id);
                    setShowModal(false);
                  }}
                  className="py-2.5 px-4 rounded-xl border text-sm font-semibold text-red-500 border-red-200 hover:bg-red-50 transition-colors"
                  title="Delete Event"
                >
                  🗑️
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.date}
                className="btn-primary flex-1"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
