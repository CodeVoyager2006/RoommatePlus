// Component card interaction
document
  .querySelectorAll(".component-card, .component-db-card")
  .forEach((card) => {
    card.addEventListener("click", function (e) {
      e.stopPropagation();

      // Database cards are always open
      if (this.classList.contains("database")) {
        return;
      }

      // Close all other cards
      document
        .querySelectorAll(".component-card, .component-db-card")
        .forEach((c) => {
          if (c !== this && !c.classList.contains("database")) {
            c.classList.remove("active");
          }
        });

      // Toggle current card
      this.classList.toggle("active");
    });
  });

// Close details when clicking outside
document.addEventListener("click", function (e) {
  if (!e.target.closest(".component-card, .component-db-card")) {
    document
      .querySelectorAll(".component-card, .component-db-card")
      .forEach((c) => {
        if (!c.classList.contains("database")) {
          c.classList.remove("active");
        }
      });
  }
});

// Toggle all details
function toggleAllDetails() {
  const cards = document.querySelectorAll(".component-card");

  const allOpen = Array.from(cards).every(
    (card) =>
      card.classList.contains("active") || card.classList.contains("database"),
  );

  cards.forEach((card) => {
    if (!card.classList.contains("database")) {
      card.classList.toggle("active", !allOpen);
    }
  });
}

// Prevent bubbling from the button
document.getElementById("show-all-btn").addEventListener("click", function (e) {
  e.stopPropagation();
  toggleAllDetails();
});
