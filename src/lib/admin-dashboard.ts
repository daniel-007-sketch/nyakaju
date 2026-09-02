"use client";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

type Cleanup = () => void;

type AdminRoomImage = {
  id: number;
  room_type_id: number;
  storage_path: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
};

type AdminRoom = {
  id: number;
  slug: string;
  name: string;
  description: string;
  nightly_rate: number;
  currency: string;
  total_units: number;
  beds: number;
  bathrooms: number;
  is_active: boolean;
  display_order: number;
  room_images: AdminRoomImage[];
};

type AdminBooking = {
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
  created_at: string;
  confirmed_at: string | null;
  room_types: { name: string; slug: string } | null;
};

type Overview = {
  date: string;
  month: string;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  occupancyPercent: number;
  monthlyOccupiedRoomNights: number;
  totalRoomNights: number;
  monthlyOccupancyPercent: number;
  monthlyEarnings: number;
  previousMonthlyEarnings: number;
  todayEarnings: number;
  earningsChangePercent: number | null;
  currency: string;
  rooms: Array<{
    id: number;
    name: string;
    slug: string;
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
  }>;
};

function escapeHtml(value: unknown) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function listen(
  target: Window | Document | HTMLElement,
  eventName: string,
  listener: EventListenerOrEventListenerObject,
) {
  target.addEventListener(eventName, listener);
  return () => target.removeEventListener(eventName, listener);
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };

  if (!response.ok) {
    if (response.status === 401) {
      window.location.replace("/admin-login");
    }
    throw new Error(payload.error || "The request could not be completed.");
  }

  return payload as T;
}

function setFormValue(form: HTMLFormElement, name: string, value: string | number) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = String(value);
  }
}

