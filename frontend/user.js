const tg = window.Telegram?.WebApp;
const MIN_LEAD_MINUTES = 30;
const BASE_SERVICE_SLOTS = buildBaseServiceSlots();
const tables = [
  { id: 1, label: "S1", left: 4.7, top: 9.5 },
  { id: 2, label: "S2", left: 11.5, top: 21.5 },
  { id: 3, label: "S3", left: 4.7, top: 34.2 },
  { id: 4, label: "S4", left: 11, top: 46 },
  { id: 5, label: "S5", left: 4.7, top: 59 },
  { id: 6, label: "S6", left: 14, top: 69 },
  { id: 7, label: "S7", left: 21, top: 80.5 },
  { id: 8, label: "S8", left: 27, top: 69 },
  { id: 9, label: "S9", left: 32.5, top: 80.5 },
  { id: 10, label: "S10", left: 38, top: 69 },
  { id: 11, label: "S11", left: 58, top: 69 },
  { id: 12, label: "S12", left: 63.5, top: 80.5},
  { id: 13, label: "S13", left: 69, top: 69 },
  { id: 14, label: "S14", left: 75, top: 80.5},
  { id: 15, label: "R1", left: 22, top: 35 },
  { id: 16, label: "R2", left: 35, top: 35 },
  { id: 17, label: "R3", left: 22, top: 55 },
  { id: 18, label: "R4", left: 35, top: 55 },
  { id: 19, label: "R5", left: 62, top: 59 },
  { id: 20, label: "R6", left: 73, top: 59 },
  { id: 21, label: "VIP", left: 86.7, top: 38 },

];

const booking = {
  date: "",
  hour: "",
  minute: "00",
  guests: 2,
  table: "",
  name: "",
  phone: ""
};

const NAME_LOCALE = "ru-RU";

let currentStep = 1;
let currentView = "home";
const monthNames = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const calendarState = {
  viewYear: 0,
  viewMonth: 0,
  minDate: null
};

const elements = {
  steps: Array.from(document.querySelectorAll(".step")),
  homeScreen: document.getElementById("home-screen"),
  myBookingsScreen: document.getElementById("my-bookings-screen"),
  bookingFlow: document.getElementById("booking-flow"),
  bookingProgress: document.getElementById("booking-progress"),
  openMyBookings: document.getElementById("open-my-bookings"),
  openNewBooking: document.getElementById("open-new-booking"),
  bookingsBack: document.getElementById("bookings-back"),
  bookingsNew: document.getElementById("bookings-new"),
  myBookingsList: document.getElementById("my-bookings-list"),
  progressBar: document.getElementById("progress-bar"),
  dateNext: document.getElementById("date-next"),
  calendarPrev: document.getElementById("calendar-prev"),
  calendarNext: document.getElementById("calendar-next"),
  calendarMonthLabel: document.getElementById("calendar-month-label"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarSelected: document.getElementById("calendar-selected"),
  hourSelect: document.getElementById("reservation-hour"),
  minuteSelect: document.getElementById("reservation-minute"),
  timeNext: document.getElementById("time-next"),
  guestCount: document.getElementById("guest-count"),
  guestDecrease: document.getElementById("guest-decrease"),
  guestIncrease: document.getElementById("guest-increase"),
  guestNext: document.getElementById("guest-next"),
  tableLayer: document.getElementById("table-layer"),
  selectedTableText: document.getElementById("selected-table-text"),
  tableNext: document.getElementById("table-next"),
  nameInput: document.getElementById("guest-name"),
  phoneCountry: document.getElementById("phone-country"),
  phoneInput: document.getElementById("guest-phone"),
  phoneHint: document.getElementById("phone-hint"),
  contactNext: document.getElementById("contact-next"),
  summary: document.getElementById("summary"),
  cancelBooking: document.getElementById("cancel-booking"),
  confirmBooking: document.getElementById("confirm-booking"),
  prevButtons: Array.from(document.querySelectorAll("[data-prev]"))
};

init();

function init() {
  if (tg) {
    tg.ready();
    tg.expand();
  }

  renderHours();
  renderMinutes();
  renderTables();
  initCalendar();
  bindEvents();
  showHomeScreen();
  updateProgress();
}

function buildBaseServiceSlots() {
  const slots = [];

  for (let hour = 11; hour <= 23; hour += 1) {
    slots.push({ hour: String(hour).padStart(2, "0"), minute: "00" });
    slots.push({ hour: String(hour).padStart(2, "0"), minute: "30" });
  }

  for (let hour = 0; hour <= 1; hour += 1) {
    slots.push({ hour: String(hour).padStart(2, "0"), minute: "00" });
    slots.push({ hour: String(hour).padStart(2, "0"), minute: "30" });
  }

  slots.push({ hour: "02", minute: "00" });
  slots.push({ hour: "02", minute: "30" });

  return slots;
}

function roundUpToHalfHour(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  if (minutes === 0 || minutes === 30) {
    return rounded;
  }

  if (minutes < 30) {
    rounded.setMinutes(30, 0, 0);
    return rounded;
  }

  rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  return rounded;
}

function toServiceDateTime(dateIso, hourStr, minuteStr) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const dateTime = new Date(year, month - 1, day, hour, minute, 0, 0);

  // Ночные слоты (00:00-02:30) считаем продолжением выбранного дня.
  if (hour <= 2) {
    dateTime.setDate(dateTime.getDate() + 1);
  }

  return dateTime;
}

