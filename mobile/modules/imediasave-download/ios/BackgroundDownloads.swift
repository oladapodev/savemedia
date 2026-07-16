import Foundation
import ExpoModulesCore
import UniformTypeIdentifiers
import UIKit

enum NativeJobStatus: String, Codable {
  case queued
  case downloading
  case paused
  case complete
  case failed
  case cancelled
}

enum RelaunchAction: Equatable {
  case attach
  case restartTransfer
  case keep
}

struct NativeJobRecord: Codable, Equatable {
  let id: String
  let url: String
  let filename: String
  let mimeType: String
  var status: NativeJobStatus
  var bytesWritten: Int64
  var totalBytes: Int64?
  var fileUri: String?
  var sizeBytes: Int64?
  var errorCode: String?
  let createdAt: Date
  var updatedAt: Date

  var mediaType: String {
    mimeType.split(separator: "/").first.map(String.init) ?? "video"
  }

  func dictionary() -> [String: Any] {
    var result: [String: Any] = [
      "id": id,
      "status": status.rawValue,
      "bytesWritten": bytesWritten,
      "filename": filename,
      "mediaType": mediaType,
      "mimeType": mimeType,
    ]
    if let totalBytes { result["totalBytes"] = totalBytes }
    if let fileUri { result["fileUri"] = fileUri }
    if let sizeBytes { result["sizeBytes"] = sizeBytes }
    if let errorCode { result["errorCode"] = errorCode }
    return result
  }
}

struct SharedPayloadRecord: Codable {
  let value: String
  let shareType: String
  let mimeType: String?
  let contentUri: String?
  let contentType: String?
  let contentMimeType: String?
  let originalName: String?
  let contentSize: Int64?

  func dictionary() -> [String: Any] {
    var result: [String: Any] = ["value": value, "shareType": shareType]
    if let mimeType { result["mimeType"] = mimeType }
    if let contentUri { result["contentUri"] = contentUri }
    if let contentType { result["contentType"] = contentType }
    if let contentMimeType { result["contentMimeType"] = contentMimeType }
    if let originalName { result["originalName"] = originalName }
    if let contentSize { result["contentSize"] = contentSize }
    return result
  }
}

struct SharedBatchRecord: Codable {
  let id: String
  let payloads: [SharedPayloadRecord]
  let errorCode: String?
  let errorMessage: String?

  func dictionary() -> [String: Any] {
    var result: [String: Any] = [
      "id": id,
      "payloads": payloads.map { $0.dictionary() },
    ]
    if let errorCode { result["errorCode"] = errorCode }
    if let errorMessage { result["errorMessage"] = errorMessage }
    return result
  }
}

enum NativeDownloadError: Error {
  case appGroupUnavailable
  case invalidIdentifier
  case invalidURL
  case invalidFilename
  case unsupportedMime
  case responseRejected
  case tooLarge
  case mimeMismatch
  case invalidSignature

  var code: String {
    switch self {
    case .appGroupUnavailable: return "app_group_unavailable"
    case .invalidIdentifier: return "invalid_id"
    case .invalidURL: return "https_required"
    case .invalidFilename: return "invalid_filename"
    case .unsupportedMime: return "unsupported_mime"
    case .responseRejected: return "download_failed"
    case .tooLarge: return "too_large"
    case .mimeMismatch: return "mime_mismatch"
    case .invalidSignature: return "invalid_signature"
    }
  }
}

final class NativeJobStore {
  let root: URL
  let recordsDirectory: URL
  let completedDirectory: URL
  let partialDirectory: URL
  let sharesDirectory: URL
  private let encoder: JSONEncoder
  private let decoder: JSONDecoder

