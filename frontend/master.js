const tg = window.Telegram?.WebApp;

const elements = {
  homeScreen: document.getElementById("home-screen"),
  myBookingsScreen: document.getElementById("my-bookings-screen"),
  masterBookingsScreen: document.getElementById("master-bookings-screen"),
  bookingFlow: document.getElementById("booking-flow"),
  masterGroups: document.getElementById("master-groups"),
};

initMaster();

function initMaster() {
  if (tg) {
    tg.ready();
    tg.expand();
  }

  if (elements.homeScreen) {
    elements.homeScreen.classList.remove("is-active");
  }
  if (elements.myBookingsScreen) {
    elements.myBookingsScreen.classList.remove("is-active");
  }
  if (elements.bookingFlow) {
    elements.bookingFlow.classList.remove("is-active");
  }
  if (elements.masterBookingsScreen) {
    elements.masterBookingsScreen.classList.add("is-active");
  }

  loadMasterBookings();
}

function formatDateHuman(value) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function renderMasterBookings(groups) {
  if (!groups.length) {
    elements.masterGroups.innerHTML =
      '<div class="booking-empty">Сейчас нет активных бронирований.</div>';
    return;
  }

  elements.masterGroups.innerHTML = groups
    .map((group) => {
      const timeBlocks = group.times
        .map((timeGroup) => {
          const cards = timeGroup.bookings
            .map((item) => {
              return `
                <article class="booking-card">
                  <p><strong>Столик:</strong> № ${item.table}</p>
                  <p><strong>Гостей:</strong> ${item.guests}</p>
                  <p><strong>Имя:</strong> ${item.name}</p>
                  <p><strong>Телефон:</strong> ${item.phone}</p>
                  <p><strong>Telegram:</strong> ${item.tg_name || item.telegram_id}</p>
                </article>
              `;
            })
            .join("");

          return `
            <section class="master-time-group">
              <h4>${timeGroup.time}</h4>
              <div class="booking-cards">${cards}</div>
            </section>
          `;
        })
        .join("");

      return `
        <section class="master-date-group">
          <h3>${formatDateHuman(group.date)}</h3>
          ${timeBlocks}
        </section>
      `;
    })
    .join("");
}

async function loadMasterBookings() {
  const userId = tg?.initDataUnsafe?.user?.id;

  if (!userId) {
    elements.masterGroups.innerHTML =
      '<div class="booking-empty">Не удалось определить пользователя Telegram.</div>';
    return;
  }

  elements.masterGroups.innerHTML =
    '<div class="booking-empty">Загрузка бронирований...</div>';

  try {
    const apiUrl = window.BOOKING_API_URL || "";
    const res = await fetch(`${apiUrl}/api/master-bookings?telegram_id=${userId}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    renderMasterBookings(data.groups || []);
  } catch (err) {
    elements.masterGroups.innerHTML =
      '<div class="booking-empty">Нет доступа к мастер-меню или ошибка загрузки.</div>';
  }
}
