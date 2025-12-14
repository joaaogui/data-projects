import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the main heading and tagline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("main-heading")).toBeVisible();
    await expect(page.getByTestId("main-heading")).toContainText("Find the Best Season");
    await expect(page.getByTestId("tagline")).toBeVisible();
    await expect(page.getByTestId("tagline")).toContainText(
      "Discover which season of your favorite TV show"
    );
  });

  test("should display search form with input and button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByTestId("search-button")).toBeVisible();
  });

  test("should display suggestion links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("suggestion-breaking-bad")).toBeVisible();
    await expect(page.getByTestId("suggestion-game-of-thrones")).toBeVisible();
    await expect(page.getByTestId("suggestion-the-office")).toBeVisible();
  });

  test("should navigate to show page when clicking suggestion", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("suggestion-breaking-bad").click();

    await expect(page).toHaveURL(/\/Breaking%20Bad/);
  });

  test("should have theme toggle button", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("theme-toggle")).toBeVisible();
  });

  test("should display footer with OMDb credit", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("footer")).toBeVisible();
    await expect(page.getByTestId("omdb-link")).toBeVisible();
    await expect(page.getByTestId("omdb-link")).toHaveAttribute("href", "https://www.omdbapi.com/");
  });
});

test.describe("Search Functionality", () => {
  test("should allow typing in search input", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("The Sopranos");
    await expect(searchInput).toHaveValue("The Sopranos");
  });

  test("should have search button disabled when input is empty", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("search-button")).toBeDisabled();
  });

  test("should enable search button when input has value", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("search-input").fill("Friends");
    await expect(page.getByTestId("search-button")).toBeEnabled();
  });

  test("should submit search on button click", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-input").fill("Friends");
    await page.getByTestId("search-button").click();
    await expect(page).toHaveURL(/\/Friends/);
  });

  test("should submit search on Enter key", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("search-input").fill("Seinfeld");
    await page.getByTestId("search-input").press("Enter");
 
    await expect(page).toHaveURL(/\/Seinfeld/);
  });
});

test.describe("Theme Toggle", () => {
  test("should toggle theme when clicked", async ({ page }) => {
    await page.goto("/");

    const themeToggle = page.getByTestId("theme-toggle");
    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");
    await themeToggle.click();
    await page.waitForTimeout(100);
    const newClass = await html.getAttribute("class");
    expect(newClass).not.toBe(initialClass);
  });
});

test.describe("Accessibility", () => {
  test("should have proper page title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/imdb/i);
  });

  test("search input should be focusable", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByTestId("search-input");
    await searchInput.focus();

    await expect(searchInput).toBeFocused();
  });
});

test.describe("Show Results", () => {
  const API_TIMEOUT = 30000;

  test("should display show information after searching", async ({ page }) => {
    await page.goto("/Breaking%20Bad");

    await expect(page.getByTestId("show-info")).toBeVisible({ timeout: API_TIMEOUT });

    await expect(page.getByTestId("show-title")).toBeVisible();
    await expect(page.getByTestId("show-title")).toContainText("Breaking Bad");

    await expect(page.getByTestId("show-poster")).toBeVisible();

    await expect(page.getByTestId("show-description")).toBeVisible();

    await expect(page.getByTestId("show-seasons-count")).toBeVisible();
  });

  test("should display seasons table with rankings", async ({ page }) => {
    await page.goto("/Breaking%20Bad");

    await expect(page.getByTestId("seasons-table")).toBeVisible({ timeout: API_TIMEOUT });

    await expect(page.locator('[data-testid^="season-row-"]').first()).toBeVisible();

    await expect(page.locator('[data-best-season="true"]')).toBeVisible();
  });

  test("should show season ratings in the table", async ({ page }) => {
    await page.goto("/Breaking%20Bad");

    await expect(page.getByTestId("seasons-table")).toBeVisible({ timeout: API_TIMEOUT });

    const ratingElement = page.locator('[data-testid^="season-rating-"]').first();
    await expect(ratingElement).toBeVisible();
    
    const ratingText = await ratingElement.textContent();
    expect(ratingText).toMatch(/^\d+\.\d{2}$/);
  });

  test("should display correct number of seasons for Breaking Bad", async ({ page }) => {
    await page.goto("/Breaking%20Bad");

    await expect(page.getByTestId("seasons-table")).toBeVisible({ timeout: API_TIMEOUT });

    const seasonRows = page.locator('[data-testid^="season-row-"]');
    await expect(seasonRows).toHaveCount(5);
  });

  test("should show error state for non-existent show", async ({ page }) => {
    await page.goto("/NonExistentShowXYZ123456");

    await expect(page.getByText("Show Not Found")).toBeVisible({ timeout: API_TIMEOUT });

    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });

  test("should navigate from search to show results", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("search-input").fill("The Office");
    await page.getByTestId("search-button").click();

    await expect(page).toHaveURL(/\/The%20Office/);
    await expect(page.getByTestId("show-info")).toBeVisible({ timeout: API_TIMEOUT });
    
    await expect(page.getByTestId("show-title")).toContainText(/office/i);
  });

  test("should rank best season at the top", async ({ page }) => {
    await page.goto("/Breaking%20Bad");

    await expect(page.getByTestId("seasons-table")).toBeVisible({ timeout: API_TIMEOUT });

    const firstRow = page.locator('[data-testid^="season-row-"]').first();
    await expect(firstRow).toHaveAttribute("data-best-season", "true");
  });
});