  convenience init() throws {
    guard let root = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: BackgroundDownloads.appGroupIdentifier
    ) else {
      throw NativeDownloadError.appGroupUnavailable
    }
    try self.init(root: root.appendingPathComponent("IMediaSave", isDirectory: true))
  }

  init(root: URL) throws {
    self.root = root
    recordsDirectory = root.appendingPathComponent("jobs", isDirectory: true)
    completedDirectory = root.appendingPathComponent("completed", isDirectory: true)
    partialDirectory = root.appendingPathComponent("partial", isDirectory: true)
    sharesDirectory = root.appendingPathComponent("shares", isDirectory: true)
    encoder = JSONEncoder()
    decoder = JSONDecoder()
    encoder.dateEncodingStrategy = .iso8601
    decoder.dateDecodingStrategy = .iso8601
    for directory in [root, recordsDirectory, completedDirectory, partialDirectory, sharesDirectory] {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
  }

  func recordURL(id: String) -> URL {
    recordsDirectory.appendingPathComponent("\(id).json", isDirectory: false)
  }

  func partialURL(for record: NativeJobRecord) -> URL {
    partialDirectory.appendingPathComponent("\(record.id).part", isDirectory: false)
  }

  func completedURL(for record: NativeJobRecord) -> URL {
    completedDirectory.appendingPathComponent("\(record.id)-\(Self.safeFilename(record.filename))")
  }

  func save(_ record: NativeJobRecord) throws {
    try encoder.encode(record).write(to: recordURL(id: record.id), options: [.atomic])
  }

  func load(id: String) throws -> NativeJobRecord? {
    let url = recordURL(id: id)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return try decoder.decode(NativeJobRecord.self, from: Data(contentsOf: url))
  }

  func all() throws -> [NativeJobRecord] {
    try FileManager.default.contentsOfDirectory(
      at: recordsDirectory,
      includingPropertiesForKeys: nil,
      options: [.skipsHiddenFiles]
    )
    .filter { $0.pathExtension == "json" }
    .compactMap { try? decoder.decode(NativeJobRecord.self, from: Data(contentsOf: $0)) }
    .sorted { $0.createdAt < $1.createdAt }
  }

  @discardableResult
  func complete(record: inout NativeJobRecord, temporaryFile: URL, byteCount: Int64) throws -> URL {
    let destination = completedURL(for: record)
    if record.status == .complete, FileManager.default.fileExists(atPath: destination.path) {
      try? FileManager.default.removeItem(at: temporaryFile)
      return destination
    }
    guard byteCount > 0, byteCount <= BackgroundDownloads.maximumItemBytes else {
      try? FileManager.default.removeItem(at: temporaryFile)
      throw NativeDownloadError.tooLarge
    }
    try? FileManager.default.removeItem(at: destination)
    try FileManager.default.moveItem(at: temporaryFile, to: destination)
    record.status = .complete
    record.bytesWritten = byteCount
    record.totalBytes = byteCount
    record.sizeBytes = byteCount
    record.fileUri = destination.absoluteString
    record.errorCode = nil
    record.updatedAt = Date()
    try save(record)
    try? FileManager.default.removeItem(at: partialURL(for: record))
    return destination
  }

  func cancel(record: inout NativeJobRecord) throws {
    guard record.status != .complete else { return }
    try? FileManager.default.removeItem(at: partialURL(for: record))
    try? FileManager.default.removeItem(at: completedURL(for: record))
    record.status = .cancelled
    record.errorCode = "cancelled"
    record.updatedAt = Date()
    try save(record)
  }

  func fail(record: inout NativeJobRecord, code: String) throws {
    guard record.status != .complete, record.status != .cancelled else { return }
    try? FileManager.default.removeItem(at: partialURL(for: record))
    try? FileManager.default.removeItem(at: completedURL(for: record))
    record.status = .failed
    record.errorCode = code
    record.updatedAt = Date()
    try save(record)
  }

  func sharedBatches() throws -> [SharedBatchRecord] {
    try FileManager.default.contentsOfDirectory(
      at: sharesDirectory,
      includingPropertiesForKeys: nil,
      options: [.skipsHiddenFiles]
    )
    .filter { $0.pathExtension == "json" }
    .compactMap { try? decoder.decode(SharedBatchRecord.self, from: Data(contentsOf: $0)) }
    .sorted { $0.id < $1.id }
  }

  func consumeSharedBatch(id: String) throws {
    guard Self.validIdentifier(id) else { throw NativeDownloadError.invalidIdentifier }
    try? FileManager.default.removeItem(at: sharesDirectory.appendingPathComponent("\(id).json"))
    try? FileManager.default.removeItem(at: sharesDirectory.appendingPathComponent(id, isDirectory: true))
  }

  static func validIdentifier(_ value: String) -> Bool {
    value.range(of: "^[A-Za-z0-9._-]{1,96}$", options: .regularExpression) != nil
  }

  static func safeFilename(_ value: String) -> String {
    let leaf = URL(fileURLWithPath: value).lastPathComponent
    let cleaned = leaf.replacingOccurrences(
      of: "[^A-Za-z0-9._-]",
      with: "-",
      options: .regularExpression
    )
    return String((cleaned.isEmpty || cleaned == "." || cleaned == ".." ? "media" : cleaned).prefix(180))
  }
}

