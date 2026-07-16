package com.imediasave.download

import android.content.Intent
import java.util.Collections
import java.util.IdentityHashMap

internal class ShareIntentGate(private val processedExtra: String) {
  private val inFlight = Collections.newSetFromMap(IdentityHashMap<Intent, Boolean>())

  @Synchronized
  fun tryStart(intent: Intent): Boolean =
    !intent.getBooleanExtra(processedExtra, false) && inFlight.add(intent)

  @Synchronized
  fun committed(intent: Intent) {
    intent.putExtra(processedExtra, true)
    inFlight.remove(intent)
  }

  @Synchronized
  fun retryable(intent: Intent) {
    inFlight.remove(intent)
  }
}
