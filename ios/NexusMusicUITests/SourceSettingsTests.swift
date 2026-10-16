import XCTest
import Vision

final class SourceSettingsTests: XCTestCase {
  override func setUpWithError() throws {continueAfterFailure=false}
  private func openSettings(_ app:XCUIApplication,page:String){
    let tab=app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch
    XCTAssertTrue(tab.waitForExistence(timeout:15));tab.tap()
    for _ in 0..<3 {let back=app.buttons["settings-back"];if !back.exists{break};back.tap()}
    func enter(_ target:String){
      let row=app.buttons["settings-open-"+target]
      XCTAssertTrue(row.waitForExistence(timeout:10))
      for _ in 0..<6 {if row.isHittable{break};app.swipeUp()}
      XCTAssertTrue(row.isHittable);row.tap();XCTAssertTrue(app.staticTexts["settings-title-"+target].waitForExistence(timeout:5))
    }
    let appearancePages=["theme","background","skins","accent","navigation","mini"]
    enter(page=="typography" ? "playback" : page=="equalizer" ? "equalizer" : appearancePages.contains(page) ? "appearance" : page)
    if page=="typography"{enter("typography")}else if appearancePages.contains(page){enter(page)}
  }
  private func replaceText(_ field:XCUIElement,with value:String,in app:XCUIApplication){
    field.tap();field.press(forDuration:1.1)
    let selectAll=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Select All","全选","全選"])).firstMatch
    XCTAssertTrue(selectAll.waitForExistence(timeout:5),"Replace the full field using the actual selection menu, independent of its insertion point")
    selectAll.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    XCTAssertEqual(field.value as? String,value)
  }
  private func dismissPasswordSuggestion(in container:XCUIElement) -> Bool {
    // iOS 27 can present this remote sheet only after the credential modal closes.
    // Match its title so unrelated alerts (including our removal confirmation) stay visible.
    let title=container.staticTexts.matching(NSPredicate(format:"label IN %@",["Save Password?","存储密码？","储存密码？","保存密码？","儲存密碼？"])).firstMatch
    guard title.exists else{return false}
    let later=container.buttons.matching(NSPredicate(format:"label IN %@",["Not Now","以后","稍后","暫時不要"])).firstMatch
    guard later.isHittable else{return false}
    let evidence=XCTAttachment(screenshot:XCUIScreen.main.screenshot());evidence.name="System password suggestion";evidence.lifetime = .keepAlways;add(evidence)
    later.tap();return true
  }
  private func waitForWebDAVControl(_ control:XCUIElement,in app:XCUIApplication) {
    let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      _=self.dismissPasswordSuggestion(in:app)
      return control.isHittable
    },object:control)
    XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:10),.completed,"WebDAV control must be reachable after dismissing the system password sheet")
  }
  private func selectLocalFixture(_ prefix:String,in app:XCUIApplication){
    // Query the complete tree: iOS 27 Files is a remote accessibility subtree.
    let file=app.descendants(matching:.any).matching(NSPredicate(format:"elementType == %d AND label BEGINSWITH %@",XCUIElement.ElementType.cell.rawValue,prefix)).firstMatch
    let folder=app.descendants(matching:.any).matching(NSPredicate(format:"elementType == %d AND label BEGINSWITH %@",XCUIElement.ElementType.cell.rawValue,"Nexus UITest Fixtures")).firstMatch
    for _ in 0..<6 {
      if file.waitForExistence(timeout:3) && file.isHittable{break}
      if folder.exists && folder.isHittable{folder.tap();continue}
      let phone=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).firstMatch
      if phone.exists && phone.isHittable{phone.tap();continue}
      let browse=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["浏览","Browse","瀏覽"])).firstMatch
      if browse.exists && browse.isHittable{browse.tap()}
    }
    XCTAssertTrue(file.waitForExistence(timeout:10));XCTAssertTrue(file.isHittable,"The actual Files cell must be visible before selection");file.tap()
    let open=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["打开","Open","開啟"])).firstMatch
    if open.waitForExistence(timeout:3) && open.isHittable{open.tap()}
  }
  func testAppIconOnHomeScreen() throws {
    let app=XCUIApplication();app.launch();XCUIDevice.shared.press(.home)
    let home=XCUIApplication(bundleIdentifier:"com.apple.springboard"),icon=home.icons["音枢"].firstMatch
    // iOS 27 can expose only an empty UISystemShellApplication AX root even
    // while the icon is visible. Locate its exact label in the actual screen;
    // never replace this icon-launch check with app.activate() or a fixed point.
    func visibleLabel() throws -> CGPoint? {
      guard let image=XCUIScreen.main.screenshot().image.cgImage else{return nil}
      let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.recognitionLanguages=["zh-Hans","en-US"]
      try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
      guard let match=request.results?.first(where:{$0.topCandidates(1).first.map{$0.string=="音枢" && $0.confidence>=0.8} ?? false}) else{return nil}
      return CGPoint(x:match.boundingBox.midX,y:1-match.boundingBox.midY)
    }
    var label=try visibleLabel()
    for _ in 0..<4 {if icon.isHittable || label != nil{break};home.swipeLeft();label=try visibleLabel()}
    let image=XCTAttachment(screenshot:XCUIScreen.main.screenshot());image.name="Home screen icon and exact display label";image.lifetime = .keepAlways;add(image)
    XCTAssertTrue(icon.isHittable || label != nil,"The actual Home screen must expose or visibly render the 音枢 icon label")
    if let label {home.coordinate(withNormalizedOffset:CGVector(dx:label.x,dy:label.y)).tap()}else{icon.tap()}
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.waitForExistence(timeout:15))
  }
  func testIPadWindowNavigationAndRotation() throws {
    XCTAssertEqual(UIDevice.current.userInterfaceIdiom,.pad,"Run this dedicated test on an actual iPad simulator target")
    let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
    defer{XCUIDevice.shared.orientation = .portrait}
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func wait(_ condition:@escaping()->Bool,_ message:String){let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in condition()},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:15),.completed,message)}
    func evidence(_ name:String){let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item)}
    let expanded=element("app-layout-expanded"),searchTab=element("rail-tab-search"),libraryTab=element("rail-tab-library")
    if !expanded.waitForExistence(timeout:3){
      XCTAssertTrue(element("app-layout-compact").exists);XCTAssertTrue(element("tab-search").isHittable);evidence("iPad narrow native window uses bottom navigation")
      let system=XCUIApplication(bundleIdentifier:"com.apple.springboard"),zoom=XCUIApplication(bundleIdentifier:"com.apple.springboard").buttons["Zoom-button"]
      if !zoom.isHittable{let controls=system.buttons["window-controls:com.nexusmusic.app"];XCTAssertTrue(controls.waitForExistence(timeout:5));controls.tap()}
      let item=XCTAttachment(string:system.debugDescription);item.name="iPad system window controls";item.lifetime = .keepAlways;add(item)
      XCTAssertTrue(zoom.waitForExistence(timeout:5));zoom.tap()
    }
    XCTAssertTrue(expanded.waitForExistence(timeout:20));XCTAssertGreaterThanOrEqual(expanded.frame.width,768,"iPhone compatibility windows must not satisfy iPad layout validation")
    XCTAssertTrue(searchTab.isHittable);XCTAssertTrue(libraryTab.isHittable);XCTAssertFalse(element("tab-search").isHittable)
    evidence("iPad portrait native window and rail")
    searchTab.tap();let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:5));query.tap();for character in "Fixture iPad"{query.typeText(String(character))};query.typeText("\n");XCTAssertEqual(query.value as? String,"Fixture iPad")
    XCUIDevice.shared.orientation = .landscapeLeft
    wait({app.frame.width>app.frame.height && searchTab.isHittable},"The actual iPad window must rotate while retaining navigation")
    XCTAssertEqual(query.value as? String,"Fixture iPad");XCTAssertTrue(expanded.exists);evidence("iPad landscape search draft retained")
    libraryTab.tap();let sync=app.buttons["cloud-sync-open"]
    for _ in 0..<18{if sync.isHittable{break};app.swipeUp()};XCTAssertTrue(sync.isHittable);sync.tap()
    let close=app.buttons["收起多设备同步"];XCTAssertTrue(close.waitForExistence(timeout:5));XCTAssertTrue(close.isHittable)
    XCUIDevice.shared.orientation = .portrait
    wait({app.frame.height>app.frame.width && close.isHittable},"A presented modal must rotate with the iPad window")
    evidence("iPad modal portrait after rotation");close.tap();XCTAssertTrue(libraryTab.isHittable)
    element("rail-tab-discover").tap();XCTAssertTrue(element("discovery-content").waitForExistence(timeout:10))
    let discovery=element("discovery-content");XCTAssertGreaterThan(discovery.frame.minX,libraryTab.frame.maxX)
    XCTAssertLessThanOrEqual(discovery.frame.maxX,app.frame.maxX+1);evidence("iPad discovery constrained to content column")
  }
  func testGroupedSettingsNavigationAndDrafts() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"sources")
    func reveal(_ element:XCUIElement){for _ in 0..<24 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))};XCTAssertTrue(element.isHittable)}
    func evidence(_ name:String){let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item)}
    let source=app.textFields["音源订阅地址"];reveal(source);source.tap();for character in "https://example.invalid/draft.js"{source.typeText(String(character))};source.typeText("\n")
    XCTAssertEqual(source.value as? String,"https://example.invalid/draft.js");let previousY=source.frame.midY
    XCTAssertTrue(app.buttons["settings-back"].isHittable,"Back must stay above the scroll content")
    app.buttons["settings-back"].tap();XCTAssertFalse(source.exists,"Hidden settings must leave the accessibility tree")
    XCTAssertTrue(app.staticTexts["settings-title-home"].exists);evidence("Grouped mobile settings home")
    let sources=app.buttons["settings-open-sources"];reveal(sources);sources.tap()
    XCTAssertTrue(source.isHittable);XCTAssertEqual(source.value as? String,"https://example.invalid/draft.js");XCTAssertEqual(source.frame.midY,previousY,accuracy:2,"Back must restore the original scroll position")
    openSettings(app,page:"equalizer")
    let name=app.textFields["eq-preset-name"];reveal(name);name.tap();for character in "Retained draft"{name.typeText(String(character))};name.typeText("\n")
    openSettings(app,page:"appearance");XCTAssertFalse(name.exists)
    let fontEntry=app.buttons["settings-open-typography"];reveal(fontEntry);fontEntry.tap()
    XCTAssertTrue(app.staticTexts["settings-title-typography"].exists);XCTAssertTrue(app.buttons["font-import"].isHittable)
    app.buttons["settings-back"].tap();XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    openSettings(app,page:"equalizer");XCTAssertEqual(name.value as? String,"Retained draft");XCTAssertTrue(name.isHittable);evidence("Settings draft and scroll retained")
    openSettings(app,page:"appearance");app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["settings-title-home"].waitForExistence(timeout:5),"Selecting the active settings tab must return to the settings root")
    openSettings(app,page:"storage");XCTAssertFalse(name.exists)
    let backup=app.buttons["cloud-backup-open"];reveal(backup);backup.tap();XCTAssertTrue(app.buttons["收起云备份"].waitForExistence(timeout:5));app.buttons["收起云备份"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let sourceLink=app.buttons["音乐来源"];reveal(sourceLink);sourceLink.tap()
    XCTAssertTrue(app.staticTexts["settings-title-sources"].waitForExistence(timeout:5));XCTAssertEqual(app.buttons["settings-back"].label,"返回音乐库")
    app.buttons["settings-back"].tap();XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.isSelected)
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["settings-title-home"].waitForExistence(timeout:5),"Selecting the settings tab must return to the settings root")
  }
  func testCrossPlatformLyrics() throws {
    let app=XCUIApplication();app.launch()
    func reach(_ element:XCUIElement,up:Bool=true){for _ in 0..<12 {if element.isHittable{break};if up{app.swipeUp()}else{app.swipeDown()}};XCTAssertTrue(element.isHittable)}
    openSettings(app,page:"sources")
    let source=app.textFields["音源订阅地址"];reach(source);source.tap();for character in "http://127.0.0.1:18439/matching-source.js"{source.typeText(String(character))};source.typeText("\n");app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Matching Fixture"],enabled=app.buttons["停用音源：Nexus Matching Fixture"]
    for _ in 0..<5{if enable.isHittable||enabled.isHittable{break};app.swipeUp()};if enable.exists{enable.tap()}else{XCTAssertTrue(enabled.isHittable)}
    XCTAssertTrue(app.staticTexts["已启用"].firstMatch.waitForExistence(timeout:20))
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];reach(query);app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap();query.tap();query.typeText("Synthetic match tone\n")
    let searchSongs=app.buttons["run-online-search"];reach(searchSongs);searchSongs.tap()
    let first=app.buttons["search-track-wy-0"];for _ in 0..<8{if first.waitForExistence(timeout:2){break};app.swipeUp()};XCTAssertTrue(first.exists);reach(first);first.tap();app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["正在通过 tx · Synthetic match tone 播放"].waitForExistence(timeout:30));XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    let pause=app.buttons["暂停"].firstMatch;reach(pause);pause.tap()
    let sourceButton=app.buttons["选择歌词来源"].firstMatch;reach(sourceButton,up:false);sourceButton.tap()
    app.buttons["自动优选跨平台歌词"].tap()
    let lyricSource=app.staticTexts["lyric-source"].firstMatch
    let automatic=NSPredicate(format:"label CONTAINS %@","自动优选 · 网易云")
    expectation(for:automatic,evaluatedWith:lyricSource);waitForExpectations(timeout:30)
    XCTAssertTrue(app.buttons["Synthetic rich lyric"].firstMatch.exists);XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Changing lyrics must preserve paused audio")
    reach(sourceButton,up:false);sourceButton.tap();let search=app.buttons["搜索歌词候选"];reach(search);search.tap()
    let live=app.buttons["lyric-candidate-tx-fixture-live"];XCTAssertTrue(live.waitForExistence(timeout:20));reach(live);live.tap()
    let save=app.buttons["保存此歌词"];XCTAssertTrue(save.waitForExistence(timeout:15));reach(save);save.tap()
    let manual=NSPredicate(format:"label CONTAINS %@","手动指定 · QQ音乐 · Synthetic match tone (Live)")
    expectation(for:manual,evaluatedWith:lyricSource);waitForExpectations(timeout:20)
    XCTAssertTrue(app.buttons["Synthetic original lyric"].firstMatch.exists);XCTAssertTrue(app.buttons["播放"].firstMatch.exists)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Manual lyrics with unchanged paused audio";image.lifetime = .keepAlways;add(image)
    // Restored queues are paused with no resolved media. Resolve the recording
    // before checking its saved lyric choice; a stale automatic audio match
    // must not label the original recording as the matched one while paused.
    app.terminate();app.launch();app.buttons["打开播放页"].tap()
    let resume=app.buttons["播放"].firstMatch;reach(resume);resume.tap()
    expectation(for:manual,evaluatedWith:lyricSource);waitForExpectations(timeout:30)
    reach(pause);pause.tap()
    reach(sourceButton,up:false);sourceButton.tap();app.buttons["使用原歌词"].tap()
    XCTAssertTrue(app.staticTexts["歌词来源：原歌词"].waitForExistence(timeout:15));XCTAssertTrue(app.buttons["Synthetic original lyric"].firstMatch.exists);XCTAssertTrue(app.buttons["播放"].firstMatch.exists)
    let close=app.buttons["收起播放页"];reach(close,up:false);close.tap();openSettings(app,page:"sources")
    let selected=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Matching Fixture").firstMatch;reach(selected);selected.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap();XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
  }
  func testPublicComments() throws {
    let app=XCUIApplication();app.launch();XCTAssertFalse(app.buttons["暂停"].exists)
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];for _ in 0..<8 {if query.isHittable{break};app.swipeUp()};XCTAssertTrue(query.isHittable)
    query.tap();query.typeText("fixture");query.typeText("\n");app.buttons["搜索"].firstMatch.tap()
    let song=app.buttons["search-track-wy-0"];XCTAssertTrue(song.waitForExistence(timeout:15))
    let comments=app.buttons["歌曲评论"].firstMatch;for _ in 0..<6 {if comments.isHittable{break};app.swipeUp()};comments.tap()
    XCTAssertTrue(app.staticTexts["Synthetic hot comment"].waitForExistence(timeout:15));XCTAssertTrue(app.staticTexts["Synthetic comment 1"].exists)
    let more=app.buttons["加载更多评论"];for _ in 0..<6 {if more.isHittable{break};app.swipeUp()};more.tap()
    let retry=app.buttons["重试评论"];XCTAssertTrue(retry.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["Synthetic comment 2"].exists);retry.tap()
    XCTAssertTrue(app.staticTexts["Synthetic comment 3"].waitForExistence(timeout:10));XCTAssertFalse(app.buttons["加载更多评论"].exists)
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
    let refresh=app.buttons["刷新评论"];for _ in 0..<5 {if refresh.isHittable{break};app.swipeDown()};refresh.tap();XCTAssertTrue(app.buttons["加载更多评论"].waitForExistence(timeout:10))
    app.buttons["收起歌曲评论"].tap();XCTAssertFalse(app.buttons["暂停"].exists)
  }
  func testSourceHealth() throws {
    let app=XCUIApplication();app.launch();XCTAssertFalse(app.buttons["暂停"].exists)
    openSettings(app,page:"sources")
    let address=app.textFields["音源订阅地址"]
    for _ in 0..<8 {if address.isHittable{break};app.swipeUp()};XCTAssertTrue(address.isHittable)
    address.tap();for character in "http://127.0.0.1:18439/health-source.js"{address.typeText(String(character))};address.typeText("\n");app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Health Fixture"]
    for _ in 0..<5 {if enable.isHittable{break};app.swipeUp()};if enable.waitForExistence(timeout:3){enable.tap()}else{XCTAssertTrue(app.buttons["停用音源：Nexus Health Fixture"].exists)}
    XCTAssertTrue(app.staticTexts["已启用"].firstMatch.waitForExistence(timeout:20))
    let selection=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Health Fixture").firstMatch
    for _ in 0..<3 {if selection.isHittable{break};app.swipeDown()};selection.tap()
    let health=app.buttons["音源健康批测"];for _ in 0..<5 {if health.isHittable{break};app.swipeDown()};health.tap()
    let query=app.textFields["音源检查关键词"];XCTAssertTrue(query.waitForExistence(timeout:10));query.tap();for character in "slow" {query.typeText(String(character))};expectation(for:NSPredicate(format:"value == %@","slow"),evaluatedWith:query);waitForExpectations(timeout:5);app.buttons["health-start"].tap()
    let cancel=app.buttons["health-cancel"];XCTAssertTrue(cancel.waitForExistence(timeout:5));cancel.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已取消，已完成项保留")).firstMatch.waitForExistence(timeout:10))
    query.tap();for _ in 0..<4 {query.typeText(XCUIKeyboardKey.delete.rawValue)};for character in "fixture" {query.typeText(String(character))};expectation(for:NSPredicate(format:"value == %@","fixture"),evaluatedWith:query);waitForExpectations(timeout:5);app.buttons["health-start"].tap()
    let completed=app.staticTexts["health-progress"];XCTAssertTrue(completed.waitForExistence(timeout:5))
    let finished=NSPredicate(format:"label == %@","检查结束 · 6 / 6")
    expectation(for:finished,evaluatedWith:completed);waitForExpectations(timeout:35)
    let reportImage=XCTAttachment(screenshot:app.screenshot());reportImage.lifetime = .keepAlways;add(reportImage)
    let failed=app.descendants(matching:.any).matching(identifier:"health-row-wy-flac").firstMatch
    for _ in 0..<5 {if failed.isHittable{break};app.swipeUp()};XCTAssertTrue(app.staticTexts["未取得有效地址"].firstMatch.exists)
    let response=app.descendants(matching:.any).matching(identifier:"health-row-tx-flac").firstMatch
    for _ in 0..<5 {if response.isHittable{break};app.swipeUp()};XCTAssertTrue(app.staticTexts["媒体头已识别 · WAV · HTTP 206"].firstMatch.exists)
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    let export=app.buttons["导出检查报告"];for _ in 0..<6 {if export.isHittable{break};app.swipeDown()};export.tap()
    let dismiss=app.buttons.matching(NSPredicate(format:"label IN %@",["Close","Cancel","关闭","取消"])).firstMatch
    if dismiss.waitForExistence(timeout:5){dismiss.tap()}else{
      // iOS 27 presents a popover with an explicit outside-dismiss region.
      // Its remote ActivityListView has an empty hittable frame; swiping that
      // descendant fails even though the report preview is visible.
      let outside=app.descendants(matching:.any).matching(identifier:"PopoverDismissRegion").firstMatch
      let popover=app.popovers.firstMatch
      if outside.waitForExistence(timeout:2),popover.exists {
        let preview=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@","nexus-source-health-")).firstMatch
        XCTAssertTrue(preview.exists,"The exported JSON must reach the system share preview")
        let evidence=XCTAttachment(screenshot:app.screenshot());evidence.name="Source report share preview";evidence.lifetime = .keepAlways;add(evidence)
        let top=popover.frame.minY-app.frame.minY
        XCTAssertGreaterThan(top,20,"Dismiss only in the observed region above the popover")
        app.coordinate(withNormalizedOffset:.zero).withOffset(CGVector(dx:app.frame.width/2,dy:top/2)).tap()
      }else{
        // Older SDKs present a regular sheet with a real hittable frame.
        let sheet=app.descendants(matching:.any).matching(identifier:"ActivityListView").firstMatch
        XCTAssertTrue(sheet.waitForExistence(timeout:10));XCTAssertTrue(sheet.isHittable)
        sheet.swipeDown()
      }
    }
    let returned=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true"),object:app.buttons["收起音源检查"])
    XCTAssertEqual(XCTWaiter.wait(for:[returned],timeout:5),.completed,"Dismissal must return to the existing health report")
    app.buttons["收起音源检查"].tap();XCTAssertFalse(app.buttons["暂停"].exists,"Health checks must preserve paused playback intent")
    let selected=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Health Fixture").firstMatch
    for _ in 0..<6 {if selected.isHittable{break};app.swipeUp()};XCTAssertTrue(selected.exists);app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap();XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
  }
  func testOnlineMatching() throws {
    // scripts/test-ui.mjs selects a separate simulator entry with an HTTP adapter.
    // The real provider parsing, LX host, routing, storage and PCM backend still run.
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"sources")
    let source=app.textFields["音源订阅地址"]
    for _ in 0..<8 {if source.isHittable{break};app.swipeUp()}
    XCTAssertTrue(source.isHittable);source.tap();for character in "http://127.0.0.1:18439/matching-source.js"{source.typeText(String(character))};source.typeText("\n");app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Matching Fixture"]
    for _ in 0..<5 {if enable.isHittable{break};app.swipeUp()}
    if enable.waitForExistence(timeout:3){enable.tap()}else{XCTAssertTrue(app.buttons["停用音源：Nexus Matching Fixture"].exists)}
    XCTAssertTrue(app.staticTexts["已启用"].firstMatch.waitForExistence(timeout:20))
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10));app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();query.typeText("Synthetic match tone\n")
    let first=app.buttons["search-track-wy-0"];XCTAssertTrue(first.waitForExistence(timeout:20));first.tap();app.buttons["打开播放页"].tap()
    let actual=app.staticTexts["正在通过 tx · Synthetic match tone 播放"]
    XCTAssertTrue(actual.waitForExistence(timeout:30));XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    XCTAssertTrue(app.staticTexts["偏好 flac · 成功请求档位 flac（非实际文件格式证明）"].exists)
    app.buttons["匹配歌曲"].tap();app.buttons["取消指定版本，恢复自动"].tap()
    XCTAssertTrue(app.staticTexts["保留原曲，可选择其他录音版本"].waitForExistence(timeout:10))
    for _ in 0..<4 {if app.buttons["播放"].firstMatch.isHittable{break};app.swipeUp()};app.buttons["播放"].firstMatch.tap()
    XCTAssertTrue(actual.waitForExistence(timeout:20));for _ in 0..<4 {if app.buttons["匹配歌曲"].isHittable{break};app.swipeDown()}
    app.buttons["匹配歌曲"].tap()
    let live=app.buttons["match-candidate-tx-fixture-live"]
    XCTAssertTrue(live.waitForExistence(timeout:20));for _ in 0..<4 {if live.isHittable{break};app.swipeUp()};live.tap();app.alerts.buttons["保存匹配"].tap()
    XCTAssertTrue(app.staticTexts["已指定版本，重新播放后使用"].waitForExistence(timeout:10));XCTAssertTrue(app.buttons["播放"].firstMatch.exists)
    for _ in 0..<4 {if app.buttons["播放"].firstMatch.isHittable{break};app.swipeUp()};app.buttons["播放"].firstMatch.tap()
    let liveActual=app.staticTexts["正在通过 tx · Synthetic match tone (Live) 播放"]
    XCTAssertTrue(liveActual.waitForExistence(timeout:15));XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    for _ in 0..<4 {if app.buttons["匹配歌曲"].isHittable{break};app.swipeDown()};app.buttons["匹配歌曲"].tap();app.buttons["取消指定版本，恢复自动"].tap()
    XCTAssertTrue(app.staticTexts["保留原曲，可选择其他录音版本"].waitForExistence(timeout:10))
    app.terminate();app.launch();app.buttons["打开播放页"].tap();XCTAssertTrue(app.staticTexts["保留原曲，可选择其他录音版本"].waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["Synthetic match tone"].firstMatch.exists)
    app.buttons["收起播放页"].tap();openSettings(app,page:"playback")
    let automatic=app.buttons["automatic-online-matching"]
    // Short content swipes avoid skipping this button between large settings cards.
    for _ in 0..<40 {if automatic.isHittable{break};app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.72)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.42)))}
    XCTAssertTrue(automatic.isHittable);XCTAssertEqual(automatic.label,"普通在线歌曲自动匹配：开启");automatic.tap();app.terminate();app.launch()
    openSettings(app,page:"playback");let disabled=app.buttons["automatic-online-matching"]
    for _ in 0..<40 {if disabled.isHittable{break};app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.72)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.42)))}
    XCTAssertTrue(disabled.isHittable);XCTAssertEqual(disabled.label,"普通在线歌曲自动匹配：关闭");disabled.tap()
    openSettings(app,page:"sources")
    let fixture=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Matching Fixture").firstMatch
    for _ in 0..<20 {if fixture.isHittable{break};app.swipeDown()};XCTAssertTrue(fixture.isHittable);fixture.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
  }
  func testUCloudSyncPreviewConflictRestartAndDeletion() throws {
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){for _ in 0..<18{if element.isHittable{return};app.swipeUp()};XCTAssertTrue(element.isHittable)}
    func library(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();for _ in 0..<8{app.swipeDown()}}
    func sync(){let entry=app.buttons["cloud-sync-open"];reveal(entry);entry.tap();XCTAssertTrue(app.buttons["收起多设备同步"].waitForExistence(timeout:5))}
    func confirm(){let button=app.buttons["cloud-sync-commit"];reveal(button);XCTAssertTrue(button.isEnabled);button.tap();XCTAssertTrue(app.alerts["确认同步音乐库？"].waitForExistence(timeout:5));app.alerts.buttons["确认同步两端"].tap();XCTAssertTrue(app.staticTexts["同步已完成，音乐库与基线已保存；本机历史、统计和播放队列保留"].waitForExistence(timeout:20))}
    library();let webdav=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch;reveal(webdav);webdav.tap()
    let address=app.textFields["WebDAV服务器根目录"];if !address.waitForExistence(timeout:2){app.buttons["管理WebDAV连接"].tap()}
    let prior=app.buttons["移除WebDAV连接：Sync fixture"];if prior.exists{XCTAssertTrue(app.staticTexts["http://127.0.0.1:18439/sync-dav/"].exists);prior.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10))}
    address.tap();for character in "http://127.0.0.1:18439/sync-dav/"{address.typeText(String(character))};address.typeText("\n");XCTAssertEqual(address.value as? String,"http://127.0.0.1:18439/sync-dav/")
    let user=app.textFields["WebDAV用户名"];user.tap();for character in "fixture-user"{user.typeText(String(character))};user.typeText("\n");XCTAssertEqual(user.value as? String,"fixture-user")
    let password=app.secureTextFields["WebDAV密码"];password.tap();for character in "fixture-password"{password.typeText(String(character))};password.typeText("\n")
    let label=app.textFields["WebDAV连接名称"];label.tap();for character in "Sync fixture"{label.typeText(String(character))};label.typeText("\n");XCTAssertEqual(label.value as? String,"Sync fixture");app.buttons["验证并保存WebDAV"].tap()
    XCTAssertTrue(app.buttons["刷新WebDAV目录"].waitForExistence(timeout:20));app.buttons["收起WebDAV"].tap();_=dismissPasswordSuggestion(in:app)
    let suffix=String(Int(Date().timeIntervalSince1970)),original="Sync original "+suffix,local="Sync local "+suffix,cloud="Sync cloud "+suffix,folder="nexus-sync-"+suffix+"/"
    let playlists=app.buttons["我的歌单"];reveal(playlists);playlists.tap();let input=app.textFields["创建音枢歌单名称"];reveal(input);input.tap();for character in original{input.typeText(String(character))};input.typeText("\n");app.buttons["创建歌单"].tap();XCTAssertTrue(app.buttons["返回歌单列表"].waitForExistence(timeout:5));app.buttons["返回歌单列表"].tap()
    sync();let connection=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","同步连接：Sync fixture")).firstMatch;reveal(connection);connection.tap()
    let directory=app.textFields["多设备同步相对目录"];reveal(directory);replaceText(directory,with:folder,in:app)
    let save=app.buttons["cloud-sync-save"];reveal(save);save.tap();XCTAssertTrue(app.staticTexts["同步目录已保存，请读取合并预览"].waitForExistence(timeout:5));let preview=app.buttons["cloud-sync-preview"];reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["合并预览已就绪，确认后同步两端音乐库"].waitForExistence(timeout:15));confirm();app.buttons["收起多设备同步"].tap()
    let edit=try String(contentsOf:URL(string:"http://127.0.0.1:18439/sync-fixture/remote-edit")!,encoding:.utf8);XCTAssertEqual(edit,"ok")
    for _ in 0..<8{app.swipeDown()};let originalRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",original+" ·")).firstMatch;reveal(originalRow);originalRow.tap();let rename=app.textFields["音枢歌单名称"];reveal(rename);rename.tap();rename.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:(rename.value as? String)?.count ?? 0));for character in local{rename.typeText(String(character))};rename.typeText("\n");XCTAssertEqual(rename.value as? String,local);app.buttons["保存名称"].tap();app.buttons["返回歌单列表"].tap()
    sync();reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["发现 1 项冲突，请逐项选择后确认"].waitForExistence(timeout:15));let commit=app.buttons["cloud-sync-commit"];reveal(commit);XCTAssertFalse(commit.isEnabled);let remoteChoice=app.buttons["cloud-sync-remote-0"];reveal(remoteChoice);XCTAssertTrue(app.staticTexts["云端："+cloud+" · 0 首"].exists)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Three-way conflict preview";image.lifetime = .keepAlways;add(image)
    for (button,title) in [("预览本机版本",local),("预览云端版本",cloud)]{let detail=app.buttons[button];reveal(detail);detail.tap();XCTAssertTrue(app.buttons["关闭版本预览"].waitForExistence(timeout:5));XCTAssertTrue(app.staticTexts[title+" · 0 首"].exists);app.buttons["关闭版本预览"].tap();XCTAssertTrue(app.buttons["收起多设备同步"].waitForExistence(timeout:5))}
    app.buttons["收起多设备同步"].tap();for _ in 0..<8{app.swipeDown()};let localRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",local+" ·")).firstMatch;reveal(localRow);XCTAssertTrue(localRow.exists,"Canceling a conflict preview must keep the local edit")
    sync();reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["发现 1 项冲突，请逐项选择后确认"].waitForExistence(timeout:15));reveal(remoteChoice);remoteChoice.tap();reveal(commit);confirm();app.buttons["收起多设备同步"].tap();app.terminate();app.launch();library();reveal(playlists);playlists.tap();let cloudRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",cloud+" ·")).firstMatch;reveal(cloudRow);XCTAssertTrue(cloudRow.exists);XCTAssertFalse(localRow.exists)
    cloudRow.tap();let removePlaylist=app.buttons["删除歌单"];reveal(removePlaylist);removePlaylist.tap();app.alerts.buttons["删除"].tap();sync();XCTAssertEqual(directory.value as? String,folder);reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["合并预览已就绪，确认后同步两端音乐库"].waitForExistence(timeout:15));confirm();app.buttons["收起多设备同步"].tap();app.terminate();app.launch();library();reveal(playlists);playlists.tap();XCTAssertFalse(cloudRow.exists)
    library();reveal(webdav);webdav.tap();app.buttons["管理WebDAV连接"].tap();let remove=app.buttons["移除WebDAV连接：Sync fixture"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10));app.buttons["收起WebDAV"].tap()
  }
  func testVCloudBackupUploadRestartPreviewRestore() throws {
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){for _ in 0..<18{if element.isHittable{return};app.swipeUp()};XCTAssertTrue(element.isHittable)}
    func library(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();for _ in 0..<8{app.swipeDown()}}
    func cloud(){let entry=app.buttons["cloud-backup-open"];reveal(entry);entry.tap();XCTAssertTrue(app.buttons["收起云备份"].waitForExistence(timeout:5))}
    func makePlaylist(_ name:String){
      let tab=app.buttons["我的歌单"];reveal(tab);tab.tap();let input=app.textFields["创建音枢歌单名称"];reveal(input);input.tap();for character in name{input.typeText(String(character))};input.typeText("\n");app.buttons["创建歌单"].tap();XCTAssertTrue(app.buttons["返回歌单列表"].waitForExistence(timeout:5));app.buttons["返回歌单列表"].tap()
    }
    library();let webdav=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch;reveal(webdav);webdav.tap()
    let address=app.textFields["WebDAV服务器根目录"]
    if !address.waitForExistence(timeout:2){app.buttons["管理WebDAV连接"].tap()}
    let priorConnection=app.buttons["移除WebDAV连接：Backup fixture"]
    if priorConnection.exists {XCTAssertTrue(app.staticTexts["http://127.0.0.1:18439/backup-dav/"].exists);priorConnection.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10))}
    XCTAssertTrue(address.waitForExistence(timeout:5));address.tap();for character in "http://127.0.0.1:18439/backup-dav/"{address.typeText(String(character))};address.typeText("\n");XCTAssertEqual(address.value as? String,"http://127.0.0.1:18439/backup-dav/")
    let user=app.textFields["WebDAV用户名"];user.tap();for character in "fixture-user"{user.typeText(String(character))};user.typeText("\n");XCTAssertEqual(user.value as? String,"fixture-user")
    let password=app.secureTextFields["WebDAV密码"];password.tap();for character in "fixture-password"{password.typeText(String(character))};password.typeText("\n")
    let label=app.textFields["WebDAV连接名称"];label.tap();for character in "Backup fixture"{label.typeText(String(character))};label.typeText("\n");XCTAssertEqual(label.value as? String,"Backup fixture");app.buttons["验证并保存WebDAV"].tap()
    XCTAssertTrue(app.buttons["刷新WebDAV目录"].waitForExistence(timeout:20));app.buttons["收起WebDAV"].tap();_=dismissPasswordSuggestion(in:app)
    let suffix=String(Int(Date().timeIntervalSince1970)),kept="Cloud kept "+suffix,later="Cloud later "+suffix,backupPath="nexus-backup-"+suffix+"/"
    makePlaylist(kept);cloud()
    let connection=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","备份连接：Backup fixture")).firstMatch;XCTAssertTrue(connection.waitForExistence(timeout:5));connection.tap()
    let directory=app.textFields["云备份相对目录"];replaceText(directory,with:backupPath,in:app)
    app.buttons["cloud-backup-save"].tap();XCTAssertTrue(app.staticTexts["备份目录已保存"].waitForExistence(timeout:5));app.buttons["cloud-backup-upload"].tap()
    XCTAssertTrue(app.staticTexts["备份已上传并通过回读摘要与格式校验"].waitForExistence(timeout:20));app.buttons["收起云备份"].tap();app.terminate();app.launch()
    library();makePlaylist(later);cloud();XCTAssertEqual(app.textFields["云备份相对目录"].value as? String,backupPath)
    app.buttons["cloud-backup-list"].tap();XCTAssertTrue(app.staticTexts["已读取 2 个JSON备份"].waitForExistence(timeout:15))
    let preview=app.buttons["cloud-backup-preview-0"];reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["内容摘要与格式已验证"].waitForExistence(timeout:15))
    let previewImage=XCTAttachment(screenshot:app.screenshot());previewImage.name="Verified cloud backup preview";previewImage.lifetime = .keepAlways;add(previewImage)
    let restore=app.buttons["cloud-backup-restore"];reveal(restore);restore.tap();XCTAssertTrue(app.alerts["恢复云端备份？"].waitForExistence(timeout:5));app.alerts.buttons["取消"].tap();app.buttons["收起云备份"].tap()
    for _ in 0..<8{app.swipeDown()};let laterRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",later+" ·")).firstMatch;reveal(laterRow);XCTAssertTrue(laterRow.exists,"Preview cancellation must preserve the newer local playlist")
    cloud();app.buttons["cloud-backup-list"].tap();XCTAssertTrue(app.staticTexts["已读取 2 个JSON备份"].waitForExistence(timeout:10));reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["内容摘要与格式已验证"].waitForExistence(timeout:15));reveal(restore);restore.tap();app.alerts.buttons["确认恢复云备份"].tap()
    XCTAssertTrue(app.staticTexts["本机音乐库与播放统计已恢复；音频文件和连接需在此设备另行配置"].waitForExistence(timeout:15))
    app.buttons["cloud-backup-list"].tap();XCTAssertTrue(app.staticTexts["已读取 2 个JSON备份"].waitForExistence(timeout:10));let broken=app.buttons["cloud-backup-preview-1"];reveal(broken);broken.tap();XCTAssertTrue(app.staticTexts["备份格式或大小不受支持，本机数据未更改"].waitForExistence(timeout:15));XCTAssertFalse(restore.exists)
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    app.buttons["收起云备份"].tap();app.terminate();app.launch();library();let tab=app.buttons["我的歌单"];reveal(tab);tab.tap();let keptRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",kept+" ·")).firstMatch;reveal(keptRow);XCTAssertTrue(keptRow.exists);XCTAssertFalse(laterRow.exists)
    library();reveal(webdav);webdav.tap();app.buttons["管理WebDAV连接"].tap();let remove=app.buttons["移除WebDAV连接：Backup fixture"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10));app.buttons["收起WebDAV"].tap()
  }
  func testWWebDAVBrowseTagsPlaybackAndRemoval() throws {
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch
    XCTAssertTrue(entry.waitForExistence(timeout:15));for _ in 0..<6{if entry.isHittable{break};app.swipeUp()};XCTAssertTrue(entry.isHittable);entry.tap()
    let later=app.buttons.matching(NSPredicate(format:"label IN %@",["以后","Not Now"])).firstMatch
    if later.waitForExistence(timeout:2){later.tap()}
    let address=app.textFields["WebDAV服务器根目录"]
    if !address.waitForExistence(timeout:2){
      app.buttons["管理WebDAV连接"].tap()
      let prior=app.buttons["移除WebDAV连接：fixture-user"]
      if prior.exists{
        XCTAssertTrue(app.staticTexts["http://127.0.0.1:18439/dav/"].exists,"Only remove this test's fixture connection")
        prior.tap();app.alerts.buttons["移除"].tap()
      }
    }
    XCTAssertTrue(address.waitForExistence(timeout:10))
    address.tap();for character in "http://127.0.0.1:18439/dav/"{address.typeText(String(character))};address.typeText("\n")
    let user=app.textFields["WebDAV用户名"];user.tap();for character in "fixture-user"{user.typeText(String(character))};user.typeText("\n")
    let password=app.secureTextFields["WebDAV密码"];password.tap();for character in "fixture-password"{password.typeText(String(character))};password.typeText("\n")
    app.buttons["验证并保存WebDAV"].tap()
    if later.waitForExistence(timeout:3){later.tap()}
    let folder=app.buttons["文件夹：Fixture album"];XCTAssertTrue(folder.waitForExistence(timeout:20))
    waitForWebDAVControl(folder,in:app);folder.tap()
    let tagged=app.buttons.matching(NSPredicate(format:"identifier == %@ AND label CONTAINS %@","webdav-track-album/Remote%20Fixture.mp3","已读取远程音频标签")).firstMatch
    XCTAssertTrue(tagged.waitForExistence(timeout:20));XCTAssertTrue(tagged.label.contains("Synthetic tagged tone"))
    let song=app.buttons["webdav-track-album/Remote%20Fixture.mp3"];XCTAssertTrue(song.isEnabled);waitForWebDAVControl(song,in:app);song.tap()
    app.buttons["收起WebDAV"].tap()
    // The cloud recording shows mini restored while AX still reports the old
    // DAV tree. Give dismissal and the fresh mini query separate wait budgets.
    _=dismissPasswordSuggestion(in:app)
    let player=app.buttons["打开播放页"]
    let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      _=self.dismissPasswordSuggestion(in:app)
      return player.isHittable
    },object:player)
    XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:20),.completed,"Mini must become reachable after system password dismissal")
    player.tap();XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:10))
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:10));XCTAssertTrue(app.buttons["Synthetic embedded lyric"].waitForExistence(timeout:10))
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    app.buttons["暂停"].firstMatch.tap();app.terminate();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();entry.tap();XCTAssertTrue(folder.waitForExistence(timeout:10));folder.tap()
    XCTAssertTrue(tagged.waitForExistence(timeout:20));song.tap();app.buttons["管理WebDAV连接"].tap()
    app.buttons["移除WebDAV连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10));app.buttons["收起WebDAV"].tap()
    XCTAssertTrue(app.buttons["WebDAV · 0个连接"].waitForExistence(timeout:5))
    XCTAssertFalse(app.buttons["打开播放页"].exists,"Removing the active account must clear its playback entry")
  }
  func testSourceManagerAndFilePicker() throws {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    if springboard.alerts.firstMatch.exists {
      let open = springboard.alerts.buttons["打开"]
      if open.exists { open.tap() }
    }
    let app = XCUIApplication()
    app.launch()
    openSettings(app,page:"sources")
    let importButton = app.buttons["导入本地 JS（可多选）"]
    XCTAssertTrue(importButton.waitForExistence(timeout: 15), "Native module/database must load before imports")
    for _ in 0..<5 { if importButton.isHittable { break }; app.swipeUp() }
    importButton.tap()
    // Files may need to initialize its provider on a fresh cloud simulator.
    // Await either localization in one bounded wait; do not skip the picker assertion.
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["取消", "Cancel"])).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 30), "System Files picker must finish loading")
    cancel.tap()
    XCTAssertTrue(importButton.waitForExistence(timeout: 5))
    let url = app.textFields["音源订阅地址"]
    url.tap()
    let sourceURL = "http://127.0.0.1:18439/source.js"
    for character in sourceURL { url.typeText(String(character)) }
    XCTAssertEqual(url.value as? String, sourceURL)
    url.typeText("\n")
    app.buttons["从地址导入"].tap()
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.isSelected, "Import must not hit the floating navigation underneath")
    let enable = app.buttons["启用音源：Nexus UI Test Source"]
    for _ in 0..<5 { if enable.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(enable.waitForExistence(timeout: 10))
    enable.tap()
    let disable = app.buttons["停用音源：Nexus UI Test Source"]
    XCTAssertTrue(disable.waitForExistence(timeout: 10))
    XCTAssertTrue(app.staticTexts["已启用"].waitForExistence(timeout: 10))
    disable.tap()
    let checkbox = app.descendants(matching: .any).matching(identifier: "选择音源：Nexus UI Test Source").firstMatch
    XCTAssertTrue(checkbox.waitForExistence(timeout: 5)); checkbox.tap()
    app.buttons["删除"].firstMatch.tap()
    app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout: 5))
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  func testXDeviceMediaAuthorization() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","设备媒体库 ·")).firstMatch
    XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap()
    let grant=app.buttons["授权访问设备媒体库"]
    if grant.waitForExistence(timeout:3) {
      grant.tap()
      let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard")
      let decline=springboard.alerts.buttons.matching(NSPredicate(format:"label IN %@",["不允许","Don't Allow","Don’t Allow","不允許"])).firstMatch
      if decline.waitForExistence(timeout:10){decline.tap()}
    }
    let denied=app.staticTexts["device-media-authorization"]
    XCTAssertTrue(denied.waitForExistence(timeout:10))
    let predicate=NSPredicate(format:"label != %@","尚未授权")
    expectation(for:predicate,evaluatedWith:denied);waitForExpectations(timeout:10)
    if denied.label=="已授权" {XCTAssertTrue(app.buttons["搜索或刷新设备音乐"].exists)}
    else {XCTAssertTrue(app.buttons["前往系统设置"].exists);XCTAssertFalse(app.buttons["搜索或刷新设备音乐"].exists)}
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    app.buttons["收起设备媒体库"].tap()
  }
  func testPlaylistSearchSortAndDuplicateRemoval() throws {
    let app=XCUIApplication();app.launch()
    func reach(_ element:XCUIElement){
      for _ in 0..<45 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY
        app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))}
      XCTAssertTrue(element.isHittable,"Expected visible control: \(element.identifier)")
    }
    func library(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()}
    library();let quickCreate=app.buttons["library-create-playlist"];XCTAssertTrue(quickCreate.waitForExistence(timeout:10));quickCreate.tap()
    let quickInput=app.textFields["创建音枢歌单名称"];XCTAssertTrue(quickInput.waitForExistence(timeout:10))
    let initialPlaylists=app.buttons["我的歌单"];reach(initialPlaylists);initialPlaylists.tap()
    let prior=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus list fixture")).firstMatch
    while prior.exists {reach(prior);prior.tap();let delete=app.buttons["删除歌单"];reach(delete);delete.tap();app.alerts.buttons["删除"].tap()}
    let importer=app.buttons["导入LX v2歌单 JSON / LXMC"];reach(importer);importer.tap()
    let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse","瀏覽"])).firstMatch
    XCTAssertTrue(browse.waitForExistence(timeout:30));browse.tap()
    let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch
    let file=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus Playlist Fixture")).firstMatch
    // Files remembers the previous font/image folder. A navigation title is not
    // a directory cell; tapping it opens a menu rather than entering the folder.
    if !file.waitForExistence(timeout:2){
      if !folder.waitForExistence(timeout:2){let phone=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).firstMatch;XCTAssertTrue(phone.waitForExistence(timeout:10));phone.tap()}
      XCTAssertTrue(folder.waitForExistence(timeout:10));folder.tap()
    }
    XCTAssertTrue(file.waitForExistence(timeout:10));file.tap()
    let open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","開啟"])).firstMatch;if open.waitForExistence(timeout:3){open.tap()}
    XCTAssertTrue(app.alerts["导入LX歌单"].waitForExistence(timeout:15));app.alerts.buttons["追加导入"].tap()
    XCTAssertTrue(app.staticTexts["已导入 1 个歌单、1000 首歌曲"].waitForExistence(timeout:15))
    let playlists=app.buttons["我的歌单"];reach(playlists);playlists.tap()
    let playlist=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus list fixture")).firstMatch;reach(playlist);playlist.tap()
    let random=app.buttons["随机播放"];reach(random);XCTAssertTrue(random.isHittable,"Local playlist must expose the existing random playback action")
    let manage=app.buttons["全部歌曲与批量管理"];reach(manage);manage.tap()
    let search=app.textFields["搜索列表歌曲歌手专辑"];XCTAssertTrue(search.waitForExistence(timeout:10))
    // Cloud recording showed "dplicate" after a single bulk typeText call.
    // Verify actual input before attributing a count failure to filtering.
    func filterDuplicates(){search.tap();for character in "duplicate"{search.typeText(String(character))};XCTAssertEqual(search.value as? String,"duplicate");search.typeText("\n")}
    filterDuplicates()
    let count=app.staticTexts["track-list-count"]
    func expectCount(_ label:String){expectation(for:NSPredicate(format:"label == %@",label),evaluatedWith:count);waitForExpectations(timeout:10)}
    expectCount("显示 2 / 1000 首 · 已选 0 条")
    let second=app.descendants(matching:.any).matching(identifier:"track-select-1").firstMatch;reach(second);second.tap()
    reach(search);app.buttons["选择歌曲排序"].tap();app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","时长从长到短")).firstMatch.tap()
    expectCount("显示 2 / 1000 首 · 已选 1 条")
    let remove=app.buttons["移除所选"];reach(remove);remove.tap();app.alerts.buttons["移除"].tap()
    expectCount("显示 1 / 999 首 · 已选 0 条")
    reach(search);app.buttons["清空歌曲筛选"].tap();expectCount("显示 999 / 999 首 · 已选 0 条")
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    app.buttons["收起歌曲列表"].tap();app.terminate();app.launch();library()
    reach(playlists);playlists.tap();reach(playlist);playlist.tap();reach(manage);manage.tap()
    filterDuplicates();expectCount("显示 1 / 999 首 · 已选 0 条")
    let row=app.descendants(matching:.any).matching(identifier:"track-row-0").firstMatch;reach(row);row.swipeLeft()
    let swipe=app.buttons["确认移除：Duplicate fixture"];XCTAssertTrue(swipe.waitForExistence(timeout:5));swipe.tap();app.alerts.buttons["移除"].tap()
    expectCount("显示 0 / 998 首 · 已选 0 条")
    app.buttons["收起歌曲列表"].tap();let delete=app.buttons["删除歌单"];reach(delete);delete.tap();app.alerts.buttons["删除"].tap()
    XCTAssertFalse(playlist.exists)
  }
  func testYLocalAudioFileImport() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch
    XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap();app.buttons["导入音频文件"].tap()
    let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse","瀏覽"])).firstMatch;XCTAssertTrue(browse.waitForExistence(timeout:30));browse.tap()
    let fixture=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch
    if !fixture.waitForExistence(timeout:3) {
      let phone=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).firstMatch
      XCTAssertTrue(phone.waitForExistence(timeout:10));phone.tap()
    }
    XCTAssertTrue(fixture.waitForExistence(timeout:10));fixture.tap()
    let file=app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@","Synthetic Tagged Tone")).firstMatch;XCTAssertTrue(file.waitForExistence(timeout:5));file.tap()
    let open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","開啟"])).firstMatch;if open.waitForExistence(timeout:3){open.tap()}
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:15))
    app.buttons["专辑"].tap();let albumGroup=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Fixture album")).firstMatch;XCTAssertTrue(albumGroup.waitForExistence(timeout:5));albumGroup.tap()
    app.buttons["艺术家"].tap();let artistGroup=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Fixture artist")).firstMatch;XCTAssertTrue(artistGroup.waitForExistence(timeout:5));artistGroup.tap()
    let song=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","Synthetic tagged tone")).firstMatch;XCTAssertTrue(song.waitForExistence(timeout:5));song.tap()
    app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:10))
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    if app.buttons["暂停"].firstMatch.exists{app.buttons["暂停"].firstMatch.tap()}
    app.terminate();app.launch();app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    entry.tap();XCTAssertTrue(song.waitForExistence(timeout:10));song.tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:10));app.buttons["暂停"].firstMatch.tap()
    let close=app.buttons["收起播放页"];for _ in 0..<8 {if close.isHittable{break};app.swipeDown()};close.tap()
    entry.tap();app.buttons["删除音频"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["音频正在使用或删除失败，原数据保留"].waitForExistence(timeout:5))
    app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap()
    let remove=app.buttons["移除"].firstMatch;for _ in 0..<12 {if remove.isHittable{break};app.swipeUp()};remove.tap()
    XCTAssertTrue(entry.waitForExistence(timeout:5));entry.tap();app.buttons["删除音频"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["音频已删除"].waitForExistence(timeout:5));XCTAssertFalse(song.exists)
    app.buttons["收起本地音频"].tap()
  }
  func testFontImportAndLyricStyle() throws {
    let app=XCUIApplication();app.launch()
    func reach(_ element:XCUIElement,up:Bool=true){for _ in 0..<40 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;let start=app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.65)),end=app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65 : 0.35));start.press(forDuration:0.05,thenDragTo:end)};XCTAssertTrue(element.isHittable,"Control must scroll into view: \(element.identifier)")}
    func settings(){openSettings(app,page:"typography")}
    settings();let resetInitial=app.buttons["lyric-style-reset"];reach(resetInitial);resetInitial.tap();let importer=app.buttons["font-import"];reach(importer);importer.tap()
    selectLocalFixture("Nexus Fixture.ttf",in:app)
    let global=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-global-nexusfont_")).firstMatch
    XCTAssertTrue(global.waitForExistence(timeout:15));reach(global);global.tap()
    let inherit=app.buttons["font-lyrics-inherit"];reach(inherit,up:false);inherit.tap()
    let globalStatus=app.staticTexts["font-global-status"],lyricStatus=app.staticTexts["font-lyric-status"]
    XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));XCTAssertTrue(lyricStatus.label.contains("跟随全局"));XCTAssertTrue(lyricStatus.label.contains("Nexus Fixture.ttf"))
    let preview=XCTAttachment(screenshot:app.screenshot());preview.name="Imported original triangle font with system glyph fallback";preview.lifetime = .keepAlways;add(preview)
    let system=app.buttons["font-lyrics-system"];system.tap();XCTAssertTrue(lyricStatus.label.contains("系统字体"));XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));inherit.tap()
    let height=app.buttons["行高倍数＋"];reach(height);height.tap();let spacing=app.buttons["行间距＋"];reach(spacing);spacing.tap();let blur=app.buttons["其他行模糊＋"];reach(blur);blur.tap();app.buttons["lyric-emphasis"].tap()
    let golden=app.buttons["lyric-activeColor-2"];reach(golden,up:false);golden.tap()
    app.terminate();app.launch();settings();reach(importer)
    XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));XCTAssertTrue(lyricStatus.label.contains("跟随全局"));XCTAssertTrue(lyricStatus.label.contains("Nexus Fixture.ttf"))
    reach(app.staticTexts["lyric-style-blur"]);XCTAssertEqual(app.staticTexts["lyric-style-blur"].label,"其他行模糊：1");XCTAssertTrue(app.buttons["逐字强调：关"].exists)
    // Exercise the actual renderer with imported glyphs and persisted styles.
    app.terminate();try testZNavidromePlaybackAndCredentials()
    settings();
    let remove=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-delete-nexusfont_")).firstMatch;reach(remove);remove.tap();app.alerts.buttons["删除"].tap();
    expectation(for:NSPredicate(format:"label CONTAINS %@","系统字体"),evaluatedWith:globalStatus);waitForExpectations(timeout:10);XCTAssertTrue(lyricStatus.label.contains("跟随全局"));
    let reset=app.buttons["lyric-style-reset"];reach(reset);reset.tap();XCTAssertTrue(app.buttons["逐字强调：开"].exists)
    app.terminate();app.launch();settings();reach(importer);XCTAssertFalse(app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-delete-nexusfont_")).firstMatch.exists);XCTAssertTrue(globalStatus.label.contains("系统字体"))
  }
  func testZNavidromePlaybackAndCredentials() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"skins")
    func reveal(_ element:XCUIElement){for _ in 0..<40 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65 : 0.35)))};XCTAssertTrue(element.isHittable)}
    // Establish the initial layout through the actual setting, including when a
    // previous interrupted test left a different persisted skin selected.
    let classic=app.descendants(matching:.any).matching(identifier:"player-layout-classic").firstMatch
    reveal(classic);classic.tap()
    openSettings(app,page:"sources")
    let address=app.textFields["Navidrome服务器地址"]
    XCTAssertTrue(address.waitForExistence(timeout:15))
    reveal(address)
    address.tap();for character in "http://127.0.0.1:18439" {address.typeText(String(character))};address.typeText("\n")
    XCTAssertEqual(address.value as? String,"http://127.0.0.1:18439")
    let username=app.textFields["Navidrome用户名"];username.tap();for character in "fixture-user" {username.typeText(String(character))};username.typeText("\n")
    XCTAssertEqual(username.value as? String,"fixture-user")
    let password=app.secureTextFields["Navidrome密码"];password.tap();for character in "fixture-password" {password.typeText(String(character))};password.typeText("\n")
    XCTAssertTrue(app.buttons["验证并保存连接"].isEnabled)
    app.buttons["验证并保存连接"].tap()
    let connected=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch
    if !connected.waitForExistence(timeout:15) {
      let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
      XCTFail("Connection did not finish; inspect the retained screenshot and local fixture counters");return
    }
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"library-local").firstMatch.tap()
    let statistic=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","Synthetic tone · 播放 ")).firstMatch
    func count() -> Int {guard statistic.exists else{return 0};return Int(statistic.label.components(separatedBy:" · 播放 ").last?.components(separatedBy:" 次").first ?? "") ?? 0}
    let previousCount=count()
    app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let album=app.descendants(matching:.any).matching(identifier:"navidrome-item-album-fixture-album").firstMatch
    XCTAssertTrue(album.waitForExistence(timeout:15));album.tap()
    let play=app.buttons["播放全部"];XCTAssertTrue(play.waitForExistence(timeout:10));play.tap()
    let open=app.buttons["打开播放页"];XCTAssertTrue(open.waitForExistence(timeout:10));open.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:10))
    XCTAssertTrue(app.buttons["Synthetic lyric one"].waitForExistence(timeout:5)||app.buttons["Synthetic lyric two"].exists)
    for _ in 0..<3 {if app.buttons["暂停"].firstMatch.isHittable{break};app.swipeUp()}
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:5))
    let am=app.descendants(matching:.any).matching(identifier:"play-skin-am").firstMatch
    for _ in 0..<5 {if am.isHittable{break};app.swipeDown()};am.tap()
    XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5), "Skin change must preserve paused intent")
    XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"AM lyric selection must remain reachable above clipped lyric lines")
    XCTAssertTrue(app.staticTexts["Synthetic tone"].firstMatch.exists)
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    XCTAssertTrue((progress.value as? String)?.hasSuffix(" / 2:00")==true,"Fixture duration must come from the decoded 120-second stream")
    let beforeSeek=progress.value as? String
    // Seek far from the current position in the 120-second fixture while the
    // second lyric remains active, and retain the paused playback intent.
    let clock=beforeSeek?.components(separatedBy:" / ").first?.components(separatedBy:":").compactMap(Int.init) ?? []
    let currentSeconds=clock.count==2 ? clock[0]*60+clock[1] : 0
    let target:CGFloat=currentSeconds>=70 && currentSeconds<=95 ? 0.9 : 0.7
    progress.coordinate(withNormalizedOffset:CGVector(dx:0.25,dy:0.5)).press(forDuration:0.1,thenDragTo:progress.coordinate(withNormalizedOffset:CGVector(dx:target,dy:0.5)))
    XCTAssertTrue(app.buttons["播放"].exists, "Seeking must preserve paused intent")
    expectation(for:NSPredicate(format:"value != %@",beforeSeek ?? ""),evaluatedWith:progress);waitForExpectations(timeout:5)
    let amImage=XCTAttachment(screenshot:app.screenshot());amImage.lifetime = .keepAlways;add(amImage)
    app.buttons["更多播放控制"].tap()
    XCTAssertTrue(app.buttons["播放界面样式"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons["歌词显示设置"].exists)
    XCTAssertTrue(app.buttons["队列与播放选项"].exists)
    app.buttons["歌词显示设置"].tap()
    XCTAssertTrue(app.staticTexts["歌词显示设置"].waitForExistence(timeout:5))
    XCTAssertTrue(app.staticTexts["字体与歌词样式"].exists)
    app.buttons["收起歌词显示设置"].tap()
    app.buttons["播放界面样式"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-immersive").firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons["播放"].isHittable, "Immersive transport controls must fit on screen")
    let immersiveImage=XCTAttachment(screenshot:app.screenshot());immersiveImage.lifetime = .keepAlways;add(immersiveImage)
    for layout in ["photo","vinyl","wave"] {
      app.buttons["更多播放控制"].tap()
      app.buttons["播放界面样式"].tap()
      app.descendants(matching:.any).matching(identifier:"play-skin-\(layout)").firstMatch.tap()
      XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
      XCTAssertTrue(app.buttons["播放"].isHittable, "Transport must fit in \(layout)")
      XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"Lyric selection must fit in \(layout)")
      if layout=="wave" {XCTAssertTrue(app.buttons["Synthetic lyric two"].firstMatch.isHittable,"Wave layout must show its active lyric completely below the selector")}
      XCTAssertTrue(app.staticTexts["Synthetic tone"].firstMatch.exists)
      let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    }
    app.buttons["更多播放控制"].tap()
    app.buttons["播放界面样式"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch.tap()
    let lyricChoice=app.buttons["选择歌词来源"].firstMatch
    for _ in 0..<8 {if lyricChoice.isHittable{break};app.swipeUp()};XCTAssertTrue(lyricChoice.isHittable);lyricChoice.tap()
    XCTAssertFalse(app.buttons["自动优选跨平台歌词"].exists,"Private library metadata must not enter automatic public searches")
    app.buttons["搜索公开歌词"].tap();XCTAssertTrue(app.alerts["搜索公开歌词"].waitForExistence(timeout:5))
    let privacyImage=XCTAttachment(screenshot:app.screenshot());privacyImage.name="Explicit private lyric search choice";privacyImage.lifetime = .keepAlways;add(privacyImage)
    app.alerts.buttons["取消"].tap();XCTAssertFalse(app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","lyric-candidate-")).firstMatch.exists)
    app.buttons["收起歌词选择"].tap();XCTAssertTrue(app.staticTexts["歌词来源：原歌词"].exists)
    let fullLyrics=app.buttons["全部歌词 · 双击行定位，长按打开设置"]
    for _ in 0..<8 {if fullLyrics.isHittable{break};app.swipeUp()};fullLyrics.tap()
    app.buttons["+100ms"].tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","本曲 100ms")).firstMatch.waitForExistence(timeout:5))
    app.buttons["重置"].tap()
    let lyric=app.buttons["定位歌词：Synthetic lyric one"];XCTAssertTrue(lyric.waitForExistence(timeout:5));lyric.doubleTap()
    let lyricImage=XCTAttachment(screenshot:app.screenshot());lyricImage.lifetime = .keepAlways;add(lyricImage)
    app.buttons["收起全部歌词"].tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Lyric seeking must preserve paused intent")
    for _ in 0..<4 {if app.buttons["收起播放页"].isHittable{break};app.swipeDown()}
    app.buttons["收起播放页"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"library-local").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["实际聆听统计"].waitForExistence(timeout:10))
    let recent=app.buttons["最近播放"]
    for _ in 0..<8 {if recent.isHittable{break};app.swipeUp()}
    XCTAssertTrue(recent.isHittable,"Playback history tab must remain reachable after returning from the player")
    recent.tap()
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"history-item-0").firstMatch.waitForExistence(timeout:10),"Real playback must appear in the timeline history")
    XCTAssertEqual(count(),previousCount+1,"Paused seeking and skin changes must count one native media session")
    let statsImage=XCTAttachment(screenshot:app.screenshot());statsImage.name="Persisted listening statistics";statsImage.lifetime = .keepAlways;add(statsImage)
    app.terminate();app.launch();app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    XCTAssertTrue(statistic.waitForExistence(timeout:10));XCTAssertEqual(count(),previousCount+1,"Actual listening statistics must survive restart")
    openSettings(app,page:"mini")
    func miniReach(_ element:XCUIElement){for _ in 0..<45 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))};XCTAssertTrue(element.isHittable)}
    func miniChoose(_ id:String){let control=app.descendants(matching:.any).matching(identifier:id).firstMatch;miniReach(control);control.tap()}
    miniChoose("mini-reset")
    miniChoose("mini-choice-previous");miniChoose("mini-choice-favorite");miniChoose("mini-choice-queue")
    XCTAssertTrue(app.staticTexts["mini-settings-error"].waitForExistence(timeout:10),"Fifth mini button must be rejected")
    XCTAssertEqual(app.staticTexts["mini-actions-count"].label,"已选 4/4")
    miniChoose("mini-choice-previous");miniChoose("mini-choice-queue");miniChoose("mini-order-favorite--1")
    let miniLyrics=app.switches["mini-lyrics-enabled"];miniReach(miniLyrics);if miniLyrics.value as? String != "1" {miniLyrics.tap()}
    app.terminate();app.launch()
    let miniToggle=app.buttons["mini-action-toggle"],miniFavorite=app.buttons["mini-action-favorite"],miniNext=app.buttons["mini-action-next"],miniQueue=app.buttons["mini-action-queue"]
    XCTAssertTrue(miniQueue.waitForExistence(timeout:15));XCTAssertTrue(miniToggle.isHittable&&miniFavorite.isHittable&&miniNext.isHittable&&miniQueue.isHittable,"Four mini controls must fit")
    XCTAssertEqual(miniToggle.label,"播放","Configuring and restoring mini must preserve paused intent")
    XCTAssertLessThan(miniFavorite.frame.minX,miniNext.frame.minX,"Saved button order must survive restart")
    let miniLine=app.staticTexts["mini-lyric"];expectation(for:NSPredicate(format:"label CONTAINS %@","Synthetic lyric"),evaluatedWith:miniLine);waitForExpectations(timeout:20)
    let favoriteBefore=miniFavorite.value as? String;XCTAssertNotNil(favoriteBefore);miniFavorite.tap();expectation(for:NSPredicate(format:"value != %@",favoriteBefore ?? ""),evaluatedWith:miniFavorite);waitForExpectations(timeout:10)
    miniFavorite.tap();expectation(for:NSPredicate(format:"value == %@",favoriteBefore ?? ""),evaluatedWith:miniFavorite);waitForExpectations(timeout:10)
    miniQueue.tap();XCTAssertTrue(app.buttons["收起队列"].waitForExistence(timeout:10));app.buttons["收起队列"].tap();XCTAssertEqual(miniToggle.label,"播放")
    let miniImage=XCTAttachment(screenshot:app.screenshot());miniImage.name="Four persisted mini controls and actual recording lyric";miniImage.lifetime = .keepAlways;add(miniImage)
    openSettings(app,page:"mini");miniChoose("mini-reset");expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:miniQueue);waitForExpectations(timeout:10)
    openSettings(app,page:"sources")
    for _ in 0..<45 {if app.buttons["移除连接：fixture-user"].isHittable{break};app.swipeDown()}
    app.buttons["移除连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
  }
  func testGlobalCoverThemeChangesAcrossPages() throws {
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){for _ in 0..<24 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35:0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65:0.35)))};XCTAssertTrue(element.isHittable)}
    openSettings(app,page:"background");app.descendants(matching:.any).matching(identifier:"visual-classic").firstMatch.tap()
    openSettings(app,page:"theme");app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch.tap()
    openSettings(app,page:"appearance");let follow=app.switches["appearance-cover-color"];reveal(follow);if follow.value as? String != "1"{follow.tap()}
    openSettings(app,page:"sources")
    for (label,value) in [("Navidrome服务器地址","http://127.0.0.1:18439"),("Navidrome用户名","fixture-theme"),("Navidrome密码","fixture-password")] {
      let field=label=="Navidrome密码" ? app.secureTextFields[label] : app.textFields[label];reveal(field);field.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    }
    app.buttons["验证并保存连接"].tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:20))
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let album=app.buttons["navidrome-item-album-fixture-album"];XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();XCTAssertTrue(app.buttons["播放全部"].waitForExistence(timeout:10));app.buttons["播放全部"].tap()
    func redMinusBlue()->Int {
      // Sample the actual visible app margin, outside cards/text/mini. Convert
      // to a known RGBA context instead of assuming the screenshot byte order.
      let image=app.screenshot().image
      let renderer=UIGraphicsImageRenderer(size:CGSize(width:1,height:1))
      let pixel=renderer.image{_ in image.draw(at:CGPoint(x:-6,y:-180))}
      guard let cg=pixel.cgImage else{return 0};var rgba=[UInt8](repeating:0,count:4)
      rgba.withUnsafeMutableBytes{buffer in let ctx=CGContext(data:buffer.baseAddress,width:1,height:1,bitsPerComponent:8,bytesPerRow:4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;ctx.draw(cg,in:CGRect(x:0,y:0,width:1,height:1))}
      return Int(rgba[0])-Int(rgba[2])
    }
    func expectTint(_ red:Bool,_ title:String){
      let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in let delta=redMinusBlue();return red ? delta>12 : delta < -12},object:app)
      XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:20),.completed,"Visible global tint must follow the decoded \(red ? "red" : "blue") cover on \(title)")
      let shot=XCTAttachment(screenshot:app.screenshot());shot.name=title;shot.lifetime = .keepAlways;add(shot)
    }
    expectTint(true,"Red cover private library")
    app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch.tap();expectTint(true,"Red cover discovery")
    openSettings(app,page:"appearance");expectTint(true,"Red cover appearance settings")
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    XCTAssertTrue(album.waitForExistence(timeout:15));reveal(album);album.tap()
    let blue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","blue cover tone")).firstMatch;reveal(blue);blue.tap();expectTint(false,"Blue cover private library")
    openSettings(app,page:"appearance");expectTint(false,"Blue cover appearance settings")
    let restoredFollow=app.switches["appearance-cover-color"];reveal(restoredFollow);restoredFollow.tap()
    let fallback=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(redMinusBlue())<12},object:app);XCTAssertEqual(XCTWaiter.wait(for:[fallback],timeout:10),.completed)
    restoredFollow.tap();expectTint(false,"Blue cover enabled again")
    app.terminate();app.launch();openSettings(app,page:"appearance");expectTint(false,"Blue cover restored paused after restart")
    openSettings(app,page:"sources");let remove=app.buttons["移除连接：fixture-theme"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
    XCTAssertFalse(app.buttons["打开播放页"].exists)
  }
  func testDiscoveryAndAppearance() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"theme")
    let dark=app.descendants(matching:.any).matching(identifier:"theme-dark").firstMatch
    for _ in 0..<14 {if dark.isHittable{break};app.swipeUp()}
    XCTAssertTrue(dark.exists);dark.tap()
    let darkImage=XCTAttachment(screenshot:app.screenshot());darkImage.lifetime = .keepAlways;add(darkImage)
    app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch.tap()
    let lightImage=XCTAttachment(screenshot:app.screenshot());lightImage.lifetime = .keepAlways;add(lightImage)
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let discover=app.buttons["发现 · 分类 · 排行榜 · 歌单导入"]
    XCTAssertTrue(discover.waitForExistence(timeout:10));discover.tap()
    let first=app.descendants(matching:.any).matching(identifier:"discovery-item-0").firstMatch
    XCTAssertTrue(first.waitForExistence(timeout:20));first.tap()
    let refresh=app.buttons["刷新歌单"]
    XCTAssertTrue(refresh.waitForExistence(timeout:10));XCTAssertTrue(refresh.isHittable);refresh.tap()
    let importButton=app.buttons["导入完整歌单到音乐库"]
    XCTAssertTrue(importButton.waitForExistence(timeout:15));importButton.tap()
    XCTAssertTrue(app.alerts["导入公开歌单"].waitForExistence(timeout:40));app.alerts.buttons["取消"].tap()
    app.buttons["收起发现"].tap()
  }
  func testWayfarerImportPickerCancellation() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let button=app.buttons["导入漫途版本1备份"]
    XCTAssertTrue(button.waitForExistence(timeout:15))
    for _ in 0..<10 {if button.isHittable{break};app.swipeUp()}
    button.tap()
    let cancel=app.buttons["取消"]
    if cancel.waitForExistence(timeout:5){cancel.tap()}else{
      let english=app.buttons["Cancel"];XCTAssertTrue(english.waitForExistence(timeout:5));english.tap()
    }
    XCTAssertTrue(button.waitForExistence(timeout:5))
  }
  func testQishuiImportEntry() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let button=app.buttons["导入汽水公开歌单"]
    XCTAssertTrue(button.waitForExistence(timeout:15))
    for _ in 0..<10 {if button.isHittable{break};app.swipeUp()}
    button.tap()
    XCTAssertTrue(app.textFields["汽水公开歌单链接或ID"].waitForExistence(timeout:10))
    XCTAssertFalse(app.buttons["读取并预览汽水歌单"].isEnabled)
    app.buttons["收起汽水导入"].tap()
    XCTAssertTrue(button.waitForExistence(timeout:5))
  }
  func testGraphicalEQPresetPersistence() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"equalizer")
    func reveal(_ element:XCUIElement) {
      for _ in 0..<36 {
        let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-equalizer").firstMatch.frame
        if element.exists && element.isHittable && element.frame.minY >= viewport.minY+8 && element.frame.maxY <= viewport.maxY-8 { return }
        let above=element.exists && element.frame.minY < viewport.minY+8
        app.coordinate(withNormalizedOffset:CGVector(dx:0.94,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.94,dy:above ? 0.60 : 0.40)))
      }
      XCTFail("Control not fully visible: \(element)")
    }
    let flat=app.buttons["平直"];reveal(flat);flat.tap()
    let slider=app.descendants(matching:.any).matching(identifier:"eq-preamp-slider").firstMatch;reveal(slider)
    slider.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.1,thenDragTo:slider.coordinate(withNormalizedOffset:CGVector(dx:0.75,dy:0.5)))
    let value=app.staticTexts["eq-preamp-slider-value"];XCTAssertTrue(value.label.contains("+"));let savedValue=value.label
    let curve=app.descendants(matching:.any).matching(identifier:"eq-curve").firstMatch;reveal(curve)
    curve.coordinate(withNormalizedOffset:CGVector(dx:0.45,dy:0.5)).press(forDuration:0.1,thenDragTo:curve.coordinate(withNormalizedOffset:CGVector(dx:0.45,dy:0.25)))
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.isSelected)
    let band=app.staticTexts["eq-band-slider-value"];XCTAssertNotEqual(band.label,"0.0 dB");let savedBand=band.label
    let name=app.textFields["eq-preset-name"];reveal(name)
    name.tap();for character in "Nexus EQ Test" {name.typeText(String(character))};name.typeText("\n")
    let save=app.buttons["eq-save-preset"];reveal(save);save.tap()
    XCTAssertTrue(app.buttons["Nexus EQ Test"].waitForExistence(timeout:5))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
    app.terminate();app.launch();openSettings(app,page:"equalizer")
    let preset=app.buttons["Nexus EQ Test"];reveal(preset);preset.tap()
    app.buttons["删除预设Nexus EQ Test"].tap();XCTAssertFalse(preset.exists)
    reveal(slider);XCTAssertEqual(value.label,savedValue)
    let restoredBand=app.staticTexts["eq-gain-4"];reveal(restoredBand);XCTAssertEqual(restoredBand.label,savedBand)
    reveal(flat);flat.tap();reveal(value);XCTAssertEqual(value.label,"0.0 dB")
    openSettings(app,page:"playback")
    let timer=app.buttons["15分钟"];reveal(timer);timer.tap()
    XCTAssertTrue(app.staticTexts["sleep-status"].label.contains("剩余"))
    let cancel=app.buttons["取消睡眠定时"];reveal(cancel);cancel.tap();XCTAssertEqual(app.staticTexts["sleep-status"].label,"未开启")
  }
  func testAppearancePersistenceAndPrimaryNavigation() throws {
    let app=XCUIApplication();app.launch()
    let discover=app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch
    XCTAssertTrue(discover.waitForExistence(timeout:15));discover.tap()
    XCTAssertTrue(app.staticTexts["发现"].firstMatch.exists)
    openSettings(app,page:"accent")
    let blue=app.descendants(matching:.any).matching(identifier:"accent-blue").firstMatch
    for _ in 0..<14 {if blue.isHittable{break};app.swipeUp()}
    XCTAssertTrue(blue.isHittable);blue.tap()
    openSettings(app,page:"background")
    let classic=app.descendants(matching:.any).matching(identifier:"visual-classic").firstMatch
    for _ in 0..<3 {if classic.isHittable{break};app.swipeDown()};classic.tap()
    openSettings(app,page:"theme")
    let light=app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch
    for _ in 0..<3 {if light.isHittable{break};app.swipeDown()};light.tap()
    let settingsImage=XCTAttachment(screenshot:app.screenshot());settingsImage.lifetime = .keepAlways;add(settingsImage)
    app.terminate();app.launch()
    openSettings(app,page:"accent")
    let restored=app.descendants(matching:.any).matching(identifier:"accent-blue").firstMatch
    for _ in 0..<14 {if restored.isHittable{break};app.swipeUp()}
    XCTAssertTrue(restored.isSelected)
    openSettings(app,page:"background")
    let pink=app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch
    for _ in 0..<3 {if pink.isHittable{break};app.swipeDown()};pink.tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["私人曲库"].firstMatch.exists)
    discover.tap()
    let homeImage=XCTAttachment(screenshot:app.screenshot());homeImage.lifetime = .keepAlways;add(homeImage)
  }
  func testVisualImagesAndPlayerBackgroundPersistence() throws {
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){for _ in 0..<45 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))};XCTAssertTrue(element.isHittable,"Visual control must be visible: \(element.identifier)")}
    func choose(_ id:String){let control=app.descendants(matching:.any).matching(identifier:id).firstMatch;reveal(control);control.tap()}
    func importFixture(_ id:String){
      choose(id)
      selectLocalFixture("Nexus Visual Fixture",in:app)
    }
    openSettings(app,page:"background")
    let imageBackground=app.descendants(matching:.any).matching(identifier:"background-image").firstMatch
    reveal(imageBackground);XCTAssertFalse(imageBackground.isEnabled,"Image background must stay unavailable until a theme image is imported")
    let background=app.buttons["visual-import-background"];reveal(background);importFixture("visual-import-background")
    expectation(for:NSPredicate(format:"label CONTAINS %@","Nexus Visual Fixture.png"),evaluatedWith:app.staticTexts["visual-background-name"]);waitForExpectations(timeout:20)
    let photo=app.buttons["visual-import-photo"];reveal(photo);importFixture("visual-import-photo")
    expectation(for:NSPredicate(format:"label CONTAINS %@","Nexus Visual Fixture.png"),evaluatedWith:app.staticTexts["visual-photo-name"]);waitForExpectations(timeout:20)
    let importedImage=XCTAttachment(screenshot:app.screenshot());importedImage.name="Imported background and photo previews";importedImage.lifetime = .keepAlways;add(importedImage)
    choose("background-image");choose("player-background-photo");choose("visual-backgroundOpacity-up");choose("visual-playerBlur-up");choose("visual-coverRadius-up");for id in ["visual-cover-color","visual-motion"] {let control=app.switches[id];reveal(control);if control.value as? String != "1" {control.tap()}}
    let savedValues=["backgroundOpacity","playerBlur","coverRadius"].map {app.staticTexts["visual-value-"+$0].label}
    app.terminate();app.launch();openSettings(app,page:"background")
    let restoredPhoto=app.staticTexts["visual-photo-name"];reveal(restoredPhoto);XCTAssertTrue(restoredPhoto.label.contains("Nexus Visual Fixture.png"));let motion=app.switches["visual-motion"];reveal(motion);XCTAssertEqual(motion.value as? String,"1");XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"player-background-photo").firstMatch.isSelected);XCTAssertEqual(["backgroundOpacity","playerBlur","coverRadius"].map {app.staticTexts["visual-value-"+$0].label},savedValues)
    let removeBackground=app.buttons["visual-remove-background"];reveal(removeBackground);removeBackground.tap();app.alerts.buttons["移除"].tap();expectation(for:NSPredicate(format:"label CONTAINS %@","尚未导入"),evaluatedWith:app.staticTexts["visual-background-name"]);waitForExpectations(timeout:10);XCTAssertTrue(app.staticTexts["visual-photo-name"].label.contains("Nexus Visual Fixture.png"),"Removing a shared background must retain the photo slot")
    let removePhoto=app.buttons["visual-remove-photo"];reveal(removePhoto);removePhoto.tap();app.alerts.buttons["移除"].tap();expectation(for:NSPredicate(format:"label CONTAINS %@","尚未导入"),evaluatedWith:app.staticTexts["visual-photo-name"]);waitForExpectations(timeout:10)
    app.terminate();app.launch();openSettings(app,page:"background");reveal(app.staticTexts["visual-background-name"]);XCTAssertTrue(app.staticTexts["visual-background-name"].label.contains("尚未导入"));XCTAssertTrue(app.staticTexts["visual-photo-name"].label.contains("尚未导入"))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.name="Persisted visual image settings and fallback";screenshot.lifetime = .keepAlways;add(screenshot)
  }
  func testLiveLXPlayback() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"sources")
    let field=app.textFields["音源订阅地址"]
    for _ in 0..<8 {if field.isHittable{break};app.swipeUp()}
    for _ in 0..<3 {
      let previous=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Live Validation Source").firstMatch
      if !previous.exists{break}
      for _ in 0..<8 {if previous.isHittable{break};app.swipeUp()};XCTAssertTrue(previous.isHittable);previous.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap()
      XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
    }
    for _ in 0..<8 {if field.isHittable{break};app.swipeDown()}
    XCTAssertTrue(field.exists);field.tap();for character in "http://127.0.0.1:18439/source.js" {field.typeText(String(character))};field.typeText("\n")
    app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Live Validation Source"]
    for _ in 0..<5 {if enable.isHittable{break};app.swipeUp()}
    if enable.waitForExistence(timeout:3) {enable.tap()} else {XCTAssertTrue(app.buttons["停用音源：Nexus Live Validation Source"].exists)}
    XCTAssertTrue(app.staticTexts["已启用"].waitForExistence(timeout:25))
    // This live-service smoke test verifies a known basic route. Exhaustive
    // quality-first fallback is covered by contracts and the isolated App flow.
    openSettings(app,page:"playback")
    let basic=app.descendants(matching:.any).matching(identifier:"128k").firstMatch
    for _ in 0..<14 {if basic.isHittable{break};app.swipeUp()};XCTAssertTrue(basic.isHittable);basic.tap()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();query.typeText("Shape of You\n");app.buttons["搜索"].firstMatch.tap()
    let first=app.descendants(matching:.any).matching(identifier:"search-track-wy-0").firstMatch
    XCTAssertTrue(first.waitForExistence(timeout:25));first.tap()
    app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:45))
    for _ in 0..<3 {if app.buttons["暂停"].firstMatch.isHittable{break};app.swipeUp()}
    app.buttons["暂停"].firstMatch.tap()
    for _ in 0..<5 {if app.buttons["收起播放页"].isHittable{break};app.swipeDown()};app.buttons["收起播放页"].tap()
    openSettings(app,page:"sources")
    let selected=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Live Validation Source").firstMatch
    for _ in 0..<8 {if selected.isHittable{break};app.swipeUp()}
    selected.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
    openSettings(app,page:"playback")
    let preferred=app.descendants(matching:.any).matching(identifier:"flac").firstMatch
    for _ in 0..<14 {if preferred.isHittable{break};app.swipeUp()};XCTAssertTrue(preferred.isHittable);preferred.tap()
  }

}
