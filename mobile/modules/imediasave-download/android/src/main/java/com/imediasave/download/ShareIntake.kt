package com.imediasave.download

import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID

object SharePolicy {
  const val MAX_ITEMS = 10
  const val MAX_ITEM_BYTES = DownloadPolicy.MAX_ITEM_BYTES
  const val MAX_TOTAL_BYTES = 1024L * 1024L * 1024L
  const val MAX_TEXT_CHARS = 8_192
  const val MAX_NAME_CHARS = 1_024

  fun validMime(mimeType: String): Boolean {
    val normalized = DownloadPolicy.normalizeMime(mimeType) ?: return false
    return DownloadPolicy.mediaType(normalized) == "image" || DownloadPolicy.mediaType(normalized) == "video"
  }
  fun validSize(size: Long) = size in 1..MAX_ITEM_BYTES
  fun withinCopyCeiling(bytes: Long) = bytes <= MAX_ITEM_BYTES
  fun mediaTypeForIntent(mimeType: String?): String? = when (mimeType?.substringBefore(';')?.trim()?.lowercase()) {
    "image/*", "image/jpeg", "image/png", "image/gif", "image/webp" -> "image"
    "video/*", "video/mp4", "video/quicktime", "video/webm" -> "video"
    else -> null
  }
}

data class SharedPayloadRecord(
  val value: String,
  val shareType: String,
  val mimeType: String?,
  val contentUri: String?,
  val contentType: String?,
  val contentMimeType: String?,
  val originalName: String?,
  val contentSize: Long?,
) {
  fun toJson() = JSONObject().apply {
    put("value", value)
    put("shareType", shareType)
    putNullable("mimeType", mimeType)
    putNullable("contentUri", contentUri)
    putNullable("contentType", contentType)
    putNullable("contentMimeType", contentMimeType)
    putNullable("originalName", originalName)
    putNullable("contentSize", contentSize)
  }

  fun toMap(): Map<String, Any?> = mapOf(
    "value" to value,
    "shareType" to shareType,
    "mimeType" to mimeType,
    "contentUri" to contentUri,
    "contentType" to contentType,
    "contentMimeType" to contentMimeType,
    "originalName" to originalName,
    "contentSize" to contentSize,
  )

  companion object {
    fun fromJson(json: JSONObject) = SharedPayloadRecord(
      value = json.getString("value"),
      shareType = json.getString("shareType"),
      mimeType = json.nullableString("mimeType"),
      contentUri = json.nullableString("contentUri"),
      contentType = json.nullableString("contentType"),
      contentMimeType = json.nullableString("contentMimeType"),
      originalName = json.nullableString("originalName"),
      contentSize = json.nullableLong("contentSize"),
    )
  }
}

data class SharedBatchRecord(
  val id: String,
  val payloads: List<SharedPayloadRecord>,
  val errorCode: String? = null,
  val errorMessage: String? = null,
) {
  fun toJson() = JSONObject().apply {
    put("id", id)
    put("payloads", JSONArray().apply { payloads.forEach { put(it.toJson()) } })
    putNullable("errorCode", errorCode)
    putNullable("errorMessage", errorMessage)
  }

  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "payloads" to payloads.map(SharedPayloadRecord::toMap),
    "errorCode" to errorCode,
    "errorMessage" to errorMessage,
  )

  companion object {
    fun fromJson(json: JSONObject): SharedBatchRecord {
      val payloads = json.getJSONArray("payloads")
      return SharedBatchRecord(
        id = json.getString("id"),
        payloads = (0 until payloads.length()).map { SharedPayloadRecord.fromJson(payloads.getJSONObject(it)) },
        errorCode = json.nullableString("errorCode"),
        errorMessage = json.nullableString("errorMessage"),
      )
    }
  }
}

class ShareQueueStore(private val context: Context) {
  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  @Synchronized
  fun list(): List<SharedBatchRecord> = readQueue()

  @Synchronized
  fun add(batch: SharedBatchRecord) {
    val queue = readQueue().filterNot { it.id == batch.id }.toMutableList()
    queue += batch
    val evicted = mutableListOf<SharedBatchRecord>()
    while (queue.size > MAX_QUEUED_BATCHES) evicted += queue.removeAt(0)
    if (!writeQueue(queue)) {
      cleanup(batch)
      throw IllegalStateException("share_queue_persist_failed")
    }
    evicted.forEach(::cleanup)
  }

  @Synchronized
  fun consume(id: String) {
    val queue = readQueue().toMutableList()
    val removed = queue.firstOrNull { it.id == id } ?: return
    queue.removeAll { it.id == id }
    check(writeQueue(queue)) { "share_queue_persist_failed" }
    cleanup(removed)
  }

