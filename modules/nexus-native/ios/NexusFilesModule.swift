import ExpoModulesCore

public final class NexusFilesModule: Module {
  private let files = LocalAudioFiles.shared
  private let queue = DispatchQueue(label: "nexus.local-files")
  public func definition() -> ModuleDefinition {
    Name("NexusFiles")
    AsyncFunction("importVisual") { (uri: String) throws -> [String: Any] in try VisualAssets.shared.importImage(uri) }.runOnQueue(queue)
    AsyncFunction("resolveVisual") { (id: String) throws -> String in try VisualAssets.shared.resolve(id) }.runOnQueue(queue)
    AsyncFunction("reconcileVisuals") { (ids: [String]) throws in try VisualAssets.shared.reconcile(ids) }.runOnQueue(queue)
    AsyncFunction("visualPalette") { (uri: String) throws -> String in try VisualAssets.shared.palette(uri) }.runOnQueue(queue)
    AsyncFunction("importAudio") { (uri: String, name: String, promise: Promise) in
      Task {
        do { promise.resolve(try await self.files.importFile(uri, name: name)) }
        catch { promise.reject("LOCAL_IMPORT_FAILED", error.localizedDescription) }
      }
    }.runOnQueue(queue)
    AsyncFunction("resolveAudio") { (id: String, ext: String) throws -> String in try self.files.resolve(id, ext) }.runOnQueue(queue)
    AsyncFunction("localArtwork") { (id: String) -> String? in self.files.artwork(id) }.runOnQueue(queue)
    AsyncFunction("beginRemoval") { (id: String, ext: String) throws -> String in try self.files.beginRemoval(id, ext) }.runOnQueue(queue)
    AsyncFunction("finishRemoval") { (token: String, restore: Bool) throws in try self.files.finishRemoval(token, restore: restore) }.runOnQueue(queue)
    AsyncFunction("reconcile") { (files: [[String: String]]) throws in try self.files.reconcile(files) }.runOnQueue(queue)
    AsyncFunction("removeAudio") { (id: String, ext: String) throws in try self.files.remove(id, ext) }.runOnQueue(queue)
  }
}