export function setupSupabaseAdminDashboard(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const adminRoomsGrid = document.getElementById("adminRoomsGrid");
  const bookingsBody = document.getElementById("bookingsTableBody");
  const bookingSearch = document.getElementById("bookingSearch") as HTMLInputElement | null;
  const bookingStatusFilter = document.getElementById("bookingStatusFilter") as HTMLSelectElement | null;
  const recentBookingsCount = document.getElementById("recentBookingsCount");
  const deleteBookingDialog = document.getElementById("deleteBookingDialog") as HTMLDialogElement | null;
  const deleteBookingDialogMessage = document.getElementById("deleteBookingDialogMessage");
  const overviewMonth = document.getElementById("overviewMonth") as HTMLInputElement | null;
  const dashboardContent = document.getElementById("adminDashboardContent");
  const sidebar = document.getElementById("adminSidebar");
  const main = document.getElementById("adminMain");
  const sidebarToggle = document.getElementById("adminSidebarToggle") as HTMLButtonElement | null;
  const sidebarToggleIcon = document.getElementById("adminSidebarToggleIcon");
  const dashboardLoader = document.getElementById("adminDashboardLoader");
  const dashboardLoaderText = document.getElementById("adminDashboardLoaderText");

  if (sidebar && main && sidebarToggle && sidebarToggleIcon) {
    const sidebarStateKey = "nyakajuAdminSidebarCollapsed";
    const applySidebarState = (collapsed: boolean) => {
      document.body.classList.toggle("admin-sidebar-collapsed", collapsed);
      sidebar.dataset.collapsed = String(collapsed);
      main.classList.toggle("admin-main-collapsed", collapsed);
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
      sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
      sidebarToggleIcon.textContent = collapsed ? "chevron_right" : "chevron_left";
    };
    let initiallyCollapsed = false;
    try {
      initiallyCollapsed = window.localStorage.getItem(sidebarStateKey) === "true";
    } catch {
      // The sidebar still works when browser storage is unavailable.
    }
    applySidebarState(initiallyCollapsed);
    cleanups.push(listen(sidebarToggle, "click", () => {
      const collapsed = sidebar.dataset.collapsed !== "true";
      applySidebarState(collapsed);
      try {
        window.localStorage.setItem(sidebarStateKey, String(collapsed));
      } catch {
        // Persisting the preference is optional.
      }
    }));
    cleanups.push(() => document.body.classList.remove("admin-sidebar-collapsed"));
  }

  if (!adminRoomsGrid || !bookingsBody || !bookingSearch || !bookingStatusFilter || !overviewMonth || !dashboardContent || !deleteBookingDialog || !deleteBookingDialogMessage || !dashboardLoader || !dashboardLoaderText || !sidebar || !main) {
    return cleanups;
  }

  const revealDashboard = () => {
    sidebar.style.removeProperty("visibility");
    main.style.removeProperty("visibility");
    sidebar.removeAttribute("aria-hidden");
    main.removeAttribute("aria-hidden");
    dashboardLoader.remove();
  };

  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  cleanups.push(() => {
    if (deleteBookingDialog.open) deleteBookingDialog.close("cancel");
  });
  const supabase = createBrowserSupabaseClient();
  let rooms: AdminRoom[] = [];
  let searchTimer = 0;

  const confirmBookingDeletion = (confirmationCode: string) => new Promise<boolean>((resolve) => {
    deleteBookingDialogMessage.textContent = `Booking ${confirmationCode} will be permanently removed. This action cannot be undone.`;
    deleteBookingDialog.returnValue = "";
    deleteBookingDialog.addEventListener("close", () => {
      resolve(deleteBookingDialog.returnValue === "delete");
    }, { once: true });
    deleteBookingDialog.showModal();
  });

  const header = document.querySelector<HTMLElement>("main > header");
  if (header) {
    header.insertAdjacentHTML(
      "beforeend",
      '<form action="/api/auth/logout" method="post"><button id="adminLogout" type="submit" class="absolute right-8 rounded-full border border-primary px-5 py-2 text-primary hover:bg-primary hover:text-white transition-colors">Log out</button></form>',
    );
  }

  dashboardContent.insertAdjacentHTML("beforeend", `
    <section id="adminRoomManagement" class="hidden scroll-mt-24 bg-white rounded-xl custom-shadow border border-outline-variant/10 p-6 md:p-8">
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p class="font-label-lg uppercase tracking-widest text-primary/60">Inventory</p>
          <h2 id="roomFormHeading" class="font-headline-lg text-primary">Edit Room Type</h2>
        </div>
        <button id="cancelRoomEdit" type="button" class="hidden rounded-full border border-outline px-5 py-2">Cancel edit</button>
      </div>
      <form id="adminRoomForm" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Room name
          <input name="name" required maxlength="120" placeholder="e.g. Deluxe Suite" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">URL slug
          <input name="slug" required maxlength="120" placeholder="e.g. deluxe-suite" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Nightly rate (USD)
          <input name="nightlyRate" required min="0.01" step="0.01" type="number" placeholder="e.g. 450" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Total units
          <input name="totalUnits" required min="1" step="1" type="number" placeholder="e.g. 12" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Beds per unit
          <input name="beds" required min="1" step="1" type="number" placeholder="e.g. 1" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Bathrooms per unit
          <input name="bathrooms" required min="1" step="1" type="number" placeholder="e.g. 1" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant">Display order
          <input name="displayOrder" step="1" type="number" placeholder="e.g. 1" class="rounded-lg border border-outline-variant px-4 py-3 text-on-surface">
        </label>
        <label class="grid gap-2 text-sm font-medium text-on-surface-variant md:col-span-2 lg:col-span-3">Room description
          <textarea name="description" maxlength="2000" placeholder="e.g. A spacious suite with a private terrace..." class="min-h-28 rounded-lg border border-outline-variant px-4 py-3 text-on-surface"></textarea>
        </label>
        <button id="roomFormSubmit" type="submit" class="self-end rounded-full bg-primary px-6 py-3 text-white uppercase tracking-widest">Save changes</button>
      </form>
      <p id="roomFormMessage" class="mt-4 hidden" role="status"></p>
    </section>
  `);

  const roomForm = document.getElementById("adminRoomForm") as HTMLFormElement;
  const roomFormMessage = document.getElementById("roomFormMessage") as HTMLElement;
  const roomFormHeading = document.getElementById("roomFormHeading") as HTMLElement;
  const roomFormSubmit = document.getElementById("roomFormSubmit") as HTMLButtonElement;
  const cancelRoomEdit = document.getElementById("cancelRoomEdit") as HTMLButtonElement;
  const roomManagement = document.getElementById("adminRoomManagement") as HTMLElement;

  const resetRoomForm = () => {
    roomForm.reset();
    delete roomForm.dataset.roomId;
    roomFormHeading.textContent = "Edit Room Type";
    roomFormSubmit.textContent = "Save changes";
    cancelRoomEdit.classList.add("hidden");
    roomFormMessage.classList.add("hidden");
    roomManagement.classList.add("hidden");
  };

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  const overviewMonths = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(Date.UTC(
      currentMonth.getUTCFullYear(),
      currentMonth.getUTCMonth() + index - 6,
      1,
    ));
    return date.toISOString().slice(0, 7);
  });
  overviewMonth.min = overviewMonths[0];
  overviewMonth.max = overviewMonths[overviewMonths.length - 1];
  overviewMonth.value = overviewMonths[6];

  const publicImageUrl = (path: string) => (
    supabase.storage.from("room-images").getPublicUrl(path).data.publicUrl
  );

  const renderRooms = (overview?: Overview) => {
    const overviewById = new Map(overview?.rooms.map((room) => [room.id, room]));
    adminRoomsGrid.innerHTML = rooms.length
      ? rooms.map((room) => {
        const capacity = overviewById.get(room.id);
        const previewImages = [...room.room_images]
          .sort((left, right) => left.display_order - right.display_order || left.id - right.id)
          .slice(0, 3);
        return `
          <article class="admin-suite-card ${room.is_active ? "" : "admin-suite-inactive"}" data-room-id="${room.id}">
            <div class="admin-suite-card-body">
              <div class="admin-suite-heading">
                <div>
                  <h4>${escapeHtml(room.name)}</h4>
                  <p>$${Number(room.nightly_rate).toLocaleString()} / night</p>
                </div>
                <span class="admin-suite-state">${room.is_active ? "Active" : "Inactive"}</span>
              </div>
              <div class="admin-suite-units"><span>Total Units</span><strong>${room.total_units}</strong></div>
              <div class="admin-suite-availability"><span><i aria-hidden="true"></i>Available</span><strong>${capacity ? String(capacity.availableUnits).padStart(2, "0") : "—"}</strong></div>
              <div class="admin-suite-actions">
                <button class="edit-room" data-room-id="${room.id}">Edit</button>
                <button class="toggle-room" data-room-id="${room.id}">${room.is_active ? "Deactivate" : "Activate"}</button>
                <label>Upload image<input class="room-image-upload hidden" data-room-id="${room.id}" type="file" accept="image/jpeg,image/png,image/webp"></label>
              </div>
              ${previewImages.length ? `
                <div class="admin-suite-images" aria-label="${escapeHtml(room.name)} images">
                  ${previewImages.map((image) => `
                    <div>
                      <img src="${escapeHtml(publicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || room.name)}">
                      <button class="delete-room-image" data-image-id="${image.id}" aria-label="Delete ${escapeHtml(image.alt_text || room.name)} image">×</button>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          </article>
        `;
      }).join("")
      : '<p class="md:col-span-3 text-center text-on-surface-variant">No room types have been created.</p>';
  };

  const loadRooms = async () => {
    const payload = await requestJson<{ rooms: AdminRoom[] }>("/api/admin/rooms", {
      signal: controller.signal,
    });
    rooms = payload.rooms;
    renderRooms();
  };

  const loadOverview = async () => {
    const payload = await requestJson<Overview>(
      `/api/admin/overview?month=${encodeURIComponent(overviewMonth.value)}`,
      { signal: controller.signal },
    );
    const currency = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: payload.currency,
      maximumFractionDigits: 0,
    });
    const totalEarnings = document.getElementById("totalEarnings");
    const monthlyEarningsHeading = document.getElementById("monthlyEarningsHeading");
    const todayEarnings = document.getElementById("todayEarnings");
    const earningsTrend = document.getElementById("earningsTrend");
    const earningsTrendIcon = document.getElementById("earningsTrendIcon");
    const earningsTrendText = document.getElementById("earningsTrendText");
    const roomCapacity = document.getElementById("roomCapacity");
    const roomCapacityText = document.getElementById("roomCapacityText");
    const bookingCapacity = document.getElementById("bookingCapacity");
    const bookingCapacityText = document.getElementById("bookingCapacityText");
    if (totalEarnings) totalEarnings.textContent = currency.format(payload.monthlyEarnings);
    if (monthlyEarningsHeading) {
      monthlyEarningsHeading.textContent = `${monthFormatter.format(new Date(`${payload.month}-01T00:00:00Z`))} Earnings`;
    }
    if (todayEarnings) todayEarnings.textContent = currency.format(payload.todayEarnings);
    if (earningsTrend && earningsTrendIcon && earningsTrendText) {
      const change = payload.earningsChangePercent;
      const isNew = change === null && payload.monthlyEarnings > 0;
      const isUp = isNew || (change !== null && change > 0);
      const isDown = change !== null && change < 0;
      earningsTrend.classList.remove("text-green-600", "text-red-600", "text-on-surface-variant/60");
      earningsTrend.classList.add(isUp ? "text-green-600" : isDown ? "text-red-600" : "text-on-surface-variant/60");
      earningsTrendIcon.textContent = isUp ? "arrow_upward" : isDown ? "arrow_downward" : "trending_flat";
      earningsTrendText.textContent = `${Math.abs(change ?? (isNew ? 100 : 0))}%`;
    }
    if (roomCapacity) roomCapacity.textContent = String(payload.occupiedUnits);
    if (roomCapacityText) {
      roomCapacityText.textContent = `${payload.occupiedUnits} of ${payload.totalUnits} rooms occupied today`;
    }
    if (bookingCapacity) bookingCapacity.textContent = String(payload.availableUnits);
    if (bookingCapacityText) {
      bookingCapacityText.textContent = `${payload.availableUnits} of ${payload.totalUnits} rooms available today`;
    }
    renderRooms(payload);
  };

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const loadBookings = async () => {
    const query = new URLSearchParams({
      search: bookingSearch.value.trim(),
      status: bookingStatusFilter.value,
    });
    const payload = await requestJson<{ bookings: AdminBooking[] }>(
      `/api/admin/bookings?${query.toString()}`,
      { signal: controller.signal },
    );

    const displayedBookings = bookingSearch.value.trim() || bookingStatusFilter.value
      ? payload.bookings
      : payload.bookings.slice(0, 5);
    if (recentBookingsCount) recentBookingsCount.textContent = String(displayedBookings.length);
    bookingsBody.innerHTML = displayedBookings.length
      ? displayedBookings.map((booking) => {
        const nights = Math.round(
          (Date.parse(`${booking.departure_date}T00:00:00Z`)
            - Date.parse(`${booking.arrival_date}T00:00:00Z`)) / 86_400_000,
        );
        const money = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: booking.currency,
          maximumFractionDigits: 0,
        });
        const confirmedTimeline = booking.confirmed_at
          ? `Confirmed ${dateTimeFormatter.format(new Date(booking.confirmed_at))}`
          : "Not yet confirmed";
        return `
          <tr data-id="${booking.id}" data-confirmation="${escapeHtml(booking.confirmation_code)}">
            <td><strong>${escapeHtml(`${booking.guest_first_name} ${booking.guest_last_name}`)}</strong><span>${escapeHtml(booking.guest_email)}</span><span>${escapeHtml(booking.guest_phone)}</span></td>
            <td><strong>${escapeHtml(booking.room_types?.name || "Unknown room")}</strong><span>${booking.room_count} room${booking.room_count === 1 ? "" : "s"} · ${escapeHtml(booking.confirmation_code)}</span></td>
            <td><strong>${dateFormatter.format(new Date(`${booking.arrival_date}T00:00:00Z`))} – ${dateFormatter.format(new Date(`${booking.departure_date}T00:00:00Z`))}</strong><span>${nights} night${nights === 1 ? "" : "s"}</span></td>
            <td><strong>${money.format(Number(booking.total_amount))}</strong><span>${money.format(Number(booking.nightly_rate))} per night</span></td>
            <td>
              <select class="booking-status" data-status="${escapeHtml(booking.status)}" aria-label="Status for ${escapeHtml(booking.confirmation_code)}">
                ${["pending", "confirmed", "rejected", "cancelled", "completed"].map((status) => `<option value="${status}"${booking.status === status ? " selected" : ""}>${status[0].toUpperCase()}${status.slice(1)}</option>`).join("")}
              </select>
            </td>
            <td><strong>Booked ${dateTimeFormatter.format(new Date(booking.created_at))}</strong><span>${confirmedTimeline}</span></td>
            <td><div class="admin-booking-actions"><a class="admin-booking-view" href="/admin-bookings?booking=${booking.id}">View details</a><button class="delete-booking" type="button" aria-label="Permanently delete booking ${escapeHtml(booking.confirmation_code)}">Delete</button></div></td>
          </tr>
        `;
      }).join("")
      : '<tr><td colspan="7" class="admin-booking-empty">No bookings match these filters.</td></tr>';
  };

  cleanups.push(listen(cancelRoomEdit, "click", resetRoomForm));

  cleanups.push(listen(roomForm, "submit", async (event) => {
    event.preventDefault();
    const roomId = roomForm.dataset.roomId;
    if (!roomId) return;
    if (!roomForm.reportValidity()) return;
    roomFormSubmit.disabled = true;
    roomFormMessage.textContent = "Saving room…";
    roomFormMessage.classList.remove("hidden", "text-error");

    const formData = new FormData(roomForm);
    const body = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      nightlyRate: formData.get("nightlyRate"),
      totalUnits: formData.get("totalUnits"),
      beds: formData.get("beds"),
      bathrooms: formData.get("bathrooms"),
      displayOrder: Number(formData.get("displayOrder") || 0),
      isActive: true,
    };

    try {
      await requestJson(`/api/admin/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      resetRoomForm();
      await Promise.all([loadRooms(), loadOverview()]);
    } catch (error) {
      roomFormMessage.textContent = (error as Error).message;
      roomFormMessage.classList.remove("hidden");
      roomFormMessage.classList.add("text-error");
    } finally {
      roomFormSubmit.disabled = false;
    }
  }));

  cleanups.push(listen(adminRoomsGrid, "click", async (event) => {
    const target = event.target as HTMLElement;
    const editButton = target.closest<HTMLButtonElement>(".edit-room");
    if (editButton) {
      const room = rooms.find((item) => item.id === Number(editButton.dataset.roomId));
      if (!room) return;
      roomForm.dataset.roomId = String(room.id);
      setFormValue(roomForm, "name", room.name);
      setFormValue(roomForm, "slug", room.slug);
      setFormValue(roomForm, "description", room.description);
      setFormValue(roomForm, "nightlyRate", room.nightly_rate);
      setFormValue(roomForm, "totalUnits", room.total_units);
      setFormValue(roomForm, "beds", room.beds);
      setFormValue(roomForm, "bathrooms", room.bathrooms);
      setFormValue(roomForm, "displayOrder", room.display_order);
      roomFormHeading.textContent = `Edit ${room.name}`;
      roomFormSubmit.textContent = "Save changes";
      roomManagement.classList.remove("hidden");
      cancelRoomEdit.classList.remove("hidden");
      roomForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const toggleButton = target.closest<HTMLButtonElement>(".toggle-room");
    if (toggleButton) {
      const room = rooms.find((item) => item.id === Number(toggleButton.dataset.roomId));
      if (!room) return;
      try {
        await requestJson(`/api/admin/rooms/${room.id}`, {
          method: "PATCH",
          body: JSON.stringify(room.is_active ? { deactivate: true } : { activate: true }),
        });
        await Promise.all([loadRooms(), loadOverview()]);
      } catch (error) {
        window.alert((error as Error).message);
      }
      return;
    }

    const deleteImageButton = target.closest<HTMLButtonElement>(".delete-room-image");
    if (deleteImageButton && window.confirm("Permanently delete this room image?")) {
      try {
        await requestJson(`/api/admin/room-images/${deleteImageButton.dataset.imageId}`, {
          method: "DELETE",
        });
        await loadRooms();
      } catch (error) {
        window.alert((error as Error).message);
      }
    }
  }));

  cleanups.push(listen(adminRoomsGrid, "change", async (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches(".room-image-upload") || !input.files?.[0]) return;
    const formData = new FormData();
    formData.set("file", input.files[0]);
    formData.set("altText", input.files[0].name);
    input.disabled = true;
    try {
      await requestJson(`/api/admin/rooms/${input.dataset.roomId}/images`, {
        method: "POST",
        body: formData,
      });
      await loadRooms();
    } catch (error) {
      window.alert((error as Error).message);
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }));

  cleanups.push(listen(bookingsBody, "change", async (event) => {
    const select = event.target as HTMLSelectElement;
    if (!select.matches(".booking-status")) return;
    const row = select.closest<HTMLTableRowElement>("tr");
    if (!row?.dataset.id) return;
    select.disabled = true;
    try {
      await requestJson(`/api/admin/bookings/${row.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value }),
      });
      await Promise.all([loadBookings(), loadOverview()]);
    } catch (error) {
      window.alert((error as Error).message);
      await loadBookings();
    }
  }));

  cleanups.push(listen(bookingsBody, "click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".delete-booking");
    if (!button) return;
    event.preventDefault();
    const row = button.closest<HTMLTableRowElement>("tr");
    if (!row?.dataset.id || !row.dataset.confirmation) return;
    const confirmationCode = row.dataset.confirmation;
    const confirmed = await confirmBookingDeletion(confirmationCode);
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting…";
    try {
      await requestJson(`/api/admin/bookings/${row.dataset.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmationCode }),
      });
      await Promise.all([loadBookings(), loadOverview()]);
    } catch (error) {
      window.alert((error as Error).message);
      button.disabled = false;
      button.textContent = "Delete";
    }
  }));

  cleanups.push(listen(bookingSearch, "input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void loadBookings().catch((error) => window.alert((error as Error).message));
    }, 250);
  }));
  cleanups.push(listen(bookingStatusFilter, "change", () => {
    void loadBookings().catch((error) => window.alert((error as Error).message));
  }));
  cleanups.push(() => window.clearTimeout(searchTimer));
  cleanups.push(listen(overviewMonth, "change", () => {
    void loadOverview().catch((error) => window.alert((error as Error).message));
  }));

  void Promise.all([loadRooms(), loadBookings()])
    .then(() => loadOverview())
    .then(revealDashboard)
    .catch((error) => {
      if ((error as Error).name !== "AbortError") {
        dashboardLoader.classList.add("admin-dashboard-loader-error");
        dashboardLoaderText.textContent = `The dashboard could not be loaded. ${(error as Error).message} Refresh the page to try again.`;
      }
    });

  return cleanups;
}
