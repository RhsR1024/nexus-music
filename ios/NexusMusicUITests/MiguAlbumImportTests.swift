import XCTest

final class MiguAlbumImportTests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  func testLiveMiguAlbumImportPersistence() throws {
    let app = XCUIApplication()
    let title = "No.6 Collaborations Project"
    let scope = "来自平台公开目录，仅包含本次可读取的曲目。"
    app.launch()
    func reach(_ item: XCUIElement) {
      for _ in 0..<35 {
        if item.exists {
          let frame = item.frame
          if !frame.isInfinite && !frame.isNull && !frame.isEmpty && item.isHittable { return }
          if !frame.isInfinite && !frame.isNull && frame.midY < app.frame.midY { app.swipeDown(); continue }
        }
        app.swipeUp()
      }
      let screenshot = XCTAttachment(screenshot: app.screenshot())
      screenshot.name = "Migu import unreachable target"; screenshot.lifetime = .keepAlways; add(screenshot)
      let hierarchy = XCTAttachment(string: "Target: \(item.debugDescription)\n" + app.debugDescription)
      hierarchy.name = "Migu import unreachable target hierarchy"; hierarchy.lifetime = .keepAlways; add(hierarchy)
      XCTAssertTrue(item.exists && item.isHittable)
    }
    func image(_ name: String) {
      let shot = XCTAttachment(screenshot: app.screenshot())
      shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    func tab(_ name: String) {
      let target = app.descendants(matching: .any).matching(identifier: "tab-" + name).firstMatch
      XCTAssertTrue(target.waitForExistence(timeout: 20)); target.tap()
    }
    func playlists() {
      tab("library")
      let target = app.buttons["我的歌单"]
      reach(target); target.tap()
    }
    func copyRow() -> XCUIElement {
      app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title + " · ")).firstMatch
    }
    func openDigitalAlbum() {
      tab("search")
      let albums = app.descendants(matching: .any).matching(identifier: "search-kind-album").firstMatch
      reach(albums); albums.tap()
      let migu = app.descendants(matching: .any).matching(identifier: "咪咕").firstMatch
      reach(migu); migu.tap()
      let query = app.textFields["搜索专辑"]
      reach(query)
      if query.value as? String != title {
        XCTAssertTrue((query.value as? String == "") || (query.value as? String == query.placeholderValue), "Initial search draft must be empty")
        query.tap()
        for character in title { query.typeText(String(character)) }
        let typed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", title), object: query)
        XCTAssertEqual(XCTWaiter.wait(for: [typed], timeout: 10), .completed)
        query.typeText("\n")
      }
      XCTAssertEqual(query.value as? String, title)
      let album = app.buttons["search-album-mg-0"]
      XCTAssertTrue(album.waitForExistence(timeout: 45)); XCTAssertTrue(album.label.contains(title))
      reach(album); album.tap()
      let first = app.otherElements["discovery-track-0"]
      XCTAssertTrue(first.waitForExistence(timeout: 45))
    }
    playlists()
    try XCTSkipIf(copyRow().exists, "This test must not modify a pre-existing album copy")
    openDigitalAlbum()
    XCTAssertTrue(app.staticTexts["album-public-scope"].exists)
    // Public digital-resource snapshot, independently fixed before import.
    let expected = ["Beautiful People feat. Khalid", "Cross Me (Explicit)",
      "Best Part of Me feat. Yebba", "I Don't Care", "Feels (feat. Young Thug & J Hus)",
      "Put It All on Me (feat. Ella Mai)", "Blow with Bruno Mars & Chris Stapleton"]
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label == %@", "咪咕 · 已加载 7 / 7 首")).firstMatch.exists)
    let importer = app.buttons["discovery-import-full"]
    reach(importer); XCTAssertEqual(importer.label, "导入公开曲目到音乐库"); importer.tap()
    let alert = app.alerts["导入公开曲目"]
    XCTAssertTrue(alert.waitForExistence(timeout: 45))
    XCTAssertTrue(alert.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "7 首")).firstMatch.exists)
    XCTAssertTrue(alert.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "未返回的曲目不在本次导入范围内")).firstMatch.exists)
    image("Migu public album preview explicitly limits seven tracks")
    alert.buttons["取消"].tap()
    let back = app.buttons["返回搜索结果"]
    reach(back); back.tap(); playlists()
    XCTAssertFalse(copyRow().exists, "Cancelling must not create a local copy")
    openDigitalAlbum(); reach(importer); importer.tap()
    XCTAssertTrue(alert.waitForExistence(timeout: 45)); alert.buttons["创建本地歌单"].tap()
    XCTAssertTrue(app.staticTexts["已保存到我的歌单"].waitForExistence(timeout: 20))
    reach(back); back.tap(); playlists()
    func verifyCopy(_ screenshot: String) {
      let copy = copyRow()
      XCTAssertTrue(copy.waitForExistence(timeout: 15)); XCTAssertTrue(copy.label.contains("7首"))
      reach(copy); copy.tap()
      let description = app.textFields["音枢歌单描述"]
      XCTAssertTrue(description.waitForExistence(timeout: 10)); XCTAssertEqual(description.value as? String, scope)
      reach(description); image(screenshot + " scope")
      var previousY: CGFloat?
      for name in expected {
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
        reach(row)
        XCTAssertTrue(row.label.contains("mg"), "Keep the original Migu platform identity")
        // Compare adjacent rows in a single unscrolled layout after revealing
        // the last item, so scroll offsets cannot masquerade as reordered rows.
      }
      for name in expected {
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
        if let previousY { XCTAssertGreaterThan(row.frame.minY, previousY) }
        previousY = row.frame.minY
      }
      image(screenshot)
    }
    verifyCopy("Migu public album local copy preserves seven ordered identities")
    app.terminate(); app.launch(); playlists()
    verifyCopy("Migu public album scope and ordered tracks persist after relaunch")
    let remove = app.buttons["删除歌单"]
    reach(remove); remove.tap()
    let confirmation = app.alerts["删除此音枢歌单？"]
    XCTAssertTrue(confirmation.waitForExistence(timeout: 10)); confirmation.buttons["删除"].tap()
    XCTAssertTrue(app.textFields["创建音枢歌单名称"].waitForExistence(timeout: 15)); XCTAssertFalse(copyRow().exists)
    app.terminate(); app.launch(); playlists()
    XCTAssertFalse(copyRow().exists, "Only this run's new copy is removed, durably")
    XCTAssertFalse(app.buttons["暂停"].exists)
    image("Migu import cleanup persists without starting playback")
  }
}
