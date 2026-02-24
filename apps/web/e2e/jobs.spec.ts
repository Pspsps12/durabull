import {
  expect,
  createJob,
  ensureActiveOrg,
  getDefaultConnectionId,
  getJob,
  getTestQueueName,
  removeJobs,
  test,
  TEST_ORG_SLUG,
} from "./fixtures/test";

async function safeRemoveJobs(
  page: Parameters<typeof removeJobs>[0],
  options: Parameters<typeof removeJobs>[1]
) {
  try {
    await removeJobs(page, options);
  } catch (error) {
    console.warn("Failed to cleanup jobs:", error);
  }
}

test.describe("Jobs", () => {
  test("job detail shows duplicate dialog", async ({ page }) => {
    await ensureActiveOrg(page);
    const connectionId = await getDefaultConnectionId(page);
    const queueName = await getTestQueueName(page, connectionId);
    const createdJobs: string[] = [];

    try {
      const jobId = await createJob(page, {
        connectionId,
        queueName,
        name: `e2e-job-${Date.now()}`,
        data: { e2e: true },
      });
      createdJobs.push(jobId);

      await page.goto(`/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}/jobs/${jobId}`);

      const duplicateButton = page.getByRole("button", { name: "Duplicate" });
      await expect(duplicateButton).toBeEnabled({ timeout: 15000 });
      await duplicateButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Duplicate Job")).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();
    } finally {
      await safeRemoveJobs(page, { connectionId, queueName, jobIds: createdJobs });
    }
  });

  test("invoke promotes a delayed job", async ({ page }) => {
    await ensureActiveOrg(page);
    const connectionId = await getDefaultConnectionId(page);
    const queueName = await getTestQueueName(page, connectionId);
    const createdJobs: string[] = [];

    try {
      const jobId = await createJob(page, {
        connectionId,
        queueName,
        name: `e2e-delayed-${Date.now()}`,
        data: { e2e: true, delayed: true },
        delay: 10 * 60 * 1000,
      });
      createdJobs.push(jobId);

      await page.goto(`/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}/jobs/${jobId}`);
      const invokeButton = page.getByRole("button", { name: "Invoke" });
      await expect(invokeButton).toBeVisible({ timeout: 15000 });
      await expect(invokeButton).toBeEnabled();

      await invokeButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Invoke Job")).toBeVisible();

      const invokeNowButton = dialog.getByRole("button", { name: "Invoke Now" });
      await expect(invokeNowButton).toBeEnabled();
      await invokeNowButton.click();
      await page.waitForURL(
        new RegExp(`/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}`),
        { timeout: 15000 }
      );

      await expect
        .poll(
          async () => {
            const job = await getJob(page, connectionId, queueName, jobId);
            return job.status;
          },
          { timeout: 15000 }
        )
        .not.toBe("delayed");
    } finally {
      await safeRemoveJobs(page, { connectionId, queueName, jobIds: createdJobs });
    }
  });

  test("remove job from detail page", async ({ page }) => {
    await ensureActiveOrg(page);
    const connectionId = await getDefaultConnectionId(page);
    const queueName = await getTestQueueName(page, connectionId);
    const createdJobs: string[] = [];

    try {
      const jobId = await createJob(page, {
        connectionId,
        queueName,
        name: `e2e-remove-${Date.now()}`,
        data: { e2e: true },
        // Keep the job out of active processing while validating remove behavior.
        delay: 10 * 60 * 1000,
      });
      createdJobs.push(jobId);

      await page.goto(`/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}/jobs/${jobId}`);
      await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();

      await page.getByRole("button", { name: "Remove" }).click();
      await page.waitForURL(
        new RegExp(`/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}`)
      );

      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              `/api/c/${connectionId}/queues/${queueName}/jobs/${jobId}`
            );
            return response.status();
          },
          { timeout: 15000 }
        )
        .toBe(404);
    } finally {
      await safeRemoveJobs(page, { connectionId, queueName, jobIds: createdJobs });
    }
  });
});
