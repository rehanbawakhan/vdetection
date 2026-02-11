self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "FaceWatch Alert", {
      body: data.body || "Wanted match detected",
      icon: "/favicon.ico"
    })
  );
});
