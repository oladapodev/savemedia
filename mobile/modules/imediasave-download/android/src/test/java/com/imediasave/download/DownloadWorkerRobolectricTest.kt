package com.imediasave.download

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.Data
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.net.URL

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 34])
class DownloadWorkerRobolectricTest {
  @Test
  fun `worker rejects non HTTPS before creating app download artifacts`() = runBlocking {
    val fixture = fixture()
    val worker = fixture.worker(
      id = "worker-http",
      url = "http://cdn.example/clip.mp4",
    )

    val result = worker.doWork()

    assertFailure("https_required", result)
    assertFalse(fixture.directory.exists())
    assertTrue(fixture.http.openedUrls.isEmpty())
  }

  @Test
  fun `worker rejects redirect to non HTTPS and closes redirect response`() = runBlocking {
    val redirect = FakeConnection(
      responseCode = 302,
      headers = mapOf("Location" to "http://unsafe.example/clip.mp4"),
    )
    val fixture = fixture(connections = listOf(redirect))

    val result = fixture.worker(id = "redirect-http").doWork()

    assertFailure("https_required", result)
    assertEquals(listOf("https://cdn.example/clip.mp4"), fixture.http.openedUrls)
    assertTrue(redirect.closed)
    assertDirectoryEmpty(fixture.directory)
  }

  @Test
  fun `worker completes bounded transfer through foreground and progress boundary`() = runBlocking {
    val body = mp4Bytes(payloadSize = 96 * 1024)
    val response = FakeConnection(
      responseCode = 200,
      contentType = "video/mp4; charset=binary",
      contentLength = body.size.toLong(),
      body = body,
    )
    val fixture = fixture(connections = listOf(response))

    val result = fixture.worker(id = "bounded-success").doWork()

    assertTrue(result is ListenableWorker.Result.Success)
    val output = (result as ListenableWorker.Result.Success).outputData
    assertEquals(body.size.toLong(), output.getLong(DownloadWorker.KEY_SIZE_BYTES, -1))
    val fileUri = requireNotNull(output.getString(DownloadWorker.KEY_FILE_URI))
    val finalFile = File(requireNotNull(android.net.Uri.parse(fileUri).path))
    assertTrue(finalFile.exists())
    assertTrue(body.contentEquals(finalFile.readBytes()))
    assertTrue(response.closed)
    assertTrue(fixture.reporter.foregrounds.size >= 2)
    assertTrue(fixture.reporter.foregrounds.first().indeterminate)
    assertTrue(fixture.reporter.foregrounds.any { !it.indeterminate && it.bytesWritten > 0 })
    assertTrue(fixture.reporter.progress.any {
      it.getLong(DownloadWorker.KEY_BYTES_WRITTEN, -1) == body.size.toLong()
    })
    assertTrue(finalFile.delete())
  }

  @Test
  fun `worker rejects declared transfer above item bound before opening body`() = runBlocking {
    val response = FakeConnection(
      responseCode = 200,
      contentType = "video/mp4",
      contentLength = DownloadPolicy.MAX_ITEM_BYTES + 1,
      body = mp4Bytes(payloadSize = 16),
    )
    val fixture = fixture(connections = listOf(response))

    val result = fixture.worker(id = "oversized-transfer").doWork()

    assertFailure("too_large", result)
    assertFalse(response.inputOpened)
    assertTrue(response.closed)
    assertDirectoryEmpty(fixture.directory)
  }

  @Test
  fun `worker cancellation removes partially transferred artifact`() = runBlocking {
    val body = mp4Bytes(payloadSize = 128 * 1024)
    val response = FakeConnection(
      responseCode = 200,
      contentType = "video/mp4",
      contentLength = body.size.toLong(),
      body = body,
      maxReadSize = 8 * 1024,
    )
    val fixture = fixture(connections = listOf(response))
    fixture.reporter.cancelAfterFirstProgress = true

    try {
      fixture.worker(id = "cancelled-transfer").doWork()
      fail("Expected worker cancellation")
    } catch (_: CancellationException) {
      // WorkManager owns cancellation state; the worker must still clean its partial file.
    }

    assertTrue(fixture.reporter.progress.isNotEmpty())
    assertTrue(response.closed)
    assertDirectoryEmpty(fixture.directory)
  }

