package com.imediasave.download

import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Operation
import androidx.work.WorkManager
import androidx.work.workDataOf

internal data class DownloadWorkInput(
  val id: String,
  val url: String,
  val filename: String,
  val mimeType: String,
)

internal class DownloadScheduler(
  private val workManager: WorkManager,
  private val now: () -> Long = System::currentTimeMillis,
) {
  fun enqueue(input: DownloadWorkInput): Operation {
    val enqueuedAt = now()
    val requestBuilder = OneTimeWorkRequestBuilder<DownloadWorker>()
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setInputData(workDataOf(
        DownloadWorker.KEY_ID to input.id,
        DownloadWorker.KEY_URL to input.url,
        DownloadWorker.KEY_FILENAME to input.filename,
        DownloadWorker.KEY_MIME_TYPE to input.mimeType,
        KEY_ENQUEUED_AT to enqueuedAt,
      ))
      .addTag(DownloadPolicy.WORK_TAG)
      .addTag(DownloadPolicy.workName(input.id))
    DownloadPolicy.metadataTags(input.id, input.filename, input.mimeType, enqueuedAt)
      .forEach { tag -> requestBuilder.addTag(tag) }
    val request = requestBuilder.build()
    return workManager.enqueueUniqueWork(
      DownloadPolicy.workName(input.id),
      ExistingWorkPolicy.KEEP,
      request,
    )
  }

  fun cancel(id: String): Operation = workManager.cancelUniqueWork(DownloadPolicy.workName(id))

  companion object {
    const val KEY_ENQUEUED_AT = "enqueuedAt"
  }
}