function getAvailableTimeSlots() {
  if (!booking.date) {
    return BASE_SERVICE_SLOTS;
  }

  const todayIso = toIsoDate(new Date());
  if (booking.date !== todayIso) {
    return BASE_SERVICE_SLOTS;
  }

  const minAllowed = roundUpToHalfHour(
    new Date(Date.now() + MIN_LEAD_MINUTES * 60 * 1000)
  );

  return BASE_SERVICE_SLOTS.filter((slot) => {
    const slotDateTime = toServiceDateTime(booking.date, slot.hour, slot.minute);
    return slotDateTime >= minAllowed;
  });
}

function bindEvents() {
  elements.openMyBookings.addEventListener("click", showMyBookingsScreen);
  elements.openNewBooking.addEventListener("click", startNewBooking);
  elements.bookingsBack.addEventListener("click", showHomeScreen);
  elements.bookingsNew.addEventListener("click", startNewBooking);
  elements.dateNext.addEventListener("click", handleDateNext);
  elements.timeNext.addEventListener("click", handleTimeNext);
  elements.guestNext.addEventListener("click", handleGuestNext);
  elements.tableNext.addEventListener("click", handleTableNext);
  elements.contactNext.addEventListener("click", handleContactNext);
  elements.confirmBooking.addEventListener("click", handleConfirm);
  elements.cancelBooking.addEventListener("click", () => {
    resetBooking();
    showHomeScreen();
  });
  elements.calendarPrev.addEventListener("click", () => switchMonth(-1));
  elements.calendarNext.addEventListener("click", () => switchMonth(1));

  elements.prevButtons.forEach((button) => {
    button.addEventListener("click", () => goToStep(currentStep - 1));
  });

  elements.hourSelect.addEventListener("change", () => {
    booking.hour = elements.hourSelect.value;
    renderMinutes();
  });

  elements.minuteSelect.addEventListener("change", () => {
    booking.minute = elements.minuteSelect.value;
    // Перезагружаем доступность столиков при изменении минут
    renderTables();
  });

  elements.phoneCountry.addEventListener("change", handlePhoneCountryChange);
  elements.phoneInput.addEventListener("input", handlePhoneInput);

  elements.guestDecrease.addEventListener("click", () => updateGuests(-1));
  elements.guestIncrease.addEventListener("click", () => updateGuests(1));

  elements.myBookingsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cancel-booking-id]");
    if (!button) {
      return;
    }

    const bookingId = Number(button.dataset.cancelBookingId);
    if (!bookingId) {
      return;
    }

    const approved = window.confirm("Вы уверены?\nОтменить бронь?");
    if (!approved) {
      return;
    }

    await cancelBookingById(bookingId, button);
  });
}

function setActiveView(view) {
  currentView = view;

  elements.homeScreen.classList.toggle("is-active", view === "home");
  elements.myBookingsScreen.classList.toggle("is-active", view === "my-bookings");

  const bookingFlowVisible = view === "booking";
  elements.bookingFlow.classList.toggle("is-active", bookingFlowVisible);
  elements.bookingProgress.style.display = bookingFlowVisible ? "block" : "none";
}

