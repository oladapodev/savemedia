package com.imediasave.download

import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.Operation
import androidx.work.WorkManager
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class DownloadSchedulerTest {
  @Test
  fun `enqueue uses job-scoped unique KEEP work with a connected network constraint`() {
    val operation = mock(Operation::class.java)
    val manager = mock(WorkManager::class.java) { invocation ->
      if (invocation.method.name == "enqueueUniqueWork") operation
      else org.mockito.Answers.RETURNS_DEFAULTS.answer(invocation)
    }
    val scheduler = DownloadScheduler(manager) { 123L }

    scheduler.enqueue(DownloadWorkInput(
      id = "job-1",
      url = "https://cdn.example/clip.mp4",
      filename = "clip.mp4",
      mimeType = "video/mp4",
    ))

    val invocation = org.mockito.Mockito.mockingDetails(manager).invocations
      .single { it.method.name == "enqueueUniqueWork" }
    assertEquals("imediasave-download-job-1", invocation.arguments[0])
    assertEquals(ExistingWorkPolicy.KEEP, invocation.arguments[1])
    val request = invocation.arguments[2] as OneTimeWorkRequest
    assertEquals(NetworkType.CONNECTED, request.workSpec.constraints.requiredNetworkType)
    assertEquals("video/mp4", request.workSpec.input.getString(DownloadWorker.KEY_MIME_TYPE))
    assertEquals(123L, request.workSpec.input.getLong(DownloadScheduler.KEY_ENQUEUED_AT, -1))
    assertEquals(
      DownloadWorkMetadata("job-1", "clip.mp4", "video/mp4", 123L),
      DownloadPolicy.metadataFromTags(request.tags),
    )
  }

  @Test
  fun `cancel addresses the same unique job work name`() {
    val manager = mock(WorkManager::class.java)
    val operation = mock(Operation::class.java)
    `when`(manager.cancelUniqueWork("imediasave-download-job-1")).thenReturn(operation)

    DownloadScheduler(manager).cancel("job-1")

    verify(manager).cancelUniqueWork("imediasave-download-job-1")
  }
}
