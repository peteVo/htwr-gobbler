import { test, expect } from "@playwright/test";
test("undated module actions persist through completion, reopening, editing and deletion", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin },
    email = `actions-${Date.now()}@example.test`,
    password = "a-local-test-password-123";
  await page.goto("/");
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: false }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  const { id } = await (
    await page.request.post("/api/courses", {
      headers,
      data: { name: "Datenkommunikation test" },
    })
  ).json();
  await page.reload();
  const section = page.getByRole("region", {
    name: "Next actions",
    exact: true,
  });
  await section.getByRole("button", { name: "Add action" }).click();
  await section
    .getByLabel("Action title", { exact: true })
    .fill("Enable course MFA");
  await section.getByLabel("Action module").selectOption(id);
  await section
    .getByLabel("Instructions and coverage notes")
    .fill("User action required; no cutoff provided.");
  await section
    .getByLabel("Original instructions URL")
    .fill("https://moodle.rwth-aachen.de/");
  await section
    .getByRole("button", { name: "Save action", exact: true })
    .click();
  await expect(
    section.getByRole("button", { name: "Enable course MFA", exact: true }),
  ).toBeVisible();
  await expect(
    section.getByText("Datenkommunikation test · No date assigned"),
  ).toBeVisible();
  const stored = await (await page.request.get("/api/data")).json();
  expect(stored.items).toHaveLength(0);
  expect(stored.actions).toHaveLength(1);
  await section
    .getByRole("button", { name: "Complete Enable course MFA" })
    .click();
  await page.reload();
  await section.getByText("Completed actions (1)", { exact: true }).click();
  await section
    .getByRole("button", { name: "Reopen Enable course MFA" })
    .click();
  await section
    .getByRole("button", { name: "Enable course MFA", exact: true })
    .click();
  await section
    .getByLabel("Action title", { exact: true })
    .fill("Review course setup");
  await section
    .getByRole("button", { name: "Save action", exact: true })
    .click();
  await section
    .getByRole("button", { name: "Review course setup", exact: true })
    .click();
  await section
    .getByRole("button", { name: "Delete action", exact: true })
    .click();
  await expect(
    section.getByText("No open next actions recorded.", { exact: false }),
  ).toBeVisible();
});

test("long action titles and editing controls fit narrow screens", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin };
  await page.request.post("/api/auth/register", {
    headers,
    data: {
      email: `action-width-${Date.now()}@example.test`,
      password: "a-local-test-password-123",
    },
  });
  await page.request.post("/api/actions", {
    headers,
    data: {
      title:
        "Review the original course instructions and confirm which exercise group and module this belongs to",
      notes:
        "No deadline was stated. Keep the source quotation and review the original material before acting.",
      source_url: "https://moodle.rwth-aachen.de/course/view.php?id=1",
    },
  });
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const section = page.getByRole("region", {
      name: "Next actions",
      exact: true,
    });
    await section
      .getByRole("button", { name: /^Review the original course instructions/ })
      .click();
    await expect(
      section.getByLabel("Action title", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
