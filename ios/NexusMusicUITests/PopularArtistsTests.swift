import XCTest

final class PopularArtistsTests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  func testLivePopularArtists() throws {
    let app = XCUIApplication()
    app.launch()
    func reach(_ item: XCUIElement) {
      for _ in 0..<32 {
        if item.exists {
          let frame = item.frame
          if !frame.isInfinite && !frame.isNull && !frame.isEmpty && item.isHittable { return }
          if !frame.isInfinite && !frame.isNull && frame.midY < app.frame.midY { app.swipeDown(); continue }
        }
        app.swipeUp()
      }
      XCTAssertTrue(item.exists && item.isHittable)
    }
    func image(_ name: String) {
      let shot = XCTAttachment(screenshot: app.screenshot())
      shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    let discover = app.descendants(matching: .any).matching(identifier: "tab-discover").firstMatch
    XCTAssertTrue(discover.waitForExistence(timeout: 20)); discover.tap()
    let netease = app.descendants(matching: .any).matching(identifier: "网易").firstMatch
    reach(netease); netease.tap()
    let open = app.buttons["discovery-popular-artists"]
    reach(open); open.tap()
    let count = app.staticTexts["popular-artists-count"]
    XCTAssertTrue(count.waitForExistence(timeout: 15))
    let thirty = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS %@", "30 位歌手"), object: count)
    XCTAssertEqual(XCTWaiter.wait(for: [thirty], timeout: 30), .completed)
    image("Public popular artists first thirty")
    let more = app.buttons["加载更多"]
    reach(more); more.tap()
    let sixty = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS %@", "60 位歌手"), object: count)
    XCTAssertEqual(XCTWaiter.wait(for: [sixty], timeout: 30), .completed)
    reach(count); image("Public popular artists sixty distinct entries")
    let first = app.buttons["discovery-item-0"]
    reach(first); first.tap()
    let songs = app.otherElements["discovery-track-0"]
    XCTAssertTrue(songs.waitForExistence(timeout: 40))
    XCTAssertTrue(app.staticTexts["artist-popular-scope"].exists)
    XCTAssertTrue(app.staticTexts["artist-search-counts"].label.hasPrefix("热门目录摘要"))
    image("Popular artist opens existing songs and honest catalog scope")
    let albums = app.descendants(matching: .any).matching(identifier: "artist-tab-albums").firstMatch
    reach(albums); albums.tap()
    let album = app.buttons["discovery-item-0"]
    XCTAssertTrue(album.waitForExistence(timeout: 40)); image("Popular artist opens existing album directory")
    let back = app.buttons["返回热门歌手"]
    reach(back); back.tap()
    XCTAssertTrue(count.waitForExistence(timeout: 15)); XCTAssertTrue(count.label.contains("60 位歌手"))
    reach(count); image("Returning retains sixty popular artists without reloading")
    let refresh = app.buttons["discovery-load-retry"]
    reach(refresh); refresh.tap()
    let refreshed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS %@", "30 位歌手"), object: count)
    XCTAssertEqual(XCTWaiter.wait(for: [refreshed], timeout: 30), .completed)
    reach(count); image("Refreshing popular artists resets the public page boundary")
    XCTAssertFalse(app.buttons["暂停"].exists, "Browsing must not start music")
  }
}