function showHomeScreen() {
  setActiveView("home");
}

function startNewBooking() {
  resetBooking();
  setActiveView("booking");
}

async function showMyBookingsScreen() {
  setActiveView("my-bookings");
  await loadMyBookings();
}

function renderBookingsCards(bookings) {
  if (!bookings.length) {
    elements.myBookingsList.innerHTML =
      '<div class="booking-empty">У вас пока нет активных бронирований.</div>';
    return;
  }

  elements.myBookingsList.innerHTML = bookings
    .map((item) => {
      return `
        <article class="booking-card">
          <h3>Бронь</h3>
          <p><strong>Дата:</strong> ${formatDate(item.date)}</p>
          <p><strong>Время:</strong> ${item.time}</p>
          <p><strong>Гостей:</strong> ${item.guests}</p>
          <p><strong>Столик:</strong> № ${item.table}</p>
          <p><strong>Имя:</strong> ${item.name}</p>
          <p><strong>Телефон:</strong> ${item.phone}</p>
          <div class="booking-card-actions">
            <button class="btn btn-ghost" data-cancel-booking-id="${item.id}">Отменить бронь</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadMyBookings() {
  const userId = tg?.initDataUnsafe?.user?.id;

  if (!userId) {
    elements.myBookingsList.innerHTML =
      '<div class="booking-empty">Не удалось определить пользователя Telegram.</div>';
    return;
  }

  elements.myBookingsList.innerHTML =
    '<div class="booking-empty">Загрузка бронирований...</div>';

  try {
    const apiUrl = window.BOOKING_API_URL || "";
    const res = await fetch(`${apiUrl}/api/my-bookings?telegram_id=${userId}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    renderBookingsCards(data.bookings || []);
  } catch (err) {
    elements.myBookingsList.innerHTML =
      '<div class="booking-empty">Не удалось загрузить брони. Попробуйте позже.</div>';
  }
}

async function cancelBookingById(bookingId, button) {
  const userId = tg?.initDataUnsafe?.user?.id;

  if (!userId) {
    alert("Не удалось определить пользователя Telegram.");
    return;
  }

  const initialText = button.textContent;
  button.disabled = true;
  button.textContent = "Отменяем...";

  try {
    const apiUrl = window.BOOKING_API_URL || "";
    const res = await fetch(
      `${apiUrl}/api/my-bookings/${bookingId}?telegram_id=${userId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    await loadMyBookings();
  } catch (err) {
    button.disabled = false;
    button.textContent = initialText;
    alert("Не удалось отменить бронь. Попробуйте позже.");
  }
}

function handlePhoneCountryChange() {
  const requiredDigits = getRequiredPhoneDigits();
  elements.phoneInput.maxLength = requiredDigits;
  elements.phoneInput.value = sanitizePhoneDigits(elements.phoneInput.value)
    .slice(0, requiredDigits);
  updatePhoneHint();
}

function handlePhoneInput() {
  const requiredDigits = getRequiredPhoneDigits();
  const digits = sanitizePhoneDigits(elements.phoneInput.value).slice(0, requiredDigits);
  elements.phoneInput.value = digits;
  updatePhoneHint();
}

function getRequiredPhoneDigits() {
  const selectedOption = elements.phoneCountry.options[elements.phoneCountry.selectedIndex];
  return Number(selectedOption.dataset.digits || 10);
}

function sanitizePhoneDigits(value) {
  return value.replace(/\D/g, "");
}

function updatePhoneHint(isError = false) {
  const requiredDigits = getRequiredPhoneDigits();
  const currentDigits = sanitizePhoneDigits(elements.phoneInput.value).length;
  elements.phoneHint.textContent =
    `Нужно ${requiredDigits} цифр без пробелов и символов. Сейчас: ${currentDigits}.`;
  elements.phoneHint.classList.toggle("is-error", isError);
}

function isPhoneValid() {
  const requiredDigits = getRequiredPhoneDigits();
  const digits = sanitizePhoneDigits(elements.phoneInput.value);
  return digits.length === requiredDigits;
}

function normalizeName(rawName) {
  return rawName
    .trim()
    .toLocaleLowerCase(NAME_LOCALE)
    .replace(/(^|[\s-])([A-Za-zА-Яа-яЁё])/g, (match, separator, letter) => {
      return `${separator}${letter.toLocaleUpperCase(NAME_LOCALE)}`;
    });
}

function renderHours() {
  const availableSlots = getAvailableTimeSlots();
  const hours = [...new Set(availableSlots.map((slot) => slot.hour))];

  if (!hours.length) {
    elements.hourSelect.innerHTML =
      '<option value="" disabled selected>Нет времени</option>';
    elements.minuteSelect.innerHTML =
      '<option value="" disabled selected>--</option>';
    elements.timeNext.disabled = true;
    booking.hour = "";
    booking.minute = "";
    return;
  }

  elements.hourSelect.innerHTML = hours
    .map((hour) => `<option value="${hour}">${hour}</option>`)
    .join("");

  if (!hours.includes(booking.hour)) {
    booking.hour = hours[0];
  }

  elements.hourSelect.value = booking.hour;
  renderMinutes(availableSlots);
}

function renderMinutes(availableSlots = getAvailableTimeSlots()) {
  const minuteOptions = [
    ...new Set(
      availableSlots
        .filter((slot) => slot.hour === booking.hour)
        .map((slot) => slot.minute)
    )
  ];

  if (!minuteOptions.length) {
    elements.minuteSelect.innerHTML =
      '<option value="" disabled selected>--</option>';
    elements.timeNext.disabled = true;
    booking.minute = "";
    return;
  }

  elements.minuteSelect.innerHTML = minuteOptions
    .map((minute) => `<option value="${minute}">${minute}</option>`)
    .join("");

  if (!minuteOptions.includes(booking.minute)) {
    booking.minute = minuteOptions[0];
  }

  elements.minuteSelect.value = booking.minute;
  elements.timeNext.disabled = false;
  
  // Перезагружаем доступность столиков для нового времени
  renderTables();
}

async function renderTables() {
  elements.tableLayer.innerHTML = "";

  // Загружаем информацию о недоступных столиках если дата и время выбраны
  let unavailableTables = new Set();
  let eligibleTables = new Set(tables.map((table) => table.label));
  if (booking.date && booking.hour && booking.minute) {
    try {
      const apiUrl = window.BOOKING_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/availability?date=${booking.date}&hour=${booking.hour}&minute=${booking.minute}&guests=${booking.guests}`
      );
      const data = await res.json();
      unavailableTables = new Set(data.unavailable_tables || []);
      if (Array.isArray(data.eligible_tables)) {
        eligibleTables = new Set(data.eligible_tables);
      }
    } catch (e) {
      console.error("Error loading table availability:", e);
    }
  }

  let canKeepSelection = false;

  tables.forEach((table) => {
    if (!eligibleTables.has(table.label)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-chip";
    button.textContent = "";
    button.setAttribute("aria-label", `Выбрать столик ${table.label}`);
    button.style.left = `${table.left}%`;
    button.style.top = `${table.top}%`;
    
    const isUnavailable = unavailableTables.has(table.label);
    if (isUnavailable) {
      button.disabled = true;
      button.classList.add("is-unavailable");
      button.style.opacity = "0.35";
      button.style.cursor = "not-allowed";
    }

    if (booking.table === table.label && !isUnavailable) {
      button.classList.add("is-selected");
      canKeepSelection = true;
    }
    
    button.addEventListener("click", () => {
      if (isUnavailable) return;
      
      booking.table = table.label;
      document.querySelectorAll(".table-chip").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      elements.selectedTableText.textContent = `Выбран столик № ${table.label}`;
      elements.tableNext.disabled = false;
    });
    elements.tableLayer.appendChild(button);
  });

  if (!canKeepSelection) {
    booking.table = "";
    elements.tableNext.disabled = true;
    if (eligibleTables.size === 0) {
      elements.selectedTableText.textContent =
        "Нет столиков для выбранного количества гостей.";
    } else {
      elements.selectedTableText.textContent = "Столик пока не выбран.";
    }
    return;
  }

  elements.tableNext.disabled = false;
  elements.selectedTableText.textContent = `Выбран столик № ${booking.table}`;
}

function initCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calendarState.minDate = today;
  // maxDate = today + 4 месяца
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + 4);
  calendarState.maxDate = maxDate;
  
  calendarState.viewYear = today.getFullYear();
  calendarState.viewMonth = today.getMonth();

  renderCalendar();
}

