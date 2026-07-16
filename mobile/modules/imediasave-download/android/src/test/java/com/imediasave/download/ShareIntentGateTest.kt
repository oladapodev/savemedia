package com.imediasave.download

import android.content.Intent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 34])
class ShareIntentGateTest {
  @Test
  fun `intent remains retryable until durable commit and is protected while in flight`() {
    val extra = "share-processed"
    val gate = ShareIntentGate(extra)
    val intent = Intent(Intent.ACTION_SEND)

    assertTrue(gate.tryStart(intent))
    assertFalse(gate.tryStart(intent))
    assertFalse(intent.getBooleanExtra(extra, false))

    gate.retryable(intent)
    assertTrue(gate.tryStart(intent))
    gate.committed(intent)

    assertTrue(intent.getBooleanExtra(extra, false))
    assertFalse(gate.tryStart(intent))
  }
}