final class BackgroundDownloads: NSObject, URLSessionDownloadDelegate, URLSessionTaskDelegate {
  static let shared = BackgroundDownloads()
  static let appGroupIdentifier = "group.com.imediasave.app"
  static let sessionPrefix = "com.imediasave.app.download."
  static let maximumItemBytes: Int64 = 512 * 1024 * 1024

  private let stateQueue = DispatchQueue(label: "com.imediasave.app.download-state")
  private var sessions: [String: URLSession] = [:]
  private var storeResult: Result<NativeJobStore, Error>
  var eventSink: (([String: Any]) -> Void)?
  var shareQueueSink: ((Bool) -> Void)?

  override private init() {
    storeResult = Result { try NativeJobStore() }
    super.init()
    restorePersistedSessions()
  }

  static func sessionIdentifier(for jobId: String) -> String {
    sessionPrefix + jobId
  }

  static func configuration(for jobId: String) -> URLSessionConfiguration {
    let configuration = URLSessionConfiguration.background(withIdentifier: sessionIdentifier(for: jobId))
    configuration.sharedContainerIdentifier = appGroupIdentifier
    configuration.sessionSendsLaunchEvents = true
    configuration.isDiscretionary = false
    configuration.allowsCellularAccess = true
    configuration.httpMaximumConnectionsPerHost = 2
    return configuration
  }

  static func jobIdentifier(from sessionIdentifier: String) -> String? {
    guard sessionIdentifier.hasPrefix(sessionPrefix) else { return nil }
    let id = String(sessionIdentifier.dropFirst(sessionPrefix.count))
    return NativeJobStore.validIdentifier(id) ? id : nil
  }

  static func relaunchAction(status: NativeJobStatus, hasTasks: Bool) -> RelaunchAction {
    if hasTasks { return .attach }
    switch status {
    case .queued, .downloading, .paused: return .restartTransfer
    default: return .keep
    }
  }

  func enqueue(id: String, url: String, filename: String, mimeType: String) throws {
    guard NativeJobStore.validIdentifier(id) else { throw NativeDownloadError.invalidIdentifier }
    guard filename.count <= 256, !filename.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw NativeDownloadError.invalidFilename
    }
    guard let source = URL(string: url), source.scheme?.lowercased() == "https" else {
      throw NativeDownloadError.invalidURL
    }
    let normalizedMime = Self.normalizedMime(mimeType)
    guard Self.supportedMimes.contains(normalizedMime) else { throw NativeDownloadError.unsupportedMime }

