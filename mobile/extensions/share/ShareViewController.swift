import UIKit
import UniformTypeIdentifiers

private enum SharePolicy {
  static let appGroup = "group.com.imediasave.app"
  static let maximumItems = 10
  static let maximumItemBytes: Int64 = 512 * 1024 * 1024
  static let maximumTotalBytes: Int64 = 1024 * 1024 * 1024
  static let maximumTextCharacters = 8_192
  static let supportedMimes: Set<String> = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
  ]
}

private enum ShareIntakeError: Error {
  case appGroupUnavailable
  case empty
  case mixedPayload
  case tooManyItems
  case tooLarge
  case invalidText
  case unsupportedType
  case inaccessibleFile
  case mimeMismatch
  case invalidSignature
  case storage

  var message: String {
    switch self {
    case .tooManyItems: return "Choose up to 10 photos or videos."
    case .tooLarge: return "This share is too large to save safely."
    case .mixedPayload: return "Share one link or a set of photos and videos."
    case .invalidText: return "The shared link or text is not valid."
    case .unsupportedType, .mimeMismatch, .invalidSignature: return "This media type is not supported."
    case .empty: return "Nothing compatible was shared."
    default: return "The shared content could not be queued safely."
    }
  }
}

private struct SharedPayload: Codable {
  let value: String
  let shareType: String
  let mimeType: String?
  let contentUri: String?
  let contentType: String?
  let contentMimeType: String?
  let originalName: String?
  let contentSize: Int64?
}

private struct SharedBatch: Codable {
  let id: String
  let payloads: [SharedPayload]
  let errorCode: String? = nil
  let errorMessage: String? = nil
}

final class ShareViewController: UIViewController {
  private let statusLabel = UILabel()
  private let activity = UIActivityIndicatorView(style: .medium)
  private var started = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    statusLabel.text = "Saving…"
    statusLabel.font = .preferredFont(forTextStyle: .headline)
    statusLabel.adjustsFontForContentSizeCategory = true
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 2
    statusLabel.accessibilityLabel = "Saving shared media"
    activity.startAnimating()
    let stack = UIStackView(arrangedSubviews: [activity, statusLabel])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      view.heightAnchor.constraint(greaterThanOrEqualToConstant: 132),
    ])
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !started else { return }
    started = true
    Task { await receiveShare() }
  }

  private func receiveShare() async {
    do {
      let providers = extensionContext?.inputItems
        .compactMap { $0 as? NSExtensionItem }
        .flatMap { $0.attachments ?? [] } ?? []
      let batch = try await ShareIntake().receive(providers: providers)
      try ShareQueue().commit(batch)
      await finish(message: "Saved to iMediaSave", error: nil)
    } catch let error as ShareIntakeError {
      await finish(message: error.message, error: error)
    } catch {
      await finish(message: "The shared content could not be queued safely.", error: error)
    }
  }

  @MainActor
  private func finish(message: String, error: Error?) {
    activity.stopAnimating()
    statusLabel.text = message
    UIAccessibility.post(notification: .announcement, argument: message)
    DispatchQueue.main.asyncAfter(deadline: .now() + (error == nil ? 0.35 : 1.2)) { [weak self] in
      guard let self else { return }
      if let error {
        extensionContext?.cancelRequest(withError: error)
      } else {
        extensionContext?.completeRequest(returningItems: nil)
      }
    }
  }
}

private final class ShareIntake {
  private let fileManager = FileManager.default

