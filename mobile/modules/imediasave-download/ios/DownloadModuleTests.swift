import XCTest
@testable import IMediaSaveDownload

final class DownloadModuleTests: XCTestCase {
  private var root: URL!
  private var store: NativeJobStore!

  override func setUpWithError() throws {
    root = FileManager.default.temporaryDirectory
      .appendingPathComponent("imediasave-ios-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    store = try NativeJobStore(root: root)
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: root)
  }

  func testSessionIdentifierIsStableAndJobScoped() {
    let configuration = BackgroundDownloads.configuration(for: "job-123")
    XCTAssertEqual(
      BackgroundDownloads.sessionIdentifier(for: "job-123"),
      "com.imediasave.app.download.job-123"
    )
    XCTAssertEqual(configuration.identifier, "com.imediasave.app.download.job-123")
    XCTAssertEqual(configuration.sharedContainerIdentifier, "group.com.imediasave.app")
    XCTAssertTrue(configuration.sessionSendsLaunchEvents)
  }

  func testQueuedRecordsAreAtomicallyPersistedAndReloaded() throws {
    let record = NativeJobRecord.fixture(id: "atomic-job")
    try store.save(record)

    XCTAssertEqual(try store.load(id: record.id), record)
    XCTAssertFalse(FileManager.default.fileExists(
      atPath: store.recordsDirectory.appendingPathComponent("atomic-job.json.tmp").path
    ))
  }

  func testRelaunchReattachesOrRecoversJobsWithoutLeavingThemStuck() {
    XCTAssertEqual(BackgroundDownloads.relaunchAction(status: .queued, hasTasks: true), .attach)
    XCTAssertEqual(BackgroundDownloads.relaunchAction(status: .downloading, hasTasks: true), .attach)
    XCTAssertEqual(BackgroundDownloads.relaunchAction(status: .queued, hasTasks: false), .restartTransfer)
    XCTAssertEqual(BackgroundDownloads.relaunchAction(status: .downloading, hasTasks: false), .restartTransfer)
    XCTAssertEqual(BackgroundDownloads.relaunchAction(status: .paused, hasTasks: false), .restartTransfer)
  }

  func testDuplicateCompletionDoesNotOverwriteTheCommittedArtifact() throws {
    var record = NativeJobRecord.fixture(id: "complete-once")
    let first = root.appendingPathComponent("first.mp4")
    let duplicate = root.appendingPathComponent("duplicate.mp4")
    try Data("first".utf8).write(to: first)
    try Data("duplicate".utf8).write(to: duplicate)

    let committed = try store.complete(record: &record, temporaryFile: first, byteCount: 5)
    let repeated = try store.complete(record: &record, temporaryFile: duplicate, byteCount: 9)

    XCTAssertEqual(committed, repeated)
    XCTAssertEqual(try Data(contentsOf: committed), Data("first".utf8))
    XCTAssertFalse(FileManager.default.fileExists(atPath: duplicate.path))
    XCTAssertEqual(try store.load(id: record.id)?.status, .complete)
  }

  func testCancellationRemovesPartialAndUncommittedFiles() throws {
    var record = NativeJobRecord.fixture(id: "cancel-job")
    try store.save(record)
    try Data("partial".utf8).write(to: store.partialURL(for: record))

    try store.cancel(record: &record)

    XCTAssertEqual(try store.load(id: record.id)?.status, .cancelled)
    XCTAssertFalse(FileManager.default.fileExists(atPath: store.partialURL(for: record).path))
    XCTAssertFalse(FileManager.default.fileExists(atPath: store.completedURL(for: record).path))
  }

  func testCancellationCannotDowngradeAnAlreadyCompletedRecord() throws {
    var record = NativeJobRecord.fixture(id: "completed-job")
    let temporary = root.appendingPathComponent("completed.mp4")
    try Data("final".utf8).write(to: temporary)
    let final = try store.complete(record: &record, temporaryFile: temporary, byteCount: 5)

    try store.cancel(record: &record)

    XCTAssertEqual(record.status, .complete)
    XCTAssertTrue(FileManager.default.fileExists(atPath: final.path))
  }
}

private extension NativeJobRecord {
  static func fixture(id: String) -> NativeJobRecord {
    NativeJobRecord(
      id: id,
      url: "https://cdn.example/video.mp4",
      filename: "video.mp4",
      mimeType: "video/mp4",
      status: .queued,
      bytesWritten: 0,
      totalBytes: nil,
      fileUri: nil,
      sizeBytes: nil,
      errorCode: nil,
      createdAt: Date(timeIntervalSince1970: 1),
      updatedAt: Date(timeIntervalSince1970: 1)
    )
  }
}
