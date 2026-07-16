package com.imediasave.download

import androidx.work.Data
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

internal interface DownloadHttpBoundary {
  fun open(url: URL): DownloadConnection
}

internal interface DownloadConnection : AutoCloseable {
  val responseCode: Int
  val contentType: String?
  val contentLength: Long
  val inputStream: InputStream

  fun header(name: String): String?
}

internal interface DownloadWorkReporter {
  suspend fun setForeground(bytesWritten: Long, totalBytes: Long, indeterminate: Boolean)
  suspend fun setProgress(data: Data)
  fun isCancellationRequested(): Boolean
}

internal fun interface DownloadWorkReporterFactory {
  fun create(worker: DownloadWorker): DownloadWorkReporter
}

internal data class DownloadWorkerDependencies(
  val http: DownloadHttpBoundary,
  val reporterFactory: DownloadWorkReporterFactory,
) {
  companion object {
    fun production() = DownloadWorkerDependencies(
      http = HttpUrlConnectionBoundary,
      reporterFactory = DownloadWorkReporterFactory { AndroidDownloadWorkReporter(it) },
    )
  }
}

private object HttpUrlConnectionBoundary : DownloadHttpBoundary {
  override fun open(url: URL): DownloadConnection {
    val connection = url.openConnection() as? HttpURLConnection
      ?: throw DownloadBoundaryFailure("invalid_url")
    connection.instanceFollowRedirects = false
    connection.connectTimeout = DownloadPolicy.CONNECT_TIMEOUT_MS
    connection.readTimeout = DownloadPolicy.READ_TIMEOUT_MS
    connection.useCaches = false
    connection.setRequestProperty(
      "Accept",
      "audio/mpeg,audio/mp4,audio/ogg,audio/wav,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm",
    )
    return HttpUrlDownloadConnection(connection)
  }
}

private class HttpUrlDownloadConnection(
  private val connection: HttpURLConnection,
) : DownloadConnection {
  override val responseCode: Int get() = connection.responseCode
  override val contentType: String? get() = connection.contentType
  override val contentLength: Long get() = connection.contentLengthLong
  override val inputStream: InputStream get() = connection.inputStream

  override fun header(name: String): String? = connection.getHeaderField(name)

  override fun close() {
    connection.disconnect()
  }
}

private class AndroidDownloadWorkReporter(
  private val worker: DownloadWorker,
) : DownloadWorkReporter {
  override suspend fun setForeground(bytesWritten: Long, totalBytes: Long, indeterminate: Boolean) {
    worker.publishForeground(worker.foreground(bytesWritten, totalBytes, indeterminate))
  }

  override suspend fun setProgress(data: Data) {
    worker.publishProgress(data)
  }

  override fun isCancellationRequested(): Boolean = worker.workerIsStopped()
}

internal class DownloadBoundaryFailure(val code: String) : Exception(code)