  @Test
  fun `worker failure after writing removes partial and final artifacts`() = runBlocking {
    val invalidBody = "<html>not a video</html>".toByteArray()
    val response = FakeConnection(
      responseCode = 200,
      contentType = "video/mp4",
      contentLength = invalidBody.size.toLong(),
      body = invalidBody,
    )
    val fixture = fixture(connections = listOf(response))

    val result = fixture.worker(id = "signature-failure").doWork()

    assertFailure("invalid_signature", result)
    assertTrue(fixture.reporter.progress.isNotEmpty())
    assertTrue(response.closed)
    assertDirectoryEmpty(fixture.directory)
  }

  private fun fixture(connections: List<FakeConnection> = emptyList()): Fixture {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val directory = File(context.cacheDir, DownloadWorker.DOWNLOAD_DIRECTORY).apply { deleteRecursively() }
    val http = FakeHttpBoundary(connections.toMutableList())
    val reporter = RecordingReporter()
    return Fixture(context, directory, http, reporter)
  }

  private data class Fixture(
    val context: Context,
    val directory: File,
    val http: FakeHttpBoundary,
    val reporter: RecordingReporter,
  ) {
    fun worker(
      id: String,
      url: String = "https://cdn.example/clip.mp4",
      filename: String = "clip.mp4",
      mimeType: String = "video/mp4",
    ): DownloadWorker {
      val dependencies = DownloadWorkerDependencies(http) { reporter }
      val factory = object : WorkerFactory() {
        override fun createWorker(
          appContext: Context,
          workerClassName: String,
          workerParameters: WorkerParameters,
        ): ListenableWorker = DownloadWorker(appContext, workerParameters, dependencies)
      }
      return TestListenableWorkerBuilder<DownloadWorker>(context)
        .setWorkerFactory(factory)
        .setInputData(workDataOf(
          DownloadWorker.KEY_ID to id,
          DownloadWorker.KEY_URL to url,
          DownloadWorker.KEY_FILENAME to filename,
          DownloadWorker.KEY_MIME_TYPE to mimeType,
        ))
        .build()
    }
  }

  private class FakeHttpBoundary(
    private val connections: MutableList<FakeConnection>,
  ) : DownloadHttpBoundary {
    val openedUrls = mutableListOf<String>()

    override fun open(url: URL): DownloadConnection {
      openedUrls += url.toString()
      if (connections.isEmpty()) error("No fake response for $url")
      return connections.removeAt(0)
    }
  }

  private class FakeConnection(
    override val responseCode: Int,
    override val contentType: String? = null,
    override val contentLength: Long = -1,
    private val headers: Map<String, String> = emptyMap(),
    body: ByteArray = ByteArray(0),
    maxReadSize: Int = Int.MAX_VALUE,
  ) : DownloadConnection {
    private val bodyStream: InputStream = ChunkedInputStream(body, maxReadSize)
    override val inputStream: InputStream
      get() {
        inputOpened = true
        return bodyStream
      }
    var inputOpened = false
    var closed = false

    override fun header(name: String): String? = headers.entries
      .firstOrNull { it.key.equals(name, ignoreCase = true) }
      ?.value

    override fun close() {
      closed = true
    }
  }

  private class RecordingReporter : DownloadWorkReporter {
    val foregrounds = mutableListOf<RecordedForeground>()
    val progress = mutableListOf<Data>()
    var cancelAfterFirstProgress = false

    override suspend fun setForeground(bytesWritten: Long, totalBytes: Long, indeterminate: Boolean) {
      foregrounds += RecordedForeground(bytesWritten, totalBytes, indeterminate)
    }

    override suspend fun setProgress(data: Data) {
      progress += data
    }

    override fun isCancellationRequested(): Boolean = cancelAfterFirstProgress && progress.isNotEmpty()
  }

  private data class RecordedForeground(
    val bytesWritten: Long,
    val totalBytes: Long,
    val indeterminate: Boolean,
  )

  private class ChunkedInputStream(
    body: ByteArray,
    private val maxReadSize: Int,
  ) : ByteArrayInputStream(body) {
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
      super.read(buffer, offset, minOf(length, maxReadSize))
  }

  private fun assertFailure(code: String, result: ListenableWorker.Result) {
    assertEquals(
      ListenableWorker.Result.failure(workDataOf(DownloadWorker.KEY_ERROR_CODE to code)),
      result,
    )
  }

  private fun assertDirectoryEmpty(directory: File) {
    assertTrue(!directory.exists() || directory.listFiles().orEmpty().isEmpty())
  }

  private fun mp4Bytes(payloadSize: Int): ByteArray = byteArrayOf(
    0, 0, 0, 24,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d,
  ) + ByteArray(payloadSize) { (it % 251).toByte() }
}