  private fun readQueue(): List<SharedBatchRecord> = runCatching {
    val json = JSONArray(preferences.getString(KEY_QUEUE, "[]"))
    (0 until json.length()).map { SharedBatchRecord.fromJson(json.getJSONObject(it)) }
  }.getOrDefault(emptyList())

  private fun writeQueue(queue: List<SharedBatchRecord>): Boolean {
    val json = JSONArray().apply { queue.forEach { put(it.toJson()) } }
    return preferences.edit().putString(KEY_QUEUE, json.toString()).commit()
  }

  private fun cleanup(batch: SharedBatchRecord) {
    batch.payloads.mapNotNull { it.contentUri }
      .mapNotNull { runCatching { File(Uri.parse(it).path.orEmpty()) }.getOrNull() }
      .forEach { file ->
        val root = "${File(context.cacheDir, SHARE_DIRECTORY).canonicalPath}${File.separator}"
        if (file.canonicalPath.startsWith(root)) {
          file.delete()
          file.parentFile?.takeIf { it.name == batch.id }?.delete()
        }
      }
  }

  companion object {
    const val SHARE_DIRECTORY = "imediasave-shares"
    private const val PREFERENCES = "imediasave-share-queue"
    private const val KEY_QUEUE = "queue"
    private const val MAX_QUEUED_BATCHES = 8
  }
}

