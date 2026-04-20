const tg = window.Telegram?.WebApp;
const MIN_LEAD_MINUTES = 30;
const BASE_SERVICE_SLOTS = buildBaseServiceSlots();

const addresses = [
  "Адрес 1",
  "Адрес 2",
  "Адрес 3",
  "Адрес 4",
  "Адрес 5"
];

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
  address: "",
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
  progressBar: document.getElementById("progress-bar"),
  addressGrid: document.getElementById("address-grid"),
  addressNext: document.getElementById("address-next"),
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
  resultSummary: document.getElementById("result-summary"),
  cancelBooking: document.getElementById("cancel-booking"),
  confirmBooking: document.getElementById("confirm-booking"),
  restartBooking: document.getElementById("restart-booking"),
  prevButtons: Array.from(document.querySelectorAll("[data-prev]"))
};

init();

function init() {
  if (tg) {
    tg.ready();
    tg.expand();
  }

  renderAddresses();
  renderHours();
  renderMinutes();
  renderTables();
  initCalendar();
  bindEvents();
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
  elements.addressNext.addEventListener("click", () => goToStep(2));
  elements.dateNext.addEventListener("click", handleDateNext);
  elements.timeNext.addEventListener("click", handleTimeNext);
  elements.guestNext.addEventListener("click", handleGuestNext);
  elements.tableNext.addEventListener("click", handleTableNext);
  elements.contactNext.addEventListener("click", handleContactNext);
  elements.confirmBooking.addEventListener("click", handleConfirm);
  elements.cancelBooking.addEventListener("click", resetBooking);
  elements.restartBooking.addEventListener("click", resetBooking);
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
  });

  elements.phoneCountry.addEventListener("change", handlePhoneCountryChange);
  elements.phoneInput.addEventListener("input", handlePhoneInput);

  elements.guestDecrease.addEventListener("click", () => updateGuests(-1));
  elements.guestIncrease.addEventListener("click", () => updateGuests(1));
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

function renderAddresses() {
  elements.addressGrid.innerHTML = "";

  addresses.forEach((address) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "address-option";
    button.textContent = address;
    button.addEventListener("click", () => {
      booking.address = address;
      document.querySelectorAll(".address-option").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      elements.addressNext.disabled = false;
    });
    elements.addressGrid.appendChild(button);
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
}

function renderTables() {
  elements.tableLayer.innerHTML = "";

  tables.forEach((table) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-chip";
    button.textContent = table.label;
    button.style.left = `${table.left}%`;
    button.style.top = `${table.top}%`;
    button.addEventListener("click", () => {
      booking.table = table.label;
      document.querySelectorAll(".table-chip").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      elements.selectedTableText.textContent = `Выбран столик № ${table.label}`;
      elements.tableNext.disabled = false;
    });
    elements.tableLayer.appendChild(button);
  });
}

function initCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calendarState.minDate = today;
  calendarState.viewYear = today.getFullYear();
  calendarState.viewMonth = today.getMonth();

  renderCalendar();
}

function switchMonth(direction) {
  const nextMonth = calendarState.viewMonth + direction;
  const nextDate = new Date(calendarState.viewYear, nextMonth, 1);

  const minYear = calendarState.minDate.getFullYear();
  const minMonth = calendarState.minDate.getMonth();
  const isBeforeMinMonth =
    nextDate.getFullYear() < minYear ||
    (nextDate.getFullYear() === minYear && nextDate.getMonth() < minMonth);

  if (isBeforeMinMonth) {
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

  elements.calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;
  elements.calendarPrev.disabled =
    year === minYear && month === minMonth;

  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const iso = toIsoDate(date);
    const isDisabled = date < calendarState.minDate;
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

  elements.calendarGrid.querySelectorAll(".calendar-day[data-date]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        booking.date = button.dataset.date;
        elements.calendarSelected.textContent =
          `Выбрана дата: ${formatDate(booking.date)}`;
        renderHours();
        renderCalendar();
      });
    });

  if (!booking.date) {
    elements.calendarSelected.textContent = "Дата не выбрана";
  }
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
  currentStep = Math.max(1, Math.min(8, step));
  elements.steps.forEach((section) => {
    section.classList.toggle("is-active", Number(section.dataset.step) === currentStep);
  });
  updateProgress();
}

function updateProgress() {
  const totalInteractiveSteps = 8;
  const percent = (currentStep / totalInteractiveSteps) * 100;
  elements.progressBar.style.width = `${percent}%`;
}

function handleDateNext() {
  if (!booking.date) {
    alert("Выберите дату бронирования.");
    return;
  }

  goToStep(3);
}

function handleTimeNext() {
  if (!booking.hour || !booking.minute) {
    alert("Для выбранной даты нет доступного времени. Выберите другую дату.");
    return;
  }

  booking.hour = elements.hourSelect.value;
  booking.minute = elements.minuteSelect.value;
  goToStep(4);
}

function handleGuestNext() {
  booking.guests = clampGuests(booking.guests);
  elements.guestCount.textContent = booking.guests;
  goToStep(5);
}

function handleTableNext() {
  if (!booking.table) {
    alert("Выберите столик на схеме.");
    return;
  }

  goToStep(6);
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
  goToStep(7);
}

function handleConfirm() {
  fillSummary(elements.resultSummary);

  if (tg) {
    tg.sendData(JSON.stringify(booking));
    tg.MainButton.hide();
  }

  goToStep(8);
}

function fillSummary(container) {
  const rows = [
    ["Адрес", booking.address],
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
  booking.address = "";
  booking.date = "";
  booking.hour = "11";
  booking.minute = "00";
  booking.guests = 2;
  booking.table = "";
  booking.name = "";
  booking.phone = "";

  elements.addressNext.disabled = true;
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
  document.querySelectorAll(".address-option").forEach((item) => item.classList.remove("is-selected"));
  document.querySelectorAll(".table-chip").forEach((item) => item.classList.remove("is-selected"));

  goToStep(1);
}

handlePhoneCountryChange();