function switchMonth(direction) {
  const nextMonth = calendarState.viewMonth + direction;
  const nextDate = new Date(calendarState.viewYear, nextMonth, 1);

  const minYear = calendarState.minDate.getFullYear();
  const minMonth = calendarState.minDate.getMonth();
  const maxYear = calendarState.maxDate.getFullYear();
  const maxMonth = calendarState.maxDate.getMonth();

  const isBeforeMinMonth =
    nextDate.getFullYear() < minYear ||
    (nextDate.getFullYear() === minYear && nextDate.getMonth() < minMonth);

  const isAfterMaxMonth =
    nextDate.getFullYear() > maxYear ||
    (nextDate.getFullYear() === maxYear && nextDate.getMonth() > maxMonth);

  if (isBeforeMinMonth || isAfterMaxMonth) {
    return;
  }

  calendarState.viewYear = nextDate.getFullYear();
  calendarState.viewMonth = nextDate.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const year = calendarState.viewYear;
  const month = calendarState.viewMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const minYear = calendarState.minDate.getFullYear();
  const minMonth = calendarState.minDate.getMonth();
  const maxYear = calendarState.maxDate.getFullYear();
  const maxMonth = calendarState.maxDate.getMonth();

  elements.calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;
  elements.calendarPrev.disabled =
    year === minYear && month === minMonth;
  
  // Отключаем кнопку "Дальше" если мы уже в последнем возможном месяце
  elements.calendarNext.disabled =
    year === maxYear && month === maxMonth;

  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const iso = toIsoDate(date);
    const isDisabled = date < calendarState.minDate || date > calendarState.maxDate;
    const isSelected = booking.date === iso;
    const isToday = isSameDate(date, calendarState.minDate);

    const classNames = ["calendar-day"];
    if (isDisabled) {
      classNames.push("is-disabled");
    }
    if (isSelected) {
      classNames.push("is-selected");
    }
    if (isToday) {
      classNames.push("is-today");
    }

    cells.push(
      `<button type="button" class="${classNames.join(" ")}" data-date="${iso}" ${isDisabled ? "disabled" : ""}>${day}</button>`
    );
  }

  elements.calendarGrid.innerHTML = cells.join("");

  // Загружаем информацию о доступности и обновляем стили дат
  loadCalendarAvailability(year, month);

  elements.calendarGrid.querySelectorAll(".calendar-day[data-date]")
    .forEach((button) => {
      button.addEventListener("click", handleDateClick);
    });

  if (!booking.date) {
    elements.calendarSelected.textContent = "Дата не выбрана";
  }
}