  func receive(providers: [NSItemProvider]) async throws -> SharedBatch {
    guard !providers.isEmpty else { throw ShareIntakeError.empty }
    let mediaProviders = providers.filter(Self.isMedia)
    let textProviders = providers.filter(Self.isText)
    guard mediaProviders.count + textProviders.count == providers.count else {
      throw ShareIntakeError.unsupportedType
    }
    guard mediaProviders.isEmpty || textProviders.isEmpty else { throw ShareIntakeError.mixedPayload }

    let id = UUID().uuidString.lowercased()
    if let provider = textProviders.first {
      guard textProviders.count == 1 else { throw ShareIntakeError.mixedPayload }
      return SharedBatch(id: id, payloads: [try await loadText(from: provider)])
    }
    guard mediaProviders.count <= SharePolicy.maximumItems else { throw ShareIntakeError.tooManyItems }
    guard let shares = sharedDirectory() else { throw ShareIntakeError.appGroupUnavailable }
    let batchDirectory = shares.appendingPathComponent(id, isDirectory: true)
    try fileManager.createDirectory(at: batchDirectory, withIntermediateDirectories: true)
    do {
      var total: Int64 = 0
      var payloads: [SharedPayload] = []
      for (index, provider) in mediaProviders.enumerated() {
        let payload = try await loadMedia(
          from: provider,
          into: batchDirectory,
          index: index,
          remainingBytes: SharePolicy.maximumTotalBytes - total
        )
        total += payload.contentSize ?? 0
        guard total <= SharePolicy.maximumTotalBytes else { throw ShareIntakeError.tooLarge }
        payloads.append(payload)
      }
      return SharedBatch(id: id, payloads: payloads)
    } catch {
      try? fileManager.removeItem(at: batchDirectory)
      throw error
    }
  }

