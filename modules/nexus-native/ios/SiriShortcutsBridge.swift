import Foundation
#if canImport(AppIntents)
import AppIntents

@available(iOS 16.0, *)
public struct ResumeNexusPlaybackIntent: AppIntent {
  public static var title: LocalizedStringResource = "继续播放音枢"
  public static var description = IntentDescription("恢复音枢当前队列播放")
  public static var openAppWhenRun: Bool = false

  public init() {}

  public func perform() async throws -> some IntentResult & ProvidesDialog {
    NexusCarBridgeStore.shared.dispatchCommand(["source": "siri", "action": "resume"])
    return .result(dialog: "已在音枢恢复播放")
  }
}

@available(iOS 16.0, *)
public struct PauseNexusPlaybackIntent: AppIntent {
  public static var title: LocalizedStringResource = "暂停音枢播放"
  public static var description = IntentDescription("暂停音枢当前播放")
  public static var openAppWhenRun: Bool = false

  public init() {}

  public func perform() async throws -> some IntentResult & ProvidesDialog {
    NexusCarBridgeStore.shared.dispatchCommand(["source": "siri", "action": "pause"])
    return .result(dialog: "已暂停音枢播放")
  }
}

@available(iOS 16.0, *)
public struct PlayNexusFavoritesIntent: AppIntent {
  public static var title: LocalizedStringResource = "播放音枢收藏"
  public static var description = IntentDescription("从头播放音枢收藏曲库")
  public static var openAppWhenRun: Bool = false

  public init() {}

  public func perform() async throws -> some IntentResult & ProvidesDialog {
    NexusCarBridgeStore.shared.dispatchCommand(["source": "siri", "action": "playFavorites"])
    return .result(dialog: "正在播放音枢收藏歌曲")
  }
}

@available(iOS 16.0, *)
public struct NextNexusTrackIntent: AppIntent {
  public static var title: LocalizedStringResource = "音枢下一首"
  public static var description = IntentDescription("切换到音枢下一首歌曲")
  public static var openAppWhenRun: Bool = false

  public init() {}

  public func perform() async throws -> some IntentResult & ProvidesDialog {
    NexusCarBridgeStore.shared.dispatchCommand(["source": "siri", "action": "next"])
    return .result(dialog: "已切换到下一首")
  }
}

@available(iOS 16.0, *)
public struct NexusAppShortcutsProvider: AppShortcutsProvider {
  public static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ResumeNexusPlaybackIntent(),
      phrases: ["用 \(.applicationName) 继续播放", "继续播放 \(.applicationName)"],
      shortTitle: "继续播放",
      systemImageName: "play.fill"
    )
    AppShortcut(
      intent: PlayNexusFavoritesIntent(),
      phrases: ["用 \(.applicationName) 播放收藏", "播放 \(.applicationName) 收藏"],
      shortTitle: "播放收藏",
      systemImageName: "heart.fill"
    )
    AppShortcut(
      intent: NextNexusTrackIntent(),
      phrases: ["\(.applicationName) 下一首", "用 \(.applicationName) 切歌"],
      shortTitle: "下一首",
      systemImageName: "forward.fill"
    )
  }
}
#endif
