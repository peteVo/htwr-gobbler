import { test, expect } from "@playwright/test";
test("PDF dates are read locally with page evidence and saved as needing review", async ({
  page,
}) => {
  const email = `pdf-${Date.now()}@example.test`,
    password = "a-local-test-password-123";
  await page.request.post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:5173" },
    data: { email, password },
  });
  const course = await (
    await page.request.post("/api/courses", {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: { name: "PDF Module" },
    })
  ).json();
  await page.goto("/");
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Review document text" }).click();
  await page.getByLabel("Module for this document").selectOption(course.id);
  let aiRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/")) aiRequests++;
  });
  await page
    .getByLabel("Exercise PDF · up to 20 pages, 10 MB")
    .setInputFiles("tests/fixtures/exercise.pdf");
  await expect(
    page.getByRole("textbox", { name: "Document text", exact: true }),
  ).toHaveValue(/Abgabe bis zum 20.10.2026/, { timeout: 20000 });
  await page
    .getByRole("button", { name: "Find explicit dates locally" })
    .click();
  await expect(page.getByText(/Needs review · Page 1/)).toBeVisible();
  expect(aiRequests).toBe(0);
  await page.getByRole("button", { name: "Review and save" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(
    page.getByText("Deadline candidate · exercise.pdf", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".verification.review")).toContainText(
    "Needs review",
  );
  await expect(
    page.locator(".course-label").filter({ hasText: "PDF Module" }),
  ).toBeVisible();
  const reopen = async () => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review document text", exact: true })
      .click();
    await page.getByLabel("Module for this document").selectOption(course.id);
  };
  await reopen();
  await page
    .getByLabel("Exercise PDF · up to 20 pages, 10 MB")
    .setInputFiles("tests/fixtures/exercise.pdf");
  await expect(page.getByLabel("Document text", { exact: true })).toHaveValue(
    /Abgabe bis zum 20.10.2026/,
  );
  await page
    .getByRole("button", { name: "Find explicit dates locally" })
    .click();
  await page.getByRole("button", { name: "Review and save" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  let saved = await (await page.request.get("/api/data")).json();
  expect(saved.items).toHaveLength(1);
  const id = saved.items[0].id;
  await reopen();
  await page
    .getByLabel("Document text", { exact: true })
    .fill("Abgabe bis zum 19.10.2026 um 16:00 Uhr.");
  await page
    .getByRole("button", { name: "Find explicit dates locally" })
    .click();
  await page
    .getByLabel("Update an existing document task (optional)")
    .selectOption(id);
  await page.getByRole("button", { name: "Review and save" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  saved = await (await page.request.get("/api/data")).json();
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0]).toMatchObject({
    id,
    course_id: course.id,
    starts_at: "2026-10-19T14:00:00.000Z",
    verification: "needs_review",
  });
  expect(saved.changes[0].kind).toBe("deadline_earlier");
  expect(aiRequests).toBe(0);
});