class ShareIntake(
  private val context: Context,
  private val queue: ShareQueueStore,
) {
  fun handles(intent: Intent): Boolean = intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE

  fun receive(intent: Intent): SharedBatchRecord {
    val batchId = UUID.randomUUID().toString()
    val batch = try {
      when (intent.action) {
        Intent.ACTION_SEND -> receiveSingle(batchId, intent)
        Intent.ACTION_SEND_MULTIPLE -> receiveMultiple(batchId, intent)
        else -> throw ShareFailure("unsupported_action")
      }
    } catch (failure: ShareFailure) {
      File(context.cacheDir, "${ShareQueueStore.SHARE_DIRECTORY}/$batchId").deleteRecursively()
      SharedBatchRecord(batchId, emptyList(), failure.code, messageFor(failure.code))
    } catch (_: Throwable) {
      File(context.cacheDir, "${ShareQueueStore.SHARE_DIRECTORY}/$batchId").deleteRecursively()
      SharedBatchRecord(batchId, emptyList(), "intake_failed", "The shared content could not be copied safely.")
    }
    queue.add(batch)
    return batch
  }

  private fun receiveSingle(batchId: String, intent: Intent): SharedBatchRecord {
    if (intent.type?.substringBefore(';')?.trim()?.lowercase() == "text/plain") {
      if (streamUris(intent).isNotEmpty()) throw ShareFailure("mixed_payload")
      val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
      if (text.isBlank() || text.length > SharePolicy.MAX_TEXT_CHARS) throw ShareFailure("invalid_text")
      return SharedBatchRecord(batchId, listOf(SharedPayloadRecord(
        value = text,
        shareType = "text",
        mimeType = "text/plain",
        contentUri = text,
        contentType = "text",
        contentMimeType = "text/plain",
        originalName = null,
        contentSize = null,
      )))
    }
    if (!intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().isNullOrBlank()) throw ShareFailure("mixed_payload")
    val intentMediaType = SharePolicy.mediaTypeForIntent(intent.type) ?: throw ShareFailure("unsupported_mime")
    val uris = streamUris(intent)
    if (uris.size != 1) throw ShareFailure("invalid_item_count")
    return receiveMedia(batchId, uris, intentMediaType)
  }

  private fun receiveMultiple(batchId: String, intent: Intent): SharedBatchRecord {
    val uris = streamUris(intent)
    if (uris.size !in 1..SharePolicy.MAX_ITEMS) throw ShareFailure("too_many_items")
    val intentMediaType = SharePolicy.mediaTypeForIntent(intent.type) ?: throw ShareFailure("unsupported_mime")
    return receiveMedia(batchId, uris, intentMediaType)
  }

  private fun receiveMedia(batchId: String, uris: List<Uri>, intentMediaType: String): SharedBatchRecord {
    if (uris.distinct().size != uris.size) throw ShareFailure("duplicate_item")
    val metadata = uris.map(::metadata)
    if (metadata.any { DownloadPolicy.mediaType(it.mimeType) != intentMediaType }) throw ShareFailure("mime_mismatch")
    if (metadata.sumOf { it.size } > SharePolicy.MAX_TOTAL_BYTES) throw ShareFailure("too_large")
    val directory = File(context.cacheDir, "${ShareQueueStore.SHARE_DIRECTORY}/$batchId").apply {
      if (!mkdirs() && !isDirectory) throw ShareFailure("storage_error")
    }
    val payloads = metadata.mapIndexed { index, item ->
      val output = File(directory, "${index + 1}-${DownloadPolicy.safeFilename(item.name, item.mimeType)}")
      val copied = copyBounded(item.uri, output)
      if (copied != item.size) throw ShareFailure("changed_during_copy")
      val header = ByteArray(512)
      val count = FileInputStream(output).use { it.read(header) }
      if (count <= 0 || !DownloadPolicy.matchesSignature(item.mimeType, header.copyOf(count))) {
        throw ShareFailure("invalid_signature")
      }
      val fileUri = Uri.fromFile(output).toString()
      SharedPayloadRecord(
        value = fileUri,
        shareType = DownloadPolicy.mediaType(item.mimeType),
        mimeType = item.mimeType,
        contentUri = fileUri,
        contentType = DownloadPolicy.mediaType(item.mimeType),
        contentMimeType = item.mimeType,
        originalName = output.name.substringAfter('-', output.name),
        contentSize = copied,
      )
    }
    return SharedBatchRecord(batchId, payloads)
  }

  private fun metadata(uri: Uri): ShareMetadata {
    if (uri.scheme != "content") throw ShareFailure("inaccessible_file")
    val mimeType = DownloadPolicy.normalizeMime(context.contentResolver.getType(uri))
      ?.takeIf(SharePolicy::validMime)
      ?: throw ShareFailure("unsupported_mime")
    var name: String? = null
    var size: Long? = null
    val cursor: Cursor? = context.contentResolver.query(
      uri,
      arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
      null,
      null,
      null,
    )
    cursor?.use {
      if (it.moveToFirst()) {
        val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = it.getColumnIndex(OpenableColumns.SIZE)
        if (nameIndex >= 0 && !it.isNull(nameIndex)) name = it.getString(nameIndex)
        if (sizeIndex >= 0 && !it.isNull(sizeIndex)) size = it.getLong(sizeIndex)
      }
    }
    val safeName = name?.takeIf { it.length in 1..SharePolicy.MAX_NAME_CHARS }
      ?: throw ShareFailure("invalid_metadata")
    val safeSize = size?.takeIf(SharePolicy::validSize) ?: throw ShareFailure("too_large")
    return ShareMetadata(uri, safeName, mimeType, safeSize)
  }

  private fun copyBounded(uri: Uri, output: File): Long {
    val input = context.contentResolver.openInputStream(uri) ?: throw ShareFailure("inaccessible_file")
    var copied = 0L
    input.use { source ->
      FileOutputStream(output).use { destination ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE * 4)
        while (true) {
          val count = source.read(buffer)
          if (count < 0) break
          if (count == 0) continue
          copied += count
          if (!SharePolicy.withinCopyCeiling(copied)) throw ShareFailure("too_large")
          destination.write(buffer, 0, count)
        }
        destination.flush()
        destination.fd.sync()
      }
    }
    if (copied <= 0) throw ShareFailure("empty_file")
    return copied
  }

  private fun streamUris(intent: Intent): List<Uri> {
    intent.clipData?.let { clip ->
      if (clip.itemCount > SharePolicy.MAX_ITEMS) throw ShareFailure("too_many_items")
      return buildList {
        repeat(clip.itemCount) { index -> clip.getItemAt(index).uri?.let(::add) }
      }
    }
    if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      val streams = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      }
      return streams?.toList().orEmpty()
    } else {
      val stream = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
      }
      return listOfNotNull(stream)
    }
  }

  private fun messageFor(code: String): String = when (code) {
    "too_large" -> "Shared media exceeds the bounded import size."
    "too_many_items", "invalid_item_count" -> "Share no more than ${SharePolicy.MAX_ITEMS} media items at once."
    "unsupported_mime" -> "Only supported image and video formats can be saved."
    "invalid_signature" -> "Shared media does not match its declared format."
    "invalid_text" -> "Share one bounded public link at a time."
    else -> "The shared content could not be copied safely."
  }

  private data class ShareMetadata(val uri: Uri, val name: String, val mimeType: String, val size: Long)
  private class ShareFailure(val code: String) : Exception(code)
}

private fun JSONObject.putNullable(key: String, value: Any?) {
  put(key, value ?: JSONObject.NULL)
}

private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)
private fun JSONObject.nullableLong(key: String): Long? = if (isNull(key)) null else getLong(key)
