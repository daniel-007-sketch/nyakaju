import type { LegacyPageId } from "@/lib/legacy";
import { setupSupabaseAdminDashboard } from "@/lib/admin-dashboard";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

type Cleanup = () => void;

type PublicRoomImage = {
  id: number;
  path: string;
  alt: string;
  isPrimary: boolean;
  displayOrder: number;
  url: string;
};

type PublicRoom = {
  id: number;
  slug: string;
  name: string;
  description: string;
  nightlyRate: number;
  currency: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  beds: number;
  bathrooms: number;
  displayOrder: number;
  images: PublicRoomImage[];
};

const MAX_GUESTS_PER_ROOM = 2;

function readGuestCount(params: URLSearchParams, name: "adults" | "children", fallback: number) {
  const value = Number.parseInt(params.get(name) ?? "", 10);
  const minimum = name === "adults" ? 1 : 0;
  return Number.isInteger(value) && value >= minimum && value <= 8 ? value : fallback;
}

function guestSummary(adults: number, children: number) {
  const adultsLabel = `${adults} Adult${adults === 1 ? "" : "s"}`;
  const childrenLabel = `${children} Child${children === 1 ? "" : "ren"}`;
  return `${adultsLabel}, ${childrenLabel}`;
}

function requiredRoomsFor(adults: number, children: number) {
  return Math.max(1, Math.ceil((adults + children) / MAX_GUESTS_PER_ROOM));
}

function escapeHtml(value: unknown) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
  };

  if (!response.ok) {
    if (response.status === 401 && window.location.pathname === "/admin-dashboard") {
      window.location.replace("/admin-login");
    }
    throw new Error(payload.error || "The request could not be completed.");
  }

  return payload as T;
}

function roomImage(room: PublicRoom) {
  return room.images.find((image) => image.isPrimary)?.url
    ?? room.images[0]?.url
    ?? "/media/room_images/delux_bed-1280.webp";
}

function bookingHref(
  room: PublicRoom,
  arrival?: string | null,
  departure?: string | null,
  adults = 1,
  children = 0,
  rooms = requiredRoomsFor(adults, children),
) {
  const params = new URLSearchParams({
    room: room.slug,
    adults: String(adults),
    children: String(children),
    rooms: String(rooms),
  });
  if (arrival && departure) {
    params.set("arrival", arrival);
    params.set("departure", departure);
  }
  return `/complete-booking?${params.toString()}`;
}

function renderHomepageRooms(rooms: PublicRoom[]): Cleanup[] {
  const container = document.getElementById("homepageRoomsGrid");
  if (!container) return [];

  if (!rooms.length) {
    container.innerHTML = '<p class="py-20 text-center text-on-surface-variant">No rooms are currently available.</p>';
    return [];
  }

  let roomIndex = 0;
  let imageIndex = 0;

  const render = () => {
    const room = rooms[roomIndex];
    const images = room.images.length
      ? room.images
      : [{
        id: 0,
        path: "",
        alt: room.name,
        isPrimary: true,
        displayOrder: 0,
        url: roomImage(room),
      }];
    const image = images[imageIndex] ?? images[0];
    const hasMultipleImages = images.length > 1;
    const availabilityClass = room.availableUnits > 0 ? "text-green-700" : "text-error";
    const availabilityLabel = room.availableUnits > 0
      ? `${room.availableUnits} of ${room.totalUnits} available`
      : "Currently unavailable";
    const price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: room.currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(room.nightlyRate));

    container.innerHTML = `
      <article class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div class="order-2 lg:order-1 lg:col-span-5 lg:pr-4">
          <div class="flex flex-wrap items-center gap-4 mb-8">
            <h3 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">${escapeHtml(room.name)}</h3>
            <span class="rounded-full bg-primary px-4 py-2 font-label-lg text-label-lg uppercase tracking-[0.14em] text-on-primary"><strong>${escapeHtml(price)}</strong>/night</span>
          </div>
          <p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-10">${escapeHtml(room.description)}</p>
          <div class="flex flex-wrap gap-7 mb-7 font-label-lg text-label-lg uppercase tracking-[0.1em] text-primary">
            <span class="flex items-center gap-2"><span class="material-symbols-outlined" aria-hidden="true">king_bed</span>${room.beds} Bed${room.beds === 1 ? "" : "s"}</span>
            <span class="flex items-center gap-2"><span class="material-symbols-outlined" aria-hidden="true">bathtub</span>${room.bathrooms} Bathroom${room.bathrooms === 1 ? "" : "s"}</span>
          </div>
          <p class="font-body-md text-body-md ${availabilityClass} mb-10">${escapeHtml(availabilityLabel)}</p>
          <div class="flex flex-wrap gap-4">
            ${room.availableUnits > 0 ? `<a href="${bookingHref(room)}" class="inline-flex items-center justify-center rounded-full bg-black px-7 py-4 font-label-lg text-label-lg uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary">Book room</a>` : ""}
          </div>
        </div>
        <div class="order-1 lg:order-2 lg:col-span-7">
          <div class="relative h-[320px] sm:h-[420px] lg:h-[560px] overflow-hidden rounded-xl bg-surface-container custom-shadow">
            <img class="h-full w-full object-cover" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt || room.name)}" width="1280" height="853" loading="${roomIndex === 0 ? "eager" : "lazy"}" decoding="async">
            ${hasMultipleImages ? `
              <button type="button" data-home-room-action="previous-image" class="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-white" aria-label="Previous ${escapeHtml(room.name)} image">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              </button>
              <button type="button" data-home-room-action="next-image" class="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-white" aria-label="Next ${escapeHtml(room.name)} image">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              </button>
              <span class="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1.5 font-label-sm text-label-sm text-white backdrop-blur-sm">${imageIndex + 1} / ${images.length}</span>
            ` : ""}
          </div>
        </div>
      </article>
      <div class="mt-14 flex flex-col gap-6 border-t border-surface-variant pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex w-full max-w-xl items-center gap-2" role="group" aria-label="Choose a room package">
          ${rooms.map((item, index) => `
            <button type="button" data-home-room-index="${index}" class="group flex-1 py-3" aria-label="View ${escapeHtml(item.name)}" aria-current="${index === roomIndex ? "true" : "false"}">
              <span class="block h-1.5 rounded-full transition-colors ${index === roomIndex ? "bg-primary" : "bg-surface-variant group-hover:bg-primary/40"}"></span>
            </button>
          `).join("")}
        </div>
        <div class="flex items-center justify-end gap-5">
          <div class="flex gap-3">
            <button type="button" data-home-room-action="previous-room" class="flex h-12 w-12 items-center justify-center rounded-full border border-outline text-on-surface transition-colors hover:border-primary hover:bg-primary hover:text-white" aria-label="Previous room package"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>
            <button type="button" data-home-room-action="next-room" class="flex h-12 w-12 items-center justify-center rounded-full border border-outline bg-on-background text-white transition-colors hover:bg-primary" aria-label="Next room package"><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
          </div>
        </div>
      </div>
    `;
  };

  const clickHandler = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || !container.contains(button)) return;

    const requestedRoomIndex = button.dataset.homeRoomIndex;
    if (requestedRoomIndex !== undefined) {
      roomIndex = Number(requestedRoomIndex);
      imageIndex = 0;
      render();
      return;
    }

    const action = button.dataset.homeRoomAction;
    if (!action) return;
    const imageCount = Math.max(rooms[roomIndex].images.length, 1);
    if (action === "previous-image") imageIndex = (imageIndex - 1 + imageCount) % imageCount;
    if (action === "next-image") imageIndex = (imageIndex + 1) % imageCount;
    if (action === "previous-room") {
      roomIndex = (roomIndex - 1 + rooms.length) % rooms.length;
      imageIndex = 0;
    }
    if (action === "next-room") {
      roomIndex = (roomIndex + 1) % rooms.length;
      imageIndex = 0;
    }
    render();
  };

  render();
  container.addEventListener("click", clickHandler);
  return [() => container.removeEventListener("click", clickHandler)];
}

function addListener<K extends keyof WindowEventMap>(
  target: Window | Document | HTMLElement,
  eventName: K | string,
  listener: EventListenerOrEventListenerObject,
) {
  target.addEventListener(eventName, listener as EventListener);
  return () => target.removeEventListener(eventName, listener as EventListener);
}

