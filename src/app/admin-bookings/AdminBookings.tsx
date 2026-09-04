"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKING_STATUSES, getManualBookingStatusOptions } from "@/lib/booking-status";
import styles from "./AdminBookings.module.css";

type Booking = {
  id: number;
  confirmation_code: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  arrival_date: string;
  departure_date: string;
  status: string;
  nightly_rate: number;
  room_count: number;
  total_amount: number;
  currency: string;
  admin_notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  room_types: { name: string; slug: string } | null;
};

type RoomOption = {
  id: number;
  name: string;
  total_units: number;
  is_active: boolean;
};

type AvailableRoom = {
  id: number;
  availableUnits: number;
};

const statuses = BOOKING_STATUSES;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace("/admin-login");
    throw new Error("Your admin session has expired.");
  }
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body as T;
}

function NavIcon({ type }: { type: "dashboard" | "bookings" | "chevron" }) {
  if (type === "chevron") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.4 7.4-1.4-1.4-6 6 6 6 1.4-1.4-4.6-4.6z" /></svg>;
  }
  return type === "dashboard" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3zm13 8H4v10h16zM6 12h4v3H6z" /></svg>
  );
}

export function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createRoomId, setCreateRoomId] = useState("");
  const [createArrival, setCreateArrival] = useState("");
  const [createDeparture, setCreateDeparture] = useState("");
  const [createRoomCount, setCreateRoomCount] = useState(1);
  const [createAvailableUnits, setCreateAvailableUnits] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const deepLinkedBookingHandled = useRef(false);
  const availabilityRequestId = useRef(0);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await requestJson<{ bookings: Booking[] }>("/api/admin/bookings");
      setBookings(payload.bookings);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    const payload = await requestJson<{ rooms: RoomOption[] }>("/api/admin/rooms");
    setRooms(payload.rooms.filter((room) => room.is_active));
  }, []);

  async function checkCreateAvailability(roomId: string, arrival: string, departure: string) {
    const requestId = ++availabilityRequestId.current;
    if (!roomId || !arrival || !departure || departure <= arrival) {
      setCreateAvailableUnits(null);
      setCheckingAvailability(false);
      return;
    }

    setCheckingAvailability(true);
    try {
      const query = new URLSearchParams({ arrival, departure });
      const payload = await requestJson<{ rooms: AvailableRoom[] }>(`/api/rooms?${query.toString()}`);
      if (requestId !== availabilityRequestId.current) return;
      const room = payload.rooms.find((item) => item.id === Number(roomId));
      const availableUnits = room?.availableUnits ?? 0;
      setCreateAvailableUnits(availableUnits);
      setCreateRoomCount((current) => availableUnits > 0 ? Math.min(current, availableUnits) : 1);
    } catch (caught) {
      if (requestId === availabilityRequestId.current) {
        setCreateAvailableUnits(null);
        setError((caught as Error).message);
      }
    } finally {
      if (requestId === availabilityRequestId.current) setCheckingAvailability(false);
    }
  }

  function openCreateBooking() {
    availabilityRequestId.current += 1;
    setError("");
    setCreateRoomId("");
    setCreateArrival("");
    setCreateDeparture("");
    setCreateRoomCount(1);
    setCreateAvailableUnits(null);
    setCheckingAvailability(false);
    setCreateOpen(true);
  }

  function closeCreateBooking() {
    availabilityRequestId.current += 1;
    setCreateOpen(false);
    setCheckingAvailability(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadBookings(), loadRooms()]).catch((caught) => {
        setError((caught as Error).message);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings, loadRooms]);

  useEffect(() => {
    if (deepLinkedBookingHandled.current || bookings.length === 0) return;
    deepLinkedBookingHandled.current = true;
    const bookingId = Number(new URLSearchParams(window.location.search).get("booking"));
    if (!Number.isInteger(bookingId)) return;
    const linkedBooking = bookings.find((booking) => booking.id === bookingId);
    if (!linkedBooking) return;
    const timer = window.setTimeout(() => setSelected(linkedBooking), 0);
    return () => window.clearTimeout(timer);
  }, [bookings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSidebarCollapsed(window.localStorage.getItem("nyakajuAdminSidebarCollapsed") === "true");
      } catch {
        // The sidebar remains usable when browser storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (status && booking.status !== status) return false;
      if (!query) return true;
      return [
        booking.confirmation_code,
        booking.guest_first_name,
        booking.guest_last_name,
        booking.guest_email,
        booking.guest_phone,
        booking.room_types?.name,
      ].join(" ").toLowerCase().includes(query);
    });
  }, [bookings, search, status]);

  const counts = useMemo(() => Object.fromEntries(
    statuses.map((item) => [item, bookings.filter((booking) => booking.status === item).length]),
  ), [bookings]);
  const selectedCreateRoom = rooms.find((room) => room.id === Number(createRoomId));
  const createRoomLimit = createAvailableUnits ?? selectedCreateRoom?.total_units ?? 0;

  const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
  const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateTime = (value: string | null) => value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "Not yet confirmed";
  const nights = (booking: Booking) => Math.round(
    (Date.parse(`${booking.departure_date}T00:00:00Z`) - Date.parse(`${booking.arrival_date}T00:00:00Z`)) / 86_400_000,
  );

  async function updateBooking(booking: Booking, nextStatus: string, notes = booking.admin_notes ?? "") {
    setSaving(true);
    setError("");
    try {
      const payload = await requestJson<{ booking: Booking }>(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNotes: notes }),
      });
      setBookings((items) => items.map((item) => item.id === booking.id ? payload.booking : item));
      setSelected((current) => current?.id === booking.id ? payload.booking : current);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setCreating(true);
    setError("");
    const formData = new FormData(form);

    try {
      const payload = await requestJson<{ booking: Booking }>("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          roomTypeId: formData.get("roomTypeId"),
          roomCount: formData.get("roomCount"),
          arrival: formData.get("arrival"),
          departure: formData.get("departure"),
        }),
      });
      form.reset();
      closeCreateBooking();
      await loadBookings();
      setSelected(payload.booking);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/admin-login");
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("nyakajuAdminSidebarCollapsed", String(next));
      } catch {
        // Persisting this display preference is optional.
      }
      return next;
    });
  }

  return <div className={styles.shell}>
    <aside id="adminBookingsSidebar" className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
      <button className={styles.sidebarToggle} type="button" onClick={toggleSidebar} aria-controls="adminBookingsSidebar" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed}>
        <span className={sidebarCollapsed ? styles.chevronRight : ""}><NavIcon type="chevron"/></span>
      </button>
      <div className={styles.brandBlock}>
        <Image className={styles.logo} src="/remote-images/AB6AXuBug833spFtV4UfdEQd.png" alt="The Nyakaju Logo" width={224} height={74} priority/>
        <div className={styles.monogram}>N</div>
        <p className={styles.portal}>Admin Portal</p>
      </div>
      <nav className={styles.nav} aria-label="Admin navigation">
        <Link href="/admin-dashboard"><NavIcon type="dashboard"/><span>Dashboard</span></Link>
        <Link href="/admin-bookings" className={styles.active} aria-current="page"><NavIcon type="bookings"/><span>Bookings</span></Link>
      </nav>
      <div className={styles.profile}><div className={styles.avatar}>AD</div><span>Admin</span></div>
    </aside>

    <main className={`${styles.main} ${sidebarCollapsed ? styles.mainCollapsed : ""}`}>
      <header className={styles.topbar}>
        <h1>Bookings</h1>
        <button className={styles.logout} onClick={logout}>Log out</button>
      </header>

      <div className={styles.content}>
        <section className={styles.intro}>
          <div><p className={styles.eyebrow}>Operations</p><h2>All Bookings</h2><p>Review every reservation, guest, stay, payment value, and status in one place.</p></div>
          <div className={styles.introActions}>
            <button className={styles.secondaryAction} onClick={() => void loadBookings()} disabled={loading}>{loading ? "Loading…" : "Refresh bookings"}</button>
            <button className={styles.refresh} onClick={openCreateBooking}>Add booking</button>
          </div>
        </section>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}

        <section className={styles.metrics} aria-label="Booking summary">
          <div><span>All bookings</span><strong>{bookings.length}</strong><small>Complete booking history</small></div>
          <div><span>Pending</span><strong>{counts.pending ?? 0}</strong><small>Awaiting review</small></div>
          <div><span>Confirmed</span><strong>{counts.confirmed ?? 0}</strong><small>Reserved stays</small></div>
          <div><span>Completed</span><strong>{counts.completed ?? 0}</strong><small>Finished stays</small></div>
        </section>

        <section className={styles.bookingPanel}>
          <div className={styles.panelHeader}>
            <div><p className={styles.eyebrow}>Booking records</p><h2>{filtered.length} booking{filtered.length === 1 ? "" : "s"} shown</h2></div>
            <div className={styles.filters}>
              <label><span>Search bookings</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guest, phone, room or code" type="search"/></label>
              <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Guest & contact</th><th>Room & code</th><th>Stay</th><th>Booking value</th><th>Status</th><th>Timeline</th><th></th></tr></thead>
              <tbody>
                {filtered.map((booking) => <tr key={booking.id}>
                  <td><strong>{booking.guest_first_name} {booking.guest_last_name}</strong><span>{booking.guest_email}</span><span>{booking.guest_phone}</span></td>
                  <td><strong>{booking.room_types?.name ?? "Unknown room"}</strong><span>{booking.room_count} room{booking.room_count === 1 ? "" : "s"} · {booking.confirmation_code}</span></td>
                  <td><strong>{date(booking.arrival_date)} – {date(booking.departure_date)}</strong><span>{nights(booking)} night{nights(booking) === 1 ? "" : "s"}</span></td>
                  <td><strong>{money(booking.total_amount, booking.currency)}</strong><span>{money(booking.nightly_rate, booking.currency)} per night</span></td>
                  <td><select className={styles.status} data-status={booking.status} value={booking.status} disabled={saving || getManualBookingStatusOptions(booking.status).length < 2} onChange={(event) => void updateBooking(booking, event.target.value)} aria-label={`Status for ${booking.confirmation_code}`}>{getManualBookingStatusOptions(booking.status).map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></td>
                  <td><strong>Booked {dateTime(booking.created_at)}</strong><span>{booking.confirmed_at ? `Confirmed ${dateTime(booking.confirmed_at)}` : "Not yet confirmed"}</span></td>
                  <td><button className={styles.viewButton} onClick={() => setSelected(booking)}>View details</button></td>
                </tr>)}
              </tbody>
            </table>
            {!loading && filtered.length === 0 ? <div className={styles.empty}>No bookings match these filters.</div> : null}
          </div>
        </section>
      </div>

      <footer className={styles.footer}>© 2026 THE NYAKAJU. ALL RIGHTS RESERVED.</footer>
    </main>

    {createOpen ? <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) closeCreateBooking(); }}>
      <section className={`${styles.drawer} ${styles.createDrawer}`} role="dialog" aria-modal="true" aria-labelledby="createBookingTitle">
        <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>Direct database entry</p><h2 id="createBookingTitle">Add booking</h2></div><button type="button" disabled={creating} onClick={closeCreateBooking} aria-label="Close booking form">×</button></div>
        <p className={styles.createIntro}>Enter the guest and stay details. Every new booking starts as pending and can be confirmed after payment is received.</p>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <form className={styles.createForm} onSubmit={(event) => void createBooking(event)}>
          <label><span>First name</span><input name="firstName" type="text" maxLength={100} autoComplete="given-name" required autoFocus/></label>
          <label><span>Last name</span><input name="lastName" type="text" maxLength={100} autoComplete="family-name" required/></label>
          <label><span>Email</span><input name="email" type="email" maxLength={320} autoComplete="email" required/></label>
          <label><span>Phone</span><input name="phone" type="tel" maxLength={50} autoComplete="tel" required/></label>
          <label className={styles.fullField}><span>Room type</span><select name="roomTypeId" value={createRoomId} onChange={(event) => { const value = event.target.value; setCreateRoomId(value); setCreateRoomCount(1); setCreateAvailableUnits(null); void checkCreateAvailability(value, createArrival, createDeparture); }} required><option value="" disabled>Select a room type</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.total_units} total units</option>)}</select></label>
          <label><span>Arrival</span><input name="arrival" type="date" min={new Date().toLocaleDateString("en-CA")} value={createArrival} onChange={(event) => { const value = event.target.value; setCreateArrival(value); setCreateAvailableUnits(null); void checkCreateAvailability(createRoomId, value, createDeparture); }} required/></label>
          <label><span>Departure</span><input name="departure" type="date" min={new Date().toLocaleDateString("en-CA")} value={createDeparture} onChange={(event) => { const value = event.target.value; setCreateDeparture(value); setCreateAvailableUnits(null); void checkCreateAvailability(createRoomId, createArrival, value); }} required/></label>
          <label><span>Number of rooms</span><input name="roomCount" type="number" min="1" max={Math.max(1, createRoomLimit)} step="1" value={createRoomCount} disabled={!createRoomId || createRoomLimit === 0 || checkingAvailability} onChange={(event) => setCreateRoomCount(Math.min(Math.max(1, Number(event.target.value)), Math.max(1, createRoomLimit)))} required/><small className={styles.availabilityHelp}>{checkingAvailability ? "Checking live availability…" : createAvailableUnits !== null ? `${createAvailableUnits} room${createAvailableUnits === 1 ? "" : "s"} available for these dates.` : selectedCreateRoom ? `Up to ${selectedCreateRoom.total_units} rooms in this package. Choose dates for live availability.` : "Select a room package first."}</small></label>
          <div className={`${styles.createActions} ${styles.fullField}`}><button type="button" className={styles.cancelCreate} disabled={creating} onClick={closeCreateBooking}>Cancel</button><button type="submit" className={styles.save} disabled={creating || checkingAvailability || rooms.length === 0 || createAvailableUnits === 0}>{creating ? "Creating booking…" : "Create booking"}</button></div>
        </form>
      </section>
    </div> : null}

    {selected ? <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="bookingDetailsTitle">
        <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>Complete booking record</p><h2 id="bookingDetailsTitle">{selected.guest_first_name} {selected.guest_last_name}</h2></div><button onClick={() => setSelected(null)} aria-label="Close booking details">×</button></div>
        <div className={styles.detailGrid}>{[
          ["Confirmation", selected.confirmation_code], ["Room", selected.room_types?.name ?? "Unknown room"],
          ["Number of rooms", String(selected.room_count)],
          ["Email", selected.guest_email], ["Phone", selected.guest_phone], ["Arrival", date(selected.arrival_date)],
          ["Departure", date(selected.departure_date)], ["Nightly rate", money(selected.nightly_rate, selected.currency)],
          ["Total", money(selected.total_amount, selected.currency)], ["Booked", dateTime(selected.created_at)],
          ["Confirmed", dateTime(selected.confirmed_at)],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <label className={styles.drawerField}><span>Status</span><select value={selected.status} disabled={getManualBookingStatusOptions(selected.status).length < 2} onChange={(event) => setSelected({ ...selected, status: event.target.value })}>{getManualBookingStatusOptions(selected.status).map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
        <label className={styles.drawerField}><span>Admin notes</span><textarea value={selected.admin_notes ?? ""} placeholder="Add internal notes about this booking" onChange={(event) => setSelected({ ...selected, admin_notes: event.target.value })}/></label>
        <button className={styles.save} disabled={saving} onClick={() => void updateBooking(selected, selected.status, selected.admin_notes ?? "")}>{saving ? "Saving…" : "Save booking changes"}</button>
      </section>
    </div> : null}
  </div>;
}
