(function loadFrontendMode() {
  const params = new URLSearchParams(window.location.search);
  const isMasterMode = params.get("mode") === "master";

  const script = document.createElement("script");
  script.src = isMasterMode ? "master.js" : "user.js";
  script.defer = true;
  document.body.appendChild(script);
})();