type BookingPickerOptions = {
  rootId: string;
  arrivalInput: HTMLInputElement;
  departureInput: HTMLInputElement;
  adultsInput: HTMLSelectElement;
  childrenInput: HTMLSelectElement;
  roomsInput: HTMLSelectElement;
};

const bookingDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const bookingMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function bookingDateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function bookingDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function bookingAddMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function bookingPlural(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function setupBookingPicker(options: BookingPickerOptions): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const root = document.getElementById(options.rootId);
  if (!root) return cleanups;

  const dateTrigger = root.querySelector<HTMLButtonElement>("[aria-controls][id*='DateTrigger']");
  const guestTrigger = root.querySelector<HTMLButtonElement>("[aria-controls][id*='GuestTrigger']");
  const dateSummary = root.querySelector<HTMLElement>("[data-booking-date-summary]");
  const guestSummaryElement = root.querySelector<HTMLElement>("[data-booking-guest-summary]");
  const calendarPanel = root.querySelector<HTMLElement>("[data-booking-calendar-popover]");
  const guestPanel = root.querySelector<HTMLElement>("[data-booking-guest-popover]");

  if (!dateTrigger || !guestTrigger || !dateSummary || !guestSummaryElement || !calendarPanel || !guestPanel) {
    return cleanups;
  }

  const now = new Date();
  const today = bookingDateValue(new Date(now.getTime() - now.getTimezoneOffset() * 60_000));
  const earliestMonth = bookingStartOfMonth(bookingDateFromValue(today));
  let monthCursor = bookingStartOfMonth(
    options.arrivalInput.value ? bookingDateFromValue(options.arrivalInput.value) : bookingDateFromValue(today),
  );
  let hoverDate = "";
  let guestSelectionMade = !root.dataset.bookingGuestPlaceholder || root.dataset.bookingGuestSelected === "true";

  const syncBodyLock = () => {
    const hasOpenPicker = Boolean(document.querySelector(".booking-popover:not(.hidden)"));
    document.body.classList.toggle("booking-picker-open", hasOpenPicker);
  };

  const closePanels = () => {
    calendarPanel.classList.add("hidden");
    guestPanel.classList.add("hidden");
    dateTrigger.setAttribute("aria-expanded", "false");
    guestTrigger.setAttribute("aria-expanded", "false");
    hoverDate = "";
    syncBodyLock();
  };

  const updateSummaries = () => {
    const arrival = options.arrivalInput.value;
    const departure = options.departureInput.value;
    dateSummary.textContent = arrival
      ? `${bookingDateFormatter.format(bookingDateFromValue(arrival))} — ${departure
        ? bookingDateFormatter.format(bookingDateFromValue(departure))
        : "Select check-out"}`
      : root.dataset.bookingDatePlaceholder || "Check-in date — Check-out date";

    const adults = Number.parseInt(options.adultsInput.value, 10) || 1;
    const children = Number.parseInt(options.childrenInput.value, 10) || 0;
    const rooms = Number.parseInt(options.roomsInput.value, 10) || requiredRoomsFor(adults, children);
    guestSummaryElement.textContent = !guestSelectionMade && root.dataset.bookingGuestPlaceholder
      ? root.dataset.bookingGuestPlaceholder
      : [
        bookingPlural(adults, "adult"),
        bookingPlural(children, "child", "children"),
        bookingPlural(rooms, "room"),
      ].join(" · ");
  };

  const calendarMonthMarkup = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const arrival = options.arrivalInput.value;
    const departure = options.departureInput.value;
    const previewEnd = arrival && !departure && hoverDate > arrival ? hoverDate : "";
    const rangeEnd = departure || previewEnd;
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => `<span role="columnheader">${day}</span>`)
      .join("");
    const blanks = Array.from({ length: leadingBlanks }, () => '<span class="booking-calendar__blank" aria-hidden="true"></span>').join("");
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const value = bookingDateValue(new Date(year, monthIndex, day, 12));
      const isDisabled = value < today;
      const classNames = ["booking-calendar__day"];
      if (value === today) classNames.push("is-today");
      if (value === arrival) classNames.push("is-selected-start");
      if (departure && value === departure) classNames.push("is-selected-end");
      if (previewEnd && value === previewEnd) classNames.push("is-preview-end");
      if (rangeEnd && value > arrival && value < rangeEnd) {
        classNames.push(departure ? "is-confirmed-range" : "is-preview-range");
      }
      return `<button type="button" class="${classNames.join(" ")}" data-booking-date="${value}" ${isDisabled ? "disabled" : ""} aria-label="${bookingDateFormatter.format(bookingDateFromValue(value))}" aria-selected="${value === arrival || value === departure}">${day}</button>`;
    }).join("");

    return `
      <section class="booking-calendar__month" aria-label="${bookingMonthFormatter.format(month)}">
        <h4 class="booking-calendar__month-title">${bookingMonthFormatter.format(month)}</h4>
        <div class="booking-calendar__weekdays" role="row">${weekdays}</div>
        <div class="booking-calendar__days" role="grid">${blanks}${days}</div>
      </section>
    `;
  };

  const renderCalendar = () => {
    const isAtEarliestMonth = monthCursor.getTime() <= earliestMonth.getTime();
    const isChoosingDeparture = Boolean(options.arrivalInput.value && !options.departureInput.value);
    calendarPanel.innerHTML = `
      <div class="booking-popover__header">
        <h3 class="booking-popover__title">${isChoosingDeparture ? "Choose your check-out date" : "Select dates"}</h3>
        <div class="booking-calendar__nav">
          <button type="button" data-booking-month="previous" aria-label="Show previous month" ${isAtEarliestMonth ? "disabled" : ""}><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
          <button type="button" data-booking-month="next" aria-label="Show next month"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
        </div>
        <button type="button" class="booking-popover__close" data-booking-close aria-label="Close calendar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <div class="booking-calendar__months">
        ${calendarMonthMarkup(monthCursor)}
      </div>
      <p class="booking-calendar__hint">${isChoosingDeparture
        ? "Move across the calendar to preview your stay, then choose a check-out date."
        : "Choose a check-in date, followed by your check-out date."}</p>
    `;
  };

  const selectBounds = (input: HTMLSelectElement, fallbackMin: number, fallbackMax: number) => {
    const values = Array.from(input.options)
      .map((option) => Number.parseInt(option.value, 10))
      .filter(Number.isFinite);
    return {
      min: values.length ? Math.min(...values) : fallbackMin,
      max: values.length ? Math.max(...values) : fallbackMax,
    };
  };

  const countRowMarkup = (kind: "adults" | "children" | "rooms", label: string, input: HTMLSelectElement) => {
    const value = Number.parseInt(input.value, 10) || (kind === "children" ? 0 : 1);
    const fallbackMin = kind === "children" ? 0 : 1;
    const bounds = selectBounds(input, fallbackMin, 8);
    const minimum = kind === "rooms"
      ? Math.max(bounds.min, requiredRoomsFor(
        Number.parseInt(options.adultsInput.value, 10) || 1,
        Number.parseInt(options.childrenInput.value, 10) || 0,
      ))
      : bounds.min;
    const controlsDisabled = kind === "rooms" && input.disabled;
    return `
      <div class="booking-guests__row">
        <span class="booking-guests__label">${label}</span>
        <div class="booking-guests__stepper" role="group" aria-label="${label}">
          <button type="button" data-booking-count="${kind}" data-booking-direction="decrease" aria-label="Decrease ${label.toLowerCase()}" ${controlsDisabled || value <= minimum ? "disabled" : ""}>−</button>
          <span class="booking-guests__value" aria-live="polite">${value}</span>
          <button type="button" data-booking-count="${kind}" data-booking-direction="increase" aria-label="Increase ${label.toLowerCase()}" ${controlsDisabled || value >= bounds.max ? "disabled" : ""}>＋</button>
        </div>
      </div>
    `;
  };

  const renderGuests = () => {
    guestPanel.innerHTML = `
      <div class="booking-popover__header">
        <h3 class="booking-popover__title">Select occupancy</h3>
        <button type="button" class="booking-popover__close" data-booking-close aria-label="Close occupancy selector"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <div class="booking-guests__rows">
        ${countRowMarkup("adults", "Adults", options.adultsInput)}
        ${countRowMarkup("children", "Children", options.childrenInput)}
        ${countRowMarkup("rooms", "Rooms", options.roomsInput)}
      </div>
      <div class="booking-guests__actions">
        <button type="button" class="booking-guests__confirm" data-booking-guest-confirm>Confirm</button>
      </div>
    `;
  };

  const dispatchFieldChange = (input: HTMLInputElement | HTMLSelectElement) => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const setDateValue = (input: HTMLInputElement, value: string) => {
    if (input.value === value) return;
    input.value = value;
    dispatchFieldChange(input);
  };

  const selectDate = (value: string) => {
    const arrival = options.arrivalInput.value;
    const departure = options.departureInput.value;
    let staySelectionComplete = false;
    if (!arrival || departure) {
      setDateValue(options.departureInput, "");
      setDateValue(options.arrivalInput, value);
      hoverDate = "";
    } else if (value <= arrival) {
      setDateValue(options.departureInput, "");
      setDateValue(options.arrivalInput, value);
      hoverDate = "";
    } else {
      setDateValue(options.departureInput, value);
      hoverDate = "";
      staySelectionComplete = true;
    }
    updateSummaries();
    renderCalendar();
    if (staySelectionComplete) {
      closePanels();
      dateTrigger.focus();
    }
  };

  const openCalendar = () => {
    guestPanel.classList.add("hidden");
    guestTrigger.setAttribute("aria-expanded", "false");
    renderCalendar();
    calendarPanel.classList.remove("hidden");
    dateTrigger.setAttribute("aria-expanded", "true");
    syncBodyLock();
  };

  const openGuests = () => {
    calendarPanel.classList.add("hidden");
    dateTrigger.setAttribute("aria-expanded", "false");
    renderGuests();
    guestPanel.classList.remove("hidden");
    guestTrigger.setAttribute("aria-expanded", "true");
    syncBodyLock();
  };

  const pickerClickHandler = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-booking-guest-confirm]")) {
      guestSelectionMade = true;
      updateSummaries();
      closePanels();
      guestTrigger.focus();
      return;
    }

    if (target.closest("[data-booking-close]")) {
      closePanels();
      return;
    }

    const monthButton = target.closest<HTMLButtonElement>("[data-booking-month]");
    if (monthButton && !monthButton.disabled) {
      monthCursor = bookingAddMonths(monthCursor, monthButton.dataset.bookingMonth === "previous" ? -1 : 1);
      renderCalendar();
      return;
    }

    const dateButton = target.closest<HTMLButtonElement>("[data-booking-date]");
    if (dateButton?.dataset.bookingDate && !dateButton.disabled) {
      selectDate(dateButton.dataset.bookingDate);
      return;
    }

    const countButton = target.closest<HTMLButtonElement>("[data-booking-count]");
    if (!countButton || countButton.disabled) return;
    guestSelectionMade = true;
    const kind = countButton.dataset.bookingCount as "adults" | "children" | "rooms";
    const input = kind === "adults"
      ? options.adultsInput
      : kind === "children"
        ? options.childrenInput
        : options.roomsInput;
    const current = Number.parseInt(input.value, 10) || (kind === "children" ? 0 : 1);
    const bounds = selectBounds(input, kind === "children" ? 0 : 1, 8);
    const minimum = kind === "rooms"
      ? Math.max(bounds.min, requiredRoomsFor(
        Number.parseInt(options.adultsInput.value, 10) || 1,
        Number.parseInt(options.childrenInput.value, 10) || 0,
      ))
      : bounds.min;
    const next = Math.max(minimum, Math.min(bounds.max, current + (countButton.dataset.bookingDirection === "decrease" ? -1 : 1)));
    if (next !== current) {
      input.value = String(next);
      dispatchFieldChange(input);
    }

    if (kind !== "rooms") {
      const requiredRooms = requiredRoomsFor(
        Number.parseInt(options.adultsInput.value, 10) || 1,
        Number.parseInt(options.childrenInput.value, 10) || 0,
      );
      const roomBounds = selectBounds(options.roomsInput, 1, 8);
      const currentRooms = Number.parseInt(options.roomsInput.value, 10) || 1;
      if (currentRooms < requiredRooms && requiredRooms <= roomBounds.max) {
        options.roomsInput.value = String(requiredRooms);
        dispatchFieldChange(options.roomsInput);
      }
    }

    updateSummaries();
    renderGuests();
  };

  const hoverHandler = (event: Event) => {
    if (!options.arrivalInput.value || options.departureInput.value) return;
    const dateButton = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-booking-date]");
    const value = dateButton?.dataset.bookingDate || "";
    const nextHoverDate = value > options.arrivalInput.value ? value : "";
    if (nextHoverDate !== hoverDate) {
      hoverDate = nextHoverDate;
      calendarPanel.querySelectorAll<HTMLButtonElement>("[data-booking-date]").forEach((button) => {
        const buttonDate = button.dataset.bookingDate || "";
        button.classList.toggle(
          "is-preview-range",
          Boolean(hoverDate && buttonDate > options.arrivalInput.value && buttonDate < hoverDate),
        );
        button.classList.toggle("is-preview-end", Boolean(hoverDate && buttonDate === hoverDate));
      });
    }
  };

  const clearHover = () => {
    if (!hoverDate) return;
    hoverDate = "";
    calendarPanel.querySelectorAll(".is-preview-range, .is-preview-end").forEach((element) => {
      element.classList.remove("is-preview-range", "is-preview-end");
    });
  };

  const documentClickHandler = (event: Event) => {
    if (!event.composedPath().includes(root)) closePanels();
  };

  const documentKeyHandler = (event: Event) => {
    if ((event as KeyboardEvent).key === "Escape") closePanels();
  };

  const externalChangeHandler = () => {
    updateSummaries();
    if (!calendarPanel.classList.contains("hidden")) renderCalendar();
    if (!guestPanel.classList.contains("hidden")) renderGuests();
  };

  cleanups.push(addListener(dateTrigger, "click", () => {
    if (calendarPanel.classList.contains("hidden")) openCalendar();
    else closePanels();
  }));
  cleanups.push(addListener(guestTrigger, "click", () => {
    if (guestPanel.classList.contains("hidden")) openGuests();
    else closePanels();
  }));
  cleanups.push(addListener(root, "click", pickerClickHandler));
  cleanups.push(addListener(calendarPanel, "pointerover", hoverHandler));
  cleanups.push(addListener(calendarPanel, "pointerleave", clearHover));
  cleanups.push(addListener(document, "click", documentClickHandler));
  cleanups.push(addListener(document, "keydown", documentKeyHandler));
  [options.arrivalInput, options.departureInput, options.adultsInput, options.childrenInput, options.roomsInput]
    .forEach((input) => cleanups.push(addListener(input, "change", externalChangeHandler)));

  const roomOptionsObserver = new MutationObserver(externalChangeHandler);
  roomOptionsObserver.observe(options.roomsInput, { attributes: true, childList: true, subtree: true });
  cleanups.push(() => roomOptionsObserver.disconnect());
  cleanups.push(() => {
    closePanels();
    if (!document.querySelector(".booking-popover:not(.hidden)")) document.body.classList.remove("booking-picker-open");
  });

  updateSummaries();
  return cleanups;
}