  private func loadText(from provider: NSItemProvider) async throws -> SharedPayload {
    let type = provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) ? UTType.url : UTType.plainText
    let item: NSSecureCoding = try await withCheckedThrowingContinuation { continuation in
      provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { value, error in
        if let error { continuation.resume(throwing: error); return }
        guard let value else { continuation.resume(throwing: ShareIntakeError.invalidText); return }
        continuation.resume(returning: value)
      }
    }
    let raw: String
    if let url = item as? URL { raw = url.absoluteString }
    else if let text = item as? String { raw = text }
    else if let data = item as? Data, let text = String(data: data, encoding: .utf8) { raw = text }
    else { throw ShareIntakeError.invalidText }
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty, value.count <= SharePolicy.maximumTextCharacters else {
      throw ShareIntakeError.invalidText
    }
    if let url = URL(string: value), url.scheme?.lowercased() == "https" {
      return SharedPayload(
        value: url.absoluteString,
        shareType: "url",
        mimeType: "text/plain",
        contentUri: url.absoluteString,
        contentType: "website",
        contentMimeType: "text/plain",
        originalName: nil,
        contentSize: nil
      )
    }
    return SharedPayload(
      value: value,
      shareType: "text",
      mimeType: "text/plain",
      contentUri: value,
      contentType: "text",
      contentMimeType: "text/plain",
      originalName: nil,
      contentSize: nil
    )
  }

  private func loadMedia(
    from provider: NSItemProvider,
    into directory: URL,
    index: Int,
    remainingBytes: Int64
  ) async throws -> SharedPayload {
    guard remainingBytes > 0 else { throw ShareIntakeError.tooLarge }
    let type = try Self.mediaType(for: provider)
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { source, error in
        if let error { continuation.resume(throwing: error); return }
        guard let source else { continuation.resume(throwing: ShareIntakeError.inaccessibleFile); return }
        do {
          let mime = type.preferredMIMEType?.lowercased() ?? ""
          guard SharePolicy.supportedMimes.contains(mime) else { throw ShareIntakeError.unsupportedType }
          let size = Int64(try source.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
          guard size > 0,
                size <= SharePolicy.maximumItemBytes,
                size <= remainingBytes else { throw ShareIntakeError.tooLarge }
          let filename = Self.safeFilename(source.lastPathComponent, type: type)
          let destination = directory.appendingPathComponent("\(index + 1)-\(filename)")
          try Self.copyBounded(source: source, destination: destination, ceiling: min(remainingBytes, SharePolicy.maximumItemBytes))
          guard Self.matchesSignature(mime: mime, file: destination) else {
            try? FileManager.default.removeItem(at: destination)
            throw ShareIntakeError.invalidSignature
          }
          let kind = type.conforms(to: .image) ? "image" : "video"
          continuation.resume(returning: SharedPayload(
            value: destination.absoluteString,
            shareType: kind,
            mimeType: mime,
            contentUri: destination.absoluteString,
            contentType: kind,
            contentMimeType: mime,
            originalName: filename,
            contentSize: size
          ))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func sharedDirectory() -> URL? {
    guard let root = fileManager.containerURL(forSecurityApplicationGroupIdentifier: SharePolicy.appGroup) else {
      return nil
    }
    let directory = root.appendingPathComponent("IMediaSave/shares", isDirectory: true)
    try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private static func isMedia(_ provider: NSItemProvider) -> Bool {
    provider.hasItemConformingToTypeIdentifier(UTType.image.identifier)
      || provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier)
  }

  private static func isText(_ provider: NSItemProvider) -> Bool {
    provider.hasItemConformingToTypeIdentifier(UTType.url.identifier)
      || provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
  }

  private static func mediaType(for provider: NSItemProvider) throws -> UTType {
    let identifiers = provider.registeredTypeIdentifiers.compactMap(UTType.init)
    guard let type = identifiers.first(where: { type in
      (type.conforms(to: .image) || type.conforms(to: .movie))
        && SharePolicy.supportedMimes.contains(type.preferredMIMEType?.lowercased() ?? "")
    }) else { throw ShareIntakeError.unsupportedType }
    return type
  }

  private static func safeFilename(_ value: String, type: UTType) -> String {
    let base = URL(fileURLWithPath: value).deletingPathExtension().lastPathComponent
      .replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "-", options: .regularExpression)
    let name = String((base.isEmpty ? "media" : base).prefix(140))
    return "\(name).\(type.preferredFilenameExtension ?? "bin")"
  }

  private static func copyBounded(source: URL, destination: URL, ceiling: Int64) throws {
    let partial = destination.appendingPathExtension("part")
    FileManager.default.createFile(atPath: partial.path, contents: nil)
    let input = try FileHandle(forReadingFrom: source)
    let output = try FileHandle(forWritingTo: partial)
    defer { try? input.close(); try? output.close() }
    var written: Int64 = 0
    while let data = try input.read(upToCount: 64 * 1024), !data.isEmpty {
      written += Int64(data.count)
      guard written <= ceiling else {
        try? FileManager.default.removeItem(at: partial)
        throw ShareIntakeError.tooLarge
      }
      try output.write(contentsOf: data)
    }
    try output.synchronize()
    try FileManager.default.moveItem(at: partial, to: destination)
  }

  private static func matchesSignature(mime: String, file: URL) -> Bool {
    guard let data = try? Data(contentsOf: file, options: [.mappedIfSafe]).prefix(16) else { return false }
    let bytes = [UInt8](data)
    switch mime {
    case "image/jpeg": return bytes.starts(with: [0xFF, 0xD8, 0xFF])
    case "image/png": return bytes.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    case "image/gif": return data.starts(with: Data("GIF8".utf8))
    case "image/webp": return data.starts(with: Data("RIFF".utf8)) && data.dropFirst(8).starts(with: Data("WEBP".utf8))
    case "video/mp4", "video/quicktime": return data.count >= 12 && data.dropFirst(4).starts(with: Data("ftyp".utf8))
    case "video/webm": return bytes.starts(with: [0x1A, 0x45, 0xDF, 0xA3])
    default: return false
    }
  }
}

private final class ShareQueue {
  func commit(_ batch: SharedBatch) throws {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: SharePolicy.appGroup) else {
      throw ShareIntakeError.appGroupUnavailable
    }
    let directory = root.appendingPathComponent("IMediaSave/shares", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let destination = directory.appendingPathComponent("\(batch.id).json")
    do {
      let encoder = JSONEncoder()
      try encoder.encode(batch).write(to: destination, options: [.atomic])
    } catch {
      try? FileManager.default.removeItem(at: directory.appendingPathComponent(batch.id, isDirectory: true))
      throw ShareIntakeError.storage
    }
  }
}
