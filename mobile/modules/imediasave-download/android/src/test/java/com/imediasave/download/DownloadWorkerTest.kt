package com.imediasave.download

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URL
import java.io.File

class DownloadWorkerTest {
  @Test
  fun `unique work names are stable and job scoped`() {
    assertEquals("imediasave-download-job-123", DownloadPolicy.workName("job-123"))
  }

  @Test
  fun `persisted work tags round trip bounded non secret metadata`() {
    val tags = DownloadPolicy.metadataTags(
      id = "job-123",
      filename = "Summer clip (final).mp4",
      mimeType = "video/mp4",
      enqueuedAt = 123L,
    )

    assertEquals(
      DownloadWorkMetadata("job-123", "Summer-clip-final.mp4", "video/mp4", 123L),
      DownloadPolicy.metadataFromTags(tags),
    )
    assertFalse(tags.any { it.contains("https://") })
  }

  @Test
  fun `only https download and redirect URLs are accepted`() {
    assertTrue(DownloadPolicy.isAllowedUrl(URL("https://cdn.example/video.mp4")))
    assertFalse(DownloadPolicy.isAllowedUrl(URL("http://cdn.example/video.mp4")))
    assertFalse(DownloadPolicy.isAllowedUrl(URL("file:///tmp/video.mp4")))
  }

  @Test
  fun `supported concrete mime and signature pairs are enforced`() {
    assertTrue(DownloadPolicy.matchesSignature("image/jpeg", byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte())))
    assertTrue(DownloadPolicy.matchesSignature("image/png", byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))
    assertTrue(DownloadPolicy.matchesSignature("video/mp4", byteArrayOf(0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d)))
    assertFalse(DownloadPolicy.matchesSignature("image/jpeg", "<html>nope</html>".toByteArray()))
    assertFalse(DownloadPolicy.sameConcreteMime("image/jpeg", "image/png"))
    assertTrue(DownloadPolicy.sameConcreteMime("video/mp4", "video/mp4; charset=binary"))
    assertFalse(DownloadPolicy.isSupportedMime("application/octet-stream"))
    assertTrue(DownloadPolicy.isSupportedMime("audio/mpeg"))
    assertTrue(DownloadPolicy.matchesSignature("audio/mpeg", "ID3\u0004\u0000\u0000".toByteArray()))
    assertTrue(DownloadPolicy.matchesSignature("audio/mp4", byteArrayOf(0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20)))
    assertTrue(DownloadPolicy.matchesSignature("audio/ogg", "OggS".toByteArray()))
    assertTrue(DownloadPolicy.matchesSignature("audio/wav", "RIFF\u0000\u0000\u0000\u0000WAVE".toByteArray()))
  }

  @Test
  fun `filenames cannot escape app storage and receive their validated extension`() {
    assertEquals("summer-photo.mp4", DownloadPolicy.safeFilename("../../summer photo.exe", "video/mp4"))
    assertEquals("media.jpg", DownloadPolicy.safeFilename("..", "image/jpeg"))
  }

  @Test
  fun `download size is bounded`() {
    assertEquals(512L * 1024L * 1024L, DownloadPolicy.MAX_ITEM_BYTES)
  }

  @Test
  fun `progress data persists byte counters and app file URI`() {
    val progress = DownloadWorker.progressData(256, 1024, "file:///cache/clip.mp4")

    assertEquals(256, progress.getLong(DownloadWorker.KEY_BYTES_WRITTEN, -1))
    assertEquals(1024, progress.getLong(DownloadWorker.KEY_TOTAL_BYTES, -1))
    assertEquals("file:///cache/clip.mp4", progress.getString(DownloadWorker.KEY_FILE_URI))
  }

  @Test
  fun `failed work cleanup removes partial and unfinished final files`() {
    val root = createTempDir(prefix = "imediasave-worker-")
    val partial = File(root, "clip.mp4.part").apply { writeText("partial") }
    val final = File(root, "clip.mp4").apply { writeText("unfinished") }

    DownloadWorker.cleanupArtifacts(partial, final, finalized = false)

    assertFalse(partial.exists())
    assertFalse(final.exists())
    root.deleteRecursively()
  }
}