function setupMobileNavigation(): Cleanup[] {
  const toggle = document.querySelector<HTMLButtonElement>("[data-mobile-menu-toggle]");
  const menu = document.querySelector<HTMLElement>("[data-mobile-menu]");
  const icon = toggle?.querySelector<HTMLElement>("[data-mobile-menu-icon]");

  if (!toggle || !menu) {
    return [];
  }

  const setOpen = (isOpen: boolean) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    menu.classList.toggle("hidden", !isOpen);
    if (icon) {
      icon.textContent = isOpen ? "close" : "menu";
    }
  };

  const toggleMenu = () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  };
  const closeFromLink = (event: Event) => {
    if ((event.target as HTMLElement).closest("a")) {
      setOpen(false);
    }
  };
  const closeFromOutside = (event: Event) => {
    const target = event.target as Node;
    if (toggle.getAttribute("aria-expanded") === "true" && !toggle.contains(target) && !menu.contains(target)) {
      setOpen(false);
    }
  };
  const closeFromKeyboard = (event: Event) => {
    if ((event as KeyboardEvent).key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  };
  const closeAtDesktopWidth = () => {
    if (window.innerWidth >= 768) {
      setOpen(false);
    }
  };

  setOpen(false);

  return [
    addListener(toggle, "click", toggleMenu),
    addListener(menu, "click", closeFromLink),
    addListener(document, "click", closeFromOutside),
    addListener(document, "keydown", closeFromKeyboard),
    addListener(window, "resize", closeAtDesktopWidth),
  ];
}