    try stateQueue.sync {
      let store = try self.store()
      if let existing = try store.load(id: id), [.queued, .downloading, .complete].contains(existing.status) {
        emit(existing)
        return
      }
      let now = Date()
      var record = NativeJobRecord(
        id: id,
        url: source.absoluteString,
        filename: filename,
        mimeType: normalizedMime,
        status: .queued,
        bytesWritten: 0,
        totalBytes: nil,
        fileUri: nil,
        sizeBytes: nil,
        errorCode: nil,
        createdAt: now,
        updatedAt: now
      )
      try store.save(record)
      let session = session(for: id)
      var request = URLRequest(url: source)
      request.httpMethod = "GET"
      request.timeoutInterval = 60
      let task = session.downloadTask(with: request)
      task.taskDescription = id
      record.status = .downloading
      record.updatedAt = Date()
      try store.save(record)
      task.resume()
      emit(record)
    }
  }

  func cancel(id: String) throws {
    guard NativeJobStore.validIdentifier(id) else { return }
    try stateQueue.sync {
      let store = try self.store()
      if var record = try store.load(id: id) {
        try store.cancel(record: &record)
        emit(record)
      }
      sessions[id]?.invalidateAndCancel()
      sessions.removeValue(forKey: id)
    }
  }

  func list() throws -> [[String: Any]] {
    try stateQueue.sync { try store().all().map { $0.dictionary() } }
  }

  func listSharedPayloads() throws -> [[String: Any]] {
    try stateQueue.sync { try store().sharedBatches().map { $0.dictionary() } }
  }

  func consumeSharedPayloads(id: String) throws {
    try stateQueue.sync {
      try store().consumeSharedBatch(id: id)
      shareQueueSink?(!(try store().sharedBatches()).isEmpty)
    }
  }

  func reconnect(sessionIdentifier: String) {
    guard let id = Self.jobIdentifier(from: sessionIdentifier) else { return }
    stateQueue.async { _ = self.session(for: id) }
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    guard let id = identifier(for: session, task: downloadTask) else { return }
    stateQueue.async {
      do {
        let store = try self.store()
        guard var record = try store.load(id: id), record.status == .downloading else { return }
        guard totalBytesWritten <= Self.maximumItemBytes,
              totalBytesExpectedToWrite <= 0 || totalBytesExpectedToWrite <= Self.maximumItemBytes else {
          try store.fail(record: &record, code: NativeDownloadError.tooLarge.code)
          downloadTask.cancel()
          self.emit(record)
          return
        }
        record.bytesWritten = totalBytesWritten
        record.totalBytes = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : nil
        record.updatedAt = Date()
        try store.save(record)
        self.emit(record)
      } catch {
        downloadTask.cancel()
      }
    }
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    guard let id = identifier(for: session, task: downloadTask) else { return }
    stateQueue.async {
      do {
        let store = try self.store()
        guard var record = try store.load(id: id), record.status == .downloading else {
          try? FileManager.default.removeItem(at: location)
          return
        }
        guard let response = downloadTask.response as? HTTPURLResponse,
              (200...299).contains(response.statusCode) else {
          throw NativeDownloadError.responseRejected
        }
        let responseMime = Self.normalizedMime(response.mimeType ?? "")
        guard responseMime == record.mimeType else { throw NativeDownloadError.mimeMismatch }
        let values = try location.resourceValues(forKeys: [.fileSizeKey])
        let byteCount = Int64(values.fileSize ?? 0)
        guard Self.matchesSignature(mimeType: record.mimeType, file: location) else {
          throw NativeDownloadError.invalidSignature
        }
        _ = try store.complete(record: &record, temporaryFile: location, byteCount: byteCount)
        self.emit(record)
      } catch let failure as NativeDownloadError {
        self.fail(id: id, code: failure.code, temporaryFile: location)
      } catch {
        self.fail(id: id, code: "download_failed", temporaryFile: location)
      }
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let id = identifier(for: session, task: task) else { return }
    guard let error else {
      stateQueue.async {
        session.finishTasksAndInvalidate()
        self.sessions.removeValue(forKey: id)
      }
      return
    }
    stateQueue.async {
      do {
        let store = try self.store()
        guard var record = try store.load(id: id), ![.complete, .cancelled, .failed].contains(record.status) else { return }
        let code = (error as NSError).code == NSURLErrorCancelled ? "cancelled" : "download_failed"
        if code == "cancelled" {
          try store.cancel(record: &record)
        } else {
          try store.fail(record: &record, code: code)
        }
        self.emit(record)
      } catch {}
    }
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    guard request.url?.scheme?.lowercased() == "https" else {
      if let id = identifier(for: session, task: task) { fail(id: id, code: "https_required") }
      completionHandler(nil)
      return
    }
    completionHandler(request)
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    if let identifier = session.configuration.identifier {
      DownloadBackgroundSessionHandler.finish(identifier: identifier)
    }
  }

  private func store() throws -> NativeJobStore { try storeResult.get() }

  private func session(for id: String) -> URLSession {
    if let existing = sessions[id] { return existing }
    let session = URLSession(configuration: Self.configuration(for: id), delegate: self, delegateQueue: nil)
    sessions[id] = session
    return session
  }

  private func restorePersistedSessions() {
    stateQueue.async {
      guard let records = try? self.store().all() else { return }
      for record in records where [.queued, .downloading, .paused].contains(record.status) {
        let session = self.session(for: record.id)
        session.getAllTasks { tasks in
          self.stateQueue.async {
            switch Self.relaunchAction(status: record.status, hasTasks: !tasks.isEmpty) {
            case .attach:
              if record.status == .queued, var active = self.loadRecord(id: record.id) {
                active.status = .downloading
                active.updatedAt = Date()
                try? self.store().save(active)
                self.emit(active)
              }
              return
            case .restartTransfer:
              guard var resumed = self.loadRecord(id: record.id),
                    [.queued, .downloading, .paused].contains(resumed.status),
                    let source = URL(string: resumed.url),
                    source.scheme?.lowercased() == "https" else { return }
              var request = URLRequest(url: source)
              request.httpMethod = "GET"
              request.timeoutInterval = 60
              let task = session.downloadTask(with: request)
              task.taskDescription = resumed.id
              resumed.status = .downloading
              resumed.errorCode = nil
              resumed.updatedAt = Date()
              try? self.store().save(resumed)
              self.emit(resumed)
              task.resume()
            case .keep:
              return
            }
          }
        }
      }
    }
  }

  private func identifier(for session: URLSession, task: URLSessionTask) -> String? {
    if let id = task.taskDescription, NativeJobStore.validIdentifier(id) { return id }
    return session.configuration.identifier.flatMap(Self.jobIdentifier)
  }

  private func emit(_ record: NativeJobRecord) {
    let payload = record.dictionary()
    DispatchQueue.main.async { self.eventSink?(payload) }
  }

  private func fail(id: String, code: String, temporaryFile: URL? = nil) {
    stateQueue.async {
      if let temporaryFile { try? FileManager.default.removeItem(at: temporaryFile) }
      guard let store = try? self.store(),
            var record = self.loadRecord(id: id) else { return }
      try? store.fail(record: &record, code: code)
      self.emit(record)
    }
  }

  private func loadRecord(id: String) -> NativeJobRecord? {
    do {
      return try store().load(id: id)
    } catch {
      return nil
    }
  }

  private static let supportedMimes: Set<String> = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav",
  ]

  private static func normalizedMime(_ value: String) -> String {
    value.split(separator: ";", maxSplits: 1).first.map(String.init)?
      .trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
  }

  private static func matchesSignature(mimeType: String, file: URL) -> Bool {
    guard let handle = try? FileHandle(forReadingFrom: file) else { return false }
    defer { try? handle.close() }
    let data = (try? handle.read(upToCount: 512)) ?? Data()
    let bytes = [UInt8](data)
    switch mimeType {
    case "image/jpeg": return bytes.starts(with: [0xFF, 0xD8, 0xFF])
    case "image/png": return bytes.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    case "image/gif": return data.starts(with: Data("GIF8".utf8))
    case "image/webp": return data.starts(with: Data("RIFF".utf8)) && data.dropFirst(8).starts(with: Data("WEBP".utf8))
    case "video/mp4", "video/quicktime", "audio/mp4":
      return data.count >= 12 && data.subdata(in: 4..<8) == Data("ftyp".utf8)
    case "video/webm": return bytes.starts(with: [0x1A, 0x45, 0xDF, 0xA3])
    case "audio/mpeg":
      return data.starts(with: Data("ID3".utf8)) || (bytes.count >= 2 && bytes[0] == 0xFF && bytes[1] & 0xE0 == 0xE0)
    case "audio/ogg": return data.starts(with: Data("OggS".utf8))
    case "audio/wav": return data.starts(with: Data("RIFF".utf8)) && data.dropFirst(8).starts(with: Data("WAVE".utf8))
    default: return false
    }
  }
}

public final class DownloadBackgroundSessionHandler: ExpoAppDelegateSubscriber {
  private static let lock = NSLock()
  private static var completionHandlers: [String: () -> Void] = [:]

  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    guard BackgroundDownloads.jobIdentifier(from: identifier) != nil else {
      completionHandler()
      return
    }
    Self.lock.lock()
    Self.completionHandlers[identifier] = completionHandler
    Self.lock.unlock()
    BackgroundDownloads.shared.reconnect(sessionIdentifier: identifier)
  }

  static func finish(identifier: String) {
    lock.lock()
    let completion = completionHandlers.removeValue(forKey: identifier)
    lock.unlock()
    DispatchQueue.main.async { completion?() }
  }
}
