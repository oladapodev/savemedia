package com.imediasave.download

import java.net.URL

data class DownloadWorkMetadata(
  val id: String,
  val filename: String,
  val mimeType: String,
  val enqueuedAt: Long,
)

object DownloadPolicy {
  const val WORK_PREFIX = "imediasave-download-"
  const val WORK_TAG = "imediasave-download"
  const val MAX_ITEM_BYTES = 512L * 1024L * 1024L
  const val MAX_REDIRECTS = 5
  const val CONNECT_TIMEOUT_MS = 15_000
  const val READ_TIMEOUT_MS = 30_000

  private const val META_ID = "imediasave-meta-id="
  private const val META_FILENAME = "imediasave-meta-filename="
  private const val META_MIME = "imediasave-meta-mime="
  private const val META_ENQUEUED_AT = "imediasave-meta-enqueued-at="

  private val extensions = mapOf(
    "image/jpeg" to "jpg",
    "image/png" to "png",
    "image/gif" to "gif",
    "image/webp" to "webp",
    "video/mp4" to "mp4",
    "video/quicktime" to "mov",
    "video/webm" to "webm",
    "audio/mpeg" to "mp3",
    "audio/mp4" to "m4a",
    "audio/ogg" to "ogg",
    "audio/wav" to "wav",
  )

  fun workName(id: String) = "$WORK_PREFIX$id"

  fun metadataTags(
    id: String,
    filename: String,
    mimeType: String,
    enqueuedAt: Long,
  ): Set<String> {
    val normalizedMime = normalizeMime(mimeType) ?: throw IllegalArgumentException("unsupported_mime")
    require(id.matches(Regex("[A-Za-z0-9._-]{1,96}"))) { "invalid_id" }
    return setOf(
      "$META_ID$id",
      "$META_FILENAME${safeFilename(filename, normalizedMime)}",
      "$META_MIME$normalizedMime",
      "$META_ENQUEUED_AT$enqueuedAt",
    )
  }

  fun metadataFromTags(tags: Set<String>): DownloadWorkMetadata? {
    val id = tagValue(tags, META_ID)
      ?.takeIf { it.matches(Regex("[A-Za-z0-9._-]{1,96}")) }
      ?: return null
    val mimeType = normalizeMime(tagValue(tags, META_MIME)) ?: return null
    val filename = tagValue(tags, META_FILENAME)
      ?.takeIf { it == safeFilename(it, mimeType) }
      ?: return null
    val enqueuedAt = tagValue(tags, META_ENQUEUED_AT)?.toLongOrNull() ?: return null
    return DownloadWorkMetadata(id, filename, mimeType, enqueuedAt)
  }

  fun isAllowedUrl(url: URL): Boolean = url.protocol.equals("https", ignoreCase = true) && url.host.isNotBlank()

  fun normalizeMime(value: String?): String? = value
    ?.substringBefore(';')
    ?.trim()
    ?.lowercase()
    ?.takeIf(::isSupportedMime)

  fun isSupportedMime(mimeType: String): Boolean = extensions.containsKey(mimeType.lowercase())

  fun sameConcreteMime(declared: String, response: String?): Boolean =
    normalizeMime(declared) != null && normalizeMime(declared) == normalizeMime(response)

  fun mediaType(mimeType: String): String = when {
    mimeType.startsWith("image/") -> "image"
    mimeType.startsWith("video/") -> "video"
    mimeType.startsWith("audio/") -> "audio"
    else -> throw IllegalArgumentException("unsupported_mime")
  }

  fun safeId(value: String): String = value
    .replace(Regex("[^A-Za-z0-9._-]+"), "-")
    .trim('.', '-', '_')
    .take(96)
    .ifBlank { "download" }

  fun safeFilename(value: String, mimeType: String): String {
    val extension = extensions[mimeType] ?: throw IllegalArgumentException("unsupported_mime")
    val raw = value.substringAfterLast('/').substringAfterLast('\\').trim()
    val rawExtension = raw.substringAfterLast('.', "")
    val withoutExtension = if (rawExtension.isNotBlank()) raw.dropLast(rawExtension.length + 1) else raw
    val stem = withoutExtension
      .replace(Regex("[^A-Za-z0-9._-]+"), "-")
      .trim('.', '-', '_')
      .take(112)
      .ifBlank { "media" }
    return "$stem.$extension"
  }

  fun matchesSignature(mimeType: String, header: ByteArray): Boolean = when (mimeType) {
    "image/jpeg" -> header.startsWith(0xff, 0xd8, 0xff)
    "image/png" -> header.startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    "image/gif" -> header.ascii(0, 6) == "GIF87a" || header.ascii(0, 6) == "GIF89a"
    "image/webp" -> header.ascii(0, 4) == "RIFF" && header.ascii(8, 12) == "WEBP"
    "video/mp4" -> header.ascii(4, 8) == "ftyp" && header.ascii(8, 12).lowercase().let {
      it.startsWith("iso") || it.startsWith("mp4") || it == "avc1" || it == "dash" || it == "m4v "
    }
    "video/quicktime" -> header.ascii(4, 8) == "ftyp" && header.ascii(8, 12) == "qt  "
    "video/webm" -> header.startsWith(0x1a, 0x45, 0xdf, 0xa3) && header.ascii(0, header.size).lowercase().contains("webm")
    "audio/mpeg" -> header.ascii(0, 3) == "ID3" || (
      header.size >= 2 && header[0].toInt() and 0xff == 0xff && header[1].toInt() and 0xe0 == 0xe0
    )
    "audio/mp4" -> header.ascii(4, 8) == "ftyp" && header.ascii(8, 12).lowercase().let {
      it == "m4a " || it == "m4b "
    }
    "audio/ogg" -> header.ascii(0, 4) == "OggS"
    "audio/wav" -> header.ascii(0, 4) == "RIFF" && header.ascii(8, 12) == "WAVE"
    else -> false
  }

  private fun ByteArray.startsWith(vararg expected: Int): Boolean =
    size >= expected.size && expected.indices.all { this[it].toInt() and 0xff == expected[it] }

  private fun tagValue(tags: Set<String>, prefix: String): String? = tags
    .firstOrNull { it.startsWith(prefix) }
    ?.removePrefix(prefix)
    ?.takeIf { it.isNotBlank() }

  private fun ByteArray.ascii(start: Int, end: Int): String {
    if (start < 0 || end > size || start >= end) return ""
    return copyOfRange(start, end).toString(Charsets.ISO_8859_1)
  }
}