function observeReveals() {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

  if (!revealItems.length) {
    return () => undefined;
  }

  document.documentElement.classList.add("reveal-enhanced");

  if (typeof IntersectionObserver === "undefined") {
    revealItems.forEach((item) => item.classList.add("reveal-visible"));
    return () => document.documentElement.classList.remove("reveal-enhanced");
  }

  const observer = new IntersectionObserver((entries, observerInstance) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal-visible");
        observerInstance.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: "0px 0px -10% 0px",
  });

  revealItems.forEach((item) => {
    const delay = item.getAttribute("data-reveal-delay");
    if (delay) {
      item.style.setProperty("--reveal-delay", delay);
    }
    observer.observe(item);
  });

  // Never leave content invisible if an injected legacy page misses an
  // IntersectionObserver notification during hydration.
  const revealFallbackId = window.setTimeout(() => {
    revealItems.forEach((item) => item.classList.add("reveal-visible"));
  }, 1200);

  return () => {
    window.clearTimeout(revealFallbackId);
    observer.disconnect();
    document.documentElement.classList.remove("reveal-enhanced");
  };
}

function setupIndexPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const roomsController = new AbortController();
  cleanups.push(() => roomsController.abort());

  void fetchJson<{ rooms: PublicRoom[] }>("/api/rooms", {
    signal: roomsController.signal,
  })
    .then(({ rooms }) => cleanups.push(...renderHomepageRooms(rooms)))
    .catch((error) => {
      if ((error as Error).name !== "AbortError") {
        console.error("Homepage rooms failed to load", error);
      }
    });

  const slides = Array.from(document.querySelectorAll<HTMLElement>(".slideshow-container > div"));
  if (slides.length > 0) {
    let currentSlide = 0;
    let transitionInProgress = false;
    let cancelIdlePreload = () => {};

    const hydrateSlide = async (slide: HTMLElement | undefined) => {
      const image = slide?.querySelector<HTMLImageElement>("img[data-src]");
      if (!image) return;

      image.sizes = image.dataset.sizes || "100vw";
      image.srcset = image.dataset.srcset || "";
      image.src = image.dataset.src || "";
      image.removeAttribute("data-src");
      image.removeAttribute("data-srcset");
      image.removeAttribute("data-sizes");

      try {
        await image.decode();
      } catch {
        await new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
    };

    const preloadFollowingSlide = () => hydrateSlide(slides[(currentSlide + 1) % slides.length]);
    const nextSlide = async () => {
      if (transitionInProgress) return;
      transitionInProgress = true;
      const nextIndex = (currentSlide + 1) % slides.length;
      await hydrateSlide(slides[nextIndex]);
      slides[currentSlide]?.classList.remove("active");
      currentSlide = nextIndex;
      slides[currentSlide]?.classList.add("active");
      transitionInProgress = false;
      void preloadFollowingSlide();
    };

    if ("requestIdleCallback" in window) {
      const idlePreloadId = window.requestIdleCallback(() => {
        void preloadFollowingSlide();
      }, { timeout: 2000 });
      cancelIdlePreload = () => window.cancelIdleCallback(idlePreloadId);
    } else {
      const idlePreloadId = setTimeout(() => {
        void preloadFollowingSlide();
      }, 1000);
      cancelIdlePreload = () => clearTimeout(idlePreloadId);
    }

    const intervalId = window.setInterval(() => void nextSlide(), 5000);
    cleanups.push(() => {
      window.clearInterval(intervalId);
      cancelIdlePreload();
    });
  }

  const arrivalDateInput = document.getElementById("arrival-date") as HTMLInputElement | null;
  const departureDateInput = document.getElementById("departure-date") as HTMLInputElement | null;
  const adultsCountInput = document.getElementById("adults-count") as HTMLSelectElement | null;
  const childrenCountInput = document.getElementById("children-count") as HTMLSelectElement | null;
  const roomsCountInput = document.getElementById("rooms-count") as HTMLSelectElement | null;
  const checkAvailabilityBtn = document.getElementById("check-availability-btn") as HTMLAnchorElement | null;

  if (arrivalDateInput && departureDateInput) {
    const syncDateFieldDisplay = (input: HTMLInputElement) => {
      input.closest(".date-input-shell")?.classList.toggle("date-input-has-value", Boolean(input.value));
    };

    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];

    arrivalDateInput.min = today;
    if (arrivalDateInput.value && arrivalDateInput.value < today) {
      arrivalDateInput.value = today;
    }

    departureDateInput.min = arrivalDateInput.value || today;
    if (departureDateInput.value && departureDateInput.value < departureDateInput.min) {
      departureDateInput.value = departureDateInput.min;
    }

    syncDateFieldDisplay(arrivalDateInput);
    syncDateFieldDisplay(departureDateInput);

    const syncArrival = () => {
      departureDateInput.min = arrivalDateInput.value;
      if (departureDateInput.value && departureDateInput.value < arrivalDateInput.value) {
        departureDateInput.value = arrivalDateInput.value;
      }
      syncDateFieldDisplay(arrivalDateInput);
      syncDateFieldDisplay(departureDateInput);
    };

    const syncDeparture = () => {
      arrivalDateInput.max = departureDateInput.value;
      if (arrivalDateInput.value && arrivalDateInput.value > departureDateInput.value) {
        arrivalDateInput.value = departureDateInput.value;
      }
      syncDateFieldDisplay(arrivalDateInput);
      syncDateFieldDisplay(departureDateInput);
    };

    cleanups.push(addListener(arrivalDateInput, "input", () => syncDateFieldDisplay(arrivalDateInput)));
    cleanups.push(addListener(departureDateInput, "input", () => syncDateFieldDisplay(departureDateInput)));
    cleanups.push(addListener(arrivalDateInput, "change", syncArrival));
    cleanups.push(addListener(departureDateInput, "change", syncDeparture));

    if (checkAvailabilityBtn) {
      const clickHandler = (event: Event) => {
        event.preventDefault();

        if (!arrivalDateInput.value || !departureDateInput.value) {
          window.alert("Please select both arrival and departure dates.");
          return;
        }

        const params = new URLSearchParams({
          arrival: arrivalDateInput.value,
          departure: departureDateInput.value,
          adults: adultsCountInput?.value || "1",
          children: childrenCountInput?.value || "0",
          rooms: roomsCountInput?.value || "1",
        });
        window.location.href = `/rooms?${params.toString()}`;
      };

      cleanups.push(addListener(checkAvailabilityBtn, "click", clickHandler));
    }
  }

  if (arrivalDateInput && departureDateInput && adultsCountInput && childrenCountInput && roomsCountInput) {
    cleanups.push(...setupBookingPicker({
      rootId: "homeBookingPicker",
      arrivalInput: arrivalDateInput,
      departureInput: departureDateInput,
      adultsInput: adultsCountInput,
      childrenInput: childrenCountInput,
      roomsInput: roomsCountInput,
    }));
  }

  const header = document.getElementById("main-header");
  const logo = document.getElementById("header-logo");
  if (header) {
    const scrollHandler = () => {
      if (window.scrollY > 0) {
        header.classList.add("shadow-sm", "nav-scrolled");
        logo?.classList.remove("brightness-0", "invert");
        logo?.classList.add("opacity-100");
      } else {
        header.classList.remove("shadow-sm", "nav-scrolled");
        logo?.classList.add("brightness-0", "invert");
        logo?.classList.remove("opacity-100");
      }
    };

    scrollHandler();
    cleanups.push(addListener(window, "scroll", scrollHandler));
  }

  const heroIds = ["hero-title", "hero-rating", "hero-sub", "hero-desc", "hero-bar"];
  heroIds.forEach((id, index) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      element.classList.remove("opacity-0", "translate-y-10");
      element.classList.add("opacity-100", "translate-y-0");
    }, 500 + index * 200);

    cleanups.push(() => window.clearTimeout(timeoutId));
  });

  return cleanups;
}

function setupAboutPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const header = document.querySelector<HTMLElement>("header");

  if (header) {
    const scrollHandler = () => {
      if (window.scrollY > 50) {
        header.classList.add("shadow-sm");
        header.classList.replace("bg-surface-container-lowest/90", "bg-inverse-on-surface/95");
      } else {
        header.classList.remove("shadow-sm");
        header.classList.replace("bg-inverse-on-surface/95", "bg-surface-container-lowest/90");
      }
    };

    scrollHandler();
    cleanups.push(addListener(window, "scroll", scrollHandler));
  }

  return cleanups;
}

function setupGalleryPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const header = document.getElementById("main-nav");
  const carousel = document.getElementById("galleryCarousel");

  if (header) {
    const scrollHandler = () => {
      if (window.scrollY > 50) {
        header.classList.add("bg-surface/90", "backdrop-blur-md", "shadow-sm");
        header.classList.remove("bg-transparent");
      } else {
        header.classList.remove("bg-surface/90", "backdrop-blur-md", "shadow-sm");
        header.classList.add("bg-transparent");
      }
    };

    scrollHandler();
    cleanups.push(addListener(window, "scroll", scrollHandler));
  }

  if (carousel) {
    const image = carousel.querySelector<HTMLImageElement>("[data-gallery-image]");
    const counter = carousel.querySelector<HTMLElement>("[data-gallery-counter]");
    const slides = [
      { alt: "A serene wide-angle shot of a luxury resort infinity pool seamlessly blending into a calm, glassy lake at dawn.", number: 1 },
      { alt: "A modern resort suite with natural wood accents and warm morning light.", number: 2 },
      { alt: "The resort's main architectural structure glowing warmly at twilight.", number: 3 },
      { alt: "An elegant outdoor dining table for two overlooking a misty valley.", number: 4 },
      { alt: "Natural stone, polished concrete, and warm timber in a resort architectural detail.", number: 5 },
      { alt: "A tranquil spa treatment room with soft light and a view of a Zen garden.", number: 6 },
      { alt: "A secluded stepping-stone path winding through lush tropical gardens.", number: 7 },
      { alt: "A freestanding stone bathtub overlooking a private resort courtyard.", number: 8 },
      { alt: "The landscape surrounding the resort glowing at golden hour.", number: 9 },
    ];
    let activeIndex = 0;

    const showSlide = (nextIndex: number) => {
      activeIndex = (nextIndex + slides.length) % slides.length;
      const slide = slides[activeIndex];
      if (!image) return;

      image.src = `/media/gallery/gallery_${slide.number}-768.webp`;
      image.srcset = [768, 1280, 1920]
        .map((width) => `/media/gallery/gallery_${slide.number}-${width}.webp ${width}w`)
        .join(", ");
      image.alt = slide.alt;
      if (counter) {
        counter.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      }
    };

    const clickHandler = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-gallery-action]");
      if (!button || !carousel.contains(button)) return;
      showSlide(activeIndex + (button.dataset.galleryAction === "previous" ? -1 : 1));
    };

    const keyHandler = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== "ArrowLeft" && keyboardEvent.key !== "ArrowRight") return;
      keyboardEvent.preventDefault();
      showSlide(activeIndex + (keyboardEvent.key === "ArrowLeft" ? -1 : 1));
    };

    cleanups.push(addListener(carousel, "click", clickHandler));
    cleanups.push(addListener(carousel, "keydown", keyHandler));
  }

  return cleanups;
}

function setupContactPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const header = document.querySelector<HTMLElement>("header");

  if (header) {
    const scrollHandler = () => {
      if (window.scrollY > 50) {
        header.classList.add("shadow-[0_10px_40px_rgba(0,0,0,0.04)]");
      } else {
        header.classList.remove("shadow-[0_10px_40px_rgba(0,0,0,0.04)]");
      }
    };

    scrollHandler();
    cleanups.push(addListener(window, "scroll", scrollHandler));
  }

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".contact-input").forEach((input) => {
    const syncFilledState = () => {
      input.classList.toggle("filled", input.value.trim() !== "");
    };

    syncFilledState();
    cleanups.push(addListener(input, "input", syncFilledState));
    cleanups.push(addListener(input, "change", syncFilledState));
    cleanups.push(addListener(input, "blur", syncFilledState));
  });

  return cleanups;
}

function setupRoomsPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const container = document.getElementById("roomsCatalog");
  if (!container) return cleanups;

  const roomGalleries = new Map<number, { images: PublicRoomImage[]; index: number }>();
  const galleryClickHandler = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-room-gallery-action]");
    if (!button || !container.contains(button)) return;

    const roomId = Number(button.dataset.roomId);
    const gallery = roomGalleries.get(roomId);
    if (!gallery || gallery.images.length < 2) return;

    gallery.index = button.dataset.roomGalleryAction === "previous"
      ? (gallery.index - 1 + gallery.images.length) % gallery.images.length
      : (gallery.index + 1) % gallery.images.length;

    const galleryElement = container.querySelector<HTMLElement>(`[data-room-gallery="${roomId}"]`);
    const imageElement = galleryElement?.querySelector<HTMLImageElement>("[data-room-gallery-image]");
    const counterElement = galleryElement?.querySelector<HTMLElement>("[data-room-gallery-counter]");
    const image = gallery.images[gallery.index];
    if (imageElement) {
      imageElement.src = image.url;
      imageElement.alt = image.alt;
    }
    if (counterElement) counterElement.textContent = `${gallery.index + 1} / ${gallery.images.length}`;
  };
  cleanups.push(addListener(container, "click", galleryClickHandler));

  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  const params = new URLSearchParams(window.location.search);
  const arrival = params.get("arrival");
  const departure = params.get("departure");
  const adults = readGuestCount(params, "adults", 1);
  const children = readGuestCount(params, "children", 0);
  const guestCount = adults + children;
  const minimumRooms = requiredRoomsFor(adults, children);
  const requestedRooms = Math.min(8, Math.max(minimumRooms, Number.parseInt(params.get("rooms") ?? "", 10) || minimumRooms));
  const query = arrival && departure
    ? `?${new URLSearchParams({ arrival, departure }).toString()}`
    : "";

  container.innerHTML = `
    <section class="text-center max-w-3xl mx-auto mb-16">
      <h1 class="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg mb-6" style="font-size: clamp(1.9rem, 8.5vw, 4rem)">Accommodations</h1>
      <p class="font-body-lg text-body-lg text-on-surface-variant">Loading live room availability…</p>
    </section>
  `;

  void fetchJson<{ rooms: PublicRoom[]; arrival: string; departure: string }>(
    `/api/rooms${query}`,
    { signal: controller.signal },
  ).then((payload) => {
    const dateSummary = arrival && departure
      ? `Availability for ${escapeHtml(arrival)} to ${escapeHtml(departure)}`
      : "Availability for tonight";
    const roomSections = payload.rooms.map((room, index) => {
      const images = room.images.length
        ? room.images
        : [{
          id: 0,
          url: "/media/room_images/delux_bed-1280.webp",
          alt: room.name,
          isPrimary: true,
          displayOrder: 0,
          path: "",
        }];
      const primary = images.find((image) => image.isPrimary) ?? images[0];
      const galleryImages = [primary, ...images.filter((image) => image.id !== primary.id)];
      roomGalleries.set(room.id, { images: galleryImages, index: 0 });
      const soldOut = room.availableUnits < requestedRooms;
      return `
        <section id="${escapeHtml(room.slug)}-suite" class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center ${index ? "mt-24 border-t border-surface-variant pt-24" : ""}">
          <div class="order-2 lg:order-1 lg:col-span-5 space-y-8">
            <div class="flex items-center gap-3 flex-wrap">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg">${escapeHtml(room.name)}</h2>
              <span class="font-label-lg text-label-lg text-on-primary bg-primary px-3 py-1.5 rounded-full uppercase tracking-[0.16em]"><strong>$${Number(room.nightlyRate).toLocaleString()}</strong>/night</span>
            </div>
            <p class="font-body-lg text-body-lg text-on-surface-variant">${escapeHtml(room.description)}</p>
            <div class="flex flex-wrap gap-6 font-label-lg text-label-lg uppercase tracking-[0.1em] text-primary">
              <span class="flex items-center gap-2"><span class="material-symbols-outlined">bed</span>${room.beds} Bed${room.beds === 1 ? "" : "s"}</span>
              <span class="flex items-center gap-2"><span class="material-symbols-outlined">bathtub</span>${room.bathrooms} Bathroom${room.bathrooms === 1 ? "" : "s"}</span>
            </div>
            <p class="font-label-lg ${soldOut ? "text-error" : "text-green-700"}">${soldOut ? `Only ${room.availableUnits} room${room.availableUnits === 1 ? " is" : "s are"} available; you selected ${requestedRooms}` : `${room.availableUnits} of ${room.totalUnits} available`}</p>
            ${soldOut
              ? '<span class="inline-flex rounded-full px-5 py-3 bg-surface-container text-on-surface-variant">Not enough rooms for this party</span>'
              : `<a href="${bookingHref(room, arrival, departure, adults, children, requestedRooms)}" class="group font-label-sm text-label-sm uppercase tracking-[0.16em] text-on-primary bg-black rounded-full px-5 py-3 hover:bg-primary transition-all flex items-center w-fit">Book ${requestedRooms > 1 ? `${requestedRooms} rooms` : "room"}</a>`}
          </div>
          <div class="order-1 lg:order-2 lg:col-span-7" data-room-gallery="${room.id}">
            <div class="relative h-[320px] sm:h-[460px] lg:h-[560px] w-full overflow-hidden rounded-xl bg-surface-container shadow-sm">
              <img data-room-gallery-image class="h-full w-full object-cover" alt="${escapeHtml(primary.alt)}" src="${escapeHtml(primary.url)}" width="1280" height="853" loading="${index === 0 ? "eager" : "lazy"}" fetchpriority="${index === 0 ? "high" : "low"}" decoding="async">
              ${galleryImages.length > 1 ? `
                <button type="button" data-room-gallery-action="previous" data-room-id="${room.id}" class="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-white" aria-label="Previous ${escapeHtml(room.name)} image">
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <button type="button" data-room-gallery-action="next" data-room-id="${room.id}" class="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-white" aria-label="Next ${escapeHtml(room.name)} image">
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
                <span data-room-gallery-counter class="absolute bottom-4 right-4 rounded-full bg-black/65 px-3 py-1.5 font-label-sm text-label-sm text-white backdrop-blur-sm">1 / ${galleryImages.length}</span>
              ` : ""}
            </div>
          </div>
        </section>
      `;
    }).join("");

    container.innerHTML = `
      <section class="text-center max-w-3xl mx-auto mb-16">
        <h1 class="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg mb-6" style="font-size: clamp(1.9rem, 8.5vw, 4rem)">Accommodations</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant">Discover live rates and capacity directly from Nyakaju.</p>
        <p class="mt-4 font-label-lg text-primary">${dateSummary}</p>
        <p class="mt-2 font-body-md text-on-surface-variant">${escapeHtml(guestSummary(adults, children))}</p>
        ${guestCount > MAX_GUESTS_PER_ROOM ? `
          <div class="mt-6 rounded-xl border border-primary/30 bg-primary-container p-5 text-left text-on-primary-container" role="status">
            <p class="font-semibold">Each room supports a maximum of two people.</p>
            <p class="mt-1">Your party of ${guestCount} requires at least ${minimumRooms} rooms. You selected ${requestedRooms}; this selection will carry into booking.</p>
          </div>
        ` : ""}
      </section>
      ${roomSections || '<p class="text-center text-on-surface-variant">No active rooms are available.</p>'}
    `;

  }).catch((error) => {
    if ((error as Error).name === "AbortError") return;
    container.innerHTML = `
      <section class="text-center py-24">
        <h1 class="font-headline-lg text-primary mb-4">Rooms unavailable</h1>
        <p class="text-on-surface-variant">${escapeHtml((error as Error).message)}</p>
      </section>
    `;
  });

  return cleanups;
}

function setupCompleteBookingPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const arrivalDateInput = document.getElementById("arrivalDate") as HTMLInputElement | null;
  const departureDateInput = document.getElementById("departureDate") as HTMLInputElement | null;
  const bookingRoomName = document.getElementById("bookingRoomName");
  const bookingRoomImage = document.getElementById("bookingRoomImage") as HTMLImageElement | null;
  const bookingNights = document.getElementById("bookingNights");
  const bookingArrival = document.getElementById("bookingArrival");
  const bookingDeparture = document.getElementById("bookingDeparture");
  const bookingRate = document.getElementById("bookingRate");
  const bookingTotal = document.getElementById("bookingTotal");
  const bookingRoomCount = document.getElementById("bookingRoomCount");
  const bookingGuestSummary = document.getElementById("bookingGuestSummary");
  const roomCapacityMessage = document.getElementById("roomCapacityMessage");
  const roomCapacityMessageText = document.getElementById("roomCapacityMessageText");
  const roomCapacityMessageClose = document.getElementById("roomCapacityMessageClose");
  const adultsCountInput = document.getElementById("bookingAdultsCount") as HTMLSelectElement | null;
  const childrenCountInput = document.getElementById("bookingChildrenCount") as HTMLSelectElement | null;
  const roomCountInput = document.getElementById("roomCount") as HTMLSelectElement | null;
  const roomCountHelp = document.getElementById("roomCountHelp");
  const bookingFormMessage = document.getElementById("bookingFormMessage");
  const bookingFormMessageText = document.getElementById("bookingFormMessageText");
  const bookingFormMessageClose = document.getElementById("bookingFormMessageClose");
  const bookingForm = document.getElementById("bookingForm") as HTMLFormElement | null;

  if (!arrivalDateInput || !departureDateInput || !bookingRoomName || !bookingRoomImage || !bookingNights || !bookingArrival || !bookingDeparture || !bookingRate || !bookingTotal || !bookingRoomCount || !bookingGuestSummary || !roomCapacityMessage || !roomCapacityMessageText || !roomCapacityMessageClose || !adultsCountInput || !childrenCountInput || !roomCountInput || !roomCountHelp || !bookingFormMessage || !bookingFormMessageText || !bookingFormMessageClose || !bookingForm) {
    return cleanups;
  }

  const setBookingFeedback = (message: string, tone: "info" | "error" | "success" = "info") => {
    bookingFormMessageText.textContent = message;
    bookingFormMessage.className = `relative mt-4 rounded-lg px-4 py-3 pr-12 text-center font-body-md ${tone === "error"
      ? "bg-error-container text-on-error-container"
      : tone === "success"
        ? "bg-primary-container text-on-primary-container"
        : "bg-surface-container text-on-surface-variant"}`;
  };

  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const searchParams = new URLSearchParams(window.location.search);
  const selectedRoomSlug = searchParams.get("room");
  let adults = readGuestCount(searchParams, "adults", 1);
  let children = readGuestCount(searchParams, "children", 0);
  let minimumRoomCount = requiredRoomsFor(adults, children);
  let preferredRoomCount = Math.max(
    minimumRoomCount,
    Number.parseInt(searchParams.get("rooms") ?? "", 10) || minimumRoomCount,
  );
  let latestAvailableUnits: number | null = null;
  let isCheckingAvailability = false;
  adultsCountInput.value = String(adults);
  childrenCountInput.value = String(children);
  let selectedRoom: PublicRoom | null = null;
  let availabilityController: AbortController | null = null;
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  arrivalDateInput.min = localToday;
  departureDateInput.min = localToday;

  const requestedArrival = searchParams.get("arrival");
  const requestedDeparture = searchParams.get("departure");
  if (
    requestedArrival
    && requestedDeparture
    && requestedArrival >= localToday
    && requestedDeparture > requestedArrival
  ) {
    arrivalDateInput.value = requestedArrival;
    departureDateInput.value = requestedDeparture;
  }

  const syncStayDates = () => {
    const arrivalDate = arrivalDateInput.value;
    const departureDate = departureDateInput.value;

    const stayLengthInMs = arrivalDate && departureDate
      ? Date.UTC(
        Number.parseInt(departureDate.slice(0, 4), 10),
        Number.parseInt(departureDate.slice(5, 7), 10) - 1,
        Number.parseInt(departureDate.slice(8, 10), 10),
      ) - Date.UTC(
        Number.parseInt(arrivalDate.slice(0, 4), 10),
        Number.parseInt(arrivalDate.slice(5, 7), 10) - 1,
        Number.parseInt(arrivalDate.slice(8, 10), 10),
      )
      : 0;

    const nights = arrivalDate && departureDate && stayLengthInMs > 0 ? Math.round(stayLengthInMs / 86400000) : null;

    arrivalDateInput.max = departureDate || "";
    departureDateInput.min = arrivalDate || localToday;

    arrivalDateInput.setCustomValidity("");
    departureDateInput.setCustomValidity("");

    if (arrivalDate && departureDate && departureDate < arrivalDate) {
      const validationMessage = "Departure date cannot be earlier than arrival date.";
      arrivalDateInput.setCustomValidity(validationMessage);
      departureDateInput.setCustomValidity(validationMessage);
    }

    bookingArrival.textContent = arrivalDate ? dateFormatter.format(new Date(`${arrivalDate}T00:00:00`)) : "--";
    bookingDeparture.textContent = departureDate ? dateFormatter.format(new Date(`${departureDate}T00:00:00`)) : "--";
    bookingNights.textContent = nights ? `${nights} Night${nights === 1 ? "" : "s"}` : "--";
    const roomCount = Number.parseInt(roomCountInput.value, 10) || 1;
    bookingRoomCount.textContent = `${roomCount} Room${roomCount === 1 ? "" : "s"}`;
    bookingTotal.textContent = nights && selectedRoom
      ? currencyFormatter.format(selectedRoom.nightlyRate * nights * roomCount)
      : "--";
  };

  const setRoomCountOptions = (availableUnits: number) => {
    latestAvailableUnits = availableUnits;
    const previousValue = Math.max(
      preferredRoomCount,
      Number.parseInt(roomCountInput.value, 10) || minimumRoomCount,
    );
    const maximum = Math.max(0, availableUnits);
    const hasEnoughRooms = maximum >= minimumRoomCount;
    roomCountInput.innerHTML = hasEnoughRooms
      ? Array.from({ length: maximum - minimumRoomCount + 1 }, (_, index) => {
        const count = index + minimumRoomCount;
        return `<option value="${count}">${count}</option>`;
      }).join("")
      : '<option value="">Not enough rooms available</option>';
    roomCountInput.disabled = !hasEnoughRooms;
    if (hasEnoughRooms) {
      roomCountInput.value = String(Math.max(minimumRoomCount, Math.min(previousValue, maximum)));
      preferredRoomCount = Number.parseInt(roomCountInput.value, 10);
      searchParams.set("rooms", roomCountInput.value);
      window.history.replaceState(null, "", `${window.location.pathname}?${searchParams.toString()}`);
    }
    roomCountHelp.textContent = hasEnoughRooms
      ? `${maximum} room${maximum === 1 ? "" : "s"} available for these dates. Your party requires at least ${minimumRoomCount}.`
      : `Only ${maximum} room${maximum === 1 ? " is" : "s are"} available, but your party requires at least ${minimumRoomCount}.`;
    syncStayDates();
  };

  const syncGuestDetails = () => {
    adults = Number.parseInt(adultsCountInput.value, 10) || 1;
    children = Number.parseInt(childrenCountInput.value, 10) || 0;
    const guestCount = adults + children;
    minimumRoomCount = requiredRoomsFor(adults, children);
    bookingGuestSummary.textContent = guestSummary(adults, children);

    if (guestCount > MAX_GUESTS_PER_ROOM) {
      roomCapacityMessageText.textContent = ` Your party of ${guestCount} requires at least ${minimumRoomCount} rooms, so ${minimumRoomCount - 1 === 1 ? "an extra room has" : `${minimumRoomCount - 1} extra rooms have`} been added for the other adults or children.`;
      roomCapacityMessage.classList.remove("hidden");
    } else {
      roomCapacityMessageText.textContent = "";
      roomCapacityMessage.classList.add("hidden");
    }

    searchParams.set("adults", String(adults));
    searchParams.set("children", String(children));
    window.history.replaceState(null, "", `${window.location.pathname}?${searchParams.toString()}`);

    if (latestAvailableUnits !== null) {
      preferredRoomCount = Math.max(minimumRoomCount, Number.parseInt(roomCountInput.value, 10) || minimumRoomCount);
      setRoomCountOptions(latestAvailableUnits);
    } else {
      syncStayDates();
    }
  };

  const refreshAvailability = async () => {
    const arrival = arrivalDateInput.value;
    const departure = departureDateInput.value;
    if (!selectedRoom || !arrival || !departure || departure <= arrival) {
      roomCountHelp.textContent = "Choose valid dates to see live availability.";
      return;
    }

    availabilityController?.abort();
    const currentAvailabilityController = new AbortController();
    availabilityController = currentAvailabilityController;
    isCheckingAvailability = true;
    roomCountInput.disabled = true;
    roomCountHelp.textContent = "Checking live availability…";

    try {
      const query = new URLSearchParams({ arrival, departure });
      const { rooms } = await fetchJson<{ rooms: PublicRoom[] }>(`/api/rooms?${query.toString()}`, {
        signal: currentAvailabilityController.signal,
      });
      const refreshedRoom = rooms.find((room) => room.id === selectedRoom?.id);
      if (!refreshedRoom) {
        setRoomCountOptions(0);
        return;
      }
      selectedRoom = refreshedRoom;
      setRoomCountOptions(refreshedRoom.availableUnits);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      roomCountInput.disabled = true;
      roomCountHelp.textContent = "Availability could not be checked. Please try again.";
      setBookingFeedback("We could not check room availability. Please try changing the dates again.", "error");
    } finally {
      if (availabilityController === currentAvailabilityController) {
        isCheckingAvailability = false;
      }
    }
  };

  const syncAndRefresh = () => {
    syncStayDates();
    void refreshAvailability();
  };

  const syncRoomCount = () => {
    preferredRoomCount = Number.parseInt(roomCountInput.value, 10) || minimumRoomCount;
    searchParams.set("rooms", String(preferredRoomCount));
    window.history.replaceState(null, "", `${window.location.pathname}?${searchParams.toString()}`);
    syncStayDates();
  };

  cleanups.push(addListener(arrivalDateInput, "input", syncStayDates));
  cleanups.push(addListener(arrivalDateInput, "change", syncAndRefresh));
  cleanups.push(addListener(departureDateInput, "input", syncStayDates));
  cleanups.push(addListener(departureDateInput, "change", syncAndRefresh));
  cleanups.push(addListener(adultsCountInput, "change", syncGuestDetails));
  cleanups.push(addListener(childrenCountInput, "change", syncGuestDetails));
  cleanups.push(addListener(roomCountInput, "change", syncRoomCount));
  cleanups.push(() => availabilityController?.abort());
  syncGuestDetails();
  syncStayDates();
  cleanups.push(...setupBookingPicker({
    rootId: "bookingFormPicker",
    arrivalInput: arrivalDateInput,
    departureInput: departureDateInput,
    adultsInput: adultsCountInput,
    childrenInput: childrenCountInput,
    roomsInput: roomCountInput,
  }));

  const roomQuery = requestedArrival && requestedDeparture
    ? `?${new URLSearchParams({
      arrival: requestedArrival,
      departure: requestedDeparture,
    }).toString()}`
    : "";
  void fetchJson<{ rooms: PublicRoom[] }>(`/api/rooms${roomQuery}`, {
    signal: controller.signal,
  }).then(({ rooms }) => {
    selectedRoom = rooms.find((room) => room.slug === selectedRoomSlug) ?? null;
    if (!selectedRoom) {
      bookingRoomName.textContent = "Room unavailable";
      bookingRate.textContent = "--";
      setBookingFeedback("This room is no longer available. Please return to the rooms page and select another room.", "error");
      return;
    }

    bookingRoomName.textContent = selectedRoom.name;
    bookingRoomImage.src = roomImage(selectedRoom);
    bookingRoomImage.alt = selectedRoom.images[0]?.alt || selectedRoom.name;
    bookingRate.textContent = currencyFormatter.format(selectedRoom.nightlyRate);
    if (arrivalDateInput.value && departureDateInput.value) {
      void refreshAvailability();
    } else {
      setRoomCountOptions(selectedRoom.availableUnits);
      roomCountHelp.textContent = "Choose dates to confirm live availability.";
    }
  }).catch((error) => {
    if ((error as Error).name !== "AbortError") {
      bookingRoomName.textContent = "Room unavailable";
      setBookingFeedback("The room details could not be loaded. Please refresh the page and try again.", "error");
      console.error("Booking room failed to load", error);
    }
  });

  const submitHandler = async (event: Event) => {
    event.preventDefault();
    syncStayDates();

    if (isCheckingAvailability) {
      setBookingFeedback("Please wait while we finish checking room availability.");
      return;
    }

    if (!selectedRoom) {
      setBookingFeedback("This room could not be loaded. Please return to the rooms page and select it again.", "error");
      return;
    }

    if (!bookingForm.reportValidity()) {
      setBookingFeedback("Please complete all required booking details.", "error");
      return;
    }

    const arrivalDate = arrivalDateInput.value;
    const departureDate = departureDateInput.value;

    if (!arrivalDate || !departureDate || departureDate <= arrivalDate) {
      departureDateInput.setCustomValidity("Choose a departure date after the arrival date.");
      bookingForm.reportValidity();
      setBookingFeedback("Choose a departure date after the arrival date.", "error");
      return;
    }

    departureDateInput.setCustomValidity("");
    const submitButton = bookingForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const previousButtonText = submitButton?.innerHTML;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting…";
    }
    setBookingFeedback("Submitting your booking request…");

    const roomCount = Number.parseInt(roomCountInput.value, 10);
    if (!Number.isInteger(roomCount) || roomCount < minimumRoomCount || roomCountInput.disabled) {
      setBookingFeedback(`Choose at least ${minimumRoomCount} room${minimumRoomCount === 1 ? "" : "s"} for your party.`, "error");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = previousButtonText ?? "Submit booking";
      }
      return;
    }

    try {
      const result = await fetchJson<{
        confirmationCode: string;
        status: string;
        totalAmount: number;
        currency: string;
      }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          roomTypeId: selectedRoom.id,
          roomCount,
          firstName: (document.getElementById("firstName") as HTMLInputElement).value,
          lastName: (document.getElementById("lastName") as HTMLInputElement).value,
          email: (document.getElementById("email") as HTMLInputElement).value,
          phone: (document.getElementById("phone") as HTMLInputElement).value,
          arrival: arrivalDate,
          departure: departureDate,
        }),
      });

      const confirmation = document.createElement("div");
      confirmation.className = "mb-8 rounded-xl bg-primary-container p-6 text-on-primary-container";
      confirmation.innerHTML = `
        <p class="font-label-lg uppercase tracking-widest mb-2">Booking request received</p>
        <p class="font-headline-md text-2xl mb-2">${escapeHtml(result.confirmationCode)}</p>
        <p>Keep this confirmation code. Your request is pending administrator review.</p>
      `;
      bookingForm.before(confirmation);
      bookingForm.classList.add("hidden");
      window.scrollTo({ top: confirmation.offsetTop - 120, behavior: "smooth" });
    } catch (error) {
      setBookingFeedback((error as Error).message, "error");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = previousButtonText ?? "Submit booking";
      }
    }
  };

  const invalidHandler = () => {
    setBookingFeedback("Please complete all required booking details.", "error");
  };
  bookingForm.addEventListener("invalid", invalidHandler, true);
  cleanups.push(() => bookingForm.removeEventListener("invalid", invalidHandler, true));
  cleanups.push(addListener(bookingFormMessageClose, "click", () => bookingFormMessage.classList.add("hidden")));
  cleanups.push(addListener(roomCapacityMessageClose, "click", () => roomCapacityMessage.classList.add("hidden")));

  cleanups.push(addListener(bookingForm, "submit", submitHandler));
  return cleanups;
}

