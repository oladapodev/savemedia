package com.imediasave.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ensureActive
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.URL
import kotlin.coroutines.coroutineContext

class DownloadWorker internal constructor(
  appContext: Context,
  params: WorkerParameters,
  private val dependencies: DownloadWorkerDependencies,
) : CoroutineWorker(appContext, params) {
  constructor(appContext: Context, params: WorkerParameters) : this(
    appContext,
    params,
    DownloadWorkerDependencies.production(),
  )

  private val jobId = inputData.getString(KEY_ID).orEmpty()
  private val filename = inputData.getString(KEY_FILENAME).orEmpty()
  private val declaredMime = inputData.getString(KEY_MIME_TYPE).orEmpty()
  private val reporter = dependencies.reporterFactory.create(this)

  override suspend fun doWork(): Result {
    val safeId = DownloadPolicy.safeId(jobId)
    val mimeType = DownloadPolicy.normalizeMime(declaredMime)
      ?: return failure("unsupported_mime")
    val startUrl = runCatching { URL(inputData.getString(KEY_URL).orEmpty()) }.getOrNull()
      ?: return failure("invalid_url")
    if (!DownloadPolicy.isAllowedUrl(startUrl)) return failure("https_required")

    val directory = File(applicationContext.cacheDir, DOWNLOAD_DIRECTORY).apply { mkdirs() }
    val finalFile = File(directory, "$safeId-${DownloadPolicy.safeFilename(filename, mimeType)}")
    val partialFile = File(directory, "${finalFile.name}.part")
    partialFile.delete()
    finalFile.delete()

    reporter.setForeground(0, 0, true)
    var finalized = false
    try {
      val connection = openHttpsConnection(startUrl)
      try {
        val responseMime = DownloadPolicy.normalizeMime(connection.contentType)
          ?: throw DownloadFailure("unsupported_response_mime")
        if (!DownloadPolicy.sameConcreteMime(mimeType, responseMime)) {
          throw DownloadFailure("mime_mismatch")
        }
        val contentLength = connection.contentLength
        if (contentLength == 0L) throw DownloadFailure("empty_file")
        if (contentLength > DownloadPolicy.MAX_ITEM_BYTES) throw DownloadFailure("too_large")

        val progressUri = Uri.fromFile(partialFile).toString()
        var written = 0L
        var lastProgress = -1
        var lastPersistedBytes = 0L
        BufferedInputStream(connection.inputStream).use { input ->
          FileOutputStream(partialFile).use { fileOutput ->
            BufferedOutputStream(fileOutput).use { output ->
              val buffer = ByteArray(DEFAULT_BUFFER_SIZE * 4)
              while (true) {
                coroutineContext.ensureActive()
                if (reporter.isCancellationRequested()) throw CancellationException("work_cancelled")
                val count = input.read(buffer)
                if (count < 0) break
                if (count == 0) continue
                if (written + count > DownloadPolicy.MAX_ITEM_BYTES) throw DownloadFailure("too_large")
                output.write(buffer, 0, count)
                written += count
                val progress = if (contentLength > 0) ((written * 100) / contentLength).toInt().coerceIn(0, 99) else -1
                if (progress != lastProgress || written - lastPersistedBytes >= PROGRESS_BYTES) {
                  lastProgress = progress
                  lastPersistedBytes = written
                  reporter.setProgress(progressData(written, contentLength.coerceAtLeast(0), progressUri))
                  reporter.setForeground(written, contentLength, contentLength <= 0)
                }
              }
              output.flush()
              fileOutput.fd.sync()
            }
          }
        }
        if (written <= 0) throw DownloadFailure("empty_file")
        if (contentLength > 0 && written != contentLength) throw DownloadFailure("truncated_file")
        val header = ByteArray(512)
        val headerSize = FileInputStream(partialFile).use { it.read(header) }
        if (headerSize <= 0 || !DownloadPolicy.matchesSignature(responseMime, header.copyOf(headerSize))) {
          throw DownloadFailure("invalid_signature")
        }
        moveIntoPlace(partialFile, finalFile)
        finalized = true
        reporter.setProgress(progressData(written, written, Uri.fromFile(finalFile).toString()))
        return Result.success(workDataOf(
          KEY_FILE_URI to Uri.fromFile(finalFile).toString(),
          KEY_SIZE_BYTES to written,
        ))
      } finally {
        connection.close()
      }
    } catch (cancelled: CancellationException) {
      throw cancelled
    } catch (failure: DownloadFailure) {
      return failure(failure.code)
    } catch (failure: DownloadBoundaryFailure) {
      return failure(failure.code)
    } catch (_: java.net.SocketTimeoutException) {
      return failure("timeout")
    } catch (_: java.io.IOException) {
      return failure("network_error")
    } catch (_: Throwable) {
      return failure("download_failed")
    } finally {
      cleanupArtifacts(partialFile, finalFile, finalized)
    }
  }

  private fun openHttpsConnection(startUrl: URL): DownloadConnection {
    var current = startUrl
    repeat(DownloadPolicy.MAX_REDIRECTS + 1) { redirectCount ->
      if (!DownloadPolicy.isAllowedUrl(current)) throw DownloadFailure("https_required")
      val connection = dependencies.http.open(current)
      val response = try {
        connection.responseCode
      } catch (failure: Throwable) {
        connection.close()
        throw failure
      }
      if (response in 200..299) return connection
      if (response in 300..399) {
        val location = try {
          connection.header("Location")
        } finally {
          connection.close()
        }
        if (redirectCount >= DownloadPolicy.MAX_REDIRECTS || location.isNullOrBlank()) {
          throw DownloadFailure("redirect_limit")
        }
        current = URL(current, location)
      } else {
        connection.close()
        throw DownloadFailure("http_$response")
      }
    }
    throw DownloadFailure("redirect_limit")
  }

  private fun moveIntoPlace(partial: File, final: File) {
    if (!partial.renameTo(final)) throw DownloadFailure("finalize_failed")
  }

  private fun failure(code: String) = Result.failure(workDataOf(KEY_ERROR_CODE to code))

  internal fun foreground(bytes: Long, total: Long, indeterminate: Boolean): ForegroundInfo {
    val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(
        CHANNEL_ID,
        "Downloads",
        NotificationManager.IMPORTANCE_LOW,
      ))
    }
    val progress = if (total > 0) ((bytes * 100) / total).toInt().coerceIn(0, 100) else 0
    val icon = applicationContext.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.stat_sys_download
    val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle("Saving $filename")
      .setContentText(if (indeterminate) "Downloading media" else "$progress%")
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setProgress(100, progress, indeterminate)
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "Cancel",
        WorkManager.getInstance(applicationContext).createCancelPendingIntent(this.id),
      )
      .build()
    val notificationId = 20_000 + (jobId.hashCode() and 0x0fff)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      ForegroundInfo(notificationId, notification)
    }
  }

  internal suspend fun publishForeground(info: ForegroundInfo) = setForeground(info)

  internal suspend fun publishProgress(data: Data) = setProgress(data)

  internal fun workerIsStopped(): Boolean = isStopped

  private class DownloadFailure(val code: String) : Exception(code)

  companion object {
    const val KEY_ID = "id"
    const val KEY_URL = "url"
    const val KEY_FILENAME = "filename"
    const val KEY_MIME_TYPE = "mimeType"
    const val KEY_FILE_URI = "fileUri"
    const val KEY_SIZE_BYTES = "sizeBytes"
    const val KEY_BYTES_WRITTEN = "bytesWritten"
    const val KEY_TOTAL_BYTES = "totalBytes"
    const val KEY_ERROR_CODE = "errorCode"
    const val DOWNLOAD_DIRECTORY = "imediasave-downloads"
    const val CHANNEL_ID = "downloads"
    const val PROGRESS_BYTES = 256L * 1024L

    internal fun progressData(bytesWritten: Long, totalBytes: Long, fileUri: String) = workDataOf(
      KEY_BYTES_WRITTEN to bytesWritten,
      KEY_TOTAL_BYTES to totalBytes,
      KEY_FILE_URI to fileUri,
    )

    internal fun cleanupArtifacts(partialFile: File, finalFile: File, finalized: Boolean) {
      if (!finalized) {
        partialFile.delete()
        finalFile.delete()
      }
    }
  }
}