async function loadCalendarAvailability(year, month) {
  try {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = toIsoDate(date);
      const button = elements.calendarGrid.querySelector(`[data-date="${iso}"]`);
      if (!button || button.classList.contains("is-disabled")) continue;

      const apiUrl = window.BOOKING_API_URL || "";
      try {
        const res = await fetch(`${apiUrl}/api/availability?date=${iso}`);
        const data = await res.json();
        
        if (data.fully_booked) {
          button.classList.add("is-fully-booked");
        } else {
          button.classList.remove("is-fully-booked");
        }
      } catch (e) {
        console.error(`Error checking availability for ${iso}:`, e);
      }
    }
  } catch (e) {
    console.error("Error in loadCalendarAvailability:", e);
  }
}

async function handleDateClick(event) {
  const button = event.target;
  const date = button.dataset.date;
  
  // Проверяем не заблокирована ли дата
  if (button.classList.contains("is-fully-booked")) {
    alert("К сожалению, все столики заняты на эту дату.");
    return;
  }

  booking.date = date;
  elements.calendarSelected.textContent =
    `Выбрана дата: ${formatDate(booking.date)}`;
  renderHours();
  renderCalendar();
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function goToStep(step) {
  currentStep = Math.max(1, Math.min(6, step));
  elements.steps.forEach((section) => {
    section.classList.toggle("is-active", Number(section.dataset.step) === currentStep);
  });
  updateProgress();
}

function updateProgress() {
  const totalInteractiveSteps = 6;
  const percent = (currentStep / totalInteractiveSteps) * 100;
  elements.progressBar.style.width = `${percent}%`;
}

function handleDateNext() {
  if (!booking.date) {
    alert("Выберите дату бронирования.");
    return;
  }

  goToStep(2);
}

function handleTimeNext() {
  if (!booking.hour || !booking.minute) {
    alert("Для выбранной даты нет доступного времени. Выберите другую дату.");
    return;
  }

  booking.hour = elements.hourSelect.value;
  booking.minute = elements.minuteSelect.value;
  goToStep(3);
}

function handleGuestNext() {
  booking.guests = clampGuests(booking.guests);
  elements.guestCount.textContent = booking.guests;
  renderTables();
  goToStep(4);
}

function handleTableNext() {
  if (!booking.table) {
    alert("Выберите столик на схеме.");
    return;
  }

  goToStep(5);
}

function handleContactNext() {
  const name = normalizeName(elements.nameInput.value);
  const phoneDigits = sanitizePhoneDigits(elements.phoneInput.value);
  const countryCode = elements.phoneCountry.value;

  if (!name || !phoneDigits) {
    alert("Введите имя и номер телефона.");
    return;
  }

  if (!isPhoneValid()) {
    updatePhoneHint(true);
    alert("Неверный номер: только цифры и нужное количество для выбранной страны.");
    return;
  }

  updatePhoneHint(false);
  elements.nameInput.value = name;

  booking.name = name;
  booking.phone = `${countryCode} ${phoneDigits}`;
  fillSummary(elements.summary);
  goToStep(6);
}

async function handleConfirm() {
  if (!tg) {
    alert("Бронь отправлена. В Telegram вы получите сообщение с деталями.");
    resetBooking();
    return;
  }

  elements.confirmBooking.disabled = true;
  elements.confirmBooking.textContent = "Отправляем...";

  const user = tg.initDataUnsafe?.user ?? {};
  const payload = {
    telegram_id: user.id ?? 0,
    tg_name: user.username ?? "",
    tg_first_name: user.first_name ?? "",
    tg_last_name: user.last_name ?? "",
    name: booking.name,
    date: booking.date,
    hour: booking.hour,
    minute: booking.minute,
    guests: booking.guests,
    table: booking.table,
    phone: booking.phone,
  };

  try {
    const apiUrl = window.BOOKING_API_URL || "";
    const res = await fetch(`${apiUrl}/api/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    elements.confirmBooking.disabled = false;
    elements.confirmBooking.textContent = "Всё верно";
    alert("Ошибка отправки брони. Попробуйте ещё раз.");
    return;
  }

  setTimeout(() => tg.close(), 500);
}

function fillSummary(container) {
  const rows = [
    ["Дата", formatDate(booking.date)],
    ["Время", `${booking.hour}:${booking.minute}`],
    ["Количество гостей", String(booking.guests)],
    ["Столик", `№ ${booking.table}`],
    ["Имя", booking.name],
    ["Телефон", booking.phone]
  ];

  container.innerHTML = rows
    .map(([label, value]) => {
      return `
        <div class="summary-row">
          <span class="summary-label">${label}</span>
          <span class="summary-value">${value}</span>
        </div>
      `;
    })
    .join("");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function updateGuests(delta) {
  booking.guests = clampGuests(booking.guests + delta);
  elements.guestCount.textContent = booking.guests;
}

function clampGuests(value) {
  return Math.min(20, Math.max(1, value));
}

function resetBooking() {
  booking.date = "";
  booking.hour = "11";
  booking.minute = "00";
  booking.guests = 2;
  booking.table = "";
  booking.name = "";
  booking.phone = "";

  elements.tableNext.disabled = true;
  elements.calendarSelected.textContent = "Дата не выбрана";
  elements.hourSelect.value = "11";
  renderMinutes();
  initCalendar();
  elements.guestCount.textContent = booking.guests;
  elements.nameInput.value = "";
  elements.phoneInput.value = "";
  elements.phoneCountry.value = "+7";
  handlePhoneCountryChange();
  elements.selectedTableText.textContent = "Столик пока не выбран.";
  document.querySelectorAll(".table-chip").forEach((item) => item.classList.remove("is-selected"));

  goToStep(1);
}

handlePhoneCountryChange();