function setupAdminLoginPage(): Cleanup[] {
  const cleanups: Cleanup[] = [];
  const loginForm = document.getElementById("adminLoginForm") as HTMLFormElement | null;
  const passwordInput = document.getElementById("password") as HTMLInputElement | null;
  const passwordToggle = document.getElementById("passwordToggle") as HTMLButtonElement | null;
  const loginMessage = document.getElementById("loginMessage");

  if (!loginForm || !loginMessage) {
    return cleanups;
  }

  const adminUsername = "admin";
  const adminEmail = "daniellochole@gmail.com";

  loginForm.querySelector(".flex.items-center.justify-between.mt-2")?.classList.add("hidden");
  const headingCopy = loginForm.parentElement?.querySelector("p");
  if (headingCopy) {
    headingCopy.textContent = "Enter your administrator username and password.";
  }
  const submitLabel = loginForm.querySelector<HTMLSpanElement>('button[type="submit"] > span');
  if (submitLabel) submitLabel.textContent = "Sign In";
  const demoCopy = loginMessage.nextElementSibling;
  if (demoCopy) {
    demoCopy.textContent = `Administrator username: ${adminUsername}`;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("error")) {
    loginMessage.textContent = "Your sign-in session is invalid or is not authorized for the dashboard.";
    loginMessage.classList.remove("hidden");
  }

  if (passwordInput && passwordToggle) {
    const passwordToggleHandler = () => {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      passwordToggle.querySelector("span")!.textContent = showPassword ? "visibility" : "visibility_off";
      passwordToggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
    };
    cleanups.push(addListener(passwordToggle, "click", passwordToggleHandler));
  }

  const submitHandler = async (event: Event) => {
    event.preventDefault();
    const username = (loginForm.elements.namedItem("username") as HTMLInputElement | null)?.value.trim().toLowerCase();
    const password = passwordInput?.value ?? "";

    if (username !== adminUsername || !password) {
      loginMessage.textContent = "Incorrect username or password.";
      loginMessage.classList.remove("hidden");
      loginMessage.classList.add("text-error");
      return;
    }

    const submitButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    loginMessage.textContent = "Signing in…";
    loginMessage.classList.remove("hidden", "text-error");

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password,
    });

    if (error) {
      loginMessage.textContent = "Incorrect username or password.";
      loginMessage.classList.add("text-error");
      if (submitButton) submitButton.disabled = false;
      return;
    }

    if (data.user.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      loginMessage.textContent = "This account is not authorized for the administrator dashboard.";
      loginMessage.classList.add("text-error");
      if (submitButton) submitButton.disabled = false;
      return;
    }

    window.location.replace("/admin-dashboard");
  };

  cleanups.push(addListener(loginForm, "submit", submitHandler));
  return cleanups;
}

function setupAdminDashboardPage(): Cleanup[] {
  return setupSupabaseAdminDashboard();
}
export function setupLegacyEnhancements(pageId: LegacyPageId) {
  const cleanups: Cleanup[] = [observeReveals(), ...setupMobileNavigation()];

  switch (pageId) {
    case "index":
      cleanups.push(...setupIndexPage());
      break;
    case "about":
      cleanups.push(...setupAboutPage());
      break;
    case "gallery":
      cleanups.push(...setupGalleryPage());
      break;
    case "rooms":
      cleanups.push(...setupRoomsPage());
      break;
    case "contact-us":
      cleanups.push(...setupContactPage());
      break;
    case "complete-booking":
      cleanups.push(...setupCompleteBookingPage());
      break;
    case "admin-login":
      cleanups.push(...setupAdminLoginPage());
      break;
    case "admin-dashboard":
      cleanups.push(...setupAdminDashboardPage());
      break;
    default:
      break;
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
