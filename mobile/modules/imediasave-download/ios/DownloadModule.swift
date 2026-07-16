import ExpoModulesCore

private let downloadEvent = "onDownloadEvent"
private let shareQueueEvent = "onShareQueueChanged"

struct DownloadInput: Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var filename: String = ""
  @Field var mimeType: String = ""
}

public final class DownloadModule: Module {
  private let downloads = BackgroundDownloads.shared

  public func definition() -> ModuleDefinition {
    Name("IMediaSaveDownload")
    Events(downloadEvent, shareQueueEvent)

    OnCreate {
      downloads.eventSink = { [weak self] event in self?.sendEvent(downloadEvent, event) }
      downloads.shareQueueSink = { [weak self] queued in
        self?.sendEvent(shareQueueEvent, ["queued": queued])
      }
    }

    AsyncFunction("enqueue") { (input: DownloadInput) in
      try downloads.enqueue(
        id: input.id,
        url: input.url,
        filename: input.filename,
        mimeType: input.mimeType
      )
    }

    AsyncFunction("cancel") { (id: String) in
      try downloads.cancel(id: id)
    }

    AsyncFunction("list") { () -> [[String: Any]] in
      try downloads.list()
    }

    AsyncFunction("listSharedPayloads") { () -> [[String: Any]] in
      try downloads.listSharedPayloads()
    }

    AsyncFunction("consumeSharedPayloads") { (id: String) in
      try downloads.consumeSharedPayloads(id: id)
    }

    OnDestroy {
      downloads.eventSink = nil
      downloads.shareQueueSink = nil
    }
  }
}
