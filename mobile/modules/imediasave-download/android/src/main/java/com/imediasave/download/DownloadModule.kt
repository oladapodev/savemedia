package com.imediasave.download

import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.Observer
import androidx.work.WorkInfo
import androidx.work.WorkManager
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import java.net.URL

class DownloadModule : Module() {
  private val context by lazy { requireNotNull(appContext.reactContext).applicationContext }
  private val workManager by lazy { WorkManager.getInstance(context) }
  private val scheduler by lazy { DownloadScheduler(workManager) }
  private val workLiveData by lazy { workManager.getWorkInfosByTagLiveData(DownloadPolicy.WORK_TAG) }
  private val shareQueue by lazy { ShareQueueStore(context) }
  private val shareIntake by lazy { ShareIntake(context, shareQueue) }
  private val mainHandler = Handler(Looper.getMainLooper())
  private val shareIntentGate = ShareIntentGate(EXTRA_SHARE_PROCESSED)
  private var observingDownloads = false
  private var previousEvents = emptyMap<String, Map<String, Any?>>()

  private val workObserver = Observer<List<WorkInfo>> { infos ->
    val current = currentWork(infos).associate { event -> event.getValue("id") as String to event }
    current.forEach { (id, event) ->
      if (previousEvents[id] != event) sendEvent(EVENT_DOWNLOAD, event)
    }
    previousEvents = current
  }

  override fun definition() = ModuleDefinition {
    Name("IMediaSaveDownload")
    Events(EVENT_DOWNLOAD, EVENT_SHARE_QUEUE)

    AsyncFunction("enqueue") Coroutine { input: Map<String, String> ->
      val id = input[DownloadWorker.KEY_ID].orEmpty()
      val url = input[DownloadWorker.KEY_URL].orEmpty()
      val filename = input[DownloadWorker.KEY_FILENAME].orEmpty()
      val mimeType = DownloadPolicy.normalizeMime(input[DownloadWorker.KEY_MIME_TYPE])
        ?: throw IllegalArgumentException("unsupported_mime")
      require(id.matches(Regex("[A-Za-z0-9._-]{1,96}"))) { "invalid_id" }
      require(filename.isNotBlank() && filename.length <= 256) { "invalid_filename" }
      require(runCatching { DownloadPolicy.isAllowedUrl(URL(url)) }.getOrDefault(false)) { "https_required" }

      scheduler.enqueue(DownloadWorkInput(id, url, filename, mimeType)).result.get()
    }

    AsyncFunction("cancel") Coroutine { id: String ->
      if (id.matches(Regex("[A-Za-z0-9._-]{1,96}"))) {
        scheduler.cancel(id).result.get()
      }
    }

    AsyncFunction("list") Coroutine { ->
      currentWork(workManager.getWorkInfosByTag(DownloadPolicy.WORK_TAG).get())
    }

    AsyncFunction("listSharedPayloads") Coroutine { ->
      shareQueue.list().map(SharedBatchRecord::toMap)
    }

    AsyncFunction("consumeSharedPayloads") Coroutine { id: String ->
      shareQueue.consume(id)
      sendEvent(EVENT_SHARE_QUEUE, mapOf("queued" to shareQueue.list().isNotEmpty()))
    }

    OnCreate {
      processShareIntent(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      processShareIntent(intent)
    }

    OnStartObserving(EVENT_DOWNLOAD) {
      startDownloadObservation()
    }

    OnStopObserving(EVENT_DOWNLOAD) {
      stopDownloadObservation()
    }

    OnDestroy {
      stopDownloadObservation()
    }
  }

  private fun processShareIntent(intent: Intent?) {
    if (intent == null || !shareIntake.handles(intent) || !shareIntentGate.tryStart(intent)) return
    val job = appContext.backgroundCoroutineScope.launch {
      var committed = false
      try {
        shareIntake.receive(intent)
        shareIntentGate.committed(intent)
        committed = true
        sendEvent(EVENT_SHARE_QUEUE, mapOf("queued" to true))
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (_: Throwable) {
        // Persistence failures remain retryable on a later intent delivery.
      } finally {
        if (!committed) shareIntentGate.retryable(intent)
      }
    }
    job.invokeOnCompletion { failure ->
      if (failure is CancellationException) shareIntentGate.retryable(intent)
    }
  }

  private fun startDownloadObservation() {
    if (observingDownloads) return
    observingDownloads = true
    mainHandler.post {
      if (observingDownloads) workLiveData.observeForever(workObserver)
    }
  }

  private fun stopDownloadObservation() {
    if (!observingDownloads) return
    observingDownloads = false
    mainHandler.post { workLiveData.removeObserver(workObserver) }
  }

  private fun currentWork(infos: List<WorkInfo>): List<Map<String, Any?>> = infos
    .mapNotNull { info ->
      DownloadPolicy.metadataFromTags(info.tags)?.let { metadata -> TaggedWork(info, metadata) }
    }
    .groupBy { it.metadata.id }
    .values
    .mapNotNull { jobs -> jobs.maxByOrNull { it.metadata.enqueuedAt } }
    .map { eventFrom(it.info, it.metadata) }

  private fun eventFrom(info: WorkInfo, metadata: DownloadWorkMetadata): Map<String, Any?> {
    val progress = info.progress
    val output = info.outputData
    val mimeType = metadata.mimeType
    val fileUri = output.getString(DownloadWorker.KEY_FILE_URI)
      ?: progress.getString(DownloadWorker.KEY_FILE_URI)
    val size = output.getLong(DownloadWorker.KEY_SIZE_BYTES, -1).takeIf { it >= 0 }
    val bytesWritten = progress.getLong(DownloadWorker.KEY_BYTES_WRITTEN, -1).takeIf { it >= 0 }
      ?: size
    val totalBytes = progress.getLong(DownloadWorker.KEY_TOTAL_BYTES, -1).takeIf { it >= 0 }
      ?: size
    return mapOf(
      "id" to metadata.id,
      "status" to when (info.state) {
        WorkInfo.State.ENQUEUED -> "queued"
        WorkInfo.State.BLOCKED -> "paused"
        WorkInfo.State.RUNNING -> "downloading"
        WorkInfo.State.SUCCEEDED -> "complete"
        WorkInfo.State.FAILED -> "failed"
        WorkInfo.State.CANCELLED -> "cancelled"
      },
      "filename" to metadata.filename,
      "mediaType" to runCatching { DownloadPolicy.mediaType(mimeType) }.getOrNull(),
      "mimeType" to mimeType,
      "fileUri" to fileUri,
      "sizeBytes" to size,
      "bytesWritten" to bytesWritten,
      "totalBytes" to totalBytes,
      "errorCode" to output.getString(DownloadWorker.KEY_ERROR_CODE),
    )
  }

  private data class TaggedWork(
    val info: WorkInfo,
    val metadata: DownloadWorkMetadata,
  )

  companion object {
    private const val EVENT_DOWNLOAD = "onDownloadEvent"
    private const val EVENT_SHARE_QUEUE = "onShareQueueChanged"
    private const val EXTRA_SHARE_PROCESSED = "com.imediasave.download.SHARE_PROCESSED"
  }
}
