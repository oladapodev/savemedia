package com.imediasave.download

import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Operation
import androidx.work.WorkManager
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.ArgumentCaptor
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
    val manager = mock(WorkManager::class.java)
    val operation = mock(Operation::class.java)
    val fallbackRequest = OneTimeWorkRequestBuilder<DownloadWorker>().build()
    val anyName = org.mockito.ArgumentMatchers.anyString()
    val anyPolicy = org.mockito.ArgumentMatchers.any(ExistingWorkPolicy::class.java)
      ?: ExistingWorkPolicy.KEEP
    val anyRequest = org.mockito.ArgumentMatchers.any(OneTimeWorkRequest::class.java)
      ?: fallbackRequest
    `when`(manager.enqueueUniqueWork(
      anyName,
      anyPolicy,
      anyRequest,
    )).thenReturn(operation)
    val scheduler = DownloadScheduler(manager) { 123L }

    scheduler.enqueue(DownloadWorkInput(
      id = "job-1",
      url = "https://cdn.example/clip.mp4",
      filename = "clip.mp4",
      mimeType = "video/mp4",
    ))

    val request = ArgumentCaptor.forClass(OneTimeWorkRequest::class.java)
    val expectedName = org.mockito.ArgumentMatchers.eq("imediasave-download-job-1")
      ?: "imediasave-download-job-1"
    val expectedPolicy = org.mockito.ArgumentMatchers.eq(ExistingWorkPolicy.KEEP)
      ?: ExistingWorkPolicy.KEEP
    val capturedRequest = request.capture() ?: fallbackRequest
    verify(manager).enqueueUniqueWork(
      expectedName,
      expectedPolicy,
      capturedRequest,
    )
    assertEquals(NetworkType.CONNECTED, request.value.workSpec.constraints.requiredNetworkType)
    assertEquals("video/mp4", request.value.workSpec.input.getString(DownloadWorker.KEY_MIME_TYPE))
    assertEquals(123L, request.value.workSpec.input.getLong(DownloadScheduler.KEY_ENQUEUED_AT, -1))
    assertEquals(
      DownloadWorkMetadata("job-1", "clip.mp4", "video/mp4", 123L),
      DownloadPolicy.metadataFromTags(request.value.tags),
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
