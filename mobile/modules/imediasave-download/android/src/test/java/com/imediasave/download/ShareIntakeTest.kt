package com.imediasave.download

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowContentResolver
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 34])
class ShareIntakeTest {
  private lateinit var context: Context

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    File(context.cacheDir, ShareQueueStore.SHARE_DIRECTORY).deleteRecursively()
    context.getSharedPreferences("imediasave-share-queue", Context.MODE_PRIVATE).edit().clear().commit()
  }
  @Test
  fun `share intake bounds count item bytes and aggregate bytes`() {
    assertEquals(10, SharePolicy.MAX_ITEMS)
    assertEquals(DownloadPolicy.MAX_ITEM_BYTES, SharePolicy.MAX_ITEM_BYTES)
    assertEquals(1024L * 1024L * 1024L, SharePolicy.MAX_TOTAL_BYTES)
    assertTrue(SharePolicy.validSize(1))
    assertFalse(SharePolicy.validSize(0))
    assertFalse(SharePolicy.validSize(SharePolicy.MAX_ITEM_BYTES + 1))
  }

  @Test
  fun `share metadata accepts only concrete image and video mime types`() {
    assertTrue(SharePolicy.validMime("image/webp"))
    assertTrue(SharePolicy.validMime("video/webm"))
    assertFalse(SharePolicy.validMime("image/svg+xml"))
    assertFalse(SharePolicy.validMime("audio/mpeg"))
    assertFalse(SharePolicy.validMime("application/octet-stream"))
    assertEquals("image", SharePolicy.mediaTypeForIntent("image/*"))
    assertEquals("video", SharePolicy.mediaTypeForIntent("video/mp4"))
    assertEquals(null, SharePolicy.mediaTypeForIntent("audio/mpeg"))
  }

  @Test
  fun `stream copy ceiling permits exactly the configured item maximum`() {
    assertTrue(SharePolicy.withinCopyCeiling(SharePolicy.MAX_ITEM_BYTES))
    assertFalse(SharePolicy.withinCopyCeiling(SharePolicy.MAX_ITEM_BYTES + 1))
  }

  @Test
  fun `resolver metadata is copied durably and staging is deleted only by consume`() {
    val source = File(context.cacheDir, "resolver-photo.jpg").apply {
      writeBytes(byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0xe0.toByte()))
    }
    ResolverProvider.source = source
    val provider = ResolverProvider()
    provider.attachInfo(context, ProviderInfo().apply { authority = ResolverProvider.AUTHORITY })
    ShadowContentResolver.registerProviderInternal(ResolverProvider.AUTHORITY, provider)
    val uri = Uri.parse("content://${ResolverProvider.AUTHORITY}/photo")
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "image/jpeg"
      putExtra(Intent.EXTRA_STREAM, uri)
    }
    val queue = ShareQueueStore(context)

    val batch = ShareIntake(context, queue).receive(intent)
    val staged = File(Uri.parse(batch.payloads.single().contentUri).path!!)

    assertTrue(staged.exists())
    assertEquals(batch.id, queue.list().single().id)
    queue.consume(batch.id)
    assertFalse(staged.exists())
    assertTrue(queue.list().isEmpty())
  }

  class ResolverProvider : ContentProvider() {
    override fun onCreate() = true
    override fun getType(uri: Uri) = "image/jpeg"
    override fun query(
      uri: Uri,
      projection: Array<out String>?,
      selection: String?,
      selectionArgs: Array<out String>?,
      sortOrder: String?,
    ): Cursor = MatrixCursor(arrayOf("_display_name", "_size")).apply {
      addRow(arrayOf("photo.jpg", source.length()))
    }
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
      ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY)
    override fun insert(uri: Uri, values: ContentValues?) = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0

    companion object {
      const val AUTHORITY = "com.imediasave.download.test.share"
      lateinit var source: File
    }
  }
}
