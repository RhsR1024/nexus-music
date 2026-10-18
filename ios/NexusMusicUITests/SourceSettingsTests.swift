import XCTest
import Vision

final class SourceSettingsTests: XCTestCase {
  override func setUpWithError() throws {continueAfterFailure=false}
  private func openSettings(_ app:XCUIApplication,page:String){
    for id in ["background-sheet-close","theme-sheet-close","skins-sheet-close","mini-sheet-close","navigation-sheet-close","typography-sheet-close","globalFont-sheet-close","lyricFont-sheet-close"]{let close=app.buttons[id];if close.exists{close.tap()}}
    let rail=app.descendants(matching:.any).matching(identifier:"rail-tab-settings").firstMatch
    let tab=rail.exists ? rail : app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch
    XCTAssertTrue(tab.waitForExistence(timeout:15));tab.tap()
    for _ in 0..<3 {let back=app.buttons["settings-back"];if !back.exists{break};back.tap()}
    var settingsPage="home"
    func enter(_ target:String){
      let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-"+settingsPage).firstMatch
      XCTAssertTrue(viewport.waitForExistence(timeout:5))
      let row=app.buttons["settings-open-"+target]
      XCTAssertTrue(row.waitForExistence(timeout:10))
      // Settings preserves each page's scroll position. On returning from a
      // lower row, the next target can be above the visible viewport.
      for _ in 0..<12 {
        if row.isHittable{break};if !row.exists{break}
        let above=row.frame.midY<viewport.frame.midY
        viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.25 : 0.75)).press(forDuration:0.05,thenDragTo:viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.75 : 0.25)))
      }
      if !row.isHittable {
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Settings row unreachable: "+target;image.lifetime = .keepAlways;add(image)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Settings navigation failure hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertTrue(row.isHittable,"Settings row must be reachable: \(target), frame: \(row.frame)");row.tap();XCTAssertTrue(app.staticTexts["settings-title-"+target].waitForExistence(timeout:5));settingsPage=target
    }
    let appearancePages=["theme","background","skins","accent","navigation","mini","globalFont","lyricFont"]
    enter(page=="typography" || page=="equalizer" ? "playback" : appearancePages.contains(page) ? "appearance" : page)
    if page=="typography" || page=="equalizer"{enter(page)}else if appearancePages.contains(page){enter(page)}
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
    XCTAssertFalse(app.buttons["settings-open-equalizer"].exists,"EQ belongs to playback settings, with its retained independent page")
    let group=app.descendants(matching:.any).matching(identifier:"settings-category-group").firstMatch
    XCTAssertTrue(group.exists)
    let categoryRows=["playback","appearance","downloads","storage"].map{app.buttons["settings-open-"+$0]}
    for (index,row) in categoryRows.enumerated(){XCTAssertTrue(row.exists);if index>0{XCTAssertGreaterThan(row.frame.minY,categoryRows[index-1].frame.minY)}}
    let sources=app.buttons["settings-open-sources"];reveal(sources);sources.tap()
    XCTAssertTrue(source.isHittable);XCTAssertEqual(source.value as? String,"https://example.invalid/draft.js");XCTAssertEqual(source.frame.midY,previousY,accuracy:2,"Back must restore the original scroll position")
    openSettings(app,page:"equalizer")
    let name=app.textFields["eq-preset-name"];reveal(name);name.tap();for character in "Retained draft"{name.typeText(String(character))};name.typeText("\n")
    openSettings(app,page:"appearance");XCTAssertFalse(name.exists)
    let fontEntry=app.buttons["settings-open-globalFont"];reveal(fontEntry);fontEntry.tap()
    XCTAssertTrue(app.staticTexts["settings-title-globalFont"].exists);XCTAssertTrue(app.buttons["font-import"].isHittable)
    app.buttons["globalFont-sheet-close"].tap();XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    openSettings(app,page:"equalizer");XCTAssertEqual(name.value as? String,"Retained draft");XCTAssertTrue(name.isHittable);evidence("Settings draft and scroll retained")
    XCTAssertEqual(app.buttons["settings-back"].label,"返回播放与歌词")
    app.buttons["settings-back"].tap();XCTAssertTrue(app.staticTexts["settings-title-playback"].exists)
    openSettings(app,page:"theme")
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"theme-mode-sheet").firstMatch.exists)
    XCTAssertFalse(app.buttons["settings-open-background"].exists,"The underlying category must leave the accessibility tree while its sheet is open")
    evidence("Theme mode native sheet")
    app.buttons["theme-sheet-close"].tap()
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists,"Closing the picker must preserve its category")
    openSettings(app,page:"appearance");app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["settings-title-home"].waitForExistence(timeout:5),"Selecting the active settings tab must return to the settings root")
    openSettings(app,page:"downloads");XCTAssertFalse(name.exists)
    let taskEntry=app.buttons["settings-open-downloadTasks"];reveal(taskEntry);taskEntry.tap()
    XCTAssertTrue(app.staticTexts["settings-title-downloadTasks"].waitForExistence(timeout:5));XCTAssertTrue(app.staticTexts["offline-section-pending"].exists)
    app.buttons["settings-back"].tap();XCTAssertTrue(app.staticTexts["settings-title-downloads"].exists);XCTAssertFalse(app.staticTexts["offline-section-pending"].exists)
    openSettings(app,page:"storage");XCTAssertFalse(name.exists);XCTAssertFalse(app.buttons["offline-pause-all"].exists)
    let backup=app.buttons["cloud-backup-open"];reveal(backup);backup.tap();XCTAssertTrue(app.buttons["收起云备份"].waitForExistence(timeout:5));app.buttons["收起云备份"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let sourceLink=app.buttons["音乐来源"];reveal(sourceLink);sourceLink.tap()
    XCTAssertTrue(app.staticTexts["settings-title-sources"].waitForExistence(timeout:5));XCTAssertEqual(app.buttons["settings-back"].label,"返回音乐库")
    app.buttons["settings-back"].tap();XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.isSelected)
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["settings-title-home"].waitForExistence(timeout:5),"Selecting the settings tab must return to the settings root")
  }
  func testDownloadSettingsAndOfflinePlayback() throws {
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){
      func visible()->Bool{guard element.exists else{return false};let frame=element.frame;return frame.width>0 && frame.height>0 && app.frame.insetBy(dx:4,dy:44).contains(frame) && element.isHittable}
      for _ in 0..<32 {if visible(){break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))}
      if !visible(){let capture=XCTAttachment(screenshot:app.screenshot());capture.name="Offline control not fully visible: "+element.identifier;capture.lifetime = .keepAlways;add(capture);let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.lifetime = .keepAlways;add(hierarchy)}
      XCTAssertTrue(visible(),"Offline control must be fully visible and hittable: \(element.identifier)")
    }
    func type(_ field:XCUIElement,_ value:String){reveal(field);field.tap();for character in value{field.typeText(String(character))};field.typeText("\n")}
    func control(_ block:Bool?=nil) throws -> [String:Int] {
      let done=expectation(description:"Read isolated fixture counters"),path="http://127.0.0.1:18439/offline-fixture-control"+(block == nil ? "" : "?block=\(block! ? 1 : 0)")
      var result:[String:Int]?,failure:Error?
      URLSession.shared.dataTask(with:URL(string:path)!){data,_,error in
        failure=error;if let data {result=(try? JSONSerialization.jsonObject(with:data)) as? [String:Int]};done.fulfill()
      }.resume();wait(for:[done],timeout:10)
      if let failure{throw failure};return try XCTUnwrap(result)
    }
    _=try control(false)
    defer{_=try? control(false)}
    openSettings(app,page:"skins");let classic=app.descendants(matching:.any).matching(identifier:"player-layout-classic").firstMatch;reveal(classic);classic.tap()
    let skinDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.buttons["skins-sheet-close"]);XCTAssertEqual(XCTWaiter.wait(for:[skinDismissed],timeout:10),.completed,"Skin selection must finish dismissing its sheet before navigating to downloads")
    // A failed prior run can leave this synthetic fixture saved. Remove only
    // that record through the actual UI so retries cannot reuse its bytes.
    openSettings(app,page:"downloads");let initialTasks=app.buttons["settings-open-downloadTasks"];reveal(initialTasks);initialTasks.tap()
    // iOS may flatten row children into siblings. Match the action's meaningful
    // VoiceOver label instead of assuming an accessibility parent relationship.
    let fixtureRemoval=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@ AND label IN %@","offline-remove-",["删除离线文件：Synthetic tone · Fixture artist","取消任务：Synthetic tone · Fixture artist"])).firstMatch
    if fixtureRemoval.exists {
      reveal(fixtureRemoval);fixtureRemoval.tap();app.alerts.buttons["删除"].tap()
      let removed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:fixtureRemoval);XCTAssertEqual(XCTWaiter.wait(for:[removed],timeout:10),.completed)
    }
    openSettings(app,page:"sources")
    type(app.textFields["Navidrome服务器地址"],"http://127.0.0.1:18439");type(app.textFields["Navidrome用户名"],"fixture-user");type(app.secureTextFields["Navidrome密码"],"fixture-password")
    app.buttons["验证并保存连接"].tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:15))
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let account=app.descendants(matching:.any).matching(identifier:"navidrome-account-fixture-user").firstMatch;XCTAssertTrue(account.waitForExistence(timeout:10));reveal(account);account.tap()
    let album=app.descendants(matching:.any).matching(identifier:"navidrome-item-album-fixture-album").firstMatch;XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();app.buttons["播放全部"].tap()
    let mini=app.buttons["打开播放页"];XCTAssertTrue(mini.waitForExistence(timeout:10));mini.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15));let save=app.buttons["保存离线"];reveal(save);save.tap()
    let pause=app.buttons["暂停"].firstMatch;reveal(pause);pause.tap();let close=app.buttons["收起播放页"];reveal(close);close.tap()
    openSettings(app,page:"downloads")
    let limit=app.descendants(matching:.any).matching(identifier:"offline-limit-1024").firstMatch;reveal(limit);limit.tap()
    let tasks=app.buttons["settings-open-downloadTasks"];reveal(tasks);tasks.tap()
    XCTAssertTrue(app.staticTexts["settings-title-downloadTasks"].waitForExistence(timeout:5));XCTAssertTrue(app.staticTexts["offline-section-pending"].exists)
    let pauseDownload=app.buttons["暂停下载"];XCTAssertTrue(pauseDownload.waitForExistence(timeout:10));reveal(pauseDownload);pauseDownload.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已暂停 · ")).firstMatch.waitForExistence(timeout:15))
    let paused=XCTAttachment(screenshot:app.screenshot());paused.name="Download task paused with partial file";paused.lifetime = .keepAlways;add(paused)
    app.terminate();app.launch();openSettings(app,page:"downloads")
    let capacity=app.staticTexts["offline-capacity-summary"];XCTAssertTrue(capacity.waitForExistence(timeout:10));XCTAssertTrue(capacity.label.hasSuffix(" / 1024 MB"), "Download capacity must persist after restart")
    reveal(tasks);tasks.tap();XCTAssertTrue(app.buttons["继续下载"].waitForExistence(timeout:10),"Explicit pause must survive process restart")
    app.buttons["全部继续"].tap()
    let playSaved=app.buttons["播放离线文件"];XCTAssertTrue(playSaved.waitForExistence(timeout:70));reveal(playSaved)
    let counters=try control();XCTAssertGreaterThanOrEqual(counters["full"] ?? 0,1);XCTAssertGreaterThanOrEqual(counters["resumed"] ?? 0,1,"Resume must issue an actual conditional Range request")
    let completed=XCTAttachment(screenshot:app.screenshot());completed.name="Completed offline file after conditional Range resume";completed.lifetime = .keepAlways;add(completed)
    _=try control(true);app.terminate();app.launch()
    openSettings(app,page:"storage");let clear=app.buttons["清理临时音频、封面和歌词缓存"];reveal(clear);clear.tap()
    XCTAssertTrue(app.staticTexts["0.0 MB · 0 个完整文件"].waitForExistence(timeout:10),"Temporary cache must be empty before proving offline playback")
    openSettings(app,page:"downloads");reveal(tasks);tasks.tap();XCTAssertTrue(playSaved.waitForExistence(timeout:10));reveal(playSaved)
    let before=try control();playSaved.tap();XCTAssertTrue(mini.waitForExistence(timeout:10));mini.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    let after=try control();XCTAssertEqual(before["streams"],after["streams"],"Saved playback must not request the blocked server");XCTAssertEqual(after["blocked"],0)
    let savedPause=app.buttons["暂停"].firstMatch;reveal(savedPause);savedPause.tap();reveal(close);close.tap()
    openSettings(app,page:"downloads");reveal(tasks);tasks.tap();let remove=app.buttons["删除离线文件：Synthetic tone · Fixture artist"];reveal(remove);remove.tap();app.alerts.buttons["保留"].tap();XCTAssertTrue(playSaved.exists,"Cancelling removal must retain the completed file")
    remove.tap();app.alerts.buttons["删除"].tap();XCTAssertTrue(app.staticTexts["暂无已下载音频"].waitForExistence(timeout:10))
    let empty=XCTAttachment(screenshot:app.screenshot());empty.name="Download tasks and completed files empty after confirmed removal";empty.lifetime = .keepAlways;add(empty)
    app.buttons["settings-back"].tap();XCTAssertTrue(app.staticTexts["settings-title-downloads"].exists);XCTAssertFalse(app.staticTexts["offline-section-pending"].exists,"Hidden task page must leave accessibility tree")
    openSettings(app,page:"sources");let removeAccount=app.buttons["移除连接：fixture-user"];reveal(removeAccount);removeAccount.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
  }
  func testCrossPlatformLyrics() throws {
    let app=XCUIApplication();app.launch()
    func reach(_ element:XCUIElement,up:Bool=true){for _ in 0..<12 {if element.isHittable{break};if element.exists {let above=element.frame.midY < app.frame.midY; if above {app.swipeDown()} else {app.swipeUp()}} else if up {app.swipeUp()} else {app.swipeDown()}};XCTAssertTrue(element.isHittable)}
    // The preceding core tests intentionally leave the persisted player skin
    // unchanged. Establish a modern layout here so this test exercises the
    // modern player actions instead of depending on test order or simulator
    // data from an earlier run.
    openSettings(app,page:"skins")
    let waveSkin=app.descendants(matching:.any).matching(identifier:"player-layout-wave").firstMatch
    reach(waveSkin)
    XCTAssertTrue((waveSkin.value as? String)?.contains("实时音频频谱环") == true)
    waveSkin.tap()
    openSettings(app,page:"sources")
    let source=app.textFields["音源订阅地址"];reach(source);source.tap();for character in "http://127.0.0.1:18439/matching-source.js"{source.typeText(String(character))};source.typeText("\n");app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Matching Fixture"],enabled=app.buttons["停用音源：Nexus Matching Fixture"]
    for _ in 0..<5{if enable.isHittable||enabled.isHittable{break};app.swipeUp()};if enable.exists{enable.tap()}else{XCTAssertTrue(enabled.isHittable)}
    XCTAssertTrue(app.staticTexts["已启用"].firstMatch.waitForExistence(timeout:20))
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];reach(query);app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap();query.tap();query.typeText("Synthetic match tone\n")
    let searchSongs=app.buttons["run-online-search"];reach(searchSongs);searchSongs.tap()
    let first=app.buttons["search-track-wy-0"];for _ in 0..<8{if first.waitForExistence(timeout:2){break};app.swipeUp()};XCTAssertTrue(first.exists);reach(first);first.tap()
    let mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
    XCTAssertTrue(mini.waitForExistence(timeout:10));mini.swipeUp()
    let closeAfterSwipe=app.buttons["收起播放页"];XCTAssertTrue(closeAfterSwipe.waitForExistence(timeout:10),"Swiping up on the mini player must open the player")
    let handle=app.descendants(matching:.any).matching(identifier:"player-drag-handle").firstMatch
    XCTAssertTrue(handle.waitForExistence(timeout:5));handle.swipeDown()
    XCTAssertTrue(app.buttons["打开播放页"].waitForExistence(timeout:10),"Swiping down from the player handle must dismiss the player")
    app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["Synthetic match tone"].waitForExistence(timeout:30));XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:15))
    let waveSpectrum=app.descendants(matching:.any).matching(identifier:"wave-spectrum-bars").firstMatch
    XCTAssertTrue(waveSpectrum.waitForExistence(timeout:15),"Playing wave layout must receive real native FFT bands")
    let modernFavorite=app.buttons["收藏歌曲"].firstMatch
    XCTAssertTrue(modernFavorite.waitForExistence(timeout:10))
    // A rerun can retain the library fixture. Normalize that state before
    // checking the original-track favorite transition.
    if (modernFavorite.value as? String) == "已收藏" {
      modernFavorite.tap()
      expectation(for:NSPredicate(format:"value == %@","未收藏"),evaluatedWith:modernFavorite);waitForExpectations(timeout:5)
    }
    XCTAssertEqual(modernFavorite.value as? String,"未收藏")
    modernFavorite.tap(); expectation(for:NSPredicate(format:"value == %@","已收藏"),evaluatedWith:modernFavorite);waitForExpectations(timeout:5)
    app.buttons["更多播放控制"].tap(); XCTAssertTrue(app.buttons["队列与播放选项"].waitForExistence(timeout:5)); app.buttons["收起播放选项"].tap()
    let pause=app.buttons["暂停"].firstMatch;reach(pause);pause.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:waveSpectrum);waitForExpectations(timeout:5)
    // Full lyric expansion is exposed by the classic detail renderer. Keep
    // the modern skin assertions above, then use the renderer that owns this
    // existing lyrics/settings workflow.
    app.buttons["更多播放控制"].tap(); app.buttons["播放界面样式"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch.tap()
    XCTAssertTrue(app.buttons["取消本地收藏"].waitForExistence(timeout:5),"Modern favorite must update the original queue track used by classic controls")
    let sourceButton=app.buttons["选择歌词来源"].firstMatch;reach(sourceButton,up:false);sourceButton.tap()
    app.buttons["自动优选跨平台歌词"].tap()
    let lyricSource=app.staticTexts["lyric-source"].firstMatch
    let automatic=NSPredicate(format:"label CONTAINS %@","自动优选 · 网易云")
    expectation(for:automatic,evaluatedWith:lyricSource);waitForExpectations(timeout:30)
    XCTAssertTrue(app.buttons["Synthetic rich lyric"].firstMatch.exists);XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Changing lyrics must preserve paused audio")
    let stageSkin=app.descendants(matching:.any).matching(identifier:"play-skin-stage").firstMatch
    reach(stageSkin,up:false);stageSkin.tap()
    let stageGroup=app.descendants(matching:.any).matching(identifier:"lyric-stage-group").firstMatch
    XCTAssertTrue(stageGroup.waitForExistence(timeout:10));XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Entering stage must keep paused intent")
    XCTAssertEqual(stageGroup.value as? String,"逐字歌词","Stage must preserve the loaded word-timing capability")
    XCTAssertTrue(["Synthetic ","rich lyric","Second rich line"].contains(stageGroup.label),"Stage must display a real word group from the selected lyric")
    let stageImage=XCTAttachment(screenshot:app.screenshot());stageImage.name="Stage real timed group";stageImage.lifetime = .keepAlways;add(stageImage)
    let stageSettings=app.buttons["打开全部歌词与偏移设置"];reach(stageSettings);stageSettings.tap()
    XCTAssertTrue(app.buttons["收起全部歌词"].waitForExistence(timeout:5));app.buttons["+100ms"].tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","本曲 100ms")).firstMatch.waitForExistence(timeout:5))
    app.buttons["重置"].tap();app.buttons["收起全部歌词"].tap()
    app.buttons["更多播放控制"].tap();app.buttons["播放界面样式"].tap()
    let classicSkin=app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch;reach(classicSkin,up:false);classicSkin.tap()
    XCTAssertTrue(app.buttons["Synthetic rich lyric"].firstMatch.waitForExistence(timeout:10))
    let fullLyrics=app.buttons["全部歌词 · 双击行定位，长按打开设置"]
    reach(fullLyrics,up:false);fullLyrics.tap();XCTAssertTrue(app.buttons["收起全部歌词"].waitForExistence(timeout:10));app.buttons["收起全部歌词"].tap();XCTAssertTrue(app.buttons["Synthetic rich lyric"].firstMatch.exists)
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
    XCUIDevice.shared.orientation = .portrait
    defer { XCUIDevice.shared.orientation = .portrait }
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
    XCTAssertTrue(app.staticTexts["热门评论"].exists);XCTAssertTrue(app.staticTexts["最新评论"].exists)
    let header=app.descendants(matching:.any).matching(identifier:"comments-header").firstMatch
    let list=app.descendants(matching:.any).matching(identifier:"comments-list").firstMatch
    let refresh=app.buttons["刷新评论"]
    XCTAssertTrue(header.waitForExistence(timeout:5));XCTAssertTrue(list.exists)
    func checkFixedHeader() {
      let initial=header.frame
      list.swipeUp()
      XCTAssertEqual(header.frame.minY,initial.minY,accuracy:2)
      XCTAssertGreaterThanOrEqual(list.frame.minY,header.frame.maxY-2)
      XCTAssertTrue(refresh.isHittable);XCTAssertTrue(app.buttons["收起歌曲评论"].isHittable)
      let window=app.windows.firstMatch.frame
      XCTAssertGreaterThanOrEqual(header.frame.minX,window.minX)
      XCTAssertLessThanOrEqual(header.frame.maxX,window.maxX)
    }
    checkFixedHeader()
    XCUIDevice.shared.orientation = .landscapeLeft
    app.activate()
    expectation(for:NSPredicate { _,_ in app.windows.firstMatch.frame.width>app.windows.firstMatch.frame.height },evaluatedWith:app)
    waitForExpectations(timeout:10)
    XCTAssertTrue(refresh.waitForExistence(timeout:5));checkFixedHeader()
    let landscape=XCTAttachment(screenshot:XCUIScreen.main.screenshot());landscape.name="Comments fixed header landscape";landscape.lifetime = .keepAlways;add(landscape)
    XCUIDevice.shared.orientation = .portrait
    app.activate()
    expectation(for:NSPredicate { _,_ in app.windows.firstMatch.frame.height>app.windows.firstMatch.frame.width },evaluatedWith:app)
    waitForExpectations(timeout:10)
    refresh.tap()
    let moreAfterRefresh=app.buttons["加载更多评论"]
    XCTAssertTrue(moreAfterRefresh.waitForExistence(timeout:10))
    for _ in 0..<5 {if moreAfterRefresh.isHittable{break};list.swipeUp()}
    XCTAssertTrue(moreAfterRefresh.isHittable)
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.name="Comments sheet sections after refresh";screenshot.lifetime = .keepAlways;add(screenshot)
    app.buttons["收起歌曲评论"].tap();XCTAssertFalse(app.buttons["暂停"].exists)
    // Reopen and dismiss through the native sheet gesture; no playback intent.
    comments.tap();XCTAssertTrue(app.buttons["刷新评论"].waitForExistence(timeout:10))
    let start=header.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.1))
    start.press(forDuration:0.1,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.98)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["收起歌曲评论"])
    waitForExpectations(timeout:10)
    XCTAssertFalse(app.buttons["暂停"].exists)
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
    // Source settings restores its scroll offset. The fixture can be below
    // the viewport after returning from playback settings, so use its actual
    // frame instead of repeatedly scrolling toward the top of the page.
    let sourceViewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-sources").firstMatch
    XCTAssertTrue(sourceViewport.exists);XCTAssertTrue(fixture.waitForExistence(timeout:10))
    for _ in 0..<20 {
      if fixture.isHittable{break}
      let above=fixture.frame.midY < sourceViewport.frame.midY
      sourceViewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:sourceViewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.75:0.25)))
    }
    if !fixture.isHittable {
      let image=XCTAttachment(screenshot:app.screenshot());image.name="Matching fixture cleanup unreachable";image.lifetime = .keepAlways;add(image)
      let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Matching fixture cleanup hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
    }
    XCTAssertTrue(fixture.isHittable);fixture.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
  }
  func testUCloudSyncPreviewConflictRestartAndDeletion() throws {
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){for _ in 0..<18{if element.isHittable{return};let above=element.exists && element.frame.midY < app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.75:0.25)))};XCTAssertTrue(element.isHittable)}
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
    let playlists=app.buttons["我的歌单"];reveal(playlists);playlists.tap();let input=app.textFields["创建音枢歌单名称"];reveal(input);input.tap();for character in original{input.typeText(String(character))};input.typeText("\n");app.buttons["library-create-playlist-submit"].tap();XCTAssertTrue(app.buttons["返回歌单列表"].waitForExistence(timeout:5));app.buttons["返回歌单列表"].tap()
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
    func reveal(_ element:XCUIElement){for _ in 0..<18{if element.isHittable{return};let above=element.exists && element.frame.midY < app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.75:0.25)))};XCTAssertTrue(element.isHittable)}
    func library(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();for _ in 0..<8{app.swipeDown()}}
    func cloud(){let entry=app.buttons["cloud-backup-open"];reveal(entry);entry.tap();XCTAssertTrue(app.buttons["收起云备份"].waitForExistence(timeout:5))}
    func makePlaylist(_ name:String){
      let tab=app.buttons["我的歌单"];reveal(tab);tab.tap();let input=app.textFields["创建音枢歌单名称"];reveal(input);input.tap();for character in name{input.typeText(String(character))};input.typeText("\n");app.buttons["library-create-playlist-submit"].tap();XCTAssertTrue(app.buttons["返回歌单列表"].waitForExistence(timeout:5));app.buttons["返回歌单列表"].tap()
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
    let restore=app.buttons["cloud-backup-restore"]
    func revealRestore(){
      let settings=app.descendants(matching:.any).matching(identifier:"cloud-backup-settings").firstMatch
      XCTAssertTrue(settings.exists)
      for _ in 0..<18 {
        if restore.isHittable{return}
        let above=restore.exists && restore.frame.midY < settings.frame.midY
        settings.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.2:0.8)).press(forDuration:0.05,thenDragTo:settings.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.8:0.2)))
      }
      XCTAssertTrue(restore.isHittable,"Restore must be reachable inside the preview settings scroll region")
    }
    revealRestore();restore.tap();XCTAssertTrue(app.alerts["恢复云端备份？"].waitForExistence(timeout:5));app.alerts.buttons["取消"].tap();app.buttons["收起云备份"].tap()
    for _ in 0..<8{app.swipeDown()};let laterRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",later+" ·")).firstMatch;reveal(laterRow);XCTAssertTrue(laterRow.exists,"Preview cancellation must preserve the newer local playlist")
    cloud();app.buttons["cloud-backup-list"].tap();XCTAssertTrue(app.staticTexts["已读取 2 个JSON备份"].waitForExistence(timeout:10));reveal(preview);preview.tap();XCTAssertTrue(app.staticTexts["内容摘要与格式已验证"].waitForExistence(timeout:15));revealRestore();restore.tap();app.alerts.buttons["确认恢复云备份"].tap()
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
    let fixtureAccount=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","fixture-user")).firstMatch
    if fixtureAccount.waitForExistence(timeout:5) && !fixtureAccount.label.hasPrefix("● "){fixtureAccount.tap()}
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
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();entry.tap();let fixtureAccountAfterRestart=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","fixture-user")).firstMatch;if fixtureAccountAfterRestart.waitForExistence(timeout:5) && !fixtureAccountAfterRestart.label.hasPrefix("● "){fixtureAccountAfterRestart.tap()};XCTAssertTrue(folder.waitForExistence(timeout:10));folder.tap()
    XCTAssertTrue(tagged.waitForExistence(timeout:20));song.tap();app.buttons["管理WebDAV连接"].tap()
    let remainingAccounts=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","移除WebDAV连接：")).count-1
    XCTAssertGreaterThanOrEqual(remainingAccounts,0)
    app.buttons["移除WebDAV连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["WebDAV连接与凭据已移除"].waitForExistence(timeout:10));app.buttons["收起WebDAV"].tap()
    XCTAssertTrue(app.buttons["WebDAV · \(remainingAccounts)个连接"].waitForExistence(timeout:5),"Removing this account must preserve unrelated connections")
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
    let loadMore=app.buttons["加载更多歌曲"];reach(loadMore);XCTAssertTrue(loadMore.isHittable,"Long playlists must expose incremental loading in the library view");loadMore.tap()
    let more=app.buttons["更多操作：Duplicate fixture"].firstMatch;reach(more);more.tap()
    XCTAssertTrue(app.buttons["加入队列"].waitForExistence(timeout:10));XCTAssertTrue(app.buttons["本地收藏"].exists)
    app.buttons["收起音乐库歌曲更多操作"].tap()
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
    settings();let resetInitial=app.buttons["lyric-style-reset"];reach(resetInitial);resetInitial.tap();reach(app.buttons["font-open-global"]);app.buttons["font-open-global"].tap();let importer=app.buttons["font-import"];reach(importer);importer.tap()
    selectLocalFixture("Nexus Fixture.ttf",in:app)
    let global=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-global-nexusfont_")).firstMatch
    XCTAssertTrue(global.waitForExistence(timeout:15));reach(global);global.tap();reach(app.buttons["font-open-lyric"]);app.buttons["font-open-lyric"].tap()
    let inherit=app.buttons["font-lyrics-inherit"];reach(inherit,up:false);inherit.tap()
    let globalStatus=app.staticTexts["font-global-status"],lyricStatus=app.staticTexts["font-lyric-status"]
    XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));XCTAssertTrue(lyricStatus.label.contains("跟随全局"));XCTAssertTrue(lyricStatus.label.contains("Nexus Fixture.ttf"))
    let preview=XCTAttachment(screenshot:app.screenshot());preview.name="Imported original triangle font with system glyph fallback";preview.lifetime = .keepAlways;add(preview)
    let system=app.buttons["font-lyrics-system"];system.tap();XCTAssertTrue(lyricStatus.label.contains("系统字体"));XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));inherit.tap();reach(app.buttons["font-open-display"]);app.buttons["font-open-display"].tap()
    let height=app.buttons["行高倍数＋"];reach(height);height.tap();let spacing=app.buttons["行间距＋"];reach(spacing);spacing.tap();let blur=app.buttons["其他行模糊＋"];reach(blur);blur.tap();app.buttons["lyric-emphasis"].tap()
    let golden=app.buttons["lyric-activeColor-2"];reach(golden,up:false);golden.tap()
    let alignment=app.buttons["lyric-align-center"];reach(alignment)
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:alignment)],timeout:10),.completed)
    alignment.tap()
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true"),object:alignment)],timeout:10),.completed,"Confirm the setting was saved before terminating the App")
    app.terminate();app.launch();settings()
    XCTAssertTrue(globalStatus.label.contains("Nexus Fixture.ttf"));XCTAssertTrue(lyricStatus.label.contains("跟随全局"));XCTAssertTrue(lyricStatus.label.contains("Nexus Fixture.ttf"))
    reach(alignment)
    // RN's restored button can expose its selected checkmark label without
    // XCTest's selected trait; verify the same visible saved choice.
    XCTAssertEqual(alignment.label,"居中 ✓","Explicit lyric alignment must survive restart")
    reach(app.staticTexts["lyric-style-blur"]);XCTAssertEqual(app.staticTexts["lyric-style-blur"].label,"其他行模糊：1");XCTAssertTrue(app.buttons["逐字强调：关"].exists)
    // Exercise imported glyphs and persisted styles in the actual player.
    app.terminate();try testZNavidromePlaybackAndCredentials()
    settings();app.buttons["font-open-lyric"].tap()
    let remove=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-delete-nexusfont_")).firstMatch;reach(remove);remove.tap();app.alerts.buttons["删除"].tap();
    expectation(for:NSPredicate(format:"label CONTAINS %@","系统字体"),evaluatedWith:globalStatus);waitForExpectations(timeout:10);XCTAssertTrue(lyricStatus.label.contains("跟随全局"));
    reach(app.buttons["font-open-display"]);app.buttons["font-open-display"].tap()
    let reset=app.buttons["lyric-style-reset"];reach(reset);reset.tap();XCTAssertTrue(app.buttons["逐字强调：开"].exists)
    app.terminate();app.launch();settings();app.buttons["font-open-global"].tap();reach(importer);XCTAssertFalse(app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","font-delete-nexusfont_")).firstMatch.exists);XCTAssertTrue(globalStatus.label.contains("系统字体"))
  }
  func testAM2PlayerWithLargeText() throws { try verifyAM2Window(largeText:true) }
  func testAM2PlayerWindowRotation() throws { try verifyAM2Window(largeText:false) }
  func testClassicPlayerWindowSafeArea() throws {try verifyAM2Window(largeText:false,classic:true)}
  private func verifyAM2Window(largeText:Bool,classic:Bool=false) throws {
    let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    if largeText{app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"]}
    app.launch()
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    if UIDevice.current.userInterfaceIdiom == .pad && !element("app-layout-expanded").waitForExistence(timeout:3){
      let system=XCUIApplication(bundleIdentifier:"com.apple.springboard"),zoom=XCUIApplication(bundleIdentifier:"com.apple.springboard").buttons["Zoom-button"]
      if !zoom.isHittable{let controls=system.buttons["window-controls:com.nexusmusic.app"];XCTAssertTrue(controls.waitForExistence(timeout:5));controls.tap()}
      XCTAssertTrue(zoom.waitForExistence(timeout:5));zoom.tap()
      XCTAssertTrue(element("app-layout-expanded").waitForExistence(timeout:20))
      XCTAssertGreaterThanOrEqual(element("app-layout-expanded").frame.width,768)
    }
    func reveal(_ item:XCUIElement){
      for _ in 0..<30{
        if item.exists && item.isHittable{break}
        let above=item.exists && item.frame.midY<app.frame.midY
        let viewport=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","settings-viewport-")).firstMatch
        let surface=viewport.exists ? viewport : app
        surface.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.25 : 0.75)).press(forDuration:0.05,thenDragTo:surface.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.75 : 0.25)))
      }
      XCTAssertTrue(item.isHittable)
    }
    openSettings(app,page:"skins");let am2=element(classic ? "player-layout-classic":"player-layout-am2");reveal(am2);am2.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["skins-sheet-close"]);waitForExpectations(timeout:10)
    openSettings(app,page:"sources")
    for (label,value) in [("Navidrome服务器地址","http://127.0.0.1:18439"),("Navidrome用户名","fixture-user"),("Navidrome密码","fixture-password")]{
      let field=label=="Navidrome密码" ? app.secureTextFields[label] : app.textFields[label]
      reveal(field);field.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    }
    let save=app.buttons["验证并保存连接"];reveal(save);save.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:15))
    let rail=element("rail-tab-library");(rail.exists ? rail : element("tab-library")).tap()
    element("tab-private").tap();let account=element("navidrome-account-fixture-user");reveal(account);account.tap()
    let album=element("navidrome-item-album-fixture-album");XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();app.buttons["播放全部"].tap()
    let open=app.buttons["打开播放页"];XCTAssertTrue(open.waitForExistence(timeout:10));open.tap()
    if classic {
      let viewport=element("classic-player-scroll")
      XCTAssertTrue(viewport.waitForExistence(timeout:10))
      XCTAssertGreaterThanOrEqual(viewport.frame.minY,app.frame.minY+20)
      XCTAssertLessThanOrEqual(viewport.frame.maxY,app.frame.maxY-10)
      let queue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
      reveal(queue);queue.tap()
      let closeQueue=app.buttons["收起队列"];XCTAssertTrue(closeQueue.waitForExistence(timeout:10));closeQueue.tap()
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeQueue)],timeout:10),.completed)
      XCTAssertGreaterThanOrEqual(viewport.frame.minY,app.frame.minY+20)
      let portrait=XCTAttachment(screenshot:XCUIScreen.main.screenshot());portrait.name="Classic scrolled portrait safe viewport after queue";portrait.lifetime = .keepAlways;add(portrait)
      XCUIDevice.shared.orientation = .landscapeLeft;app.activate()
      var frames=""
      let rotated=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        let window=app.frame,frame=viewport.frame;frames="window: \(window), viewport: \(frame)"
        let side:CGFloat=UIDevice.current.userInterfaceIdiom == .pad ? 0:20
        return window.width>window.height && frame.minX>=window.minX+side && frame.maxX<=window.maxX-side && frame.maxY<=window.maxY-10
      },object:app)
      let result=XCTWaiter.wait(for:[rotated],timeout:15)
      let landscape=XCTAttachment(screenshot:XCUIScreen.main.screenshot());landscape.name="Classic scrolled landscape safe viewport";landscape.lifetime = .keepAlways;add(landscape)
      XCTAssertEqual(result,.completed,frames)
      XCUIDevice.shared.orientation = .portrait;app.activate()
      let restored=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.frame.height>app.frame.width && viewport.frame.minY>=app.frame.minY+20 && viewport.frame.maxY<=app.frame.maxY-10},object:app)
      XCTAssertEqual(XCTWaiter.wait(for:[restored],timeout:15),.completed)
      let close=app.buttons["收起播放页"];reveal(close);close.tap()
      openSettings(app,page:"sources");let remove=app.buttons["移除连接：fixture-user"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
      XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
      return
    }
    XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout:10));app.buttons["暂停"].tap()
    let lyrics=app.buttons["am2-content-lyrics"];XCTAssertTrue(lyrics.isHittable);lyrics.tap()
    XCTAssertTrue(element("am2-lyrics-list").waitForExistence(timeout:10))
    let progress=element("播放进度"),beforeScroll=progress.value as? String
    let line=app.buttons["定位歌词：Synthetic lyric two"].firstMatch;XCTAssertTrue(line.waitForExistence(timeout:10))
    let lyricList=element("am2-lyrics-list")
    for _ in 0..<5 {if line.isHittable{break};lyricList.swipeUp()}
    XCTAssertEqual(progress.value as? String,beforeScroll,"Scrolling lyrics must keep the paused playback position")
    let beforeTap=XCTAttachment(screenshot:app.screenshot());beforeTap.name="AM2 actual lyric before double tap";beforeTap.lifetime = .keepAlways;add(beforeTap)
    XCTAssertTrue(line.isHittable);line.doubleTap()
    expectation(for:NSPredicate(format:"value == %@","0:06 / 2:00"),evaluatedWith:progress);waitForExpectations(timeout:5)
    XCTAssertEqual(progress.value as? String,"0:06 / 2:00")
    let play=app.buttons["播放"];XCTAssertTrue(play.isHittable);XCTAssertLessThanOrEqual(play.frame.maxY,app.frame.maxY)
    let portrait=XCTAttachment(screenshot:app.screenshot());portrait.name=largeText ? "AM2 accessibility XXXL actual lyrics and transport" : "AM2 portrait actual lyrics and transport";portrait.lifetime = .keepAlways;add(portrait)
    if !largeText{
      line.press(forDuration:0.7)
      let closeLyrics=app.buttons["收起全部歌词"];XCTAssertTrue(closeLyrics.waitForExistence(timeout:5));closeLyrics.tap()
      XCTAssertEqual(progress.value as? String,"0:06 / 2:00","Long press opens settings without seeking")
    }
    if !largeText{
      XCUIDevice.shared.orientation = .landscapeLeft
      let rotated=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.frame.width>app.frame.height && element("am2-horizontal").exists},object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[rotated],timeout:15),.completed)
      XCTAssertTrue(play.isHittable,"Landscape transport must fit in its column")
      XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"Landscape lyric source must fit in its column")
      var previousPanel=CGRect.zero,stableFrames=0
      let settled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        let panel=element("am2-content-panel").frame
        stableFrames=panel==previousPanel ? stableFrames+1:0;previousPanel=panel
        return panel.minX>app.frame.width*0.4 && panel.height>100 && stableFrames>=2
      },object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[settled],timeout:10),.completed,"Capture the final native columns after rotation settles")
      let landscape=XCTAttachment(screenshot:app.screenshot());landscape.name="AM2 native landscape columns and transport";landscape.lifetime = .keepAlways;add(landscape)
      let display=XCTAttachment(screenshot:XCUIScreen.main.screenshot());display.name="AM2 landscape full display";display.lifetime = .keepAlways;add(display)
      XCUIDevice.shared.orientation = .portrait
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.frame.height>app.frame.width},object:nil)],timeout:10),.completed)
    }
    app.buttons["收起播放页"].tap();openSettings(app,page:"sources")
    app.buttons["移除连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
    openSettings(app,page:"skins");let classic=element("player-layout-classic");reveal(classic);classic.tap()
  }
  func testZNavidromePlaybackAndCredentials() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"skins")
    func reveal(_ element:XCUIElement){for _ in 0..<40 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65 : 0.35)))};XCTAssertTrue(element.isHittable)}
    // Establish the initial layout through the actual setting, including when a
    // previous interrupted test left a different persisted skin selected.
    let classic=app.descendants(matching:.any).matching(identifier:"player-layout-classic").firstMatch
    XCTAssertTrue((app.descendants(matching:.any).matching(identifier:"player-layout-wave").firstMatch.value as? String)?.contains("实时音频频谱环") == true,"Style choices should expose a concise behavior description")
    reveal(classic);classic.tap()
    let skinDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.buttons["skins-sheet-close"])
    XCTAssertEqual(XCTWaiter.wait(for:[skinDismissed],timeout:10),.completed,"Skin selection must finish dismissing before navigating to sources")
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
    XCTAssertTrue(app.staticTexts["我的音乐库"].waitForExistence(timeout:10))
    // The home card shows only the five most recent statistics. A missing row
    // cannot establish a zero baseline after other scenarios played >5 tracks.
    // Reset only synthetic local statistics through the real confirmation UI.
    let baselineImage=XCTAttachment(screenshot:app.screenshot());baselineImage.name="Listening statistics before explicit baseline reset";baselineImage.lifetime = .keepAlways;add(baselineImage)
    let clearStatistics=app.buttons["清空播放统计"]
    if clearStatistics.exists {
      reveal(clearStatistics);clearStatistics.tap()
      XCTAssertTrue(app.alerts["清空播放统计？"].waitForExistence(timeout:5))
      app.alerts["清空播放统计？"].buttons["清空"].tap()
    }
    let emptyStatistics=app.staticTexts.matching(NSPredicate(format:"label ENDSWITH %@"," · 播放统计 0")).firstMatch
    XCTAssertTrue(emptyStatistics.waitForExistence(timeout:10),"Require an actual empty persisted-statistics baseline, not absence from the five-row card")
    let statistic=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","Synthetic tone · 播放 ")).firstMatch
    func count() -> Int {
      XCTAssertTrue(statistic.waitForExistence(timeout:10),"A missing statistic must fail rather than count as zero")
      let value=Int(statistic.label.components(separatedBy:" · 播放 ").last?.components(separatedBy:" 次").first ?? "")
      XCTAssertNotNil(value,"The visible listening count must parse: \(statistic.label)")
      return value ?? -1
    }
    let previousCount=0
    app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let playbackAccount=app.descendants(matching:.any).matching(identifier:"navidrome-account-fixture-user").firstMatch
    XCTAssertTrue(playbackAccount.waitForExistence(timeout:10));reveal(playbackAccount);playbackAccount.tap()
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
    let amTitle=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","Synthetic tone")).firstMatch
    XCTAssertTrue(amTitle.waitForExistence(timeout:5),"AM skin must keep the original Navidrome title accessible")
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    XCTAssertTrue((progress.value as? String)?.hasSuffix(" / 2:00")==true,"Fixture duration must come from the decoded 120-second stream; actual progress: \(String(describing: progress.value))")
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
    XCTAssertTrue(app.staticTexts["歌词样式"].exists);XCTAssertTrue(app.buttons["font-open-lyric"].exists)
    app.buttons["font-open-lyric"].tap()
    XCTAssertTrue(app.buttons["font-import"].waitForExistence(timeout:5));XCTAssertTrue(app.buttons["font-lyrics-inherit"].exists);XCTAssertFalse(app.buttons["font-global-system"].exists)
    app.buttons["返回歌词设置"].tap()
    app.buttons["收起歌词显示设置"].tap()
    app.buttons["播放界面样式"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-immersive").firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons["播放"].isHittable, "Immersive transport controls must fit on screen")
    app.buttons["调整播放界面"].tap()
    XCTAssertTrue(app.staticTexts["播放界面样式"].waitForExistence(timeout:5), "The dedicated style control must open the style sheet")
    app.buttons["收起播放界面样式"].tap()
    let immersiveImage=XCTAttachment(screenshot:app.screenshot());immersiveImage.lifetime = .keepAlways;add(immersiveImage)
    for layout in ["photo","vinyl","wave","stage","am2"] {
      app.buttons["更多播放控制"].tap()
      app.buttons["播放界面样式"].tap()
      app.descendants(matching:.any).matching(identifier:"play-skin-\(layout)").firstMatch.tap()
      XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
      XCTAssertTrue(app.buttons["播放"].isHittable, "Transport must fit in \(layout)")
      if layout=="am2" {
        // An interrupted previous run can leave AM2's persisted controls set.
        // Establish this scenario through the same settings used by the user.
        app.buttons["am2-settings"].tap()
        if app.buttons["自动展开歌词：关"].exists{app.buttons["am2-auto"].tap()}
        if app.buttons["音量控件：显示"].exists{app.buttons["am2-show-volume"].tap()}
        for _ in 0..<60 {
          let delay=app.staticTexts["am2-delay"].label
          if delay=="等待 5 秒"{break}
          let seconds=Int(delay.filter(\.isNumber)) ?? 5
          app.buttons[seconds>5 ? "am2-delay-minus":"am2-delay-plus"].tap()
        }
        XCTAssertEqual(app.staticTexts["am2-delay"].label,"等待 5 秒")
        app.buttons["am2-settings"].tap()
        let lyrics=app.buttons["am2-content-lyrics"];XCTAssertTrue(lyrics.isHittable);lyrics.tap()
        XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"am2-lyrics-list").firstMatch.waitForExistence(timeout:10))
        let restore=app.buttons["还原歌词区域"];XCTAssertTrue(restore.waitForExistence(timeout:12),"Only idle visible lyrics should auto expand")
        let lyricsImage=XCTAttachment(screenshot:app.screenshot());lyricsImage.name="AM2 expanded real lyrics before seeking";lyricsImage.lifetime = .keepAlways;add(lyricsImage)
        let line=app.buttons["定位歌词：Synthetic lyric two"].firstMatch;XCTAssertTrue(line.isHittable);line.doubleTap()
        expectation(for:NSPredicate(format:"value == %@","0:06 / 2:00"),evaluatedWith:progress);waitForExpectations(timeout:5)
        XCTAssertTrue(app.buttons["播放"].exists,"Lyric seek must retain paused intent")
        app.buttons["am2-content-queue"].tap();XCTAssertTrue(app.staticTexts["播放队列"].waitForExistence(timeout:5))
        let queuedTrack=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","1. Synthetic tone")).firstMatch
        XCTAssertTrue(queuedTrack.waitForExistence(timeout:5));XCTAssertTrue(queuedTrack.isHittable)
        XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"am2-lyrics-list").firstMatch.exists,"Content panels must be exclusive")
        app.buttons["am2-content-comments"].tap();XCTAssertTrue(app.staticTexts["此来源暂不支持公开评论；当前支持网易云在线歌曲。"].waitForExistence(timeout:5))
        app.buttons["am2-return-cover"].tap();XCTAssertEqual(progress.value as? String,"0:06 / 2:00")
        app.buttons["am2-settings"].tap();XCTAssertTrue(app.buttons["自动展开歌词：开"].waitForExistence(timeout:5))
        app.buttons["am2-delay-minus"].tap();app.buttons["am2-delay-minus"].tap();XCTAssertEqual(app.staticTexts["am2-delay"].label,"等待 3 秒")
        app.buttons["am2-show-volume"].tap();app.buttons["am2-settings"].tap()
        let volume=app.descendants(matching:.any).matching(identifier:"am2-volume").firstMatch;XCTAssertTrue(volume.isHittable)
        volume.coordinate(withNormalizedOffset:CGVector(dx:0.8,dy:0.5)).press(forDuration:0.05,thenDragTo:volume.coordinate(withNormalizedOffset:CGVector(dx:0.3,dy:0.5)))
        XCTAssertEqual(app.staticTexts["am2-volume-value"].label,"30%");XCTAssertEqual(progress.value as? String,"0:06 / 2:00","Volume drag must not seek or toggle content")
        let am2Image=XCTAttachment(screenshot:app.screenshot());am2Image.name="AM2 independent cover and volume with paused shared clock";am2Image.lifetime = .keepAlways;add(am2Image)
        app.buttons["am2-settings"].tap();app.buttons["am2-show-volume"].tap();app.buttons["am2-delay-plus"].tap();app.buttons["am2-delay-plus"].tap();app.buttons["am2-settings"].tap();lyrics.tap()
      }
      XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"Lyric selection must fit in \(layout)")
      if layout=="stage" {
        let group=app.descendants(matching:.any).matching(identifier:"lyric-stage-group").firstMatch
        XCTAssertTrue(group.waitForExistence(timeout:10));XCTAssertEqual(group.label,"two","Stage must select the last real timed group at the shared 60-second position")
        let stageImage=XCTAttachment(screenshot:app.screenshot());stageImage.name="Stage real group with paused transport";stageImage.lifetime = .keepAlways;add(stageImage)
      }
      if layout=="wave" {
        XCTAssertTrue(app.buttons["Synthetic lyric two"].firstMatch.isHittable,"Wave layout must show its active lyric completely below the selector")
        XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"wave-spectrum-bars").firstMatch.exists,"Paused wave playback must not fabricate a spectrum ring")
        let ring=app.descendants(matching:.any).matching(identifier:"wave-seek-ring").firstMatch
        XCTAssertTrue(ring.isHittable,"The ring must expose a separate adjustable surface around the play button")
        ring.coordinate(withNormalizedOffset:CGVector(dx:0.93,dy:0.5)).press(forDuration:0.1,thenDragTo:ring.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.93)))
        expectation(for:NSPredicate(format:"value == %@","1:00 / 2:00"),evaluatedWith:ring);waitForExpectations(timeout:5)
        XCTAssertTrue(app.buttons["播放"].exists,"Ring seeking must preserve paused intent")
        XCTAssertEqual(progress.value as? String,"1:00 / 2:00","Linear and ring progress must share the authoritative controller")
        app.buttons["播放"].tap()
        XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"wave-spectrum-bars").firstMatch.waitForExistence(timeout:10),"Center play control must remain reachable through the ring")
        ring.coordinate(withNormalizedOffset:CGVector(dx:0.07,dy:0.5)).press(forDuration:0.1,thenDragTo:ring.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.93)))
        XCTAssertTrue(app.buttons["暂停"].exists,"Ring seeking during playback must retain playing intent")
        let position=ring.value as? String ?? ""
        XCTAssertTrue(position.hasPrefix("1:0"),"Playing ring seek must return to about 60 seconds: \(position)")
        app.buttons["暂停"].tap()
        XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"wave-spectrum-bars").firstMatch.exists)
      }
      let skinTitle=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","Synthetic tone")).firstMatch
      XCTAssertTrue(skinTitle.waitForExistence(timeout:5),"Skin \(layout) must keep the original Navidrome title accessible")
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
    for _ in 0..<8 {if recent.isHittable{break};let above=recent.exists && recent.frame.midY < app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7:0.35)))}
    XCTAssertTrue(recent.isHittable,"Playback history tab must remain reachable after returning from the player")
    recent.tap()
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"history-item-0").firstMatch.waitForExistence(timeout:10),"Real playback must appear in the timeline history")
    let day=app.staticTexts["history-day-0"].firstMatch;XCTAssertTrue(day.waitForExistence(timeout:5));XCTAssertNotNil(day.label.range(of:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$",options:.regularExpression));let playedDay=day.label
    for _ in 0..<12{if day.isHittable{break};let above=day.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.7:0.3)))}
    XCTAssertTrue(day.isHittable,"Calendar header must remain reachable with the actual history row")
    XCTAssertEqual(count(),previousCount+1,"Paused seeking and skin changes must count one native media session")
    let statsImage=XCTAttachment(screenshot:app.screenshot());statsImage.name="Persisted listening statistics";statsImage.lifetime = .keepAlways;add(statsImage)
    app.terminate();app.launch();app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    XCTAssertTrue(statistic.waitForExistence(timeout:10));XCTAssertEqual(count(),previousCount+1,"Actual listening statistics must survive restart")
    for _ in 0..<12 {if recent.isHittable{break};let above=recent.exists && recent.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.7:0.3)))}
    XCTAssertTrue(recent.isHittable);recent.tap();XCTAssertEqual(day.label,playedDay,"Actual playback date must survive restart")
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
    openSettings(app,page:"mini");miniChoose("mini-reset");app.buttons["mini-sheet-close"].tap();expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:miniQueue);waitForExpectations(timeout:10)
    openSettings(app,page:"sources")
    for _ in 0..<45 {if app.buttons["移除连接：fixture-user"].isHittable{break};app.swipeDown()}
    app.buttons["移除连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
  }
  func testGlobalCoverThemeChangesAcrossPages() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch();app.activate()
    func themeControl(_ query:String="") throws -> Int {
      let bytes=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/theme-fixture-control"+(query.isEmpty ? "" : "?"+query))!)
      return (try JSONSerialization.jsonObject(with:bytes) as? [String:Int])?["held"] ?? -1
    }
    _=try themeControl("transition=1")
    defer{_=try? themeControl("release=red&stop=1");_=try? themeControl("release=blue");_=try? themeControl("release=missing")}
    func reveal(_ element:XCUIElement){for _ in 0..<24 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35:0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65:0.35)))};XCTAssertTrue(element.isHittable)}
    func setSwitch(_ element:XCUIElement,_ enabled:Bool){
      reveal(element)
      // Use the actual switch track, as verified by the round-trip App test.
      let expected=enabled ? "1":"0"
      if element.value as? String != expected {element.coordinate(withNormalizedOffset:CGVector(dx:0.8,dy:0.5)).tap()}
      let saved=XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@",expected),object:element)
      let result=XCTWaiter.wait(for:[saved],timeout:10)
      if result != .completed {
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="Background switch failed: "+element.identifier;shot.lifetime = .keepAlways;add(shot)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="Background switch hierarchy";tree.lifetime = .keepAlways;add(tree)
      }
      XCTAssertEqual(result,.completed,"Background preference must reach the requested state: \(element.identifier)")
    }
    openSettings(app,page:"background");app.descendants(matching:.any).matching(identifier:"visual-classic").firstMatch.tap()
    // Other appearance tests import an image and persist its selection. Choose
    // an explicit neutral base before asserting restoration after flow stops.
    openSettings(app,page:"background")
    let solid=app.descendants(matching:.any).matching(identifier:"background-solid").firstMatch;reveal(solid);solid.tap()
    openSettings(app,page:"background")
    for id in ["visual-global-motion","visual-motion"] {setSwitch(app.switches[id],false)}
    openSettings(app,page:"theme");app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch.tap()
    openSettings(app,page:"appearance");let follow=app.switches["appearance-cover-color"];reveal(follow);if follow.value as? String != "1"{follow.tap()}
    openSettings(app,page:"sources")
    for (label,value) in [("Navidrome服务器地址","http://127.0.0.1:18439"),("Navidrome用户名","fixture-theme"),("Navidrome密码","fixture-password")] {
      let field=label=="Navidrome密码" ? app.secureTextFields[label] : app.textFields[label];reveal(field);field.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    }
    app.buttons["验证并保存连接"].tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:20))
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let themeAccount=app.descendants(matching:.any).matching(identifier:"navidrome-account-fixture-theme").firstMatch;XCTAssertTrue(themeAccount.waitForExistence(timeout:10));if (themeAccount.value as? String) != "1" {themeAccount.tap()}
    let album=app.buttons["navidrome-item-album-fixture-album"];XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();let redSong=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@","red cover tone")).firstMatch;XCTAssertTrue(redSong.waitForExistence(timeout:10));reveal(redSong);redSong.tap()
    func screenImage()->CGImage? {
      // XCTScreenshot can encode a valid PNG while UIImage.cgImage is nil.
      // Read that immutable PNG directly and use physical screen pixels.
      let image=BackgroundPixels.decode(XCUIScreen.main.screenshot().pngRepresentation)
      XCTAssertNotNil(image,"The actual screen PNG must decode before checking colors")
      return image
    }
    func redMinusBlue()->Int {
      guard let image=screenImage() else{return 0}
      let scale=UIScreen.main.scale,rgba=BackgroundPixels.rgba(image,at:CGPoint(x:6*scale,y:180*scale))
      return rgba.count==4 ? Int(rgba[0])-Int(rgba[2]) : 0
    }
    func expectTint(_ red:Bool,_ title:String){
      let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in let delta=redMinusBlue();return red ? delta>12 : delta < -12},object:app)
      XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:20),.completed,"Visible global tint must follow the decoded \(red ? "red" : "blue") cover on \(title)")
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=title;shot.lifetime = .keepAlways;add(shot)
    }
    expectTint(true,"Red cover private library")
    app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch.tap();expectTint(true,"Red cover discovery")
    openSettings(app,page:"appearance");expectTint(true,"Red cover appearance settings")
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    // The private-library page remounts on tab changes and selects its first
    // account. Select the color fixture explicitly before opening its album.
    XCTAssertTrue(themeAccount.waitForExistence(timeout:10));reveal(themeAccount);themeAccount.tap()
    XCTAssertTrue(album.waitForExistence(timeout:15));reveal(album);album.tap()
    let blue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","blue cover tone")).firstMatch;XCTAssertTrue(blue.waitForExistence(timeout:15));for _ in 0..<20{if blue.isHittable{break};app.swipeUp()};XCTAssertTrue(blue.isHittable,"Blue cover song must be reachable in the album list");blue.tap();expectTint(false,"Blue cover private library")
    openSettings(app,page:"appearance");expectTint(false,"Blue cover appearance settings")
    let restoredFollow=app.switches["appearance-cover-color"];reveal(restoredFollow);restoredFollow.tap()
    let fallback=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(redMinusBlue())<12},object:app);XCTAssertEqual(XCTWaiter.wait(for:[fallback],timeout:10),.completed)
    restoredFollow.tap();expectTint(false,"Blue cover enabled again")
    app.terminate();app.launch();openSettings(app,page:"appearance");expectTint(false,"Blue cover restored paused after restart")
    // Global flow has its own persisted switch and works with tint disabled.
    // Assert actual pixels, not merely the presence of the background view.
    openSettings(app,page:"background")
    let tint=app.switches["visual-cover-color"];reveal(tint);if tint.value as? String != "0"{tint.tap()}
    app.buttons["background-sheet-close"].tap()
    let noCover=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(redMinusBlue())<12},object:app);XCTAssertEqual(XCTWaiter.wait(for:[noCover],timeout:10),.completed)
    openSettings(app,page:"background")
    let global=app.switches["visual-global-motion"];reveal(global);global.tap();XCTAssertEqual(global.value as? String,"1")
    let playerMotion=app.switches["visual-motion"];reveal(playerMotion);XCTAssertEqual(playerMotion.value as? String,"0")
    app.buttons["background-sheet-close"].tap();expectTint(false,"Global flow without cover tint")
    app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch.tap();expectTint(false,"Global flow discovery independent of player motion")
    app.terminate();app.launch();openSettings(app,page:"background")
    let persistedGlobal=app.switches["visual-global-motion"];reveal(persistedGlobal);XCTAssertEqual(persistedGlobal.value as? String,"1")
    let persistedTint=app.switches["visual-cover-color"];reveal(persistedTint);XCTAssertEqual(persistedTint.value as? String,"0")
    let persistedPlayer=app.switches["visual-motion"];reveal(persistedPlayer);XCTAssertEqual(persistedPlayer.value as? String,"0")
    app.buttons["background-sheet-close"].tap();expectTint(false,"Global flow restored paused")
    // Exercise the real native scene gate through playback, presentation,
    // foreground restoration and pause; pixel checks above remain independent.
    func motion(_ active:Bool){
      let id="ambient-motion-"+(active ? "active":"still")
      XCTAssertTrue(app.descendants(matching:.any).matching(identifier:id).firstMatch.waitForExistence(timeout:10))
      XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"ambient-soft-lights").firstMatch.waitForExistence(timeout:10),"Three-color flow must mount the registered native soft-light view")
    }
    func backgroundPixels()->[UInt8]{
      guard let image=screenImage() else{return []}
      let margin=6*UIScreen.main.scale
      return [0.22,0.36,0.5,0.64,0.78].flatMap{fraction->[UInt8] in
        [margin,CGFloat(image.width)-margin].flatMap{x in Array(BackgroundPixels.rgba(image,at:CGPoint(x:x,y:CGFloat(image.height)*fraction)).prefix(3))}
      }
    }
    motion(false)
    let stoppedPixels=backgroundPixels();XCTAssertEqual(stoppedPixels.count,30);XCTAssertEqual(stoppedPixels,backgroundPixels(),"Paused native scene must retain stable actual background pixels")
    openSettings(app,page:"skins")
    let classic=app.descendants(matching:.any).matching(identifier:"player-layout-classic").firstMatch;reveal(classic);classic.tap()
    app.buttons["mini-action-toggle"].tap();motion(true)
    let firstMotionPixels=backgroundPixels()
    let actualMotion=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let next=backgroundPixels()
      return next.count==30 && zip(firstMotionPixels,next).reduce(0){$0+abs(Int($1.0)-Int($1.1))}>=5
    },object:app)
    XCTAssertEqual(XCTWaiter.wait(for:[actualMotion],timeout:20),.completed,"Native soft lights must change actual margin pixels while audio plays")
    app.buttons["打开播放页"].tap();motion(true)
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:20),"Background presentation must preserve native PCM playback")
    let classicViewport=app.descendants(matching:.any).matching(identifier:"classic-player-scroll").firstMatch
    XCTAssertTrue(classicViewport.waitForExistence(timeout:10))
    XCTAssertGreaterThanOrEqual(classicViewport.frame.minY,app.frame.minY+20,"The scroll viewport itself must exclude the portrait status bar, including after content is scrolled")
    XCTAssertLessThanOrEqual(classicViewport.frame.maxY,app.frame.maxY-10,"Classic controls must stay above the home indicator")
    let activeBackground=XCTAttachment(screenshot:XCUIScreen.main.screenshot());activeBackground.name="Classic foreground background with native PCM";activeBackground.lifetime = .keepAlways;add(activeBackground)
    // A full-screen child covers the classic background; closing it must
    // restore that exact parent, and closing the player must restore the root.
    let fullQueue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
    reveal(fullQueue);fullQueue.tap()
    let closeQueue=app.buttons["收起队列"];XCTAssertTrue(closeQueue.waitForExistence(timeout:10));closeQueue.tap()
    let queueDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeQueue)
    XCTAssertEqual(XCTWaiter.wait(for:[queueDismissed],timeout:10),.completed)
    motion(true)
    let resumedPixels=backgroundPixels()
    let resumedMotion=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let next=backgroundPixels()
      return next.count==30 && zip(resumedPixels,next).reduce(0){$0+abs(Int($1.0)-Int($1.1))}>=5
    },object:app)
    XCTAssertEqual(XCTWaiter.wait(for:[resumedMotion],timeout:20),.completed,"Dismissing the full-screen queue must resume actual parent background motion without changing playback")
    let restoredBackground=XCTAttachment(screenshot:XCUIScreen.main.screenshot());restoredBackground.name="Classic parent restored after full-screen queue";restoredBackground.lifetime = .keepAlways;add(restoredBackground)
    XCTAssertGreaterThanOrEqual(classicViewport.frame.minY,app.frame.minY+20,"Returning from the full-screen queue must preserve the clipped scroll viewport")
    XCUIDevice.shared.press(.home);app.activate();motion(true)
    let closePlayer=app.buttons["收起播放页"];reveal(closePlayer);closePlayer.tap();motion(true)
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let openDiscovery=app.buttons["发现 · 分类 · 排行榜 · 歌单导入"];reveal(openDiscovery);openDiscovery.tap()
    let closeDiscovery=app.buttons["收起发现"];XCTAssertTrue(closeDiscovery.waitForExistence(timeout:10));closeDiscovery.tap()
    let discoveryDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeDiscovery)
    XCTAssertEqual(XCTWaiter.wait(for:[discoveryDismissed],timeout:10),.completed)
    motion(true)
    let rootPixels=backgroundPixels()
    let rootMotion=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let next=backgroundPixels()
      return next.count==30 && zip(rootPixels,next).reduce(0){$0+abs(Int($1.0)-Int($1.1))}>=5
    },object:app)
    XCTAssertEqual(XCTWaiter.wait(for:[rootMotion],timeout:20),.completed,"Closing a non-player full screen must restore actual root motion")
    app.buttons["mini-action-toggle"].tap();motion(false)
    expectTint(false,"Visible global background restored after player and pause")
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    XCTAssertTrue(themeAccount.waitForExistence(timeout:10));reveal(themeAccount);themeAccount.tap()
    XCTAssertTrue(album.waitForExistence(timeout:15));reveal(album);album.tap()
    // Fresh synthetic artwork identities bypass only fixture cache reuse.
    // The real production loader is held at HTTP, then the display is recorded
    // independently so a final screenshot cannot masquerade as a crossfade.
    let transitionRed=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","transition red tone")).firstMatch
    XCTAssertTrue(transitionRed.waitForExistence(timeout:15));reveal(transitionRed);transitionRed.tap()
    var lastHeldRed:Int?
    let heldRed=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in lastHeldRed=try? themeControl();return lastHeldRed==1},object:nil)
    // Cover extraction is bounded by the native cache queue and can follow
    // the preceding blue request; give that queue its documented headroom.
    let heldRedResult=XCTWaiter.wait(for:[heldRed],timeout:30)
    if heldRedResult != .completed {
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="Red cover request observation failure";shot.lifetime = .keepAlways;add(shot)
      let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Red cover request failure hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
    }
    XCTAssertEqual(heldRedResult,.completed,"The new red cover must reach the held HTTP fixture; last observed held count: \(String(describing:lastHeldRed))")
    expectTint(false,"Previous blue scene retained while red cover HTTP is held")
    // Theme changes are verified below with multi-point scene samples; keep
    // this held-request checkpoint focused on the async owner identity.
    let heldThemeImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());heldThemeImage.name="Pending red identity while blue scene remains visible after theme rebuild";heldThemeImage.lifetime = .keepAlways;add(heldThemeImage)
    _=try themeControl("record=1");_=try themeControl("release=red")
    expectTint(true,"Current red scene after bounded crossfade")
    _=try themeControl("stop=1")
    let transitionBlue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","transition blue tone")).firstMatch
    reveal(transitionBlue);transitionBlue.tap()
    let heldBlue=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in (try? themeControl())==1},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[heldBlue],timeout:30),.completed)
    expectTint(true,"Previous red scene retained while blue cover HTTP is held")
    let missing=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","transition missing tone")).firstMatch
    reveal(missing);missing.tap()
    _=try themeControl("release=blue")
    let heldMissing=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in (try? themeControl())==1},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[heldMissing],timeout:30),.completed)
    expectTint(true,"Late blue artwork cannot replace the retained red scene for a newer identity")
    _=try themeControl("release=missing")
    let failedFallback=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(redMinusBlue())<12},object:app)
    XCTAssertEqual(XCTWaiter.wait(for:[failedFallback],timeout:15),.completed,"Current cover failure must clear the retained scene")
    // Restore the original full-flow assertions after the asynchronous probe.
    let multi=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","multi cover tone")).firstMatch
    XCTAssertTrue(multi.waitForExistence(timeout:15));reveal(multi);multi.tap()
    func flowSamples()->[[UInt8]] {
      guard let image=screenImage() else{return []}
      let margin=6*UIScreen.main.scale
      return (2...8).flatMap{step in [margin,CGFloat(image.width)-margin].map{x in
        BackgroundPixels.rgba(image,at:CGPoint(x:x,y:CGFloat(image.height)*CGFloat(step)/10))
      }}
    }
    func expectThreeColors(_ name:String){
      XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"ambient-three-color").firstMatch.waitForExistence(timeout:10))
      // The two-stop base and four moving softened fields do not map to three
      // fixed stops. Sample only bare margins, requiring all three actual hues.
      var lastSamples=[[UInt8]]()
      let different=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        var best=[[UInt8]]()
        for _ in 0..<5 {
          let samples=flowSamples()
          if samples.filter({$0.count==4}).count > best.filter({$0.count==4}).count { best=samples }
          if BackgroundPixels.hasPrimaryHues(samples) { lastSamples=samples; return true }
        }
        lastSamples=best
        return BackgroundPixels.hasPrimaryHues(lastSamples)
      },object:app)
      let result=XCTWaiter.wait(for:[different],timeout:20)
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)
      if result != .completed {print("Background RGB samples for \(name): \(lastSamples)")}
      XCTAssertEqual(result,.completed,"Three-color flow must render distinct red, green and blue actual margins: \(name); last RGBA samples \(lastSamples)")
    }
    func pausedScene(_ name:String)->[[UInt8]] {
      motion(false)
      let pixels=flowSamples()
      XCTAssertEqual(pixels.count,14)
      XCTAssertTrue(pixels.allSatisfy{$0.count==4 && $0[3]==255},"Paused baseline must contain fourteen opaque actual pixels")
      XCTAssertEqual(pixels,flowSamples(),"Paused scene must settle before using it as a restart baseline")
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)
      return pixels
    }
    func expectPausedScene(_ expected:[[UInt8]],_ name:String){
      motion(false)
      var actual=[[UInt8]]()
      let restored=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in actual=flowSamples();return actual==expected},object:app)
      let result=XCTWaiter.wait(for:[restored],timeout:20)
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)
      XCTAssertEqual(result,.completed,"The same identity, palette and stopped pose must restore all fourteen pixels: \(name); expected \(expected), actual \(actual)")
    }
    expectThreeColors("Three-color flow actual private library pixels")
    app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch.tap()
    expectThreeColors("Three-color flow actual discovery pixels")
    app.buttons["mini-action-toggle"].tap()
    let lightPaused=pausedScene("Light paused scene before theme and restart")
    func marginBrightness()->Double {let bytes=backgroundPixels();return Double(bytes.reduce(0){$0+Int($1)})/Double(bytes.count)}
    let lightBrightness=marginBrightness()
    app.buttons["mini-action-toggle"].tap();motion(true)
    openSettings(app,page:"theme");app.descendants(matching:.any).matching(identifier:"theme-dark").firstMatch.tap()
    app.buttons["theme-sheet-close"].tap()
    expectThreeColors("Softened dark flow actual appearance pixels")
    XCTAssertLessThan(marginBrightness(),lightBrightness-60,"The same raw cover must rebuild a substantially darker native scene")
    app.buttons["mini-action-toggle"].tap()
    let darkPaused=pausedScene("Dark paused scene before restart")
    app.terminate();app.launch();motion(false)
    expectPausedScene(darkPaused,"Softened dark flow restored paused")
    XCTAssertLessThan(marginBrightness(),lightBrightness-60,"Dark scene must survive restart")
    let darkStopped=backgroundPixels();XCTAssertEqual(darkStopped,backgroundPixels(),"Paused dark scene must remain stable")
    openSettings(app,page:"theme");app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch.tap()
    app.buttons["theme-sheet-close"].tap()
    expectPausedScene(lightPaused,"Softened light flow restored paused")
    XCTAssertGreaterThan(marginBrightness(),lightBrightness-30,"Light theme must rebuild even with unchanged identity and palette")
    openSettings(app,page:"background");setSwitch(persistedPlayer,true)
    setSwitch(persistedGlobal,false)
    app.buttons["background-sheet-close"].tap()
    let restoredBase=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(redMinusBlue())<12},object:app);XCTAssertEqual(XCTWaiter.wait(for:[restoredBase],timeout:10),.completed)
    openSettings(app,page:"background");reveal(persistedPlayer);XCTAssertEqual(persistedPlayer.value as? String,"1","Global switch must preserve playback animation choice")
    setSwitch(persistedPlayer,false)
    openSettings(app,page:"sources");let remove=app.buttons["移除连接：fixture-theme"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:15),"Wait for Keychain and repository removal to finish")
    let cleared=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.buttons["打开播放页"])
    XCTAssertEqual(XCTWaiter.wait(for:[cleared],timeout:10),.completed,"Removing the active account must clear its mini entry")
    XCTAssertFalse(app.buttons["打开播放页"].exists)
  }
  func testBackgroundMotionSwitchRoundTrip() throws {
    let app=XCUIApplication();app.launch();openSettings(app,page:"background")
    let control=app.switches["visual-motion"],scroll=app.descendants(matching:.any).matching(identifier:"background-sheet-scroll").firstMatch
    for _ in 0..<16 {if control.isHittable{break};scroll.swipeUp()}
    XCTAssertTrue(control.isHittable)
    let initial=control.value as? String
    let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in control.isHittable && control.isEnabled},object:control)
    XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:10),.completed)
    control.coordinate(withNormalizedOffset:CGVector(dx:0.8,dy:0.5)).tap()
    let changed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"value != %@",initial ?? ""),object:control)
    XCTAssertEqual(XCTWaiter.wait(for:[changed],timeout:10),.completed)
    app.terminate();app.launch();openSettings(app,page:"background")
    for _ in 0..<16 {if control.isHittable{break};scroll.swipeUp()}
    XCTAssertNotEqual(control.value as? String,initial)
    control.coordinate(withNormalizedOffset:CGVector(dx:0.8,dy:0.5)).tap()
    let restored=XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@",initial ?? ""),object:control)
    XCTAssertEqual(XCTWaiter.wait(for:[restored],timeout:10),.completed)
  }
  func testDiscoverySongActions() throws {
    let app=XCUIApplication();app.launch()
    func tab(_ name:String){let item=app.descendants(matching:.any).matching(identifier:"tab-"+name).firstMatch;XCTAssertTrue(item.waitForExistence(timeout:15));item.tap()}
    func reach(_ element:XCUIElement){
      for _ in 0..<16 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY
        app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))}
      XCTAssertTrue(element.isHittable,"Expected visible control: \(element.identifier)")
    }
    func evidence(_ name:String){let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)}
    func detail(){let first=app.buttons["discovery-item-0"];XCTAssertTrue(first.waitForExistence(timeout:15));reach(first);first.tap();XCTAssertTrue(app.buttons["刷新歌单"].waitForExistence(timeout:10))}
    let more=app.buttons["更多操作：Synthetic discovery one"]
    let panel=app.otherElements["discovery-actions"].firstMatch
    func action(_ name:String)->XCUIElement{app.buttons["discovery-action-"+name]}
    func actions(){reach(more);more.tap();XCTAssertTrue(panel.waitForExistence(timeout:10));for name in ["下一首","加入队列","加入歌单"]{XCTAssertTrue(action(name).waitForExistence(timeout:10));XCTAssertTrue(action(name).isHittable)}}
    let name="Nexus discovery actions "+String(UUID().uuidString.prefix(8))
    tab("discover");detail()
    func control(_ query:String="") throws -> Int {
      let bytes=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/discovery-fixture-control"+(query.isEmpty ? "" : "?"+query))!)
      return (try JSONSerialization.jsonObject(with:bytes) as? [String:Int])?["held"] ?? -1
    }
    _=try control("holdNext=1");defer{_=try? control("release=1")}
    let importButton=app.buttons["导入完整歌单到音乐库"]
    reach(importButton);importButton.tap();XCTAssertTrue(app.buttons["取消读取"].waitForExistence(timeout:10))
    let held=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in (try? control())==1},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[held],timeout:10),.completed,"The original full-read request must be held before navigating")
    let back=app.buttons["返回歌单广场"];reach(back);back.tap();detail()
    XCTAssertTrue(importButton.waitForExistence(timeout:5),"Returning to detail must restore the full-read action after cancelling its previous request")
    guard importButton.exists else{throw NSError(domain:"Discovery cancelled read state",code:1)}
    XCTAssertTrue(importButton.isEnabled);XCTAssertFalse(app.buttons["取消读取"].exists)
    XCTAssertEqual(try control("release=1"),0);XCTAssertFalse(app.alerts["导入公开歌单"].exists,"A cancelled request must never present a late import confirmation")
    importButton.tap();XCTAssertTrue(app.alerts["导入公开歌单"].waitForExistence(timeout:10));app.alerts.buttons["取消"].tap();evidence("Discovery navigation cancels full read and allows a fresh import preview")
    reach(back);back.tap();let kuwo=app.descendants(matching:.any).matching(identifier:"酷我").firstMatch;reach(kuwo);kuwo.tap();detail()
    reach(importButton);importButton.tap()
    let incomplete=app.staticTexts["歌曲数量与平台声明不符，未导入不完整歌单"]
    XCTAssertTrue(incomplete.waitForExistence(timeout:10));XCTAssertFalse(app.alerts["导入公开歌单"].exists);XCTAssertTrue(importButton.isEnabled);XCTAssertTrue(more.exists == false)
    evidence("Truncated provider playlist stays visible and cannot present an import confirmation")
    _=try control("completePlaylist=1");importButton.tap();XCTAssertTrue(app.alerts["导入公开歌单"].waitForExistence(timeout:10));XCTAssertTrue(app.alerts.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","2 首")).firstMatch.exists);app.alerts.buttons["取消"].tap()
    // Original fixture uses the provider's real 100-item page boundary. Filter
    // the loaded rows so both pagination controls remain reachable on phones.
    _=try control("pager=1");let refresh=app.buttons["刷新歌单"];reach(refresh);refresh.tap()
    func count(_ value:String){XCTAssertTrue(app.staticTexts["酷我 · 已加载 "+value+" 首"].waitForExistence(timeout:10))}
    count("100 / 101")
    let filter=app.textFields["搜索已加载歌曲歌手专辑"];reach(filter);filter.tap();filter.typeText("Recovery marker\n")
    let markerOne=app.buttons.containing(NSPredicate(format:"label CONTAINS %@","Recovery marker one")).firstMatch
    let markerTwo=app.buttons.containing(NSPredicate(format:"label CONTAINS %@","Recovery marker two")).firstMatch
    let failure=app.staticTexts["此平台暂时无法读取，请重试或选择其他平台；已加载内容保留。"]
    let next=app.buttons["加载更多"],retry=app.buttons["重试"]
    _=try control("failNext=1");reach(next);next.tap();XCTAssertTrue(failure.waitForExistence(timeout:10));count("100 / 101");XCTAssertTrue(markerOne.exists);XCTAssertFalse(markerTwo.exists)
    evidence("Append failure preserves loaded count and filtered songs")
    reach(retry);retry.tap();count("101 / 101");XCTAssertTrue(markerTwo.waitForExistence(timeout:10));XCTAssertFalse(next.exists)
    XCTAssertEqual(filter.value as? String,"Recovery marker");evidence("Append retries the same page without duplicate rows")
    _=try control("failNext=1");reach(refresh);refresh.tap();XCTAssertTrue(failure.waitForExistence(timeout:10));count("101 / 101");XCTAssertTrue(markerOne.exists);XCTAssertTrue(markerTwo.exists);XCTAssertEqual(filter.value as? String,"Recovery marker")
    evidence("Refresh failure retains both loaded pages and the active filter")
    _=try control("replace=1");reach(retry);retry.tap();count("100 / 101");XCTAssertFalse(markerOne.exists);XCTAssertFalse(markerTwo.exists)
    let replacement=app.buttons.containing(NSPredicate(format:"label CONTAINS %@","Recovery marker replacement one")).firstMatch
    XCTAssertTrue(replacement.waitForExistence(timeout:10));XCTAssertEqual(filter.value as? String,"Recovery marker")
    reach(next);next.tap();count("101 / 101");XCTAssertTrue(app.buttons.containing(NSPredicate(format:"label CONTAINS %@","Recovery marker replacement two")).firstMatch.waitForExistence(timeout:10))
    evidence("Successful refresh replaces rows and resets the next page")
    reach(back);back.tap();let netease=app.descendants(matching:.any).matching(identifier:"网易").firstMatch;reach(netease);netease.tap();detail()
    reach(more);evidence("Discovery compact song rows");actions()
    XCTAssertTrue(action("本地收藏").exists);evidence("Embedded discovery song actions")
    action("本地收藏").tap();actions();XCTAssertTrue(action("取消本地收藏").waitForExistence(timeout:5));action("取消本地收藏").tap()
    actions();action("加入歌单").tap()
    let input=app.textFields["新建音枢歌单名称"];XCTAssertTrue(input.waitForExistence(timeout:10));XCTAssertTrue(input.isHittable)
    input.tap();for character in name{input.typeText(String(character))};input.typeText("\n");XCTAssertEqual(input.value as? String,name)
    evidence("Discovery action sheet creates a local playlist");app.buttons["新建并添加"].tap()
    XCTAssertTrue(more.waitForExistence(timeout:10));XCTAssertTrue(more.isHittable)
    func library(){tab("library");let local=app.descendants(matching:.any).matching(identifier:"library-local").firstMatch;reach(local);local.tap();let lists=app.buttons["我的歌单"];reach(lists);lists.tap()}
    library();let single=app.buttons[name+" · 1首"];XCTAssertTrue(single.waitForExistence(timeout:10));reach(single)
    tab("search");let discover=app.buttons["发现 · 分类 · 排行榜 · 歌单导入"];XCTAssertTrue(discover.waitForExistence(timeout:10));discover.tap();detail();actions();evidence("Full discovery modal owns its song action sheet")
    action("加入歌单").tap();XCTAssertTrue(app.buttons["取消添加"].waitForExistence(timeout:10));app.buttons["取消添加"].tap()
    XCTAssertTrue(more.waitForExistence(timeout:10));actions();action("加入歌单").tap()
    let existing=app.buttons[name+" · 1 首"];XCTAssertTrue(existing.waitForExistence(timeout:10));reach(existing);existing.tap()
    XCTAssertTrue(more.waitForExistence(timeout:10));let close=app.buttons["收起发现"];reach(close);close.tap()
    library();let duplicate=app.buttons[name+" · 2首"];XCTAssertTrue(duplicate.waitForExistence(timeout:10));reach(duplicate);evidence("Both discovery presentations preserve duplicate playlist entries");duplicate.tap()
    let delete=app.buttons["删除歌单"];reach(delete);delete.tap();app.alerts.buttons["删除"].tap()
    XCTAssertFalse(app.buttons[name+" · 2首"].exists)
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
    app.buttons["theme-sheet-close"].tap()
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
    var viewportID="settings-viewport-equalizer"
    func reveal(_ element:XCUIElement) {
      for _ in 0..<36 {
        let surface=app.descendants(matching:.any).matching(identifier:viewportID).firstMatch,viewport=surface.frame
        if element.exists && element.isHittable && element.frame.minY >= viewport.minY+8 && element.frame.maxY <= viewport.maxY-8 { return }
        let above=element.exists && element.frame.minY < viewport.minY+8
        // Stay in the scroll view's outer padding, outside curve/slider responders.
        surface.coordinate(withNormalizedOffset:CGVector(dx:0.99,dy:above ? 0.25 : 0.75)).press(forDuration:0.05,thenDragTo:surface.coordinate(withNormalizedOffset:CGVector(dx:0.99,dy:above ? 0.75 : 0.25)))
      }
      let failure=XCTAttachment(screenshot:app.screenshot());failure.name="EQ scroll reachability failure";failure.lifetime = .keepAlways;add(failure)
      XCTFail("Control not fully visible: \(element)\n\(app.debugDescription)")
    }
    let flat=app.buttons["eq-builtin-0"],bass=app.buttons["eq-builtin-1"];reveal(flat);flat.tap()
    XCTAssertTrue(flat.isSelected)
    XCTAssertEqual(flat.frame.minY,bass.frame.minY,accuracy:1,"Normal phone type size shows two preset cards per row")
    XCTAssertGreaterThanOrEqual(flat.frame.height,44)
    bass.tap();XCTAssertTrue(bass.isSelected);XCTAssertFalse(flat.isSelected)
    let cardsImage=XCTAttachment(screenshot:app.screenshot());cardsImage.name="EQ preset cards and selected bass";cardsImage.lifetime = .keepAlways;add(cardsImage)
    flat.tap();XCTAssertTrue(flat.isSelected);XCTAssertFalse(bass.isSelected)
    let empty=app.staticTexts["eq-custom-empty"];reveal(empty);XCTAssertTrue(empty.exists)
    let slider=app.descendants(matching:.any).matching(identifier:"eq-preamp-slider").firstMatch;reveal(slider)
    slider.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.1,thenDragTo:slider.coordinate(withNormalizedOffset:CGVector(dx:0.75,dy:0.5)))
    let value=app.staticTexts["eq-preamp-slider-value"];XCTAssertTrue(value.label.contains("+"));let savedValue=value.label
    reveal(flat);XCTAssertFalse(flat.isSelected,"Changing only preamp also clears preset selection")
    let curve=app.descendants(matching:.any).matching(identifier:"eq-curve").firstMatch;reveal(curve)
    curve.coordinate(withNormalizedOffset:CGVector(dx:0.45,dy:0.5)).press(forDuration:0.1,thenDragTo:curve.coordinate(withNormalizedOffset:CGVector(dx:0.45,dy:0.25)))
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.isSelected)
    let band=app.staticTexts["eq-band-slider-value"];XCTAssertNotEqual(band.label,"0.0 dB");let savedCurve=curve.value as? String;XCTAssertTrue(savedCurve?.contains("500 Hz "+band.label) == true)
    let name=app.textFields["eq-preset-name"];reveal(name)
    name.tap();for character in "Nexus EQ Test" {name.typeText(String(character))};name.typeText("\n")
    let save=app.buttons["eq-save-preset"];reveal(save);save.tap()
    XCTAssertTrue(app.buttons["Nexus EQ Test"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons["Nexus EQ Test"].isSelected);XCTAssertFalse(empty.exists)
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
    app.terminate();app.launch();openSettings(app,page:"equalizer")
    let preset=app.buttons["Nexus EQ Test"];reveal(preset);preset.tap()
    XCTAssertTrue(preset.isSelected)
    let enabled=app.switches["启用均衡器"];reveal(enabled);if enabled.value as? String != "1"{enabled.tap()};XCTAssertEqual(enabled.value as? String,"1")
    let zero=app.buttons["前级归零"];reveal(zero);zero.tap();XCTAssertEqual(value.label,"0.0 dB")
    reveal(curve);XCTAssertEqual(curve.value as? String,savedCurve,"Zeroing preamp must preserve every band")
    reveal(preset);XCTAssertFalse(preset.isSelected,"Actual preamp participates in selected state");preset.tap()
    reveal(enabled);enabled.tap();XCTAssertEqual(enabled.value as? String,"0")
    reveal(value);XCTAssertEqual(value.label,savedValue);reveal(curve);XCTAssertEqual(curve.value as? String,savedCurve,"Disabling preserves the configured curve")
    app.terminate();app.launch();openSettings(app,page:"equalizer")
    reveal(enabled);XCTAssertEqual(enabled.value as? String,"0","Bypass choice persists across restart")
    reveal(value);XCTAssertEqual(value.label,savedValue);reveal(curve);XCTAssertEqual(curve.value as? String,savedCurve)
    reveal(preset);XCTAssertTrue(preset.isSelected,"Disabled EQ still identifies its actual configured preset")
    reveal(enabled);enabled.tap();XCTAssertEqual(enabled.value as? String,"1")
    let reset=app.buttons["重置均衡器曲线"];reveal(reset);reset.tap();reveal(value);XCTAssertEqual(value.label,"0.0 dB")
    reveal(curve);let flatCurve=[31,62,125,250,500,1000,2000,4000,8000,16000].map{"\($0) Hz 0.0 dB"}.joined(separator:"，");XCTAssertEqual(curve.value as? String,flatCurve)
    reveal(flat);XCTAssertTrue(flat.isSelected);XCTAssertEqual(enabled.value as? String,"1","Reset preserves enabled choice")
    let resetImage=XCTAttachment(screenshot:app.screenshot());resetImage.name="EQ actual flat selection after independent zero and reset";resetImage.lifetime = .keepAlways;add(resetImage)
    reveal(preset);preset.tap()
    app.buttons["删除预设Nexus EQ Test"].tap();XCTAssertFalse(preset.exists)
    XCTAssertTrue(empty.exists)
    reveal(slider);XCTAssertEqual(value.label,savedValue)
    reveal(curve);XCTAssertEqual(curve.value as? String,savedCurve,"Every persisted EQ band must match after restart and preset restore")
    reveal(flat);flat.tap();reveal(value);XCTAssertEqual(value.label,"0.0 dB");reveal(enabled);enabled.tap();XCTAssertEqual(enabled.value as? String,"0")
    openSettings(app,page:"playback")
    viewportID="settings-viewport-playback"
    let timer=app.buttons["15分钟"];reveal(timer);timer.tap()
    XCTAssertTrue(app.staticTexts["sleep-status"].label.contains("剩余"))
    let cancel=app.buttons["取消睡眠定时"];reveal(cancel);cancel.tap();XCTAssertEqual(app.staticTexts["sleep-status"].label,"未开启")
  }
  func testPlayerStyleSheetWithLargeTextAndPersistence() throws {
    let app=XCUIApplication()
    app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch()
    func item(_ style:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:"player-layout-"+style).firstMatch}
    func reveal(_ element:XCUIElement){
      for _ in 0..<24 {if element.isHittable{break};if element.exists && element.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(element.isHittable)
    }
    openSettings(app,page:"skins");let initialClassic=item("classic");reveal(initialClassic);initialClassic.tap()
    openSettings(app,page:"appearance")
    let entry=app.buttons["settings-open-skins"]
    for _ in 0..<20 {if entry.isHittable{break};app.descendants(matching:.any).matching(identifier:"settings-viewport-appearance").firstMatch.swipeUp()}
    XCTAssertTrue(entry.isHittable);let entryY=entry.frame.midY;entry.tap()
    let close=app.buttons["skins-sheet-close"]
    XCTAssertTrue(close.waitForExistence(timeout:5));XCTAssertFalse(app.buttons["settings-open-background"].exists)
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"player-style-sheet").firstMatch.exists)
    let wave=item("wave");reveal(wave);XCTAssertTrue((wave.value as? String)?.contains("实时音频频谱环") == true);wave.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    XCTAssertEqual(entry.frame.midY,entryY,accuracy:2,"Saving a style must retain the underlying category scroll")
    entry.tap();reveal(wave);XCTAssertTrue(wave.isSelected)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Player style sheet at accessibility XXXL with persisted choice";image.lifetime = .keepAlways;add(image)
    let title=app.staticTexts["settings-title-skins"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    XCTAssertEqual(entry.frame.midY,entryY,accuracy:2);entry.tap();reveal(wave);XCTAssertTrue(wave.isSelected)
    close.tap();entry.tap();reveal(wave);XCTAssertTrue(wave.isSelected,"Closing without a choice must preserve the style");close.tap()
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(wave);XCTAssertTrue(wave.isSelected,"Restart must restore the saved layout")
    let stage=item("stage");reveal(stage);stage.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(stage);XCTAssertTrue(stage.isSelected,"Restart must restore the new stage layout too")
    let am2=item("am2");reveal(am2);am2.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(am2);XCTAssertTrue(am2.isSelected,"Restart must restore AM2 independently from AM")
    let classic=item("classic");reveal(classic);classic.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
  }
  func testBackgroundSheetWithLargeTextAndPersistence() throws {
    let app=XCUIApplication();app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"];app.launch()
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reveal(_ item:XCUIElement){
      let scroll=element("background-sheet-scroll")
      for _ in 0..<35 {
        if item.exists && item.isHittable && item.frame.minY>=scroll.frame.minY && item.frame.maxY<=scroll.frame.maxY{break}
        let above=item.exists && item.frame.midY<scroll.frame.midY
        scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.75:0.25)))
      };XCTAssertTrue(item.isHittable)
    }
    openSettings(app,page:"background")
    XCTAssertTrue(element("theme-background-sheet").exists);XCTAssertFalse(app.buttons["settings-open-globalFont"].exists)
    let soft=element("visual-soft");reveal(soft);soft.tap();XCTAssertTrue(soft.isSelected)
    let preview=element("visual-background-preview"),previewTitle=app.staticTexts["主题背景预览"].firstMatch,previewName=app.staticTexts["visual-background-name"].firstMatch
    reveal(previewTitle);XCTAssertGreaterThanOrEqual(previewTitle.frame.minY,preview.frame.minY);XCTAssertLessThanOrEqual(previewName.frame.maxY,preview.frame.maxY)
    let previewShot=XCTAttachment(screenshot:app.screenshot());previewShot.name="Theme background growing preview at accessibility XXXL";previewShot.lifetime = .keepAlways;add(previewShot)
    let image=app.buttons["visual-import-background"];reveal(image)
    let decrease=app.buttons["visual-backgroundOpacity-down"],increase=app.buttons["visual-backgroundOpacity-up"]
    reveal(decrease);let before=app.staticTexts["visual-value-backgroundOpacity"].label;decrease.tap()
    reveal(increase);XCTAssertLessThanOrEqual(increase.frame.maxX,element("background-sheet-scroll").frame.maxX);XCTAssertEqual(increase.frame.minX,decrease.frame.minX,accuracy:1);XCTAssertGreaterThan(increase.frame.minY,decrease.frame.minY)
    increase.tap();XCTAssertEqual(app.staticTexts["visual-value-backgroundOpacity"].label,before,"Both large-text controls remain reachable and persist actual edits")
    let shot=XCTAttachment(screenshot:app.screenshot());shot.name="Theme background sheet image controls at accessibility XXXL";shot.lifetime = .keepAlways;add(shot)
    let motion=app.switches["visual-motion"];reveal(motion)
    let bottom=XCTAttachment(screenshot:app.screenshot());bottom.name="Theme background independent motion controls at accessibility XXXL";bottom.lifetime = .keepAlways;add(bottom)
    app.buttons["background-sheet-close"].tap()
    let entry=app.buttons["settings-open-background"],entryY=app.buttons["settings-open-background"].frame.midY
    XCTAssertTrue(entry.isHittable);entry.tap();reveal(soft);XCTAssertTrue(soft.isSelected)
    let title=app.staticTexts["settings-title-background"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["background-sheet-close"]);waitForExpectations(timeout:10)
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists);XCTAssertEqual(entry.frame.midY,entryY,accuracy:2)
    app.terminate();app.launch();openSettings(app,page:"background");reveal(soft);XCTAssertTrue(soft.isSelected)
    let classic=element("visual-classic");reveal(classic);classic.tap();app.buttons["background-sheet-close"].tap()
  }
  func testFontAndDisplaySheetsWithLargeText() throws {
    let app=XCUIApplication();app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"];app.launch()
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reveal(_ item:XCUIElement,_ section:String){
      let scroll=element(section+"-sheet-scroll")
      for _ in 0..<30 {
        if item.exists && item.isHittable && item.frame.minY>=scroll.frame.minY && item.frame.maxY<=scroll.frame.maxY{break}
        let above=item.exists && item.frame.midY<scroll.frame.midY
        scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.75:0.25)))
      };XCTAssertTrue(item.isHittable)
    }
    func evidence(_ name:String){let image=XCTAttachment(screenshot:app.screenshot());image.name=name;image.lifetime = .keepAlways;add(image)}
    openSettings(app,page:"globalFont")
    XCTAssertTrue(element("global-font-sheet").exists);XCTAssertFalse(app.buttons["settings-open-background"].exists)
    reveal(app.buttons["font-global-system"],"globalFont");XCTAssertFalse(app.buttons["font-lyrics-inherit"].exists);XCTAssertFalse(app.buttons["lyric-style-reset"].exists)
    evidence("Global font sheet at accessibility XXXL")
    app.buttons["globalFont-sheet-close"].tap()
    let entry=app.buttons["settings-open-globalFont"],entryY=app.buttons["settings-open-globalFont"].frame.midY
    XCTAssertTrue(entry.isHittable);entry.tap()
    let lyric=app.buttons["font-open-lyric"];reveal(lyric,"globalFont");lyric.tap()
    XCTAssertTrue(element("lyric-font-sheet").exists);XCTAssertFalse(app.buttons["font-global-system"].exists)
    reveal(app.buttons["font-lyrics-inherit"],"lyricFont");evidence("Lyric font role at accessibility XXXL")
    let display=app.buttons["font-open-display"];reveal(display,"lyricFont");display.tap()
    XCTAssertTrue(element("lyric-display-sheet").exists);XCTAssertFalse(app.buttons["font-import"].exists)
    let reset=app.buttons["lyric-style-reset"];reveal(reset,"typography");reset.tap();evidence("Scrollable lyric display settings at accessibility XXXL")
    let title=app.staticTexts["settings-title-typography"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["typography-sheet-close"]);waitForExpectations(timeout:10)
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists);XCTAssertEqual(entry.frame.midY,entryY,accuracy:2)
    openSettings(app,page:"typography");XCTAssertTrue(element("lyric-display-sheet").exists)
    app.buttons["typography-sheet-close"].tap();XCTAssertTrue(app.staticTexts["settings-title-playback"].exists)
  }
  func testMiniAndNavigationSheetsWithLargeText() throws {
    let app=XCUIApplication()
    app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch();openSettings(app,page:"mini")
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reveal(_ item:XCUIElement){
      let scroll=element("mini-sheet-scroll")
      for _ in 0..<30 {
        if item.exists && item.isHittable && item.frame.minY>=scroll.frame.minY && item.frame.maxY<=scroll.frame.maxY{break}
        let above=item.exists && item.frame.midY<scroll.frame.midY
        scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.25:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:above ? 0.75:0.25)))
      }
      XCTAssertTrue(item.isHittable)
    }
    let close=app.buttons["mini-sheet-close"]
    XCTAssertTrue(element("mini-settings-sheet").exists);XCTAssertFalse(app.buttons["settings-open-background"].exists)
    let reset=app.buttons["mini-reset"];reveal(reset);reset.tap()
    let previous=element("mini-choice-previous");reveal(previous);previous.tap()
    XCTAssertEqual(app.staticTexts["mini-actions-count"].label,"已选 3/4")
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Mini controls sheet at accessibility XXXL";image.lifetime = .keepAlways;add(image)
    close.tap();XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    let entry=app.buttons["settings-open-mini"];XCTAssertTrue(entry.isHittable);let entryY=entry.frame.midY;entry.tap()
    XCTAssertEqual(app.staticTexts["mini-actions-count"].label,"已选 3/4","Reopening must restore the saved controls")
    let title=app.staticTexts["settings-title-mini"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    XCTAssertEqual(entry.frame.midY,entryY,accuracy:2,"Swipe dismissal must retain appearance scroll")
    app.terminate();app.launch();openSettings(app,page:"mini")
    XCTAssertEqual(app.staticTexts["mini-actions-count"].label,"已选 3/4","Mini controls must survive restart")
    reveal(reset);reset.tap();close.tap()
    openSettings(app,page:"navigation")
    XCTAssertTrue(element("navigation-style-sheet").exists);XCTAssertFalse(app.buttons["settings-open-background"].exists)
    let glass=app.switches["玻璃底栏"];XCTAssertTrue(glass.isHittable);let initial=glass.value as? String;glass.tap()
    let changed=initial=="1" ? "0":"1"
    expectation(for:NSPredicate(format:"value == %@",changed),evaluatedWith:glass);waitForExpectations(timeout:5)
    let navigationImage=XCTAttachment(screenshot:app.screenshot());navigationImage.name="Navigation style sheet at accessibility XXXL";navigationImage.lifetime = .keepAlways;add(navigationImage)
    app.buttons["navigation-sheet-close"].tap();openSettings(app,page:"navigation");XCTAssertEqual(glass.value as? String,changed)
    app.terminate();app.launch();openSettings(app,page:"navigation");XCTAssertEqual(glass.value as? String,changed,"Navigation preference must survive restart")
    glass.tap();app.buttons["navigation-sheet-close"].tap()
  }
  func testThemeSheetWithLargeTextAndSwipeDismissal() throws {
    let app=XCUIApplication()
    app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch();openSettings(app,page:"theme")
    let dark=app.descendants(matching:.any).matching(identifier:"theme-dark").firstMatch
    for _ in 0..<12 {if dark.isHittable{break};app.swipeUp()}
    XCTAssertTrue(dark.isHittable);dark.tap();XCTAssertTrue(dark.isSelected)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Theme sheet at accessibility XXXL";image.lifetime = .keepAlways;add(image)
    let title=app.staticTexts["settings-title-theme"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5))
      .press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    let close=app.buttons["theme-sheet-close"]
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:close);waitForExpectations(timeout:10)
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    openSettings(app,page:"theme");XCTAssertTrue(dark.isSelected,"Swipe dismissal must retain the selected mode")
    close.tap()
    openSettings(app,page:"theme");XCTAssertTrue(dark.isSelected,"Closing without another choice must preserve mode")
    let light=app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch
    for _ in 0..<12 {if light.isHittable{break};app.swipeDown()};light.tap();close.tap()
  }
  func testEQPresetCardsWithLargeText() throws {
    let app=XCUIApplication()
    app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch();openSettings(app,page:"equalizer")
    let flat=app.buttons["eq-builtin-0"],bass=app.buttons["eq-builtin-1"]
    for _ in 0..<60 {
      let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-equalizer").firstMatch.frame
      if flat.exists && flat.isHittable && flat.frame.minY>=viewport.minY+8 && flat.frame.maxY<=viewport.maxY-8 {break}
      let above=flat.exists && flat.frame.minY<viewport.minY+8
      app.coordinate(withNormalizedOffset:CGVector(dx:0.94,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.94,dy:above ? 0.60 : 0.40)))
    }
    XCTAssertTrue(flat.isHittable)
    XCTAssertEqual(flat.frame.minX,bass.frame.minX,accuracy:1,"Accessibility type sizes must stack preset cards")
    XCTAssertGreaterThan(bass.frame.minY,flat.frame.maxY)
    flat.tap();XCTAssertTrue(flat.isSelected)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="EQ single column at accessibility XXXL";image.lifetime = .keepAlways;add(image)
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
    app.buttons["theme-sheet-close"].tap()
    let settingsImage=XCTAttachment(screenshot:app.screenshot());settingsImage.lifetime = .keepAlways;add(settingsImage)
    app.terminate();app.launch()
    openSettings(app,page:"theme")
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch.isSelected,"Theme choice must persist after sheet close and relaunch")
    app.buttons["theme-sheet-close"].tap()
    openSettings(app,page:"accent")
    let restored=app.descendants(matching:.any).matching(identifier:"accent-blue").firstMatch
    for _ in 0..<14 {if restored.isHittable{break};app.swipeUp()}
    XCTAssertTrue(restored.isSelected)
    openSettings(app,page:"background")
    let pink=app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch
    for _ in 0..<3 {if pink.isHittable{break};app.swipeDown()};pink.tap()
    app.buttons["background-sheet-close"].tap()
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
    func expectImported(_ id:String){
      let name=app.staticTexts[id]
      let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","Nexus Visual Fixture.png"),object:name)
      let result=XCTWaiter.wait(for:[ready],timeout:20)
      if result != .completed {
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Visual import failure";image.lifetime = .keepAlways;add(image)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Visual import failure hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertEqual(result,.completed,"Image name must update after import; status: \(app.staticTexts["visual-status"].exists ? app.staticTexts["visual-status"].label : "no status")")
    }
    openSettings(app,page:"background")
    let imageBackground=app.descendants(matching:.any).matching(identifier:"background-image").firstMatch
    reveal(imageBackground);XCTAssertFalse(imageBackground.isEnabled,"Image background must stay unavailable until a theme image is imported")
    let background=app.buttons["visual-import-background"];reveal(background);importFixture("visual-import-background")
    expectImported("visual-background-name")
    let photo=app.buttons["visual-import-photo"];reveal(photo);importFixture("visual-import-photo")
    expectImported("visual-photo-name")
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
