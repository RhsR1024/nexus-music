import XCTest
import UIKit
import Vision

final class SourceSettingsTests: XCTestCase {
  override func setUpWithError() throws {continueAfterFailure=false}
  private func waitForHittable(_ element:XCUIElement,timeout:TimeInterval)->Bool{
    let deadline=Date().addingTimeInterval(timeout)
    repeat{
      if element.exists{
        let frame=element.frame
        // RN can temporarily publish hidden tabs as {{inf, inf}, {0, 0}}.
        // Asking XCTest for hittability in that state raises a test failure
        // instead of returning false, so wait for a finite frame first.
        if !frame.isNull && !frame.isInfinite && !frame.isEmpty && frame.width>1 && frame.height>1 && element.isHittable{return true}
      }
      RunLoop.current.run(until:Date().addingTimeInterval(0.1))
    }while Date()<deadline
    return false
  }
  private func waitForGone(_ element:XCUIElement,timeout:TimeInterval)->Bool{
    let gone=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:element)
    return XCTWaiter.wait(for:[gone],timeout:timeout) == .completed
  }
  private func openSettings(_ app:XCUIApplication,page:String){
    for id in ["background-sheet-close","theme-sheet-close","skins-sheet-close","mini-sheet-close","navigation-sheet-close","typography-sheet-close","globalFont-sheet-close","lyricFont-sheet-close"]{
      let close=app.buttons[id]
      if waitForHittable(close,timeout:0.2){close.tap();_ = waitForGone(close,timeout:5)}
    }
    let rail=app.descendants(matching:.any).matching(identifier:"rail-tab-settings").firstMatch
    let tab=rail.exists ? rail : app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch
    XCTAssertTrue(tab.waitForExistence(timeout:15))
    if !waitForHittable(tab,timeout:1){
      // A previous test can leave the full-screen player above the tab shell.
      // Close only the actual player control, then require the shell to become
      // reachable; this preserves the page under test and does not skip a step.
      let closePlayer=app.buttons["收起播放页"].firstMatch
      if waitForHittable(closePlayer,timeout:1){closePlayer.tap()}
    }
    XCTAssertTrue(waitForHittable(tab,timeout:10),"Settings tab must be reachable after closing any presented player")
    tab.tap()
    // A synthesized first tap can leave the tab unselected. Confirm the actual
    // selection before looking for a page; retry only this same visible control.
    func selected()->Bool{let end=Date().addingTimeInterval(2);repeat{if tab.isSelected{return true};RunLoop.current.run(until:Date().addingTimeInterval(0.1))}while Date()<end;return tab.isSelected}
    if !selected() {XCTContext.runActivity(named:"Settings tab remained unselected; repeat its visible control"){_ in XCTAssertTrue(tab.isHittable);tab.tap()}}
    XCTAssertTrue(selected(),"Settings tab must actually become selected")
    for _ in 0..<3 {let back=app.buttons["settings-back"];if !waitForHittable(back,timeout:0.2){break};back.tap()}
    var settingsPage="home"
    let sheetIDs=["background":"theme-background-sheet","theme":"theme-mode-sheet","skins":"player-style-sheet","mini":"mini-settings-sheet","navigation":"navigation-style-sheet","globalFont":"global-font-sheet","lyricFont":"lyric-font-sheet"]
    func pageIsOpen(_ target:String)->Bool{
      let deadline=Date().addingTimeInterval(5)
      repeat{
        if app.staticTexts["settings-title-"+target].exists{return true}
        if let sheetID=sheetIDs[target]{
          let sheet=app.descendants(matching:.any).matching(identifier:sheetID).firstMatch
          let scroll=app.descendants(matching:.any).matching(identifier:target+"-sheet-scroll").firstMatch
          if sheet.exists&&scroll.exists{return true}
        }
        RunLoop.current.run(until:Date().addingTimeInterval(0.1))
      }while Date()<deadline
      return false
    }
    func enter(_ target:String){
      let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-"+settingsPage).firstMatch
      let viewportReady=viewport.waitForExistence(timeout:5)
      if !viewportReady {
        let screen=XCTAttachment(screenshot:XCUIScreen.main.screenshot());screen.name="Settings navigation viewport failure";screen.lifetime = .keepAlways;add(screen)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Settings navigation viewport failure accessibility";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertTrue(viewportReady,"The actual settings viewport must be available before selecting its row")
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
      XCTAssertTrue(row.isHittable,"Settings row must be reachable: \(target), frame: \(row.frame)");row.tap();XCTAssertTrue(pageIsOpen(target),"Settings page or presented sheet must become active: \(target)");settingsPage=target
    }
    let appearancePages=["theme","background","skins","accent","navigation","mini","globalFont","lyricFont"]
    enter(page=="typography" || page=="equalizer" ? "playback" : appearancePages.contains(page) ? "appearance" : page)
    if page=="typography" || page=="equalizer"{enter(page)}else if appearancePages.contains(page){enter(page)}
  }
  private func openPhotoLyricSource(_ app:XCUIApplication){
    // IMG_4868 has no inline diagnostic row; the source entry lives in the
    // shared lyric settings panel, which the ellipsis menu opens.
    app.buttons["更多播放控制"].tap()
    XCTAssertTrue(app.buttons["歌词显示设置"].firstMatch.waitForExistence(timeout:5))
    app.buttons["歌词显示设置"].firstMatch.tap()
    XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.waitForExistence(timeout:5),"Photo lyric selection must remain reachable from the lyrics settings panel")
    app.buttons["收起歌词显示设置"].firstMatch.tap()
    XCTAssertTrue(app.buttons["收起播放选项"].firstMatch.waitForExistence(timeout:5))
    app.buttons["收起播放选项"].firstMatch.tap()
  }
  private func replaceText(_ field:XCUIElement,with value:String,in app:XCUIApplication){
    field.tap();field.press(forDuration:1.1)
    let selectAll=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Select All","全选","全選"])).firstMatch
    XCTAssertTrue(selectAll.waitForExistence(timeout:5),"Replace the full field using the actual selection menu, independent of its insertion point")
    selectAll.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    XCTAssertEqual(field.value as? String,value)
  }
  private func selectClassicSourcePlayback(in app:XCUIApplication) {
    // Source playback assertions use the classic page's PCM and queue controls.
    // Stage/window tests persist their layout, including across app launches.
    openSettings(app,page:"skins")
    let classic=app.descendants(matching:.any).matching(identifier:"player-layout-classic").firstMatch
    XCTAssertTrue(classic.waitForExistence(timeout:5))
    let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-skins").firstMatch
    for _ in 0..<12 {
      if classic.isHittable{break}
      viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.25)).press(forDuration:0.05,thenDragTo:viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.75)))
    }
    XCTAssertTrue(classic.isHittable);classic.tap()
    let dismissed=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !app.buttons["skins-sheet-close"].exists},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[dismissed],timeout:10),.completed,"Persist the source test's classic layout before playback")
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
  private func selectLocalFixture(_ prefix:String,in app:XCUIApplication,folderName:String="Nexus UITest Fixtures"){
    // iOS 27 Files is a remote accessibility subtree. Reading `.frame` on an
    // element that the provider refreshes between `exists` and the frame query
    // raises kAXErrorInvalidUIElement and aborts the test, so navigate by
    // existence and tap the cells directly.
    let fileCell=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@",prefix)).firstMatch
    let folderCell=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@",folderName)).firstMatch
    let fileRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT (identifier BEGINSWITH %@)",prefix,"local-track-")).firstMatch
    // The navigation title also begins with the folder name; its Actions
    // Menu opens a context menu, not the directory (cloud failure evidence).
    let folderRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT (label CONTAINS[c] %@) AND NOT (label CONTAINS %@)",folderName,"Actions Menu","操作菜单")).firstMatch
    let fixtureRoot=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: \(folderName)")).firstMatch
    let locations=NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])
    func settle(){RunLoop.current.run(until:Date().addingTimeInterval(2))}
    let cancel=app.buttons.matching(NSPredicate(format:"label IN %@",["取消","Cancel","取消選取"])).firstMatch
    // iOS 27 can present the full document manager without a Cancel button.
    // Readiness still requires the actual Files subtree or the target file row.
    let filesRoot=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source: com.apple.FileProvider")).firstMatch
    let presented=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in cancel.exists || filesRoot.exists || fileCell.exists || fileRow.exists},object:nil)
    guard XCTWaiter.wait(for:[presented],timeout:30) == .completed else{
      let image=XCTAttachment(screenshot:XCUIScreen.main.screenshot());image.name="Files presentation unavailable";image.lifetime = .keepAlways;add(image)
      let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Files presentation hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      XCTFail("Files picker must be presented before navigation");return
    }
    settle()
    func confirmSelection(){
      let open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","開啟"])).firstMatch
      if open.waitForExistence(timeout:3){open.tap()}
    }
    for _ in 0..<18 {
      if fileCell.exists{fileCell.tap();confirmSelection();return}
      if folderCell.exists{folderCell.tap();settle();continue}
      if fileRow.exists{fileRow.tap();confirmSelection();return}
      // Once inside, allow provider enumeration without reopening the title
      // menu or navigating back out to the location list.
      if fixtureRoot.exists{settle();continue}
      if folderRow.exists{folderRow.tap();settle();continue}
      // Files labels its back button with the previous location. Never accept
      // a Button here or navigation moves backwards instead of to On My iPhone.
      let phone=app.cells.matching(locations).allElementsBoundByIndex.first{$0.exists}
      if let phone{phone.tap();settle();continue}
      let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse","瀏覽"])).firstMatch
      if browse.exists && browse.isHittable{browse.tap()}
      settle()
    }
    // The local FileProvider can take tens of seconds to enumerate a directory
    // that was recreated by the test harness; a re-seeded file restarts that
    // enumeration, so poll in several rounds instead of one wait. Grid view
    // defers the cell's AX element behind a hung thumbnail request, so return
    // to the list view (its toggle is named after the CURRENT mode) first.
    let fileIdCell=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","\(prefix),")).firstMatch
    let gridToggle=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.itemCollectionMenuButton.图标")).firstMatch
    if gridToggle.exists && gridToggle.isHittable{
      gridToggle.tap()
      let listMode=app.buttons.matching(NSPredicate(format:"label IN %@",["列表","List"])).firstMatch
      if listMode.waitForExistence(timeout:5){listMode.tap()}
      settle()
    }
    // The Files remote AX view can enumerate the cell in debugDescription
    // while `exists` keeps returning false for the same query (observed on
    // iOS 26.3.1 with a freshly re-seeded directory). As a last resort,
    // parse the cell's frame out of the hierarchy snapshot and tap its
    // center — the fixture directory holds exactly this one file.
    var selected=false
    for _ in 0..<4 {
      if fileCell.waitForExistence(timeout:30){fileCell.tap();selected=true;break}
      if fileIdCell.waitForExistence(timeout:10){fileIdCell.tap();selected=true;break}
      if fileRow.waitForExistence(timeout:5){fileRow.tap();selected=true;break}
      let tree=app.debugDescription
      let snapshot=XCTAttachment(string:tree);snapshot.name="Files fixture poll";snapshot.lifetime = .keepAlways;add(snapshot)
      if let range=tree.range(of:"\\{\\{([\\d.\\-]+), ([\\d.\\-]+)\\}, \\{([\\d.\\-]+), ([\\d.\\-]+)\\}\\}, identifier: '\(prefix)",options:.regularExpression){
        let frameText=String(tree[range]),expression=try! NSRegularExpression(pattern:"[-\\d.]+")
        let numbers=expression.matches(in:frameText,range:NSRange(frameText.startIndex...,in:frameText)).compactMap{match in
          Range(match.range,in:frameText).flatMap{Double(frameText[$0])}
        }
        if numbers.count>=4{
          let x=numbers[0]+numbers[2]/2,y=numbers[1]+numbers[3]/2
          app.coordinate(withNormalizedOffset:CGVector(dx:x/app.frame.width,dy:y/app.frame.height)).tap()
          selected=true;break
        }
      }
      settle()
    }
    if !selected{
      let image=XCTAttachment(screenshot:app.screenshot());image.name="Files fixture row unreachable";image.lifetime = .keepAlways;add(image)
      let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Files fixture hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      XCTFail("The actual Files cell/row must be visible before selection")
      return
    }
    confirmSelection()
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
    func control(_ block:Bool?=nil,pauseWindow:Bool?=nil) throws -> [String:Int] {
      var query:[String]=[]
      if let block {query.append("block=\(block ? 1 : 0)")}
      if let pauseWindow {query.append("pauseWindow=\(pauseWindow ? 1 : 0)")}
      let done=expectation(description:"Read isolated fixture counters"),path="http://127.0.0.1:18439/offline-fixture-control"+(query.isEmpty ? "" : "?"+query.joined(separator:"&"))
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
    let fixtureRemoval=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@ AND label IN %@","offline-remove-",["删除离线文件：Synthetic tone · Fixture artist","移除记录：Synthetic tone · Fixture artist","取消任务：Synthetic tone · Fixture artist"])).firstMatch
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
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15));let save=app.buttons["保存离线"];reveal(save);_=try control(pauseWindow:true);save.tap()
    let pause=app.buttons["暂停"].firstMatch;reveal(pause);pause.tap();let close=app.buttons["收起播放页"];reveal(close);close.tap()
    openSettings(app,page:"downloads")
    let limit=app.descendants(matching:.any).matching(identifier:"offline-limit-1024").firstMatch;reveal(limit);limit.tap()
    let tasks=app.buttons["settings-open-downloadTasks"];reveal(tasks);tasks.tap()
    XCTAssertTrue(app.staticTexts["settings-title-downloadTasks"].waitForExistence(timeout:5));XCTAssertTrue(app.staticTexts["offline-section-pending"].exists)
    let pauseDownload=app.buttons["暂停下载"];XCTAssertTrue(pauseDownload.waitForExistence(timeout:10));reveal(pauseDownload);pauseDownload.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已暂停 · ")).firstMatch.waitForExistence(timeout:15))
    let held=try control();XCTAssertGreaterThanOrEqual(held["heldFull"] ?? 0,1,"The server must hold a real partial download before pause")
    let paused=XCTAttachment(screenshot:app.screenshot());paused.name="Download task paused with partial file";paused.lifetime = .keepAlways;add(paused)
    app.terminate();app.launch();openSettings(app,page:"downloads")
    let capacity=app.staticTexts["offline-capacity-summary"];XCTAssertTrue(capacity.waitForExistence(timeout:10));XCTAssertTrue(capacity.label.hasSuffix(" / 1024 MB"), "Download capacity must persist after restart")
    reveal(tasks);tasks.tap();XCTAssertTrue(app.buttons["继续下载"].waitForExistence(timeout:10),"Explicit pause must survive process restart")
    _=try control(pauseWindow:false)
    app.buttons["全部继续"].tap()
    let playSaved=app.buttons["播放离线文件"];XCTAssertTrue(playSaved.waitForExistence(timeout:70));reveal(playSaved)
    let counters=try control();XCTAssertGreaterThanOrEqual(counters["full"] ?? 0,1);XCTAssertGreaterThanOrEqual(counters["resumed"] ?? 0,1,"Resume must issue an actual conditional Range request")
    let completed=XCTAttachment(screenshot:app.screenshot());completed.name="Completed offline file after conditional Range resume";completed.lifetime = .keepAlways;add(completed)
    _=try control(true);app.terminate();app.launch()
    openSettings(app,page:"storage");let clear=app.buttons["清理临时音频、封面和歌词缓存"];reveal(clear);clear.tap();let clearAlert=app.alerts["清理临时缓存？"];XCTAssertTrue(clearAlert.waitForExistence(timeout:5));clearAlert.buttons["清理"].tap()
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
    XCTAssertTrue(waitForGone(app.buttons["skins-sheet-close"],timeout:10),"Wave selection must finish dismissing before source navigation")
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
    app.buttons["更多播放控制"].tap()
    XCTAssertTrue(app.buttons["播放界面样式"].waitForExistence(timeout:5))
    app.buttons["播放界面样式"].tap()
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
  func testSearchHistoryAndStates() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    let clearHistory=app.buttons["search-history-clear"]
    if clearHistory.exists {clearHistory.tap();XCTAssertTrue(clearHistory.waitForNonExistence(timeout:5))}
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();query.typeText("Fixture song\n")
    XCTAssertTrue(app.buttons["search-track-wy-0"].waitForExistence(timeout:15))
    XCTAssertTrue(app.staticTexts["search-end-wy"].waitForExistence(timeout:10),"A terminal result set must say there is no more content")
    let clear=app.buttons["search-clear"];XCTAssertTrue(clear.isHittable);clear.tap()
    let history=app.buttons["search-history-0"];XCTAssertTrue(history.waitForExistence(timeout:5))
    XCTAssertEqual(history.label,"搜索历史：Fixture song")
    query.tap();query.typeText("Fixt")
    let suggestion=app.buttons["search-suggestion-0"];XCTAssertTrue(suggestion.waitForExistence(timeout:5))
    XCTAssertEqual(suggestion.label,"搜索建议：Fixture song")
    suggestion.tap()
    XCTAssertEqual(query.value as? String,"Fixture song")
    XCTAssertTrue(app.buttons["search-track-wy-0"].waitForExistence(timeout:15))
    app.buttons["search-clear"].tap()
    XCTAssertTrue(app.buttons["search-history-0"].waitForExistence(timeout:5))
    app.buttons["search-history-clear"].tap()
    XCTAssertTrue(app.buttons["search-history-0"].waitForNonExistence(timeout:5))
    XCTAssertTrue(app.staticTexts["输入歌曲、歌手或专辑名开始搜索。"].exists)
  }
  func testPublicComments() throws {
    XCUIDevice.shared.orientation = .portrait
    defer { XCUIDevice.shared.orientation = .portrait }
    let app=XCUIApplication();app.launch();XCTAssertFalse(app.buttons["暂停"].exists)
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];for _ in 0..<8 {if query.isHittable{break};app.swipeUp()};let diagnostic=XCTAttachment(screenshot:app.screenshot());diagnostic.name="Search menu entry";diagnostic.lifetime = .keepAlways;add(diagnostic)
    XCTAssertTrue(query.isHittable)
    query.tap();query.typeText("fixture");query.typeText("\n");app.buttons["搜索"].firstMatch.tap()
    let song=app.buttons["search-track-wy-0"];XCTAssertTrue(song.waitForExistence(timeout:15))
    let actions=app.buttons["search-more-wy-0"]
    for _ in 0..<6 {if actions.isHittable{break};app.swipeUp()}
    XCTAssertTrue(actions.isHittable);actions.tap()
    XCTAssertTrue(app.buttons["search-action-加入歌单"].waitForExistence(timeout:5))
    let menuImage=XCTAttachment(screenshot:app.screenshot());menuImage.name="Search shared song actions";menuImage.lifetime = .keepAlways;add(menuImage)
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
  func testNeteaseLoginLauncherCancellation() throws {
    let app=XCUIApplication();app.launch()
    openSettings(app,page:"accounts")
    let login=app.buttons["login-music-account-wy"]
    XCTAssertTrue(login.waitForExistence(timeout:10));XCTAssertTrue(login.isHittable);login.tap()
    let navigation=app.navigationBars["网易云登录"]
    XCTAssertTrue(navigation.waitForExistence(timeout:10),"The official NetEase login page must open in the native WebKit sheet")
    let close=navigation.buttons["关闭"]
    XCTAssertTrue(close.waitForExistence(timeout:5));close.tap()
    XCTAssertTrue(app.staticTexts["登录已取消"].waitForExistence(timeout:10))
    XCTAssertFalse(navigation.exists)
  }
  func testLiveAccountPlaylistEntry() throws { try liveAccountPlaylistEntry(provider:"wy") }
  func testLiveAccountAlbumEntry() throws { try liveAccountPlaylistEntry(provider:"wy",albums:true) }
  func testLiveAccountMVEntry() throws { try liveAccountPlaylistEntry(provider:"wy",mvs:true) }
  func testLiveQQPlaylistEntry() throws { try liveAccountPlaylistEntry(provider:"tx") }
  func testLiveKugouPlaylistEntry() throws { try liveAccountPlaylistEntry(provider:"kg") }
  func testLiveKugouQrPhotoDenied() throws { try liveAccountPlaylistEntry(provider:"kg",photoMode:"deny") }
  func testLiveKugouQrPhotoSave() throws { try liveAccountPlaylistEntry(provider:"kg",photoMode:"allow") }
  private func liveAccountPlaylistEntry(provider:String,photoMode:String?=nil,albums:Bool=false,mvs:Bool=false) throws {
    let qq=provider=="tx",kg=provider=="kg"
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){
      let scroll=app.descendants(matching:.any).matching(identifier:"settings-scroll-accounts").firstMatch
      for _ in 0..<16 {
        var rect=scroll.frame.intersection(app.frame)
        let mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
        if mini.exists{rect.size.height=max(0,min(rect.maxY,mini.frame.minY-8)-rect.minY)}
        if element.exists&&element.isHittable&&element.frame.minY>=rect.minY+4&&element.frame.maxY<=rect.maxY-4{return}
        XCTAssertGreaterThan(rect.height,100)
        let above=element.exists&&element.frame.minY<rect.minY,origin=app.coordinate(withNormalizedOffset:.zero)
        let x=rect.maxX-12,high=rect.minY+rect.height*0.3,low=rect.minY+rect.height*0.7
        origin.withOffset(CGVector(dx:x-app.frame.minX,dy:(above ? high:low)-app.frame.minY)).press(forDuration:0.05,thenDragTo:origin.withOffset(CGVector(dx:x-app.frame.minX,dy:(above ? low:high)-app.frame.minY)))
      }
      XCTAssertTrue(element.isHittable)
      let rect=scroll.frame.intersection(app.frame),mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
      XCTAssertGreaterThanOrEqual(element.frame.minY,rect.minY+4)
      XCTAssertLessThanOrEqual(element.frame.maxY,mini.exists ? min(rect.maxY,mini.frame.minY-8)-4:rect.maxY-4)
    }
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    openSettings(app,page:"accounts")
    let suffix=provider=="wy" ? "":"-"+provider,platform=qq ? "QQ":kg ? "Kugou":mvs ? "NetEase MV":albums ? "NetEase album":"NetEase"
    let prefix=mvs ? "account-mvs":albums ? "account-albums":"account-playlists"+suffix
    let login=app.buttons[prefix+"-login"],required=app.staticTexts[prefix+"-login-required"],load=app.buttons[prefix+"-load"]
    reach(login);XCTAssertTrue(required.exists);XCTAssertFalse(load.exists);image("Real \(platform) playlist entry without a saved account")
    login.tap()
    if kg {
      let qr=app.images["kugou-login-qr"]
      XCTAssertTrue(app.staticTexts["kugou-login-waiting"].waitForExistence(timeout:25));XCTAssertTrue(qr.waitForExistence(timeout:10));reach(qr)
      XCTAssertEqual(qr.frame.width,240,accuracy:1);XCTAssertEqual(qr.frame.height,240,accuracy:1)
      image("Real Kugou official QR opened from playlist entry")
      if let photoMode {
        let save=app.buttons["kugou-login-save-photo"];reach(save);save.tap()
        let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard"),alert=springboard.alerts.firstMatch
        guard alert.waitForExistence(timeout:15) else { XCTFail("Saving must request actual add-only permission on its first use"); return }
        let details=XCTAttachment(string:springboard.debugDescription);details.name="Actual add-only Photos permission controls";details.lifetime = .keepAlways;add(details)
        XCTAssertTrue(alert.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@ OR label CONTAINS %@","add","添加")).firstMatch.exists,"The system request must describe adding photos")
        image("Real add-only Photos permission request")
        let pattern=photoMode=="deny" ? "^(Don.t Allow|不允许)$":"(?i)^(allow.*(add|added).*|.*add.*only|允许.*添加.*|只添加.*|允许|allow|好|ok)$"
        let response=alert.buttons.matching(NSPredicate(format:"label MATCHES %@",pattern)).firstMatch
        guard response.waitForExistence(timeout:5) else { XCTFail("Actual permission response must be identified"); return };response.tap()
        let status=app.staticTexts[photoMode=="deny" ? "kugou-qr-photo-denied":"kugou-qr-photo-saved"]
        XCTAssertTrue(status.waitForExistence(timeout:25));XCTAssertTrue(qr.exists,"Permission alert inactivity must not cancel the login")
        reach(status);image(photoMode=="deny" ? "Real QR photo permission denied without saving":"Real QR photo saved with add-only permission")
        if photoMode=="allow" {
          XCUIDevice.shared.press(.home);RunLoop.current.run(until:Date().addingTimeInterval(2));app.activate()
          XCTAssertTrue(qr.waitForExistence(timeout:10));XCTAssertFalse(app.staticTexts["kugou-login-cancelled"].exists)
          reach(qr);image("Real saved QR handoff survives background and foreground")
        }
      }
      let cancel=app.buttons["cancel-music-login-kg"];reach(cancel);cancel.tap()
      XCTAssertTrue(app.staticTexts["kugou-login-cancelled"].waitForExistence(timeout:10));XCTAssertTrue(waitForGone(qr,timeout:10))
      reach(login);XCTAssertTrue(required.exists);XCTAssertFalse(load.exists)
      image("Real Kugou playlist entry after QR cancellation")
    } else {
      let bar=app.navigationBars[qq ? "QQ 音乐登录":"网易云登录"];XCTAssertTrue(bar.waitForExistence(timeout:20))
    let loaded=waitForGone(app.activityIndicators[qq ? "music-web-login-loading-tx":"music-web-login-loading-wy"],timeout:45)
    if !loaded {
      let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual \(platform) loading failure hierarchy";tree.lifetime = .keepAlways;add(tree)
      image("Actual \(platform) document while loading indicator remains")
    }
    XCTAssertTrue(loaded)
    let web=app.webViews.firstMatch;XCTAssertTrue(web.waitForExistence(timeout:15))
    XCTAssertTrue(web.descendants(matching:.any).matching(NSPredicate(format:"label MATCHES %@",qq ? ".*(QQ|帐号|账号|授权|登录|Login).*":".*(网易|云音乐|登录|手机号|扫码).*" )).firstMatch.waitForExistence(timeout:35))
    image("Real official \(platform) page opened from account playlist entry")
    bar.buttons["关闭"].tap();XCTAssertTrue(waitForGone(bar,timeout:15));reach(login);XCTAssertTrue(required.exists);XCTAssertFalse(load.exists)
    }
    app.terminate();app.launch();openSettings(app,page:"accounts");reach(login);XCTAssertTrue(required.exists);XCTAssertFalse(load.exists);XCTAssertFalse(app.buttons[kg ? "remove-music-account-kg":qq ? "verify-music-account-tx":"verify-music-account-wy"].exists);image("Real \(platform) playlist remains unauthenticated after cancellation and restart")
  }
  func testLiveQQWebLogin() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){
      XCTAssertTrue(element.waitForExistence(timeout:15))
      for _ in 0..<8 {if waitForHittable(element,timeout:0.3){return};app.swipeUp()}
      XCTAssertTrue(waitForHittable(element,timeout:5))
    }
    openSettings(app,page:"accounts")
    let qq=app.buttons["login-music-account-tx"]
    reach(qq);image("Real QQ official account entry with public audio library")
    qq.tap()
    let navigation=app.navigationBars["QQ 音乐登录"]
    XCTAssertTrue(navigation.waitForExistence(timeout:20))
    XCTAssertTrue(waitForGone(app.activityIndicators["music-web-login-loading-tx"],timeout:40),"Wait for the official document to finish loading before exercising its form")
    let web=app.webViews.firstMatch
    XCTAssertTrue(web.waitForExistence(timeout:15))
    let officialContent=web.descendants(matching:.any).matching(NSPredicate(format:"label MATCHES %@",".*(QQ|帐号|账号|授权|登录|Login).*" )).firstMatch
    XCTAssertTrue(officialContent.waitForExistence(timeout:35),"The actual official login page must render; a native window alone is insufficient")
    let passwordMode=web.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["账号密码登录","帐号密码登录","密码登录"])).firstMatch
    if passwordMode.waitForExistence(timeout:10){XCTAssertTrue(waitForHittable(passwordMode,timeout:5));passwordMode.tap()}
    XCTAssertTrue(web.secureTextFields.firstMatch.waitForExistence(timeout:20),"A usable official password form must be reachable without QQ-app launch")
    XCTAssertTrue(web.textFields.firstMatch.exists,"The official account field must be present")
    image("Real QQ official web page without credentials")
    let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Real QQ official page accessibility";hierarchy.lifetime = .keepAlways;add(hierarchy)
    let oldErrors=web.staticTexts.allElementsBoundByIndex.map(\.label).filter{$0.contains("输入")&&($0.contains("帐号")||$0.contains("账号"))}
    let submit=web.buttons["登录"].firstMatch
    XCTAssertTrue(waitForHittable(submit,timeout:10));submit.tap()
    let emptyPrompt=web.staticTexts.matching(NSPredicate(format:"label MATCHES %@","^你还没有输入[帐账]号[！!]$")).firstMatch
    let emptyAccount=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      emptyPrompt.exists && self.waitForHittable(emptyPrompt,timeout:0.2)
    },object:nil)
    let emptyResult=XCTWaiter.wait(for:[emptyAccount],timeout:15)
    let observedErrors=web.staticTexts.allElementsBoundByIndex.map(\.label).filter{$0.contains("输入")&&($0.contains("帐号")||$0.contains("账号"))}
    let promptState=XCTAttachment(string:"Before submission: \(oldErrors)\nAfter submission: \(observedErrors)");promptState.name="Real QQ empty account prompt observations";promptState.lifetime = .keepAlways;add(promptState)
    if emptyResult != .completed {
      image("Real QQ empty account assertion failure")
      let failed=XCTAttachment(string:app.debugDescription);failed.name="Real QQ empty account failure accessibility";failed.lifetime = .keepAlways;add(failed)
    }
    XCTAssertEqual(emptyResult,.completed,"The real official form must visibly reject an empty account without sending private credentials")
    image("Real QQ official empty account validation")
    navigation.buttons["关闭"].tap()
    XCTAssertTrue(waitForGone(navigation,timeout:10))
    XCTAssertTrue(app.staticTexts["登录已取消"].waitForExistence(timeout:10))
    reach(qq);image("Real QQ login cancelled without account")
    qq.tap();XCTAssertTrue(navigation.waitForExistence(timeout:15));navigation.buttons["关闭"].tap()
    XCTAssertTrue(waitForGone(navigation,timeout:10))
    app.terminate();app.launch();openSettings(app,page:"accounts");reach(qq)
    XCTAssertFalse(app.buttons["verify-music-account-tx"].exists,"An anonymous or cancelled login must not create an account")
    image("Real QQ cancelled login remains logged out after restart")
    let netease=app.buttons["login-music-account-wy"]
    for _ in 0..<8 {if waitForHittable(netease,timeout:0.3){break};app.swipeDown()}
    XCTAssertTrue(waitForHittable(netease,timeout:5));netease.tap()
    let wyNavigation=app.navigationBars["网易云登录"]
    XCTAssertTrue(wyNavigation.waitForExistence(timeout:15));wyNavigation.buttons["关闭"].tap()
    XCTAssertTrue(waitForGone(wyNavigation,timeout:10))
    XCTAssertFalse(app.buttons["暂停"].exists,"Account entry and cancellation must preserve the paused real-audio playback intent")
  }
  func testLiveKugouQrLogin() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch();app.activate()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){
      XCTAssertTrue(element.waitForExistence(timeout:15))
      for _ in 0..<10 {if waitForHittable(element,timeout:0.3){return};app.swipeUp()}
      XCTAssertTrue(waitForHittable(element,timeout:5))
    }
    openSettings(app,page:"accounts")
    let login=app.buttons["login-music-account-kg"],qr=app.images["kugou-login-qr"]
    reach(login);image("Real Kugou account entry with public audio library")
    login.tap();XCTAssertTrue(app.staticTexts["kugou-login-waiting"].waitForExistence(timeout:25))
    XCTAssertTrue(qr.waitForExistence(timeout:10),"The official PNG must be rendered, not only a loading placeholder")
    reach(qr)
    let viewport=app.descendants(matching:.any).matching(identifier:"settings-viewport-accounts").firstMatch
    let completeQr=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let frame=qr.frame,bounds=viewport.frame
      return frame.minY>=bounds.minY+4 && frame.maxY<=bounds.maxY-4
    },object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[completeQr],timeout:10),.completed,"The complete real QR must fit inside the content viewport above the player")
    image("Real Kugou official anonymous QR waiting")
    XCTAssertEqual(qr.frame.width,240,accuracy:1);XCTAssertEqual(qr.frame.height,240,accuracy:1)
    let cancel=app.buttons["cancel-music-login-kg"]
    // The stable action row precedes the image; scroll back if needed.
    for _ in 0..<6 {if waitForHittable(cancel,timeout:0.3){break};app.swipeDown()}
    XCTAssertTrue(waitForHittable(cancel,timeout:5));cancel.tap()
    XCTAssertTrue(app.staticTexts["kugou-login-cancelled"].waitForExistence(timeout:10));XCTAssertTrue(waitForGone(qr,timeout:5))
    reach(login);login.tap();XCTAssertTrue(qr.waitForExistence(timeout:25))
    XCTAssertTrue(app.staticTexts["kugou-login-expired"].waitForExistence(timeout:135),"A real anonymous QR must expire without creating an account")
    XCTAssertTrue(waitForGone(qr,timeout:5));reach(login);image("Real Kugou QR expiry clears the image and allows retry")
    login.tap();XCTAssertTrue(qr.waitForExistence(timeout:25))
    let back=app.buttons["settings-back"]
    XCTAssertTrue(waitForHittable(back,timeout:5));back.tap()
    XCTAssertTrue(waitForGone(qr,timeout:10))
    openSettings(app,page:"accounts");reach(login)
    XCTAssertTrue(app.staticTexts["kugou-login-cancelled"].waitForExistence(timeout:10));XCTAssertFalse(qr.exists)
    image("Real Kugou leaving account page cancels the QR")
    login.tap();XCTAssertTrue(qr.waitForExistence(timeout:25))
    XCUIDevice.shared.press(.home);app.activate()
    XCTAssertTrue(app.staticTexts["kugou-login-cancelled"].waitForExistence(timeout:15));XCTAssertTrue(waitForGone(qr,timeout:5))
    image("Real Kugou background cancellation clears the QR")
    app.terminate();app.launch();openSettings(app,page:"accounts");reach(login)
    XCTAssertFalse(app.buttons["remove-music-account-kg"].exists,"No unscanned, expired or cancelled challenge can create a saved account")
    XCTAssertFalse(qr.exists);image("Real Kugou anonymous login remains logged out after restart")
    XCTAssertFalse(app.buttons["暂停"].exists,"The paused real-audio playback intent must remain unchanged")
  }
  func testLiveCatalogFavorites() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ item:XCUIElement){
      for _ in 0..<18{if waitForHittable(item,timeout:0.2){return};let keyboard=app.keyboards.firstMatch,upper:CGFloat=160,lower=min(app.frame.height-240,keyboard.exists ? keyboard.frame.minY-app.frame.minY-80 : app.frame.height-240),down=item.exists && item.frame.midY-app.frame.minY<(upper+lower)/2,origin=app.coordinate(withNormalizedOffset:.zero);origin.withOffset(CGVector(dx:app.frame.width/2,dy:down ? upper:lower)).press(forDuration:0.05,thenDragTo:origin.withOffset(CGVector(dx:app.frame.width/2,dy:down ? lower:upper)))}
      if !waitForHittable(item,timeout:5){image("Real catalog navigation failure")};XCTAssertTrue(waitForHittable(item,timeout:5))
    }
    func saved(_ label:String){let expectation=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@",label),object:app.buttons["catalog-favorite"]);XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:15),.completed)}
    func zero(){let expectation=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@","0 项本机收藏"),object:app.staticTexts["saved-catalogs-count"]);XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:15),.completed)}
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:15));player.tap();XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch;XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"));RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before);app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"search-kind-album").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"QQ音乐").firstMatch.tap()
    let albumField=app.textFields["搜索专辑"];albumField.tap();for c in "Ed Sheeran"{albumField.typeText(String(c))};albumField.typeText("\n")
    let album=app.buttons["search-album-tx-0"];XCTAssertTrue(album.waitForExistence(timeout:45));reach(album);album.tap();let back=app.buttons["返回搜索结果"];XCTAssertTrue(back.waitForExistence(timeout:15));let favorite=app.buttons["catalog-favorite"];reach(favorite);favorite.tap();saved("已收藏专辑（本机）");image("Real public album saved as a local catalog entry")
    favorite.tap();XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout:5));app.alerts.buttons["取消"].tap();saved("已收藏专辑（本机）");back.tap()
    let mvType=app.descendants(matching:.any).matching(identifier:"search-kind-mv").firstMatch;reach(mvType);mvType.tap();let migu=app.descendants(matching:.any).matching(identifier:"咪咕").firstMatch;reach(migu);migu.tap();let mv=app.buttons["search-mv-mg-0"];XCTAssertTrue(mv.waitForExistence(timeout:45));reach(mv);mv.tap();XCTAssertTrue(app.buttons["mv-back"].waitForExistence(timeout:15));favorite.tap();saved("已收藏MV（本机）");image("Real public Migu MV metadata saved without inventing a web page");app.buttons["mv-back"].tap()
    let playlistType=app.descendants(matching:.any).matching(identifier:"search-kind-playlist").firstMatch;reach(playlistType);playlistType.tap();let netease=app.descendants(matching:.any).matching(identifier:"网易云").firstMatch;reach(netease);netease.tap();let clear=app.buttons["search-clear"];reach(clear);clear.tap();let playlistField=app.textFields["搜索歌单"];playlistField.tap();for c in "欧美热歌榜"{playlistField.typeText(String(c))};playlistField.typeText("\n")
    let official=app.buttons.matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@","网易云欧美热歌榜","作者网易云音乐")).firstMatch;XCTAssertTrue(official.waitForExistence(timeout:60));reach(official);official.tap();XCTAssertTrue(back.waitForExistence(timeout:15));reach(favorite);favorite.tap();saved("已收藏歌单（本机）");image("Real official public playlist saved independently of a song copy");back.tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let albumDirectory=app.buttons["saved-catalogs-open-album"];reach(albumDirectory);albumDirectory.tap();let albumRow=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","saved-catalog-album:tx:")).firstMatch;XCTAssertTrue(albumRow.waitForExistence(timeout:10));app.buttons["saved-catalogs-refresh"].tap();XCTAssertTrue(app.staticTexts["已重新读取本机收藏"].waitForExistence(timeout:10));image("Real saved album directory rereads its persisted public identity");app.buttons["saved-catalogs-close"].tap()
    app.terminate();app.launch();app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();reach(albumDirectory);albumDirectory.tap();XCTAssertTrue(albumRow.waitForExistence(timeout:10));image("Real catalog favorite survives application restart");albumRow.tap();let albumBack=app.buttons["返回收藏专辑"];XCTAssertTrue(albumBack.waitForExistence(timeout:15));XCTAssertTrue(app.otherElements["discovery-track-0"].waitForExistence(timeout:45));reach(favorite);saved("已收藏专辑（本机）");favorite.tap();app.alerts.buttons["取消"].tap();saved("已收藏专辑（本机）");favorite.tap();app.alerts.buttons["移除收藏"].tap();saved("收藏专辑（本机）");image("Real album cancellation changes the shared saved catalog membership");albumBack.tap();zero();app.buttons["saved-catalogs-close"].tap()
    for (kind,label) in [("mv","MV"),("playlist","歌单")] {
      let directory=app.buttons["saved-catalogs-open-\(kind)"];reach(directory);directory.tap();let row=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","saved-catalog-\(kind):")).firstMatch;XCTAssertTrue(row.waitForExistence(timeout:10));image("Real persisted saved \(kind) directory uses its original platform")
      if kind=="mv"{row.tap();XCTAssertTrue(app.buttons["mv-back"].waitForExistence(timeout:10));saved("已收藏MV（本机）");app.buttons["mv-back"].tap()}
      let remove=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","saved-catalog-remove-\(kind):")).firstMatch;reach(remove);remove.tap();app.alerts.buttons["取消"].tap();XCTAssertTrue(row.exists);remove.tap();app.alerts.buttons["移除收藏"].tap();zero();XCTAssertFalse(row.exists);image("Real \(label) catalog cleanup retains an honest empty directory");app.buttons["saved-catalogs-close"].tap()
    }
    reach(player);player.tap();XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(play.waitForExistence(timeout:10));XCTAssertFalse(app.buttons["暂停"].exists);let paused=progress.value as? String;RunLoop.current.run(until:Date().addingTimeInterval(3));XCTAssertEqual(progress.value as? String,paused);app.buttons["收起播放页"].tap()
  }
  func testLiveMVSearch() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ item:XCUIElement){
      for _ in 0..<18{
        if waitForHittable(item,timeout:0.2){return}
        let keyboard=app.keyboards.firstMatch
        let upper:CGFloat=160,lower=min(app.frame.height-240,keyboard.exists ? keyboard.frame.minY-app.frame.minY-80 : app.frame.height-240)
        let down=item.exists && item.frame.midY-app.frame.minY<(upper+lower)/2
        let origin=app.coordinate(withNormalizedOffset:.zero)
        let from=origin.withOffset(CGVector(dx:app.frame.width/2,dy:down ? upper:lower)),to=origin.withOffset(CGVector(dx:app.frame.width/2,dy:down ? lower:upper))
        from.press(forDuration:0.05,thenDragTo:to)
      }
      if !waitForHittable(item,timeout:5){image("Real MV navigation target not reachable")}
      XCTAssertTrue(waitForHittable(item,timeout:5))
    }
    func loaded(){XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:30));let status=app.staticTexts["mv-page-status"],ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@","页面已载入"),object:app.staticTexts["mv-page-status"]);let result=XCTWaiter.wait(for:[ready],timeout:45);if result != .completed{image("Real MV document readiness failure")};XCTAssertEqual(result,.completed,"Actual MV state: \(status.label)");let token=app.staticTexts["mv-title"].label.components(separatedBy:" ").first ?? "";let body=app.webViews.firstMatch.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS[c] %@",token)).firstMatch;XCTAssertTrue(body.waitForExistence(timeout:20),"The official document must contain its own public MV title")}
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"library-local").firstMatch.tap()
    let recent=app.buttons["最近播放"];reach(recent);recent.tap()
    let realSong=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT (label BEGINSWITH %@)","Shape of You","Shape of You -")).firstMatch;reach(realSong);realSong.tap()
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:15));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["收起播放页"].firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"search-kind-mv").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"QQ音乐").firstMatch.tap()
    let field=app.textFields["搜索MV"];XCTAssertTrue(field.waitForExistence(timeout:10));field.tap();for character in "Ed Sheeran"{field.typeText(String(character))};XCTAssertEqual(field.value as? String,"Ed Sheeran");field.typeText("\n")
    let first=app.buttons["search-mv-tx-0"];XCTAssertTrue(first.waitForExistence(timeout:45));RunLoop.current.run(until:Date().addingTimeInterval(3));image("Real public MV search keeps source performer duration and widescreen artwork")
    first.tap();let back=app.buttons["mv-back"];XCTAssertTrue(back.waitForExistence(timeout:15));XCTAssertTrue(app.staticTexts["mv-source"].label.contains("QQ音乐"));XCTAssertTrue(app.staticTexts["mv-source"].label.contains("Ed Sheeran"));loaded();image("Real QQ MV official page is separate from the music queue")
    app.buttons["mv-refresh"].tap();loaded();image("Real MV official page refresh preserves its source and title")
    back.tap();XCTAssertTrue(first.waitForExistence(timeout:10));reach(first);first.press(forDuration:1);XCTAssertTrue(back.waitForExistence(timeout:10));loaded();back.tap()
    for (platform,label) in [("wy","网易云"),("kg","酷狗"),("kw","酷我")] {
      let selector=app.descendants(matching:.any).matching(identifier:label).firstMatch;reach(selector);selector.tap()
      let result=app.buttons["search-mv-\(platform)-0"];XCTAssertTrue(result.waitForExistence(timeout:45));reach(result);result.tap();XCTAssertTrue(back.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["mv-source"].label.contains(label));loaded();image("Real \(platform) MV opens its own official detail page");back.tap()
    }
    let migu=app.descendants(matching:.any).matching(identifier:"咪咕").firstMatch;reach(migu);migu.tap();let mg=app.buttons["search-mv-mg-0"];XCTAssertTrue(mg.waitForExistence(timeout:45));reach(mg);mg.tap();XCTAssertTrue(back.waitForExistence(timeout:10))
    let unavailable=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","暂不支持"),object:app.staticTexts["mv-page-status"]);XCTAssertEqual(XCTWaiter.wait(for:[unavailable],timeout:10),.completed);XCTAssertFalse(app.webViews.firstMatch.exists);XCTAssertFalse(app.buttons["mv-refresh"].exists);image("Real Migu MV metadata preserves its unavailable official page boundary");back.tap()
    let qq=app.descendants(matching:.any).matching(identifier:"QQ音乐").firstMatch;reach(qq);qq.tap();XCTAssertTrue(first.waitForExistence(timeout:45));let more=app.buttons["mv-search-more-tx"];reach(more);more.tap();let next=app.buttons["search-mv-tx-30"];XCTAssertTrue(next.waitForExistence(timeout:45));reach(next);image("Real MV search appends a second public result page")
    let clear=app.buttons["search-clear"];reach(clear);clear.tap();reach(field);field.tap();for c in "Taylor Swift"{field.typeText(String(c))}
    let artistType=app.descendants(matching:.any).matching(identifier:"search-kind-artist").firstMatch;reach(artistType);artistType.tap();let artistField=app.textFields["搜索艺术家"];XCTAssertEqual(artistField.value as? String,"Taylor Swift");XCTAssertTrue(app.buttons["search-artist-tx-0"].waitForExistence(timeout:45));image("Real pending search draft survives a result type change")
    reach(clear);clear.tap();artistField.tap();for c in "Ed Sheeran"{artistField.typeText(String(c))};let netease=app.descendants(matching:.any).matching(identifier:"网易云").firstMatch;reach(netease);netease.tap();XCTAssertEqual(artistField.value as? String,"Ed Sheeran");XCTAssertTrue(app.buttons["search-artist-wy-0"].waitForExistence(timeout:45));image("Real pending search draft survives a platform change")
    reach(player);player.tap();XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:10));XCTAssertFalse(app.buttons["暂停"].exists);let paused=progress.value as? String;RunLoop.current.run(until:Date().addingTimeInterval(3));XCTAssertEqual(progress.value as? String,paused);app.buttons["收起播放页"].firstMatch.tap()
  }
  func testLiveArtistSearch() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ item:XCUIElement){for _ in 0..<18{if waitForHittable(item,timeout:0.2){return};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}};XCTAssertTrue(waitForHittable(item,timeout:5))}
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    let searchTab=app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch;XCTAssertTrue(searchTab.waitForExistence(timeout:10));searchTab.tap()
    app.descendants(matching:.any).matching(identifier:"search-kind-artist").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    let field=app.textFields["搜索艺术家"];XCTAssertTrue(field.waitForExistence(timeout:10));field.tap();for character in "Ed Sheeran"{field.typeText(String(character))};XCTAssertEqual(field.value as? String,"Ed Sheeran");field.typeText("\n")
    let artist=app.buttons["search-artist-wy-0"];XCTAssertTrue(artist.waitForExistence(timeout:60));image("Real public artist search preserves platform and source summary")
    artist.tap();let back=app.buttons["返回搜索结果"];XCTAssertTrue(back.waitForExistence(timeout:15));let first=app.otherElements["discovery-track-0"]
    XCTAssertTrue(first.waitForExistence(timeout:45));XCTAssertTrue(app.staticTexts["artist-search-counts"].exists);XCTAssertTrue(app.staticTexts["artist-detail-counts"].exists);XCTAssertTrue(app.staticTexts["artist-popular-scope"].exists)
    image("Real artist popular collection retains separate search and detail counts")
    let firstSong=app.buttons.matching(NSPredicate(format:"label IN %@",["播放Shape of You","选择Shape of You","取消选择Shape of You"])).firstMatch;reach(firstSong);firstSong.press(forDuration:1)
    let all=app.buttons["discovery-select-all"];reach(all);all.tap();let bar=app.otherElements["discovery-selection-bar"];XCTAssertTrue(bar.label.contains("50 / 50"));image("Real artist selection is scoped to fifty loaded songs")
    app.buttons["discovery-cancel-selection"].tap();reach(firstSong);firstSong.press(forDuration:1)
    let second=app.buttons["选择Galway Girl"].firstMatch;reach(second);second.tap()
    let favorite=app.buttons["discovery-action-收藏"];reach(favorite);favorite.tap();XCTAssertTrue(app.staticTexts["已收藏 2 首"].waitForExistence(timeout:15))
    for index in 0...1 {let more=app.buttons["discovery-more-\(index)"];reach(more);more.tap();let remove=app.buttons["discovery-action-取消本地收藏"];XCTAssertTrue(remove.waitForExistence(timeout:10));remove.tap();XCTAssertTrue(waitForGone(remove,timeout:10))}
    image("Real artist batch favorite and explicit cleanup use the shared library")
    let albums=app.descendants(matching:.any).matching(identifier:"artist-tab-albums").firstMatch;reach(albums);albums.tap();XCTAssertTrue(app.buttons["discovery-item-0"].waitForExistence(timeout:30));RunLoop.current.run(until:Date().addingTimeInterval(3));image("Real artist albums are independent of the popular song collection")
    reach(back);back.tap();XCTAssertTrue(artist.waitForExistence(timeout:10));reach(artist);artist.press(forDuration:1);XCTAssertTrue(back.waitForExistence(timeout:10));XCTAssertTrue(first.waitForExistence(timeout:30));back.tap()
    let qq=app.descendants(matching:.any).matching(identifier:"QQ音乐").firstMatch;reach(qq);qq.tap();let qqArtist=app.buttons["search-artist-tx-0"];XCTAssertTrue(qqArtist.waitForExistence(timeout:45));qqArtist.tap();XCTAssertTrue(first.waitForExistence(timeout:45))
    reach(albums);albums.tap();let album=app.buttons["discovery-item-0"];XCTAssertTrue(album.waitForExistence(timeout:30));reach(album);album.tap();let albumBack=app.buttons["返回艺术家专辑"];XCTAssertTrue(albumBack.waitForExistence(timeout:15));XCTAssertTrue(first.waitForExistence(timeout:45));image("Real public album opens from its artist without losing the parent context")
    albumBack.tap();XCTAssertTrue(album.waitForExistence(timeout:10));let songs=app.descendants(matching:.any).matching(identifier:"artist-tab-songs").firstMatch;reach(songs);songs.tap();XCTAssertTrue(first.waitForExistence(timeout:30));reach(back);back.tap()
    let kg=app.descendants(matching:.any).matching(identifier:"酷狗").firstMatch;reach(kg);kg.tap();let kgArtist=app.buttons["search-artist-kg-0"];XCTAssertTrue(kgArtist.waitForExistence(timeout:45));kgArtist.tap();XCTAssertTrue(first.waitForExistence(timeout:45))
    let intro=app.buttons["展开艺术家简介"];reach(intro);intro.tap();let collapse=app.buttons["收起艺术家简介"];XCTAssertTrue(collapse.waitForExistence(timeout:10));image("Real artist biography expands using its own public profile");collapse.tap();reach(back);back.tap()
    XCTAssertFalse(app.buttons["暂停"].exists,"Artist browsing and metadata actions must preserve paused real playback")
  }
  func testLiveAlbumSearch() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ item:XCUIElement){for _ in 0..<18{if waitForHittable(item,timeout:0.2){return};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}};XCTAssertTrue(waitForHittable(item,timeout:5))}
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    let searchTab=app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch;XCTAssertTrue(searchTab.waitForExistence(timeout:10));searchTab.tap()
    app.descendants(matching:.any).matching(identifier:"search-kind-album").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"QQ音乐").firstMatch.tap()
    let field=app.textFields["搜索专辑"];XCTAssertTrue(field.waitForExistence(timeout:10));field.tap();for character in "Ed Sheeran"{field.typeText(String(character))};XCTAssertEqual(field.value as? String,"Ed Sheeran");field.typeText("\n")
    let album=app.buttons.matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@","打开专辑：÷ (Deluxe)","作者Ed Sheeran")).firstMatch
    XCTAssertTrue(album.waitForExistence(timeout:60));image("Real album search with public QQ artist metadata")
    album.tap();let back=app.buttons["返回搜索结果"];XCTAssertTrue(back.waitForExistence(timeout:15));let first=app.otherElements["discovery-track-0"];XCTAssertTrue(first.waitForExistence(timeout:45))
    XCTAssertTrue(app.staticTexts["album-artist"].label.contains("Ed Sheeran"));XCTAssertEqual(app.staticTexts["album-released"].label,"2017-03-03")
    let intro=app.buttons["展开专辑简介"];reach(intro);intro.tap();let collapse=app.buttons["收起专辑简介"];XCTAssertTrue(collapse.waitForExistence(timeout:10));image("Real public album introduction expanded with artist and date");collapse.tap()
    let firstSong=app.buttons["播放Eraser"].firstMatch;reach(firstSong);XCTAssertTrue(firstSong.exists);image("Real public album detail with sixteen ordered recordings")
    let importer=app.buttons["导入完整专辑到音乐库"];reach(importer);importer.tap();let confirm=app.alerts["导入公开专辑"];XCTAssertTrue(confirm.waitForExistence(timeout:40));XCTAssertTrue(confirm.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","16 首")).firstMatch.exists);confirm.buttons["取消"].tap()
    importer.tap();XCTAssertTrue(confirm.waitForExistence(timeout:40));confirm.buttons["创建本地歌单"].tap();XCTAssertTrue(app.staticTexts["已保存到我的歌单"].waitForExistence(timeout:15));image("Real complete public album saved through explicit confirmation")
    back.tap();XCTAssertTrue(album.waitForExistence(timeout:10));reach(album);album.press(forDuration:1);XCTAssertTrue(back.waitForExistence(timeout:10));XCTAssertTrue(first.waitForExistence(timeout:30));back.tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let lists=app.buttons["我的歌单"];reach(lists);lists.tap()
    let saved=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","÷ (Deluxe)")).firstMatch;XCTAssertTrue(saved.waitForExistence(timeout:15));reach(saved);saved.tap();let delete=app.buttons["删除歌单"];reach(delete);image("Real public album copy available in the local music library")
    delete.tap();app.alerts.buttons["删除"].tap();XCTAssertTrue(waitForGone(saved,timeout:10));XCTAssertFalse(app.buttons["暂停"].exists)
  }
  func testLivePlaylistSearch() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ item:XCUIElement){for _ in 0..<18{if waitForHittable(item,timeout:0.2){return};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}};XCTAssertTrue(waitForHittable(item,timeout:5))}
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    let searchTab=app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch;XCTAssertTrue(searchTab.waitForExistence(timeout:10));searchTab.tap();app.descendants(matching:.any).matching(identifier:"search-kind-playlist").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    let field=app.textFields["搜索歌单"];XCTAssertTrue(field.waitForExistence(timeout:10));field.tap();for character in "欧美热歌榜"{field.typeText(String(character))};XCTAssertEqual(field.value as? String,"欧美热歌榜");field.typeText("\n")
    let official=app.buttons.matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@","网易云欧美热歌榜","作者网易云音乐")).firstMatch
    XCTAssertTrue(official.waitForExistence(timeout:60));image("Real official playlist search results with author and artwork")
    official.tap();XCTAssertTrue(app.buttons["返回搜索结果"].waitForExistence(timeout:15))
    XCTAssertTrue(app.staticTexts["网易云欧美热歌榜"].firstMatch.waitForExistence(timeout:15))
    let detail=app.otherElements["discovery-track-0"];XCTAssertTrue(detail.waitForExistence(timeout:60));image("Real official playlist detail opened through normal search")
    app.buttons["返回搜索结果"].tap();XCTAssertTrue(official.waitForExistence(timeout:10))
    official.press(forDuration:1);XCTAssertTrue(app.buttons["返回搜索结果"].waitForExistence(timeout:10));XCTAssertTrue(detail.waitForExistence(timeout:30))
    app.buttons["返回搜索结果"].tap();XCTAssertTrue(official.waitForExistence(timeout:10));image("Real search results retained after closing playlist detail")
    let more=app.buttons["playlist-search-more-wy"];XCTAssertTrue(more.waitForExistence(timeout:10));reach(more);more.tap()
    XCTAssertTrue(app.buttons["search-playlist-wy-30"].waitForExistence(timeout:45),"Real second-page results must extend the search collection")
    image("Real public playlist search appends its second page")
    let songs=app.descendants(matching:.any).matching(identifier:"search-kind-song").firstMatch;reach(songs);songs.tap();XCTAssertTrue(app.textFields["搜索歌曲或歌手"].waitForExistence(timeout:10))
    XCTAssertFalse(app.buttons["search-playlist-wy-0"].exists)
    image("Real song search remains reachable after switching result type")
    XCTAssertFalse(app.buttons["暂停"].exists,"Browsing must preserve paused real playback intent")
  }
  func testLiveQQComputerPairing() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ button:XCUIElement){for _ in 0..<12 {if waitForHittable(button,timeout:0.3){return};app.swipeUp()};XCTAssertTrue(waitForHittable(button,timeout:5))}
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before)
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    openSettings(app,page:"accounts")
    let open=app.buttons["qq-transfer-open"];reach(open);image("Real QQ computer pairing entry with public audio")
    open.tap();let field=app.secureTextFields["qq-transfer-code"],connect=app.buttons["qq-transfer-connect"]
    XCTAssertTrue(field.waitForExistence(timeout:10));XCTAssertTrue(app.buttons["qq-transfer-scan"].exists);XCTAssertFalse(connect.isEnabled)
    image("Real computer pairing instructions and empty secure input")
    app.buttons["qq-transfer-scan"].tap()
    let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard"),cameraAlert=springboard.alerts.firstMatch
    if cameraAlert.waitForExistence(timeout:4) {
      XCTAssertTrue(cameraAlert.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@ OR label CONTAINS %@","camera","相机")).firstMatch.exists)
      image("Real camera request only after explicit pairing scan")
      let deny=cameraAlert.buttons.matching(NSPredicate(format:"label MATCHES %@","^(Don.t Allow|不允许)$")).firstMatch
      guard deny.waitForExistence(timeout:5) else {XCTFail("Camera consent response must be identified");return};deny.tap()
    }else{
      let back=app.buttons["qq-transfer-scan-cancel"];if back.waitForExistence(timeout:3){back.tap()}
    }
    let returned=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.staticTexts["qq-transfer-failed"].exists || app.staticTexts["qq-transfer-cancelled"].exists},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[returned],timeout:20),.completed)
    XCTAssertTrue(field.exists);XCTAssertFalse(connect.isEnabled);image("Real scanner return preserves manual pairing without an account")
    // Exercise production validation only; no synthetic account/peer or screenshot.
    field.tap();field.typeText("not-a-pairing-code");XCTAssertTrue(connect.isEnabled);connect.tap()
    XCTAssertTrue(app.staticTexts["qq-transfer-failed"].waitForExistence(timeout:15));XCTAssertFalse(app.buttons["qq-transfer-confirm"].exists)
    XCTAssertFalse(connect.isEnabled,"The short-lived code input must clear on submission")
    app.buttons["qq-transfer-close"].tap();XCTAssertTrue(waitForGone(field,timeout:10))
    reach(open);open.tap();XCTAssertTrue(field.waitForExistence(timeout:10));XCTAssertFalse(connect.isEnabled)
    XCUIDevice.shared.press(.home);app.activate();XCTAssertTrue(field.waitForExistence(timeout:10));app.buttons["qq-transfer-close"].tap()
    app.terminate();app.launch();openSettings(app,page:"accounts");reach(open)
    XCTAssertFalse(app.buttons["verify-music-account-tx"].exists);open.tap();XCTAssertTrue(field.waitForExistence(timeout:10));XCTAssertFalse(connect.isEnabled)
    XCTAssertFalse(app.staticTexts["qq-transfer-failed"].exists);image("Real computer pairing remains unconfigured after restart")
    app.buttons["qq-transfer-close"].tap()
  }
  func testLiveQQDailyAuthorization() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:app.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ button:XCUIElement){for _ in 0..<10 {if waitForHittable(button,timeout:0.3){return};app.swipeUp()};XCTAssertTrue(waitForHittable(button,timeout:5))}
    openSettings(app,page:"accounts")
    let authorize=app.buttons["qq-daily-authorize"];reach(authorize);image("Real QQ daily official authorization entry")
    authorize.tap()
    let bar=app.navigationBars["QQ 每日推荐授权"]
    XCTAssertTrue(bar.waitForExistence(timeout:20));XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:15))
    XCTAssertTrue(waitForGone(app.activityIndicators["qq-daily-authorization-loading"],timeout:45))
    image("Real QQ Skills page without credentials")
    bar.buttons["关闭"].tap();XCTAssertTrue(waitForGone(bar,timeout:15))
    let cancelled=app.staticTexts["qq-daily-cancelled"]
    XCTAssertTrue(cancelled.waitForExistence(timeout:10))
    let mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
    XCTAssertTrue(mini.exists);XCTAssertLessThanOrEqual(cancelled.frame.maxY,mini.frame.minY,"Cancellation text must be fully above the mini player")
    image("Real QQ daily authorization cancelled")
    reach(authorize);authorize.tap();XCTAssertTrue(bar.waitForExistence(timeout:20))
    XCUIDevice.shared.press(.home);app.activate();XCTAssertTrue(waitForGone(bar,timeout:15))
    XCTAssertTrue(app.staticTexts["qq-daily-cancelled"].waitForExistence(timeout:10))
    app.terminate();app.launch();openSettings(app,page:"accounts")
    XCTAssertFalse(app.buttons["verify-music-account-tx"].exists)
    reach(app.buttons["qq-daily-authorize"]);image("Real QQ daily authorization remains unconfigured after restart")
  }
  func testLivePlatformRecommendations() throws {
    // Explicit real-audio target; use the same normal navigation assertions.
    try testAccountRecommendationsEntryAndLoginRouting()
    let app=XCUIApplication()
    XCTAssertTrue(app.buttons["login-music-account-tx"].exists)
    let kugou=app.buttons["login-music-account-kg"]
    for _ in 0..<6 {if waitForHittable(kugou,timeout:0.3){break};app.swipeUp()}
    XCTAssertTrue(waitForHittable(kugou,timeout:5))
    let shot=XCTAttachment(screenshot:app.screenshot());shot.name="Real platform accounts with public audio library";shot.lifetime = .keepAlways;add(shot)
  }
  func testAccountRecommendationsEntryAndLoginRouting() throws {
    let app=XCUIApplication();app.launch()
    let rail=app.descendants(matching:.any).matching(identifier:"rail-tab-library").firstMatch
    let tab=rail.exists ? rail : app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch
    XCTAssertTrue(tab.waitForExistence(timeout:15))
    XCTAssertTrue(waitForHittable(tab,timeout:10),"The library tab must be reachable")
    tab.tap()
    let login=app.buttons["account-recommendations-login"]
    for _ in 0..<6 {if waitForHittable(login,timeout:0.5){break};app.swipeUp()}
    XCTAssertTrue(login.exists,"The logged-out account recommendation entry must be on the library page")
    XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"account-daily-track-0").firstMatch.exists,"No daily row may be fabricated without an account")
    XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"account-fm-track-0").firstMatch.exists,"No FM row may be fabricated without an account")
    let entry=XCTAttachment(screenshot:app.screenshot());entry.name="Account recommendations logged out";entry.lifetime = .keepAlways;add(entry)
    XCTAssertTrue(waitForHittable(login,timeout:5));login.tap()
    let settingsLogin=app.buttons["login-music-account-wy"]
    XCTAssertTrue(settingsLogin.waitForExistence(timeout:15),"The account card CTA must open the existing NetEase login entry")
    let routed=XCTAttachment(screenshot:app.screenshot());routed.name="Account recommendations login route";routed.lifetime = .keepAlways;add(routed)
  }
  func testOnlineMatching() throws {
    // scripts/test-ui.mjs selects a separate simulator entry with an HTTP adapter.
    // The real provider parsing, LX host, routing, storage and PCM backend still run.
    let app=XCUIApplication();app.launch()
    // This test verifies both automatic matching and the preference lifecycle.
    // Start from a known enabled state because the persistent simulator can
    // retain an earlier interrupted run that stopped after turning it off.
    openSettings(app,page:"playback")
    let initialAutomatic=app.buttons["automatic-online-matching"]
    for _ in 0..<40 {if initialAutomatic.isHittable{break};app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.72)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.42)))}
    XCTAssertTrue(initialAutomatic.isHittable)
    if initialAutomatic.label=="普通在线歌曲自动匹配：关闭"{
      initialAutomatic.tap()
      expectation(for:NSPredicate(format:"label == %@","普通在线歌曲自动匹配：开启"),evaluatedWith:initialAutomatic);waitForExpectations(timeout:5)
    }
    XCTAssertEqual(initialAutomatic.label,"普通在线歌曲自动匹配：开启")
    func openMatchDetails(){
      for _ in 0..<8 {if app.buttons["更多播放控制"].isHittable{break};app.swipeDown()}
      let more=app.buttons["更多播放控制"];XCTAssertTrue(more.isHittable);more.tap()
      let details=app.buttons["队列与播放选项"];XCTAssertTrue(details.waitForExistence(timeout:5));details.tap()
    }
    func closeMatchDetails(){
      let close=app.buttons["收起播放选项"];XCTAssertTrue(close.waitForExistence(timeout:5));close.tap()
      XCTAssertTrue(waitForGone(close,timeout:5))
    }
    func assertMatchStatus(_ text:String,timeout:TimeInterval=30){
      openMatchDetails()
      XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout:timeout))
      closeMatchDetails()
    }
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
    openMatchDetails()
    let priorLive=app.staticTexts["正在通过 tx · Synthetic match tone (Live) 播放"]
    if priorLive.waitForExistence(timeout:2){
      closeMatchDetails()
      let matchButton=app.buttons["匹配歌曲"];for _ in 0..<8 {if matchButton.isHittable{break};app.swipeUp()};XCTAssertTrue(matchButton.isHittable);matchButton.tap()
      let clear=app.buttons["取消指定版本，恢复自动"];XCTAssertTrue(clear.waitForExistence(timeout:5));clear.tap()
      for _ in 0..<4 {if app.buttons["播放"].firstMatch.isHittable{break};app.swipeUp()};app.buttons["播放"].firstMatch.tap()
      assertMatchStatus("正在通过 tx · Synthetic match tone 播放")
    }else{
      XCTAssertTrue(app.staticTexts["正在通过 tx · Synthetic match tone 播放"].waitForExistence(timeout:30))
      closeMatchDetails()
    }
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    XCTAssertTrue(app.staticTexts["偏好 flac · 成功请求档位 flac（非实际文件格式证明）"].exists)
    let matchButton=app.buttons["匹配歌曲"];for _ in 0..<8 {if matchButton.isHittable{break};app.swipeUp()};XCTAssertTrue(matchButton.isHittable);matchButton.tap();app.buttons["取消指定版本，恢复自动"].tap()
    assertMatchStatus("保留原曲，可选择其他录音版本",timeout:10)
    for _ in 0..<4 {if app.buttons["播放"].firstMatch.isHittable{break};app.swipeUp()};app.buttons["播放"].firstMatch.tap()
    assertMatchStatus("正在通过 tx · Synthetic match tone 播放",timeout:20);for _ in 0..<4 {if app.buttons["匹配歌曲"].isHittable{break};app.swipeUp()}
    app.buttons["匹配歌曲"].tap()
    let live=app.buttons["match-candidate-tx-fixture-live"]
    XCTAssertTrue(live.waitForExistence(timeout:20));for _ in 0..<4 {if live.isHittable{break};app.swipeUp()};live.tap();app.alerts.buttons["保存匹配"].tap()
    assertMatchStatus("已指定版本，重新播放后使用",timeout:10);XCTAssertTrue(app.buttons["播放"].firstMatch.exists)
    for _ in 0..<4 {if app.buttons["播放"].firstMatch.isHittable{break};app.swipeUp()};app.buttons["播放"].firstMatch.tap()
    assertMatchStatus("正在通过 tx · Synthetic match tone (Live) 播放",timeout:15);XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:15))
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    for _ in 0..<4 {if app.buttons["匹配歌曲"].isHittable{break};app.swipeDown()};app.buttons["匹配歌曲"].tap();app.buttons["取消指定版本，恢复自动"].tap()
    assertMatchStatus("保留原曲，可选择其他录音版本",timeout:10)
    app.terminate();app.launch();app.buttons["打开播放页"].tap();assertMatchStatus("保留原曲，可选择其他录音版本",timeout:10);XCTAssertTrue(app.staticTexts["Synthetic match tone"].firstMatch.exists)
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
    for _ in 0..<8{app.swipeDown()};let originalRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",original+" ·")).firstMatch;reveal(originalRow);originalRow.tap();let rename=app.textFields["音枢歌单名称"];reveal(rename);rename.tap();rename.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:(rename.value as? String)?.count ?? 0));for character in local{rename.typeText(String(character))};rename.typeText("\n");XCTAssertEqual(rename.value as? String,local);let saveInfo=app.buttons["保存信息"];reveal(saveInfo);XCTAssertTrue(saveInfo.isEnabled);saveInfo.tap();XCTAssertTrue(app.staticTexts[local].waitForExistence(timeout:10),"The saved title must update before leaving the editor");app.buttons["返回歌单列表"].tap()
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
    selectClassicSourcePlayback(in:app)
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
    selectLocalFixture("Nexus Playlist Fixture",in:app)
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
  func testLXMCImportCancelAndRestart() throws {
    let app=XCUIApplication();app.launch()
    func reach(_ element:XCUIElement){
      for _ in 0..<45 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY
        app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))}
      XCTAssertTrue(element.isHittable,"Expected visible control: \(element.identifier)")
    }
    func library(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()}
    func lxmcPlaylist()->XCUIElement{app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus LXMC fixture")).firstMatch}
    library()
    let playlists=app.buttons["我的歌单"];reach(playlists);playlists.tap()
    while lxmcPlaylist().exists {reach(lxmcPlaylist());lxmcPlaylist().tap();let delete=app.buttons["删除歌单"];reach(delete);delete.tap();app.alerts.buttons["删除"].tap()}
    func trackRows()->XCUIElementQuery{app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ OR label BEGINSWITH %@","KG fixture,","TX fixture,"))}
    func expectTracks(_ context:String){
      XCTAssertTrue(trackRows().firstMatch.waitForExistence(timeout:10),context)
      // The playlist detail exposes each track as a button whose label starts
      // with the title; identities/order/duplicates must survive import.
      let order=trackRows().allElementsBoundByIndex.map{$0.label.hasPrefix("KG fixture") ? "KG" : "TX"}
      XCTAssertEqual(order,["KG","TX","KG"],context)
    }
    let importer=app.buttons["导入LX v2歌单 JSON / LXMC"];reach(importer);importer.tap()
    let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse","瀏覽"])).firstMatch
    XCTAssertTrue(browse.waitForExistence(timeout:30));browse.tap()
    selectLocalFixture("Nexus LXMC Fixture",in:app)
    let alert=app.alerts["导入LX歌单"];XCTAssertTrue(alert.waitForExistence(timeout:15))
    XCTAssertTrue(alert.staticTexts.element(matching:NSPredicate(format:"label CONTAINS %@","3 首支持的歌曲")).exists)
    alert.buttons["取消"].tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:alert);waitForExpectations(timeout:5)
    XCTAssertFalse(app.staticTexts["已导入 1 个歌单、3 首歌曲"].exists)
    reach(importer);importer.tap()
    XCTAssertTrue(browse.waitForExistence(timeout:30));browse.tap()
    selectLocalFixture("Nexus LXMC Fixture",in:app)
    XCTAssertTrue(alert.waitForExistence(timeout:15));alert.buttons["追加导入"].tap()
    XCTAssertTrue(app.staticTexts["已导入 1 个歌单、3 首歌曲"].waitForExistence(timeout:15))
    reach(playlists);playlists.tap()
    XCTAssertEqual(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus LXMC fixture")).count,1)
    let playlist=lxmcPlaylist();reach(playlist);playlist.tap()
    expectTracks("Imported playlist must keep the LX v2 track identity and order")
    let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    app.terminate();app.launch();library()
    reach(playlists);playlists.tap()
    XCTAssertEqual(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus LXMC fixture")).count,1)
    let restored=lxmcPlaylist();reach(restored);restored.tap()
    expectTracks("Playlist must keep its tracks after relaunch")
    let delete=app.buttons["删除歌单"];reach(delete);delete.tap();app.alerts.buttons["删除"].tap()
    XCTAssertFalse(lxmcPlaylist().exists)
  }
  // Batch 4: the device-only playlist system (Sollin E-1247–E-1251). Runs on a
  // real imported audio file: default 我喜欢的（仅本机）always present and
  // undeletable, creating prompts the device-only declaration, the local
  // picker excludes the default and closes on submit, deletion happens with
  // no confirmation, and the library playlist list never shows local names.
  // Opt-in: unchanged public MP3 resolved by the user's real LX source.
  func testLiveLocalFolderScan() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let value=XCTAttachment(screenshot:app.screenshot());value.name=name;value.lifetime = .keepAlways;add(value)}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch.tap();XCTAssertTrue(app.buttons["收起本地音频"].waitForExistence(timeout:10))}
    func count(_ value:String){let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.staticTexts["local-filter-count"].label == value},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:10),.completed)}
    func settings(){app.buttons["local-scan-open"].tap();XCTAssertTrue(app.buttons["local-scan-add"].waitForExistence(timeout:8))}
    func reach(_ element:XCUIElement){let wrapper=app.descendants(matching:.any).matching(identifier:"local-scan-viewport").firstMatch;let viewport=wrapper.descendants(matching:.scrollView).firstMatch;for _ in 0..<8{if element.isHittable{return};let down=element.frame.minY < wrapper.frame.minY;viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:down ? 0.2 : 0.6)).press(forDuration:0.05,thenDragTo:viewport.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:down ? 0.7 : 0.15)))};if !element.isHittable{image("Real scan controls reach failure")};XCTAssertTrue(element.isHittable)}
    func tap(_ id:String){let value=app.buttons[id];reach(value);value.tap()}
    func scan(){tap("local-scan-rescan");let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons["local-scan-rescan"].isEnabled && app.staticTexts["local-scan-message"].label.hasPrefix("扫描完成")},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:40),.completed)}
    func save(){tap("local-scan-save");XCTAssertTrue(app.staticTexts["规则已保存，重新扫描后生效"].waitForExistence(timeout:8))}
    func minimum(_ value:String){let field=app.textFields["扫描最小时长秒"];reach(field);field.tap();let old=field.value as? String ?? "";field.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:old.count));field.typeText(value);XCTAssertEqual(field.value as? String,value)}
    func closeSettings(){app.buttons["local-scan-close"].tap()}
    func chooseFolder(){
      let root=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: Nexus Real Scan")).firstMatch
      let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus Real Scan")).firstMatch
      let open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","选择","Choose"])).firstMatch
      var picked=false
      var reopened=false
      var iteration=0
      for _ in 0..<24 {
        iteration+=1
        // The sheet reopens at the last browsed location, and 打开 belongs to
        // the sheet's own navigation bar, which stays queryable even when the
        // remote Files subtree hides the browsingRoot identifiers; confirm
        // the currently viewed directory first.
        if open.exists && open.isEnabled{open.tap();picked=true;break}
        if root.exists || app.navigationBars.staticTexts["Nexus Real Scan"].exists{
          if open.waitForExistence(timeout:3), open.isEnabled{open.tap();picked=true;break}
        }
        let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse"])).firstMatch
        if folder.exists && folder.isHittable{folder.tap()}
        else if let phone=app.cells.matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).allElementsBoundByIndex.first(where:{$0.isHittable}){phone.tap()}
        else if browse.exists && browse.isHittable{browse.tap()}
        else if !reopened, iteration>1, app.buttons["local-scan-add"].isHittable{reopened=true;app.buttons["local-scan-add"].tap()}
        RunLoop.current.run(until:Date().addingTimeInterval(2))
      }
      if !picked{image("Real folder picker unavailable");let tree=XCTAttachment(string:app.debugDescription);tree.name="Folder picker hierarchy";tree.lifetime = .keepAlways;add(tree)}
      XCTAssertTrue(picked,"Select the actual public-audio directory through the system picker")
      let allow=app.alerts.buttons.matching(NSPredicate(format:"label IN %@",["允许","Allow"])).firstMatch;if allow.waitForExistence(timeout:2){allow.tap()}
      XCTAssertTrue(app.staticTexts["扫描完成 · 2 首"].waitForExistence(timeout:45));
    }
    openLocal();settings()
    while app.buttons["local-scan-root-remove-0"].exists{tap("local-scan-root-remove-0")};save();scan()
    app.buttons["local-scan-add"].tap()
    let cancel=app.buttons.matching(NSPredicate(format:"label IN %@",["取消","Cancel"])).firstMatch
    let pickerReady=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source:")).firstMatch;XCTAssertTrue(pickerReady.waitForExistence(timeout:15));image("Real system folder picker cancel")
    if cancel.exists && cancel.isHittable{cancel.tap()}else{app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.083)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.9)))}
    XCTAssertTrue(app.staticTexts["已取消，目录和索引保留"].waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["尚未添加文件夹"].exists)
    app.buttons["local-scan-add"].tap()
    chooseFolder();closeSettings();count("2 / 2 首")
    app.buttons["从列表移除"].firstMatch.tap();app.alerts["从本地列表移除？"].buttons["移除"].tap();count("1 / 1 首");settings();scan();closeSettings();count("2 / 2 首");image("Real scan restores user hidden index")
    app.buttons["文件夹"].tap();XCTAssertTrue(app.buttons["Nexus Real Scan · 1首"].exists);XCTAssertTrue(app.buttons["Nexus Real Scan / Albums · 1首"].exists);image("Real folder physical groups")
    app.buttons["Nexus Real Scan / Albums · 1首"].tap();count("1 / 2 首");XCTAssertEqual(app.buttons["local-track-0"].label,"Perfect - Ed Sheeran");app.buttons["返回文件夹"].tap();app.buttons["歌曲"].tap()
    settings();minimum("240");save();closeSettings();count("2 / 2 首")
    settings();scan();closeSettings();count("1 / 1 首");XCTAssertEqual(app.buttons["local-track-0"].label,"Perfect - Ed Sheeran");image("Real folder minimum duration applied")
    app.terminate();app.launch();openLocal();count("1 / 1 首");settings();XCTAssertEqual(app.textFields["扫描最小时长秒"].value as? String,"240");scan();closeSettings();count("1 / 1 首")
    settings();minimum("0");save();scan();tap("local-scan-block-1");save();closeSettings();count("2 / 2 首")
    settings();scan();closeSettings();count("1 / 1 首");XCTAssertEqual(app.buttons["local-track-0"].label,"Shape of You - Ed Sheeran");image("Real folder child exclusion applied")
    settings();tap("local-scan-block-1");save();scan();tap("local-scan-root-recursive-0");save();scan();closeSettings();count("1 / 1 首")
    settings();tap("local-scan-root-recursive-0");save();scan();closeSettings();count("2 / 2 首")
    app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90));app.buttons["暂停"].firstMatch.tap();app.buttons["player-drag-handle"].tap();openLocal()
    settings();tap("local-scan-root-remove-0");save();closeSettings();count("2 / 2 首")
    settings();scan();closeSettings();count("0 / 0 首");XCTAssertFalse(app.buttons["local-restore-index"].exists);image("Real folder root removed after rescan")
    app.terminate();app.launch();openLocal();count("0 / 0 首");app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap();let play=app.buttons["播放"].firstMatch;if play.exists{play.tap()};XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90),"Owned queue audio remains playable after root/index removal");image("Real scanned audio retained PCM after root removal");app.buttons["暂停"].firstMatch.tap()
    app.buttons["player-drag-handle"].tap();openLocal();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app,folderName:"Nexus Real Scan")
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:25));count("1 / 1 首")
    settings();tap("local-scan-add");chooseFolder();closeSettings();count("2 / 2 首")
    settings();tap("local-scan-root-remove-0");save();scan();closeSettings();count("1 / 1 首");XCTAssertEqual(app.buttons["local-track-0"].label,"Shape of You - Ed Sheeran")
    app.terminate();app.launch();openLocal();count("1 / 1 首");app.buttons["文件夹"].tap();XCTAssertTrue(app.buttons["单独导入 · 1首"].exists);image("Real manual import survives root removal and restart")
  }

  func testLiveLocalSorting() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:app.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch.tap();XCTAssertTrue(app.buttons["收起本地音频"].waitForExistence(timeout:10))}
    func first(_ title:String){let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons["local-track-0"].label == title},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:8),.completed,"Actual public songs must change order: \(title)")}
    func choose(_ field:String,_ label:String){app.buttons["local-sort-field"].tap();let option=app.descendants(matching:.any).matching(identifier:"local-sort-\(field)").firstMatch;XCTAssertTrue(option.waitForExistence(timeout:5));option.tap();XCTAssertEqual(app.buttons["local-sort-field"].label,"排序 · \(label)")}
    let handle=app.buttons["player-drag-handle"].firstMatch;if handle.waitForExistence(timeout:2){handle.tap()}
    openLocal();choose("title","名称");if app.buttons["local-sort-direction"].label == "倒序"{app.buttons["local-sort-direction"].tap()}
    for name in ["Shape of You - Ed Sheeran","Perfect - Ed Sheeran"] {
      app.buttons["导入音频文件"].tap();selectLocalFixture(name,in:app)
      XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:25))
    }
    XCTAssertEqual(app.staticTexts["local-filter-count"].label,"2 / 2 首")
    // These are complete, unchanged public MP3s resolved by the real V261020
    // source. Neither has ID3 artist/album tags; their missing tags remain visible.
    let shape="Shape of You - Ed Sheeran",perfect="Perfect - Ed Sheeran"
    for (field,label,ascending) in [("title","名称",perfect),("duration","时长",shape),("modifiedAt","文件修改时间",shape),("addedAt","添加时间",shape),("artist","艺术家",perfect),("album","专辑",perfect)] {
      choose(field,label);XCTAssertEqual(app.buttons["local-sort-direction"].label,"正序");first(ascending)
      app.buttons["local-sort-direction"].tap();first(ascending == shape ? perfect : shape)
      XCTAssertEqual(app.buttons["local-sort-direction"].label,"倒序")
      if field == "title"{image("Real audio name descending")}
      app.buttons["local-sort-direction"].tap();first(ascending)
    }
    choose("addedAt","添加时间");app.buttons["local-sort-direction"].tap();first(perfect)
    image("Real audio added descending")
    app.terminate();app.launch();openLocal()
    XCTAssertEqual(app.buttons["local-sort-field"].label,"排序 · 添加时间");XCTAssertEqual(app.buttons["local-sort-direction"].label,"倒序");first(perfect)
    app.buttons["local-sort-field"].tap();image("Real audio six field sort after restart");app.descendants(matching:.any).matching(identifier:"local-sort-addedAt").firstMatch.tap()
    let input=app.textFields["搜索本地歌曲艺术家专辑"];input.tap();for c in "Perfect"{input.typeText(String(c))};XCTAssertEqual(input.value as? String,"Perfect");input.typeText("\n");XCTAssertEqual(app.staticTexts["local-filter-count"].label,"1 / 2 首");first(perfect)
    app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();let player=app.buttons["打开播放页"];XCTAssertTrue(player.waitForExistence(timeout:15));player.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90),"Sorted real MP3 must decode to PCM");XCTAssertTrue(app.buttons["暂停"].firstMatch.isHittable);image("Real sorted audio PCM playback");app.buttons["暂停"].firstMatch.tap()
  }

  // Batch 5D uses two unchanged public songs from the real V261020 source.
  // Entry IDs differ from local-audio IDs; favorite and remove target different domains.
  func testLiveLocalPlaylistBatch() throws {
    let app=XCUIApplication();app.launch()
    let suffix=Int(Date().timeIntervalSince1970),source="Batch \(suffix)",copy="Copy \(suffix)"
    let names=["Shape of You - Ed Sheeran","Perfect - Ed Sheeran"]
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap();XCTAssertTrue(app.buttons["收起本地音频"].waitForExistence(timeout:10))}
    func barElement()->XCUIElement{return app.descendants(matching:.any).matching(identifier:"local-playlist-batch-selection-bar").firstMatch}
    func bar(_ n:Int,total:Int=2){let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in barElement().label == "已选 \(n) / \(total) 首"},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:8),.completed)}
    func selectBoth(){app.buttons["local-playlist-track-0"].press(forDuration:1.1);bar(1);app.buttons["local-playlist-batch-select-all"].tap();bar(2)}
    func openPlaylist(_ title:String,_ count:Int){let row=app.buttons["打开本地歌单：\(title) · \(count)首"];for _ in 0..<12{if row.exists && row.isHittable{break};app.swipeUp()};XCTAssertTrue(row.waitForExistence(timeout:10));row.tap()}
    func filter(_ title:String){let f=app.textFields["搜索本地歌曲艺术家专辑"];f.tap();let old=f.value as? String ?? "";f.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:old.count));if !title.isEmpty{f.typeText(title)};f.typeText("\n")}
    func createInPicker(_ title:String){let f=app.textFields["新建本地歌单名称"];XCTAssertTrue(f.waitForExistence(timeout:8));f.tap();f.typeText(title);f.typeText("\n");app.buttons["新建本地歌单并添加"].tap()}
    func skin(_ name:String){
      app.buttons["更多播放控制"].tap();app.buttons["播放界面样式"].tap()
      let option=app.descendants(matching:.any).matching(identifier:"play-skin-\(name)").firstMatch
      XCTAssertTrue(option.waitForExistence(timeout:10));for _ in 0..<5{if option.isHittable{break};app.swipeUp()};option.tap()
    }
    let handle=app.buttons["player-drag-handle"].firstMatch;if handle.waitForExistence(timeout:2){handle.tap()}
    func openQueue(){
      let player=app.buttons["打开播放页"];XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
      let entry=app.buttons["查看播放队列"];XCTAssertTrue(entry.waitForExistence(timeout:10))
      for _ in 0..<4{if entry.isHittable{break};app.swipeUp()};entry.tap()
      let full=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
      XCTAssertTrue(full.waitForExistence(timeout:10));full.tap();XCTAssertTrue(app.buttons["收起队列"].waitForExistence(timeout:10))
    }
    func closeQueue(){app.buttons["收起队列"].tap();XCTAssertTrue(waitForGone(app.buttons["收起队列"],timeout:10));app.buttons["收起播放选项"].tap();XCTAssertTrue(waitForGone(app.buttons["收起播放选项"],timeout:10));app.buttons["player-drag-handle"].tap()}
    // Clear through normal player navigation, then restart with persisted empty queue.
    if app.buttons["打开播放页"].waitForExistence(timeout:3){app.buttons["打开播放页"].tap();skin("classic");app.buttons["player-drag-handle"].tap();openQueue();app.buttons["清空播放队列"].tap();app.alerts.buttons["清空"].tap();app.terminate();app.launch()}
    openLocal()
    for name in names {
      app.buttons["导入音频文件"].tap();selectLocalFixture(name,in:app)
      XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:25))
    }
    for (index,name) in names.enumerated() {
      filter(name);if app.buttons["已收藏"].firstMatch.exists{app.buttons["已收藏"].firstMatch.tap()};app.buttons["加入歌单"].firstMatch.tap()
      if index == 0{createInPicker(source)}else{let row=app.buttons["添加到本地歌单：\(source)"];XCTAssertTrue(row.waitForExistence(timeout:8));row.tap()}
      XCTAssertTrue(app.staticTexts["已添加到本地歌单「\(source)」"].waitForExistence(timeout:10))
    }
    filter("");app.buttons["歌单"].tap();openPlaylist(source,2)
    app.buttons["local-playlist-track-0"].press(forDuration:1.1);bar(1)
    image("Real playlist mixed row selection");XCTAssertFalse(app.buttons["移除"].firstMatch.exists,"Single-row controls hide during selection")
    app.buttons["local-playlist-track-1"].tap();bar(2);image("Real playlist two rows selected")
    app.buttons["local-playlist-batch-select-all"].tap();bar(0)
    XCTAssertFalse(app.buttons["local-playlist-batch-action-移出歌单"].isEnabled)
    app.buttons["local-playlist-batch-cancel-selection"].tap();XCTAssertFalse(barElement().exists)
    selectBoth();app.buttons["local-playlist-batch-action-收藏"].tap()
    XCTAssertTrue(app.staticTexts["已收藏 2 首（仅本机）"].waitForExistence(timeout:10));XCTAssertFalse(barElement().exists)
    app.buttons["歌曲"].tap();XCTAssertEqual(app.buttons.matching(NSPredicate(format:"label == %@","已收藏")).count,2,"Favorite must use audio IDs rather than playlist-entry IDs");image("Real playlist favorites update local audio")
    app.buttons["歌单"].tap();openPlaylist(source,2);selectBoth();app.buttons["local-playlist-batch-action-加歌单"].tap();createInPicker(copy)
    XCTAssertTrue(app.staticTexts["已添加到本地歌单「\(copy)」"].waitForExistence(timeout:10));XCTAssertFalse(barElement().exists)
    selectBoth();app.buttons["local-playlist-batch-action-下一首"].tap()
    XCTAssertTrue(app.staticTexts["已添加 2 首到下一首播放"].waitForExistence(timeout:10));XCTAssertFalse(barElement().exists)
    app.buttons["收起本地音频"].tap();openQueue()
    for (index,name) in names.enumerated(){XCTAssertTrue(app.buttons["\(index+1). \(name)"].waitForExistence(timeout:10),"Queue must contain the actual two songs in playlist order")}
    image("Real playlist ordered authoritative queue");closeQueue();openLocal();app.buttons["歌单"].tap();openPlaylist(source,2)
    selectBoth();app.buttons["local-playlist-batch-action-下一首"].tap()
    XCTAssertTrue(app.staticTexts["所选歌曲已在队列中"].waitForExistence(timeout:10));XCTAssertFalse(barElement().exists)
    selectBoth();app.buttons["local-playlist-batch-action-移出歌单"].tap()
    XCTAssertTrue(app.staticTexts["已从歌单移除 2 首"].waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["此本地歌单暂无歌曲"].waitForExistence(timeout:8));image("Real playlist emptied by batch removal")
    app.terminate();app.launch();openLocal();app.buttons["歌单"].tap();openPlaylist(source,0)
    XCTAssertTrue(app.staticTexts["此本地歌单暂无歌曲"].waitForExistence(timeout:8));app.buttons["返回本地歌单"].tap();openPlaylist(copy,2);image("Real copied playlist persists after restart")
    app.buttons["local-playlist-track-0"].tap();app.buttons["收起本地音频"].tap();let player=app.buttons["打开播放页"];XCTAssertTrue(player.waitForExistence(timeout:15));player.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90),"Playlist removal must retain actual MP3 playback");XCTAssertTrue(app.buttons["暂停"].firstMatch.isHittable);image("Real playlist retained audio PCM playback");app.buttons["暂停"].firstMatch.tap()
    app.buttons["player-drag-handle"].tap();openLocal();app.buttons["歌曲"].tap();XCTAssertEqual(app.staticTexts["local-filter-count"].label,"2 / 2 首");XCTAssertEqual(app.buttons.matching(NSPredicate(format:"label == %@","已收藏")).count,2)
    // Build eight real playlist entries through normal UI; no queue injection.
    app.buttons["歌单"].tap();openPlaylist(copy,2)
    for total in [2,4] {
      app.buttons["local-playlist-track-0"].press(forDuration:1.1);bar(1,total:total)
      app.buttons["local-playlist-batch-select-all"].tap();bar(total,total:total)
      app.buttons["local-playlist-batch-action-加歌单"].tap()
      let destination=app.buttons["添加到本地歌单：\(copy)"];XCTAssertTrue(destination.waitForExistence(timeout:10));destination.tap()
      XCTAssertTrue(app.staticTexts["已添加到本地歌单「\(copy)」"].waitForExistence(timeout:10))
      app.buttons["返回本地歌单"].tap();openPlaylist(copy,total*2)
    }
    app.buttons["local-playlist-track-0"].tap();app.buttons["收起本地音频"].tap();player.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90));app.buttons["暂停"].firstMatch.tap()
    skin("am");let body=app.descendants(matching:.any).matching(identifier:"am-body").firstMatch
    XCTAssertTrue(body.waitForExistence(timeout:10));app.buttons["am-content-queue"].tap()
    for mode in ["one","shuffle","off"]{let choice=app.descendants(matching:.any).matching(identifier:"queue-mode-\(mode)").firstMatch;choice.tap();XCTAssertTrue(choice.isSelected)}
    XCTAssertTrue(app.staticTexts["· 1/8"].waitForExistence(timeout:10))
    XCTAssertTrue(app.buttons["1. \(names[0])"].isHittable);XCTAssertTrue(app.buttons["2. \(names[1])"].isHittable);image("Real eight entries AM queue first position")
    let last=app.buttons["8. \(names[1])"]
    for _ in 0..<6{if last.exists && last.isHittable{break};body.swipeUp()}
    XCTAssertTrue(last.isHittable,"All eight actual playlist entries must remain reachable");last.tap()
    // Track changes remount the AM body at its cover; reopen the actual queue.
    if !app.staticTexts["播放队列"].exists{app.buttons["am-content-queue"].tap()}
    XCTAssertTrue(app.staticTexts["· 8/8"].waitForExistence(timeout:10));XCTAssertTrue(app.buttons["暂停"].isHittable);image("Real eight entries AM queue last position");app.buttons["暂停"].tap()
    app.buttons["am-content-queue"].tap();skin("classic");XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:10))
  }

  // Batch 6 real-source acceptance: two live public songs saved offline, the
  // task page multi-select (Sollin E-1300) with batch actions, and the record
  // versus file separation (E-1303). Downloads may finish before navigation,
  // so the settled-state wait tolerates either outcome and cleanup runs
  // through the actual single-row path. Opt-in: real network and LX source.
  func testLiveDownloadBatch() throws {try runLiveDownloadBatch(exportNaming:false)}
  func testLiveDownloadNaming() throws {try runLiveDownloadBatch(exportNaming:true)}
  private func runLiveDownloadBatch(exportNaming:Bool) throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    func reach(_ item:XCUIElement){for _ in 0..<24 {if item.isHittable{break};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}};XCTAssertTrue(item.isHittable)}
    if exportNaming {
      let bytes=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/live-source-index")!);let rows=try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [[String:Any]]);XCTAssertEqual(rows.count,1)
      openSettings(app,page:"sources");let oldSource=app.buttons["停用音源：统一音乐源"];if oldSource.exists{reach(oldSource);oldSource.tap()};let address=app.textFields["音源订阅地址"];reach(address);address.tap();for character in "http://127.0.0.1:18439/live-source-0.js"{address.typeText(String(character))};XCTAssertEqual(address.value as? String,"http://127.0.0.1:18439/live-source-0.js");address.typeText("\n");let submit=app.buttons["从地址导入"];reach(submit);submit.tap()
      let imported=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !(address.value as? String ?? "").contains("127.0.0.1") && address.isEnabled},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[imported],timeout:25),.completed)
      let sourceName=try XCTUnwrap(rows.first?["name"] as? String);let importedRow=app.descendants(matching:.any).matching(identifier:"选择音源："+sourceName).firstMatch
      if !importedRow.waitForExistence(timeout:20){let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual source import failure hierarchy";tree.lifetime = .keepAlways;add(tree);XCTFail("Actual source import must produce its production catalog row");return}
      reach(importedRow);importedRow.tap();let enable=app.buttons["启用"].firstMatch;reach(enable);enable.tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","完成 ")).firstMatch.waitForExistence(timeout:180))
    }
    let handle=app.buttons["player-drag-handle"].firstMatch
    if handle.waitForExistence(timeout:2) {if handle.isHittable {handle.tap()} else {handle.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()};_ = waitForGone(handle,timeout:8)}
    func saveCurrent(){
      XCTAssertTrue(app.buttons["打开播放页"].waitForExistence(timeout:30));app.buttons["打开播放页"].firstMatch.tap()
      let save=app.buttons["保存离线"];XCTAssertTrue(save.waitForExistence(timeout:15));reach(save);save.tap()
      XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:8));app.buttons["收起播放页"].firstMatch.tap()
    }
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    // Cover/remix rows of a popular query often cannot resolve on the real LX
    // source (observed: 待解析 forever → 下载失败), so save the ORIGINAL row
    // of two well-known queries. Scroll momentum can shift rows under the tap
    // point, so settle before tapping and verify the player title; the quality
    // banner must leave 待解析 before saving or the task can never fetch bytes.
    // Resolved banner formats: classic "X 档位 · quality 实际请求" and
    // modern "偏好 q · 成功请求档位 quality（非实际文件格式证明）".
    func resolvedBanner()->Bool{return app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@ AND NOT label CONTAINS %@ AND (label CONTAINS %@ OR label CONTAINS %@)","档位","待解析","实际请求","成功请求档位")).firstMatch.exists}
    // Cover/remix rows of a popular query often never resolve on the real LX
    // source (observed: 待解析 forever → 下载失败), and the 300-row live list
    // drifts between runs, so try the first rows in order and only save a
    // track whose resolve actually settled.
    func searchAndSave(_ term:String)->String{
      let clear=app.buttons["search-clear"]
      if clear.exists {clear.tap()}
      query.tap();for character in term{query.typeText(String(character))};query.typeText("\n")
      var settled=String()
      for pick in 0..<3 {
        let row=app.buttons["search-track-wy-\(pick)"]
        XCTAssertTrue(row.waitForExistence(timeout:45),"Live public search must return real rows for \(term)")
        reach(row);Thread.sleep(forTimeInterval:0.8)
        let rowTitle=String(row.label.dropFirst(2))
        row.tap()
        let mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
        XCTAssertTrue(mini.waitForExistence(timeout:30))
        app.buttons["打开播放页"].firstMatch.tap()
        let resolved=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in resolvedBanner()},object:nil)
        if XCTWaiter.wait(for:[resolved],timeout:120) == .completed {
          settled=rowTitle
          let save=app.buttons["保存离线"];XCTAssertTrue(save.waitForExistence(timeout:15));reach(save);save.tap()
          XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:8));app.buttons["收起播放页"].firstMatch.tap()
          return settled
        }
        XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:8));app.buttons["收起播放页"].firstMatch.tap()
        Thread.sleep(forTimeInterval:1)
      }
      XCTFail("\(term): none of the first three rows resolved on the real source")
      return settled
    }
    _=searchAndSave("Shape of You")
    _=searchAndSave("Perfect")
    openSettings(app,page:"downloads")
    let tasks=app.buttons["settings-open-downloadTasks"];reach(tasks);tasks.tap()
    XCTAssertTrue(app.staticTexts["settings-title-downloadTasks"].waitForExistence(timeout:8))
    let statusTexts=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","offline-status-"))
    let saved=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in statusTexts.allElementsBoundByIndex.filter{$0.label.contains("已保存")||$0.label.contains("下载失败")}.count>=2},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[saved],timeout:420),.completed,"Both real downloads must settle")
    let summary=app.staticTexts["offline-task-summary"];XCTAssertTrue(summary.waitForExistence(timeout:8))
    XCTAssertTrue(summary.label.contains("0 个正在下载"),summary.label);XCTAssertTrue(summary.label.contains("2 个已保存"),summary.label)
    XCTAssertEqual(statusTexts.allElementsBoundByIndex.filter{$0.label.contains("已保存")}.count,2,"Two real songs must be saved offline")
    image("Real downloads saved offline")
    if exportNaming {
      openSettings(app,page:"downloads")
      let order=app.descendants(matching:.any).matching(identifier:"download-name-artist-title").firstMatch;reach(order);order.tap()
      let separator=app.textFields["download-name-separator"];reach(separator);separator.tap();let old=separator.value as? String ?? "";separator.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:old.count));for c in "__"{separator.typeText(String(c))};separator.typeText("\n")
      let saveName=app.buttons["download-name-save"];reach(saveName);saveName.tap();XCTAssertTrue(app.staticTexts["命名分隔符已保存"].waitForExistence(timeout:10));image("Real download naming saved")
      app.terminate();app.launch();openSettings(app,page:"downloads");reach(order);XCTAssertTrue(order.isSelected);reach(separator);XCTAssertEqual(separator.value as? String,"__");image("Real download naming restored")
      reach(tasks);tasks.tap()
      let export=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","导出音频文件：")).firstMatch;reach(export);let metadata=String(export.label.dropFirst("导出音频文件：".count)).components(separatedBy:" · ");XCTAssertEqual(metadata.count,2);export.tap()
      let saveActivity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch
      for _ in 0..<5{if saveActivity.exists&&saveActivity.isHittable{break};app.swipeUp()};XCTAssertTrue(saveActivity.waitForExistence(timeout:15));saveActivity.tap()
      let filename=app.textFields.firstMatch;XCTAssertTrue(filename.waitForExistence(timeout:10));let actualName=filename.value as? String ?? "";XCTAssertTrue(actualName.contains("__"));XCTAssertFalse(actualName.hasSuffix(".audio"));if metadata.count==2{XCTAssertTrue(actualName.hasPrefix(metadata[1]+"__"))};image("Real named audio OS save")
      let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","保存","儲存","存储"])).firstMatch;XCTAssertTrue(save.waitForExistence(timeout:10));save.tap();XCTAssertTrue(app.staticTexts["offline-task-summary"].waitForExistence(timeout:15));image("Real named audio saved source retained")
    }

    // The completed payload must play offline without touching the provider.
    let playSaved=app.buttons["播放离线文件"].firstMatch;XCTAssertTrue(playSaved.waitForExistence(timeout:8));reach(playSaved);playSaved.tap()
    XCTAssertTrue(app.buttons["打开播放页"].waitForExistence(timeout:10));app.buttons["打开播放页"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90),"Real saved download must decode to PCM")
    let pause=app.buttons["暂停"].firstMatch;if pause.isHittable{pause.tap()}
    XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:8));app.buttons["收起播放页"].firstMatch.tap()
    openSettings(app,page:"downloads");reach(tasks);tasks.tap()
    if exportNaming {image("Real named audio actual PCM source preserved");return}
    // Completed rows keep their own delete path; the batch selection bar is
    // bound to unfinished tasks, so cleanup runs per row (E-1303).
    for _ in 0..<2 {
      let remove=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","删除离线文件：")).firstMatch
      XCTAssertTrue(remove.waitForExistence(timeout:10));reach(remove);remove.tap();app.alerts.buttons["删除"].tap()
      RunLoop.current.run(until:Date().addingTimeInterval(2))
    }
    XCTAssertTrue(app.staticTexts["暂无已下载音频"].waitForExistence(timeout:10));image("Real offline storage cleaned")
  }

  // Batch 6 App acceptance for the task multi-select itself (Sollin E-1300,
  // E-1301): the 120-second fixture audio keeps each download mid-flight for
  // tens of seconds, so 批量暂停, 批量取消 and 批量重试 run against two
  // genuinely active tasks and settle to completed payloads. The live test
  // covers the real-provider end-to-end path; this one covers the mechanics.
  func testDownloadTaskBatchActions() throws {
    let app=XCUIApplication();app.launch()
    func reveal(_ element:XCUIElement){
      func visible()->Bool{guard element.exists else{return false};let frame=element.frame;return frame.width>0 && frame.height>0 && app.frame.insetBy(dx:4,dy:44).contains(frame) && element.isHittable}
      for _ in 0..<32 {if visible(){break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7 : 0.35)))}
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
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    // The scenario requires two in-flight transfers. Select that policy
    // through the production UI rather than relying on a historic default.
    openSettings(app,page:"downloads")
    func policy(_ value:Int){let e=app.descendants(matching:.any).matching(identifier:"download-concurrency-\(value)").firstMatch;reveal(e);e.tap();if value>1{XCTAssertTrue(app.alerts["提高下载并发？"].waitForExistence(timeout:5));app.alerts.buttons["使用 \(value) 并发"].tap()};let saved=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@","最多 \(value) 个任务"),object:app.staticTexts["download-concurrency-summary"]);XCTAssertEqual(XCTWaiter.wait(for:[saved],timeout:15),.completed)}
    policy(1);policy(2)
    openSettings(app,page:"sources")
    type(app.textFields["Navidrome服务器地址"],"http://127.0.0.1:18439");type(app.textFields["Navidrome用户名"],"fixture-user");type(app.secureTextFields["Navidrome密码"],"fixture-password")
    app.buttons["验证并保存连接"].tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:15))
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    let account=app.descendants(matching:.any).matching(identifier:"navidrome-account-fixture-user").firstMatch;XCTAssertTrue(account.waitForExistence(timeout:10));reveal(account);account.tap()
    // The 8-song long-queue album keeps each 120-second WAV download
    // mid-flight for about a minute, so two saves are still active when the
    // task page opens. The player's own transport button is the hittable
    // 下一首; the album page keeps a covered one behind the modal.
    let longQueueDone=expectation(description:"Enable long-queue fixture")
    URLSession.shared.dataTask(with:URL(string:"http://127.0.0.1:18439/am-fixture-control?longQueue=1")!){_,_,_ in longQueueDone.fulfill()}.resume()
    wait(for:[longQueueDone],timeout:10)
    let album=app.descendants(matching:.any).matching(identifier:"navidrome-item-album-fixture-album").firstMatch;XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();app.buttons["播放全部"].tap()
    XCTAssertTrue(app.buttons["打开播放页"].waitForExistence(timeout:15));app.buttons["打开播放页"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:30),"Fixture stream must play before saving")
    func saveCurrent(){
      let save=app.buttons["保存离线"];XCTAssertTrue(save.waitForExistence(timeout:15));reveal(save);save.tap()
      RunLoop.current.run(until:Date().addingTimeInterval(1))
    }
    saveCurrent()
    let next=app.buttons.matching(NSPredicate(format:"label == %@","下一首")).allElementsBoundByIndex.first{$0.isHittable}
    XCTAssertNotNil(next,"The player's own next control must be hittable while the modal is open")
    next!.tap()
    saveCurrent()
    XCTAssertTrue(app.buttons["收起播放页"].waitForExistence(timeout:8));app.buttons["收起播放页"].firstMatch.tap()
    openSettings(app,page:"downloads")
    let openTasks=app.buttons["settings-open-downloadTasks"];reveal(openTasks);openTasks.tap()
    XCTAssertTrue(app.staticTexts["settings-title-downloadTasks"].waitForExistence(timeout:8))
    let rows=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","offline-download-"))
    let active=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in rows.allElementsBoundByIndex.count>=2},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[active],timeout:30),.completed,"Two held downloads must appear as tasks")
    let summary=app.staticTexts["offline-task-summary"];XCTAssertTrue(summary.waitForExistence(timeout:8));XCTAssertTrue(summary.label.contains("2 个待处理"),summary.label)
    let bothRunning=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in summary.label.contains("2 个正在下载")},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[bothRunning],timeout:20),.completed,"The explicit two-task policy must admit both held transfers")
    // The row View's center sits over its action buttons; the content
    // Pressable that owns onLongPress lives in the row's upper half.
    func rowContent(_ row:XCUIElement)->XCUICoordinate{return row.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.2))}
    rowContent(rows.allElementsBoundByIndex.first!).press(forDuration:1.1)
    let bar=app.descendants(matching:.any).matching(identifier:"offline-batch-selection-bar").firstMatch
    XCTAssertTrue(bar.waitForExistence(timeout:8));XCTAssertEqual(bar.label,"已选 1 / 2 个任务")
    XCTAssertFalse(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","移除记录：")).firstMatch.exists,"Record removal hides while selecting");image("Batch selection entered on held downloads")
    let secondRow=rows.allElementsBoundByIndex[1];reveal(secondRow);rowContent(secondRow).tap()
    let twoSelected=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in bar.label=="已选 2 / 2 个任务"},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[twoSelected],timeout:8),.completed,"Tapping the second row must extend the selection")
    app.buttons["offline-batch-action-暂停"].tap()
    XCTAssertTrue(app.staticTexts["已暂停 2 / 2 个任务"].waitForExistence(timeout:15))
    let paused=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons.matching(NSPredicate(format:"label == %@","继续下载")).allElementsBoundByIndex.count>=2},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[paused],timeout:20),.completed,"Batch pause must settle both tasks");image("Batch paused two held downloads")
    rowContent(rows.allElementsBoundByIndex.first!).press(forDuration:1.1)
    XCTAssertTrue(bar.waitForExistence(timeout:8));let secondSelect=rows.allElementsBoundByIndex[1];reveal(secondSelect);rowContent(secondSelect).tap()
    app.buttons["offline-batch-action-取消"].tap()
    XCTAssertTrue(app.staticTexts["已取消 2 / 2 个任务"].waitForExistence(timeout:15))
    let cancelled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons.matching(NSPredicate(format:"label == %@","重试下载")).allElementsBoundByIndex.count>=2},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[cancelled],timeout:20),.completed,"Batch cancel must keep retryable records");image("Batch cancelled two held downloads")
    rowContent(rows.allElementsBoundByIndex.first!).press(forDuration:1.1)
    XCTAssertTrue(bar.waitForExistence(timeout:8));let retrySecond=rows.allElementsBoundByIndex[1];reveal(retrySecond);rowContent(retrySecond).tap()
    let retryTwo=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in bar.label=="已选 2 / 2 个任务"},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[retryTwo],timeout:8),.completed,"Retry selection must cover both cancelled records")
    app.buttons["offline-batch-action-重试"].tap()
    // Each retry resolves only when its download actually completes, so the
    // batch receipt lands after both 120-second fixtures finish (~2 minutes).
    XCTAssertTrue(app.staticTexts["已重试 2 / 2 个任务"].waitForExistence(timeout:240))
    let saved=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","删除离线文件：")).allElementsBoundByIndex.count>=2},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[saved],timeout:150),.completed,"Batch retry must complete both payloads");image("Batch retried downloads completed")
    for _ in 0..<2 {
      let remove=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","删除离线文件：")).firstMatch
      XCTAssertTrue(remove.waitForExistence(timeout:10));reveal(remove);remove.tap();app.alerts.buttons["删除"].tap()
      RunLoop.current.run(until:Date().addingTimeInterval(2))
    }
    XCTAssertTrue(app.staticTexts["暂无已下载音频"].waitForExistence(timeout:10))
    openSettings(app,page:"downloads");policy(1)
    openSettings(app,page:"sources");let removeAccount=app.buttons["移除连接：fixture-user"];reveal(removeAccount);removeAccount.tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
  }

  func testLiveLocalIndexActions() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap()}
    func filter(){let input=app.textFields["搜索本地歌曲艺术家专辑"];XCTAssertTrue(input.waitForExistence(timeout:10));input.tap();for character in "Shape of You"{input.typeText(String(character))};XCTAssertEqual(input.value as? String,"Shape of You");input.typeText("\n")}
    func row()->XCUIElement{app.buttons["local-track-0"]}
    let handle=app.buttons["player-drag-handle"].firstMatch;if handle.waitForExistence(timeout:2){handle.tap()}
    openLocal();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20));filter()
    XCTAssertTrue(row().waitForExistence(timeout:10));XCTAssertTrue(row().isHittable);image("Real public audio local list")
    row().press(forDuration:1.2)
    let bar=app.descendants(matching:.any).matching(identifier:"local-batch-selection-bar").firstMatch
    XCTAssertTrue(bar.waitForExistence(timeout:8));XCTAssertTrue(app.staticTexts["已选 1 / 1 首"].exists)
    app.buttons["local-batch-select-all"].tap();XCTAssertTrue(app.staticTexts["已选 0 / 1 首"].exists)
    app.buttons["local-batch-select-all"].tap();XCTAssertTrue(app.staticTexts["已选 1 / 1 首"].exists);image("Real public audio local selection")
    app.buttons["local-batch-action-收藏"].tap();XCTAssertTrue(bar.waitForNonExistence(timeout:10));XCTAssertTrue(app.buttons["已收藏"].exists)
    row().press(forDuration:1.2);app.buttons["local-batch-action-收藏"].tap();XCTAssertTrue(bar.waitForNonExistence(timeout:10));XCTAssertTrue(app.buttons["已收藏"].exists)
    row().press(forDuration:1.2);app.buttons["local-batch-action-下一首"].tap();XCTAssertTrue(bar.waitForNonExistence(timeout:10))
    row().press(forDuration:1.2);app.buttons["local-batch-action-下一首"].tap();XCTAssertTrue(app.staticTexts["所选歌曲已在队列中"].waitForExistence(timeout:8))
    row().press(forDuration:1.2);app.buttons["local-batch-action-加歌单"].tap();XCTAssertTrue(app.buttons["取消添加到本地歌单"].waitForExistence(timeout:8))
    let name="公开歌曲\(Int(Date().timeIntervalSince1970)%100000)";let field=app.textFields["新建本地歌单名称"];field.tap();for character in name{field.typeText(String(character))};XCTAssertEqual(field.value as? String,name);field.typeText("\n");app.buttons["新建本地歌单并添加"].tap()
    XCTAssertTrue(bar.waitForNonExistence(timeout:10));XCTAssertTrue(app.staticTexts["已添加到本地歌单「\(name)」"].exists)
    app.buttons["从列表移除"].tap();XCTAssertTrue(app.alerts["从本地列表移除？"].waitForExistence(timeout:5));app.alerts.buttons["取消"].tap();XCTAssertTrue(row().exists)
    row().press(forDuration:1.2);app.buttons["local-batch-action-删除"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(row().waitForNonExistence(timeout:10));XCTAssertTrue(app.buttons["local-restore-index"].exists);image("Real audio index removed file retained")
    app.terminate();app.launch();openLocal();filter();XCTAssertFalse(row().exists)
    app.buttons["local-restore-index"].tap();XCTAssertTrue(row().waitForExistence(timeout:10));XCTAssertTrue(app.buttons["已收藏"].exists);image("Real audio index restored after restart")
    row().tap();app.buttons["收起本地音频"].tap();let player=app.buttons["打开播放页"];XCTAssertTrue(player.waitForExistence(timeout:15));player.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:90),"Restored actual MP3 must decode to PCM");XCTAssertTrue(app.buttons["暂停"].firstMatch.isHittable)
    XCTAssertTrue(app.staticTexts["本地 MP3 · 原始文件"].exists)
    let favorite=app.buttons["收藏歌曲"].firstMatch;XCTAssertEqual(favorite.value as? String,"已收藏");favorite.tap();XCTAssertEqual(favorite.value as? String,"未收藏");favorite.tap();XCTAssertEqual(favorite.value as? String,"已收藏")
    image("Real audio restored PCM playback");app.buttons["暂停"].firstMatch.tap()
    app.buttons["收起播放页"].firstMatch.tap();openSettings(app,page:"storage")
    let clear=app.buttons["清理临时音频、封面和歌词缓存"]
    for _ in 0..<16{if clear.isHittable{break};app.swipeUp()}
    XCTAssertTrue(clear.isHittable);clear.tap()
    let confirmation=app.alerts["清理临时缓存？"]
    XCTAssertTrue(confirmation.waitForExistence(timeout:5));XCTAssertTrue(confirmation.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","离线下载及本地音频")).firstMatch.exists)
    image("Real audio cache clear confirmation");confirmation.buttons["取消"].tap();XCTAssertTrue(confirmation.waitForNonExistence(timeout:5));XCTAssertTrue(clear.isEnabled)
    clear.tap();confirmation.buttons["清理"].tap()
    XCTAssertTrue(app.staticTexts["已清理临时缓存，离线下载与本地音频已保留"].waitForExistence(timeout:20));image("Real audio cache clear completed")
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let reopen=app.buttons["打开播放页"];XCTAssertTrue(reopen.waitForExistence(timeout:10));reopen.tap();app.buttons["播放"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:30));XCTAssertTrue(app.buttons["暂停"].firstMatch.isHittable);image("Real audio playback retained after cache clear");app.buttons["暂停"].firstMatch.tap()
  }

  func testLiveListeningStatistics() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    let statisticsList=app.descendants(matching:.any).matching(identifier:"statistics-list").firstMatch
    func top(){for _ in 0..<10{if app.buttons["statistics-group-songs"].isHittable{break};statisticsList.swipeDown()}}
    func tapHeader(_ item:XCUIElement){top();XCTAssertTrue(item.isHittable);item.tap()}
    func reach(_ item:XCUIElement){for _ in 0..<16{if item.isHittable{break};statisticsList.swipeUp()};if !item.isHittable{image("Real listening statistics reach failure");let tree=XCTAttachment(string:app.debugDescription);tree.name="Real statistics reach hierarchy";tree.lifetime = .keepAlways;add(tree)};XCTAssertTrue(item.isHittable)}
    func openStats(){openSettings(app,page:"storage");let entry=app.buttons["open-listening-statistics"];for _ in 0..<18{if entry.isHittable{break};app.swipeUp()};XCTAssertTrue(entry.isHittable);entry.tap();XCTAssertTrue(app.buttons["收起听歌统计"].waitForExistence(timeout:10));top()}
    let handle=app.buttons["player-drag-handle"].firstMatch;if handle.waitForExistence(timeout:2){handle.tap()}
    // Establish the baseline through the product confirmation, never by seeding
    // counters. This dedicated simulator contains only public acceptance data.
    openStats();app.buttons["清空本机听歌统计"].tap();app.alerts.buttons["清空"].tap()
    XCTAssertTrue(app.staticTexts["播放统计已清空"].waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["暂无此范围的听歌统计，实际播放后会出现在这里。"].exists)
    app.buttons["收起听歌统计"].tap();app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let local=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;XCTAssertTrue(local.waitForExistence(timeout:15));local.tap()
    app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20))
    let input=app.textFields["搜索本地歌曲艺术家专辑"];input.tap();for character in "Shape of You"{input.typeText(String(character))};XCTAssertEqual(input.value as? String,"Shape of You");input.typeText("\n");XCTAssertTrue(app.buttons["local-track-0"].waitForExistence(timeout:8));app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap()
    app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(6));app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    openStats();let rows=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","statistics-row-"));XCTAssertTrue(app.staticTexts["statistics-counts"].label.contains("歌曲 1 · 已知歌手 0 · 已知专辑 0"));image("Real listening statistics overview");reach(rows.firstMatch);XCTAssertEqual(rows.count,1);XCTAssertTrue(rows.firstMatch.label.contains("Shape of You - Ed Sheeran"));image("Real listening statistics songs")
    tapHeader(app.buttons["按播放次数"]);XCTAssertTrue(app.buttons["按播放次数"].isSelected);tapHeader(app.buttons["statistics-group-artists"]);reach(rows.firstMatch);XCTAssertEqual(rows.count,1);XCTAssertTrue(rows.firstMatch.label.contains("未知艺术家"))
    tapHeader(app.buttons["statistics-group-albums"]);reach(rows.firstMatch);XCTAssertTrue(rows.firstMatch.label.contains("未知专辑"));rows.firstMatch.tap();XCTAssertTrue(app.buttons["返回统计分组"].waitForExistence(timeout:5));reach(rows.firstMatch);XCTAssertTrue(rows.firstMatch.label.contains("Shape of You"));app.buttons["返回统计分组"].tap()
    tapHeader(app.buttons["全部日期"]);XCTAssertTrue(app.buttons["取消选择日期"].waitForExistence(timeout:5));let date=app.buttons.matching(NSPredicate(format:"label MATCHES %@","[0-9]{4}-[0-9]{2}-[0-9]{2} · .*" )).firstMatch;XCTAssertTrue(date.waitForExistence(timeout:8));date.tap();image("Real listening statistics day and hours")
    XCUIDevice.shared.orientation = .landscapeLeft
    XCTAssertTrue(app.buttons["收起听歌统计"].waitForExistence(timeout:10));reach(rows.firstMatch);XCTAssertTrue(app.buttons["清空本机听歌统计"].isHittable);image("Real listening statistics landscape reachability")
    XCUIDevice.shared.orientation = .portrait
    tapHeader(app.buttons["statistics-group-songs"]);reach(rows.firstMatch);rows.firstMatch.tap();XCTAssertTrue(app.buttons["收起听歌统计"].waitForNonExistence(timeout:10));app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:30));app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    app.terminate();app.launch();openStats();reach(rows.firstMatch);XCTAssertEqual(rows.count,1);XCTAssertTrue(rows.firstMatch.label.contains("播放 2 次"));image("Real listening statistics restored after restart");app.buttons["收起听歌统计"].tap()
  }

  func testLiveStatisticsSync() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){for _ in 0..<18{if element.isHittable{return};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func openStats(){openSettings(app,page:"storage");let entry=app.buttons["open-listening-statistics"];reach(entry);entry.tap();XCTAssertTrue(app.buttons["收起听歌统计"].waitForExistence(timeout:10))}
    func clear(){app.buttons["清空本机听歌统计"].tap();app.alerts.buttons["清空"].tap();XCTAssertTrue(app.staticTexts["播放统计已清空"].waitForExistence(timeout:10))}
    func cloud(){openSettings(app,page:"storage");let entry=app.buttons["statistics-cloud-open"];reach(entry);entry.tap();XCTAssertTrue(app.buttons["收起统计同步"].waitForExistence(timeout:10))}
    func action(_ id:String){let button=app.buttons[id];reach(button);XCTAssertTrue(button.isEnabled);button.tap()}
    func message(_ value:String){let item=app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@",value)).firstMatch;XCTAssertTrue(item.waitForExistence(timeout:25))}
    func probe() throws -> [String:Any]{let done=expectation(description:"Actual statistics HTTP state");var result:[String:Any]=[:];URLSession.shared.dataTask(with:URL(string:"http://127.0.0.1:18439/statistics-probe-state")!){data,_,error in
      XCTAssertNil(error);if let data=data{result=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] ?? [:]};done.fulfill()
    }.resume();wait(for:[done],timeout:10);return result}
    func pauseAfterPlayback(){app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(6));app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()}
    let handle=app.buttons["player-drag-handle"].firstMatch;if handle.waitForExistence(timeout:2){handle.tap()}
    openStats();clear();app.buttons["收起听歌统计"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let local=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;reach(local);local.tap();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app)
    message("已导入");let search=app.textFields["搜索本地歌曲艺术家专辑"];search.tap();for c in "Shape of You"{search.typeText(String(c))};XCTAssertEqual(search.value as? String,"Shape of You");search.typeText("\n");app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();pauseAfterPlayback()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let webdav=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch;reach(webdav);webdav.tap()
    let address=app.textFields["WebDAV服务器根目录"];if !address.waitForExistence(timeout:2){app.buttons["管理WebDAV连接"].tap()}
    let old=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","移除WebDAV连接：Public statistics"));while old.firstMatch.exists{reach(old.firstMatch);old.firstMatch.tap();app.alerts.buttons["移除"].tap();message("WebDAV连接与凭据已移除")}
    let account="Public statistics "+String(Int(Date().timeIntervalSince1970)),folder="public-statistics/"
    for (field,value) in [(address,"http://127.0.0.1:18439/backup-dav/"),(app.textFields["WebDAV用户名"],"fixture-user")]{reach(field);field.tap();for c in value{field.typeText(String(c))};field.typeText("\n");XCTAssertEqual(field.value as? String,value)}
    let password=app.secureTextFields["WebDAV密码"];reach(password);password.tap();for c in "fixture-password"{password.typeText(String(c))};password.typeText("\n");let label=app.textFields["WebDAV连接名称"];reach(label);label.tap();for c in account{label.typeText(String(c))};label.typeText("\n");XCTAssertEqual(label.value as? String,account);reach(app.buttons["验证并保存WebDAV"]);app.buttons["验证并保存WebDAV"].tap();XCTAssertTrue(app.buttons["刷新WebDAV目录"].waitForExistence(timeout:20));image("Real statistics public WebDAV connection");let closeDAV=app.buttons["收起WebDAV"];XCTAssertTrue(waitForHittable(closeDAV,timeout:10));closeDAV.tap();XCTAssertTrue(closeDAV.waitForNonExistence(timeout:10));_=dismissPasswordSuggestion(in:app)
    cloud();let connection=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","统计连接："+account)).firstMatch;reach(connection);connection.tap();let directory=app.textFields["统计同步相对目录"];reach(directory);replaceText(directory,with:folder,in:app);action("statistics-cloud-save");message("统计目录已保存")
    action("statistics-cloud-refresh");message("云端暂无听歌统计")
    action("statistics-cloud-upload");XCTAssertTrue(app.alerts["上传听歌统计？"].waitForExistence(timeout:15));image("Real statistics upload confirmation");app.alerts.buttons["取消"].tap();message("上传预览已取消，云端未写入");XCTAssertEqual(try probe()["puts"] as? Int,0)
    action("statistics-cloud-upload");XCTAssertTrue(app.alerts["上传听歌统计？"].waitForExistence(timeout:15));app.alerts.buttons["继续上传统计"].tap();message("听歌统计已上传并回读验证（修订 #1）");image("Real statistics uploaded revision one");XCTAssertEqual(try probe()["playCount"] as? Int,1);app.buttons["收起统计同步"].tap()
    openStats();clear();app.buttons["收起听歌统计"].tap();cloud()
    for _ in 0..<2{action("statistics-cloud-download");message("已合并云端听歌统计（修订 #1）")};app.buttons["收起统计同步"].tap()
    openStats();let row=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","statistics-row-")).firstMatch;reach(row);XCTAssertTrue(row.label.contains("播放 1 次"));image("Real statistics duplicate merge preserves one play");row.tap();pauseAfterPlayback()
    cloud();action("statistics-cloud-download");message("已合并云端听歌统计（修订 #1）");action("statistics-cloud-upload");XCTAssertTrue(app.alerts["上传听歌统计？"].waitForExistence(timeout:15));app.alerts.buttons["继续上传统计"].tap();message("听歌统计已上传并回读验证（修订 #2）");let final=try probe();XCTAssertEqual(final["puts"] as? Int,2);XCTAssertEqual(final["playCount"] as? Int,2);image("Real statistics merged and uploaded revision two");app.buttons["收起统计同步"].tap()
    app.terminate();app.launch();cloud();XCTAssertEqual(directory.value as? String,folder);action("statistics-cloud-refresh");message("云端修订 #2");image("Real statistics cloud configuration after restart");app.buttons["收起统计同步"].tap();openStats();reach(row);XCTAssertTrue(row.label.contains("播放 2 次"));image("Real statistics two plays after restart");app.buttons["收起听歌统计"].tap()
  }

  func testLiveBackupSettings() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let monitor=addUIInterruptionMonitor(withDescription:"System password suggestion"){[unowned self] alert in self.dismissPasswordSuggestion(in:alert)}
    defer{removeUIInterruptionMonitor(monitor)}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<20{if element.isHittable{return};let above=element.exists && element.frame.midY<app.frame.midY;let settings=app.descendants(matching:.any).matching(identifier:"cloud-backup-settings").firstMatch;if settings.exists && element.identifier != "cloud-backup-preview-0"{if above{settings.swipeDown()}else{settings.swipeUp()}}else{app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))}};XCTAssertTrue(element.isHittable)}
    func message(_ value:String){XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@",value)).firstMatch.waitForExistence(timeout:25))}
    func tap(_ element:XCUIElement){reach(element);XCTAssertTrue(element.isEnabled);element.tap()}
    func radio(_ name:String)->XCUIElement{app.descendants(matching:.any).matching(NSPredicate(format:"label == %@",name)).firstMatch}
    func quality(_ name:String){openSettings(app,page:"playback");let button=radio(name);tap(button);XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true"),object:button)],timeout:10),.completed)}
    func offsets(_ value:Int,verify:Bool=false){app.buttons["打开播放页"].firstMatch.tap();let track=radio("调整本曲");reach(track)
      if !verify{track.tap();tap(app.buttons["重置"].firstMatch);if value != 0{tap(app.buttons["+100ms"].firstMatch)};tap(radio("调整全局"));tap(app.buttons["重置"].firstMatch);if value != 0{tap(app.buttons["+100ms"].firstMatch)}}
      message("全局 \(value)ms · 本曲 \(value)ms");if verify{image("Real backup restored lyric offsets")};tap(app.buttons["收起播放页"].firstMatch)
    }
    func cloud(){openSettings(app,page:"storage");tap(app.buttons["cloud-backup-open"]);XCTAssertTrue(app.buttons["收起云备份"].waitForExistence(timeout:10))}
    func localRestore(cancel:Bool){openSettings(app,page:"storage");tap(app.buttons["恢复音枢备份"]);selectLocalFixture("Actual Public Music Backup",in:app);XCTAssertTrue(app.alerts["恢复音枢备份"].waitForExistence(timeout:15));XCTAssertTrue(app.alerts.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","包含播放/歌词/EQ和外观设置")).firstMatch.exists);image(cancel ? "Real backup local restore cancellation" : "Real backup local restore confirmation");app.alerts.buttons[cancel ? "取消":"替换音乐库"].tap();if !cancel{message("音乐库与播放统计已恢复")}}
    selectClassicSourcePlayback(in:app)
    openSettings(app,page:"storage");tap(app.buttons["open-listening-statistics"]);app.buttons["清空本机听歌统计"].tap();app.alerts.buttons["清空"].tap();message("播放统计已清空");app.buttons["收起听歌统计"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let local=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;tap(local);app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app);message("已导入")
    let search=app.textFields["搜索本地歌曲艺术家专辑"];search.tap();for c in "Shape of You"{search.typeText(String(c))};XCTAssertEqual(search.value as? String,"Shape of You");search.typeText("\n");app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(6));app.buttons["暂停"].firstMatch.tap();tap(app.buttons["收起播放页"].firstMatch)
    offsets(100);quality("128k");openSettings(app,page:"typography");tap(app.buttons["lyric-align-center"]);XCTAssertEqual(app.buttons["lyric-align-center"].label,"居中 ✓")
    openSettings(app,page:"equalizer");let stale=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","删除预设Public backup "));while stale.firstMatch.exists{let oldLabel=stale.firstMatch.label;tap(stale.firstMatch);XCTAssertTrue(app.buttons[oldLabel].waitForNonExistence(timeout:10))};let enabled=app.switches["启用均衡器"];if enabled.value as? String != "1"{tap(enabled)};tap(app.buttons["eq-builtin-3"]);let presetName="Public backup "+String(Int(Date().timeIntervalSince1970));let field=app.textFields["自定义声音预设名称"];tap(field);for c in presetName{field.typeText(String(c))};field.typeText("\n");tap(app.buttons["eq-save-preset"]);XCTAssertTrue(app.buttons[presetName].waitForExistence(timeout:10))
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let webdav=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch;tap(webdav)
    let address=app.textFields["WebDAV服务器根目录"];if !address.waitForExistence(timeout:2){app.buttons["管理WebDAV连接"].tap()};let prior=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","移除WebDAV连接：Public backup")).firstMatch;if prior.exists{tap(prior);app.alerts.buttons["移除"].tap();message("WebDAV连接与凭据已移除")}
    for (input,value) in [(address,"http://127.0.0.1:18439/backup-dav/"),(app.textFields["WebDAV用户名"],"fixture-user")]{tap(input);for c in value{input.typeText(String(c))};input.typeText("\n");XCTAssertEqual(input.value as? String,value)}
    let password=app.secureTextFields["WebDAV密码"];tap(password);for c in "fixture-password"{password.typeText(String(c))};password.typeText("\n");let label=app.textFields["WebDAV连接名称"];tap(label);for c in presetName{label.typeText(String(c))};label.typeText("\n");XCTAssertEqual(label.value as? String,presetName);tap(app.buttons["验证并保存WebDAV"]);XCTAssertTrue(app.buttons["刷新WebDAV目录"].waitForExistence(timeout:20));let closeDAV=app.buttons["收起WebDAV"];XCTAssertTrue(waitForHittable(closeDAV,timeout:10));closeDAV.tap();XCTAssertTrue(closeDAV.waitForNonExistence(timeout:10));_=dismissPasswordSuggestion(in:app)
    cloud();let account=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","备份连接："+presetName)).firstMatch;tap(account);let directory=app.textFields["云备份相对目录"];reach(directory);replaceText(directory,with:"public-settings-backup-"+String(Int(Date().timeIntervalSince1970))+"/",in:app);tap(app.buttons["cloud-backup-save"]);message("备份目录已保存");tap(app.buttons["cloud-backup-upload"]);message("备份已上传并通过回读摘要与格式校验");image("Real backup settings uploaded");app.buttons["收起云备份"].tap()
    quality("flac");offsets(0);openSettings(app,page:"typography");tap(app.buttons["lyric-align-left"]);openSettings(app,page:"equalizer");tap(app.buttons["删除预设"+presetName]);tap(app.buttons["eq-builtin-0"]);if enabled.value as? String == "1"{tap(enabled)}
    cloud();tap(app.buttons["cloud-backup-list"]);message("已读取 1 个JSON备份");tap(app.buttons["cloud-backup-preview-0"]);message("设置：包含 · EQ预设 1 · 单曲歌词偏移 1");image("Real backup settings verified preview");tap(app.buttons["cloud-backup-restore"]);XCTAssertTrue(app.alerts["恢复云端备份？"].waitForExistence(timeout:5));image("Real backup cloud settings confirmation");app.alerts.buttons["确认恢复云备份"].tap();message("本机音乐库与播放统计已恢复");app.buttons["收起云备份"].tap()
    openSettings(app,page:"playback");let restoredQuality=radio("128k");reach(restoredQuality);XCTAssertTrue(restoredQuality.isSelected);image("Real backup playback preference restored");offsets(100,verify:true)
    openSettings(app,page:"typography");reach(app.buttons["lyric-align-center"]);XCTAssertEqual(app.buttons["lyric-align-center"].label,"居中 ✓");openSettings(app,page:"equalizer");XCTAssertEqual(enabled.value as? String,"1");XCTAssertTrue(app.buttons[presetName].isSelected,"Restored preset must match before any scroll gesture");reach(app.buttons[presetName]);XCTAssertTrue(app.buttons[presetName].isSelected);image("Real backup custom EQ restored")
    quality("flac");localRestore(cancel:true);openSettings(app,page:"playback");reach(radio("flac"));XCTAssertTrue(radio("flac").isSelected);localRestore(cancel:false)
    app.terminate();app.launch();openSettings(app,page:"playback");reach(restoredQuality);XCTAssertTrue(restoredQuality.isSelected);offsets(100,verify:true);openSettings(app,page:"equalizer");XCTAssertEqual(enabled.value as? String,"1");XCTAssertTrue(app.buttons[presetName].isSelected,"Restored preset must match before any scroll gesture");reach(app.buttons[presetName]);XCTAssertTrue(app.buttons[presetName].isSelected);image("Real backup settings after restart")
    openSettings(app,page:"storage");tap(app.buttons["open-listening-statistics"]);let row=app.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@","statistics-row-")).firstMatch;reach(row);XCTAssertTrue(row.label.contains("播放 1 次"));row.tap();app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(6));app.buttons["暂停"].firstMatch.tap();image("Real backup actual playback after restore");tap(app.buttons["收起播放页"].firstMatch)
  }

  func testLiveRestoredTimeline() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<18{if element.isHittable{return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func progress()->XCUIElement{app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch}
    func checkCold(_ name:String){XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:15));let item=progress();reach(item);XCTAssertTrue((item.value as? String ?? "").contains("/ 3:53"));XCTAssertFalse(item.isEnabled,"Metadata must never enable native seeking before prepare");XCTAssertFalse(app.buttons["暂停"].firstMatch.exists);image(name)}
    func layout(_ id:String){let close=app.buttons["收起播放页"].firstMatch;reach(close);close.tap();openSettings(app,page:"skins");let item=app.descendants(matching:.any).matching(identifier:"player-layout-"+id).firstMatch;reach(item);item.tap();XCTAssertTrue(app.buttons["skins-sheet-close"].waitForNonExistence(timeout:10));app.buttons["打开播放页"].firstMatch.tap()}
    selectClassicSourcePlayback(in:app);openSettings(app,page:"storage");let entry=app.buttons["open-listening-statistics"];reach(entry);entry.tap();app.buttons["清空本机听歌统计"].tap();app.alerts.buttons["清空"].tap();XCTAssertTrue(app.staticTexts["播放统计已清空"].waitForExistence(timeout:10));app.buttons["收起听歌统计"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let local=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;reach(local);local.tap();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app);XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20))
    let field=app.textFields["搜索本地歌曲艺术家专辑"];field.tap();for c in "Shape of You"{field.typeText(String(c))};XCTAssertEqual(field.value as? String,"Shape of You");field.typeText("\n");app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(6));app.buttons["暂停"].firstMatch.tap();let nativeValue=progress().value as? String ?? "";XCTAssertTrue(nativeValue.contains("/ 3:53"));let savedPosition=nativeValue.components(separatedBy:" / ").first
    app.terminate();app.launch();app.buttons["打开播放页"].firstMatch.tap();checkCold("Real restored timeline classic paused");XCTAssertEqual((progress().value as? String)?.components(separatedBy:" / ").first,savedPosition)
    layout("am");checkCold("Real restored timeline AM paused");layout("wave");checkCold("Real restored timeline wave paused");let ring=app.descendants(matching:.any).matching(identifier:"wave-seek-ring").firstMatch;XCTAssertTrue(ring.waitForExistence(timeout:10));XCTAssertTrue((ring.value as? String ?? "").contains("/ 3:53"));XCTAssertFalse(ring.isEnabled)
    app.buttons["播放"].firstMatch.tap();XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"wave-spectrum-bars").firstMatch.waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertTrue(progress().isEnabled);XCTAssertTrue(ring.isEnabled);app.buttons["暂停"].firstMatch.tap();image("Real restored timeline native duration after explicit playback")
    layout("classic");let expected=(progress().value as? String)?.components(separatedBy:" / ").first;app.terminate();app.launch();app.buttons["打开播放页"].firstMatch.tap();checkCold("Real restored timeline second restart");XCTAssertEqual((progress().value as? String)?.components(separatedBy:" / ").first,expected)
  }

  func testLiveThemeConfig() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<18{if element.isHittable{return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func item(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func tap(_ id:String){let element=item(id);reach(element);element.tap()}
    selectClassicSourcePlayback(in:app);app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let local=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;reach(local);local.tap();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app);XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20))
    let field=app.textFields["搜索本地歌曲艺术家专辑"];field.tap();for c in "Shape of You"{field.typeText(String(c))};XCTAssertEqual(field.value as? String,"Shape of You");field.typeText("\n");app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));app.buttons["暂停"].firstMatch.tap();image("Real theme actual public playback before import");app.buttons["收起播放页"].firstMatch.tap()
    openSettings(app,page:"appearance");let cover=app.switches["appearance-cover-color"];reach(cover);if cover.value as? String == "1"{cover.tap()};XCTAssertEqual(cover.value as? String,"0")
    openSettings(app,page:"background");tap("visual-blush");tap("background-solid");XCTAssertTrue(item("visual-blush").isSelected);image("Real theme original configuration")
    tap("appearance-export-theme");let saveActivity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch;for _ in 0..<5{if saveActivity.exists&&saveActivity.isHittable{break};app.swipeUp()};guard saveActivity.waitForExistence(timeout:15) else{let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual theme export share hierarchy";tree.lifetime = .keepAlways;add(tree);XCTFail("Actual OS Save to Files must be available");return};saveActivity.tap()
    let phone=app.cells.matching(NSPredicate(format:"label IN %@",["On My iPhone","我的iPhone","我的 iPhone","在我的 iPhone"])).firstMatch;if phone.waitForExistence(timeout:3){phone.tap()};let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch;if folder.waitForExistence(timeout:3){folder.tap()}
    let filename=app.textFields.firstMatch;XCTAssertTrue(filename.waitForExistence(timeout:10));let actualName=filename.value as? String ?? "";XCTAssertTrue(actualName.hasPrefix("nexus-theme-"));image("Real theme OS save actual exported file");let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","保存","儲存","存储"])).firstMatch;XCTAssertTrue(save.waitForExistence(timeout:10));XCTAssertTrue(save.isEnabled);save.tap();XCTAssertTrue(item("appearance-export-theme").waitForExistence(timeout:15))
    tap("background-sheet-close");openSettings(app,page:"appearance");reach(cover);cover.tap();XCTAssertEqual(cover.value as? String,"1");openSettings(app,page:"background");tap("visual-mint");tap("background-gradient");XCTAssertTrue(item("visual-mint").isSelected)
    func chooseActualExport(){tap("appearance-import-theme");selectLocalFixture(actualName.components(separatedBy:".json").first!,in:app);XCTAssertTrue(app.alerts["导入主题配置"].waitForExistence(timeout:15))}
    chooseActualExport();image("Real theme import preview cancel");app.alerts.buttons["取消"].tap();XCTAssertTrue(item("visual-mint").isSelected);XCTAssertTrue(item("background-gradient").isSelected)
    chooseActualExport();app.alerts.buttons["应用主题"].tap();let success=app.alerts["主题已导入"];XCTAssertTrue(success.waitForExistence(timeout:15));XCTAssertEqual(success.buttons.count,1);success.buttons.firstMatch.tap();XCTAssertTrue(item("visual-blush").isSelected);XCTAssertTrue(item("background-solid").isSelected);image("Real theme restored actual configuration")
    tap("background-sheet-close");app.terminate();app.launch();openSettings(app,page:"appearance");reach(cover);XCTAssertEqual(cover.value as? String,"0");openSettings(app,page:"background");XCTAssertTrue(item("visual-blush").waitForExistence(timeout:10));XCTAssertTrue(item("visual-blush").isSelected);XCTAssertTrue(item("background-solid").isSelected);image("Real theme restored after restart")
    XCUIDevice.shared.orientation = .landscapeLeft
    reach(item("appearance-import-theme"));XCTAssertTrue(app.frame.contains(item("appearance-export-theme").frame));image("Real theme landscape action reachability");XCUIDevice.shared.orientation = .portrait
    tap("background-sheet-close");app.buttons["打开播放页"].firstMatch.tap();XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:10));app.buttons["播放"].firstMatch.tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));app.buttons["暂停"].firstMatch.tap();image("Real theme actual playback after restore")
  }

  func testLiveDownloadQuality() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func item(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:15));for _ in 0..<24{if element.isHittable{return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func tap(_ id:String){let element=item(id);reach(element);element.tap()}
    func summary(_ text:String){let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@",text),object:app.staticTexts["download-platform-quality-summary"]);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:15),.completed)}
    func openQuality(){openSettings(app,page:"downloads");tap("download-quality-open")}
    func choose(_ platform:String,_ quality:String){tap("download-platform-"+platform);tap("download-quality-"+quality);summary(quality=="follow" ? "跟随播放设置":quality)}
    openQuality();choose("wy","128k");image("Real NetEase download preference 128k")
    choose("tx","320k");image("Real QQ independent download preference 320k")
    choose("tx","follow");tap("download-platform-wy");summary("128k");image("Real resetting QQ preserves NetEase preference");choose("tx","320k")
    app.terminate();app.launch();openQuality();summary("128k");tap("download-platform-tx");summary("320k");image("Real platform download preferences restored")
    openSettings(app,page:"playback");let playback320=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","320k")).firstMatch;reach(playback320);playback320.tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true"),object:playback320)],timeout:15),.completed);image("Real playback preference separately 320k")
    let automatic=app.buttons["automatic-online-matching"];reach(automatic);let wasAutomatic=automatic.label.hasSuffix("开启")
    if wasAutomatic{automatic.tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","关闭"),object:automatic)],timeout:15),.completed)}
    openSettings(app,page:"downloads");tap("settings-open-downloadTasks");let count=app.staticTexts["offline-task-summary"];XCTAssertTrue(count.waitForExistence(timeout:15));XCTAssertTrue(count.label.contains("2 个已保存"))
    let remove=app.buttons["删除离线文件：Shape of You · Ed Sheeran"];reach(remove);remove.tap();XCTAssertTrue(app.alerts["删除离线文件？"].waitForExistence(timeout:5));app.alerts.buttons["删除"].tap()
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","1 个已保存"),object:count)],timeout:20),.completed)
    let player=app.buttons["打开播放页"].firstMatch;reach(player);player.tap();let save=app.buttons["保存离线"];reach(save);save.tap();let close=app.buttons["收起播放页"].firstMatch;reach(close);close.tap()
    openSettings(app,page:"downloads");tap("settings-open-downloadTasks");XCTAssertTrue(count.waitForExistence(timeout:15))
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","2 个已保存"),object:count)],timeout:240),.completed);image("Real download with independent preference saved")
    openSettings(app,page:"playback");reach(playback320);XCTAssertTrue(playback320.isSelected);image("Real download preserves playback preference")
    let playback128=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","128k")).firstMatch;reach(playback128);playback128.tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true"),object:playback128)],timeout:15),.completed);image("Real prior playback preference restored")
    if wasAutomatic{reach(automatic);automatic.tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","开启"),object:automatic)],timeout:15),.completed)}
    app.terminate();app.launch();openQuality();summary("128k");tap("download-platform-tx");summary("320k");image("Real download policy persisted after actual transfer")
  }

  func testLiveDownloadDestination() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func item(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:15));for _ in 0..<24{if element.isHittable || (element.elementType == .staticText && !element.frame.isEmpty && element.frame.minY>=110 && element.frame.maxY<=app.frame.height*0.8){return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func tap(_ id:String){let element=item(id);reach(element);element.tap()}
    func summary(_ value:String){XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@",value),object:app.staticTexts["download-destination-summary"])],timeout:15),.completed)}
    func stop(){tap("download-destination-forget");XCTAssertTrue(app.alerts["停止自动另存？"].waitForExistence(timeout:5));app.alerts.buttons["停止另存"].tap();summary("未选择")}
    openSettings(app,page:"downloads");reach(item("download-destination-choose"));if item("download-destination-forget").exists{summary("Nexus UITest Fixtures");stop()};summary("未选择");image("Real destination no grant")
    tap("download-destination-choose");let browser=app.descendants(matching:.any).matching(identifier:"Browse View (Picker)").firstMatch;XCTAssertTrue(browser.waitForExistence(timeout:20));image("Real destination actual folder picker before cancellation")
    // iOS 26 exposes an inaccessible Cancel proxy over the More item.
    // Its real folder picker is a sheet beginning at y=69 on 430x932.
    app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.085)).press(forDuration:0.1,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.8)))
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true AND enabled == true"),object:item("download-destination-choose"))],timeout:15),.completed);summary("未选择");image("Real destination picker cancellation preserves default")
    tap("download-destination-choose")
    let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch,open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","选择","Choose"])).firstMatch
    let root=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: Nexus UITest Fixtures")).firstMatch
    var picked=false,entered=false
    XCTAssertTrue(browser.waitForExistence(timeout:25),"Cancellation must allow a fresh native folder picker")
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == true AND hittable == true"),object:open)],timeout:15),.completed)
    image("Real destination actual folder picker for grant")
    let nativeHierarchy=XCTAttachment(string:app.debugDescription);nativeHierarchy.name="Actual destination picker accessibility";nativeHierarchy.lifetime = .keepAlways;add(nativeHierarchy)
    for _ in 0..<24 {
      let title=app.navigationBars.descendants(matching:.any).matching(NSPredicate(format:"label == %@","Nexus UITest Fixtures")).firstMatch
      if (entered || root.exists || title.exists)&&open.exists&&open.isEnabled{open.tap();picked=true;break}
      if folder.exists&&folder.isHittable{folder.tap();entered=true}
      else if let phone=app.cells.matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).allElementsBoundByIndex.first(where:{$0.isHittable}){phone.tap()}
      else {
        let back=app.navigationBars.buttons["BackButton"].firstMatch
        let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse"])).firstMatch
        if back.exists&&back.isHittable{back.tap()}else if browse.exists&&browse.isHittable{browse.tap()}
      }
      RunLoop.current.run(until:Date().addingTimeInterval(2))
    }
    if !picked{image("Real destination folder grant failure");let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.lifetime = .keepAlways;add(hierarchy)}
    XCTAssertTrue(picked)
    let allow=app.alerts.buttons.matching(NSPredicate(format:"label IN %@",["允许","Allow"])).firstMatch;if allow.waitForExistence(timeout:2){allow.tap()};summary("Nexus UITest Fixtures");image("Real destination selected actual writable folder")
    app.terminate();app.launch();openSettings(app,page:"downloads");reach(app.staticTexts["download-destination-summary"]);summary("Nexus UITest Fixtures");image("Real destination bookmark retained after restart")
    tap("settings-open-downloadTasks");let count=app.staticTexts["offline-task-summary"];XCTAssertTrue(count.waitForExistence(timeout:15));XCTAssertTrue(count.label.contains("2 个已保存"));let remove=app.buttons["删除离线文件：Shape of You · Ed Sheeran"];reach(remove);remove.tap();XCTAssertTrue(app.alerts["删除离线文件？"].waitForExistence(timeout:5));app.alerts.buttons["删除"].tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","1 个已保存"),object:count)],timeout:20),.completed)
    let player=app.buttons["打开播放页"].firstMatch;reach(player);player.tap();let save=app.buttons["保存离线"];reach(save);save.tap();let close=app.buttons["收起播放页"].firstMatch;reach(close);close.tap()
    openSettings(app,page:"downloads");tap("settings-open-downloadTasks");let saved=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已另存 4 个文件")).firstMatch;XCTAssertTrue(saved.waitForExistence(timeout:240));reach(saved);image("Real destination automatic four file copy after actual download")
    let record=String(saved.identifier.dropFirst("offline-delivery-".count));tap("offline-delivery-save-"+record);let name=app.staticTexts["offline-delivery-name-"+record];XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@"," (2).mp3"),object:name)],timeout:90),.completed);reach(name);image("Real destination collision group uses second suffix")
    app.terminate();app.launch();openSettings(app,page:"downloads");tap("settings-open-downloadTasks");XCTAssertTrue(name.waitForExistence(timeout:15));XCTAssertTrue(name.label.contains(" (2).mp3"));reach(name);image("Real destination completed copy retained without recopy")
    openSettings(app,page:"downloads");stop();image("Real destination forgotten without deleting copies");app.terminate();app.launch();openSettings(app,page:"downloads");reach(app.staticTexts["download-destination-summary"]);summary("未选择");image("Real destination stopped after restart")
  }

  func testLiveManagedDownloadAttachments() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func item(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:15));for _ in 0..<24{if element.isHittable || (element.elementType == .staticText && !element.frame.isEmpty && element.frame.minY>=110 && element.frame.maxY<=app.frame.height*0.8){return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func tap(_ id:String){let element=item(id);reach(element);element.tap()}
    openSettings(app,page:"downloads")
    for id in ["downloadAttachLyrics","downloadAttachCover","downloadAttachMetadata"]{let control=app.switches["download-attach-"+id];reach(control);if control.value as? String != "1"{control.tap()};XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","1"),object:control)],timeout:10),.completed)}
    tap("download-cover-open");tap("download-cover-platform-wy");tap("download-cover-size-256");image("Real managed download attachment policy before enqueue");tap("download-cover-open");tap("settings-open-downloadTasks")
    let count=app.staticTexts["offline-task-summary"];XCTAssertTrue(count.waitForExistence(timeout:15));XCTAssertTrue(count.label.contains("2 个已保存"))
    let remove=app.buttons["删除离线文件：Shape of You · Ed Sheeran"];reach(remove);remove.tap();XCTAssertTrue(app.alerts["删除离线文件？"].waitForExistence(timeout:5));app.alerts.buttons["删除"].tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","1 个已保存"),object:count)],timeout:20),.completed)
    let player=app.buttons["打开播放页"].firstMatch;reach(player);player.tap();let saveOffline=app.buttons["保存离线"];reach(saveOffline);saveOffline.tap();let close=app.buttons["收起播放页"].firstMatch;reach(close);close.tap()
    openSettings(app,page:"downloads");tap("settings-open-downloadTasks");XCTAssertTrue(count.waitForExistence(timeout:15));XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","2 个已保存"),object:count)],timeout:240),.completed)
    let ready=app.staticTexts.matching(NSPredicate(format:"label == %@","附加文件 · 已保存")).firstMatch;XCTAssertTrue(ready.waitForExistence(timeout:90));reach(ready);image("Real managed companions saved after actual audio download")
    app.terminate();app.launch();openSettings(app,page:"downloads");tap("settings-open-downloadTasks");XCTAssertTrue(ready.waitForExistence(timeout:15));reach(ready);image("Real managed companions retained after restart")
    let export=app.buttons["导出音频文件：Shape of You · Ed Sheeran"];reach(export);export.tap()
    let activity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch;for _ in 0..<5{if activity.waitForExistence(timeout:2)&&activity.isHittable{break};app.swipeUp()};XCTAssertTrue(activity.waitForExistence(timeout:30));image("Real managed companions system share");activity.tap()
    let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","Export","保存","存储","导出","儲存"])).firstMatch;XCTAssertTrue(save.waitForExistence(timeout:60))
    let phone=app.cells.matching(NSPredicate(format:"label IN %@",["On My iPhone","我的iPhone","我的 iPhone","在我的 iPhone"])).firstMatch;if phone.exists&&phone.isHittable{phone.tap()};let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch;if folder.waitForExistence(timeout:3){folder.tap()};image("Real managed companions actual OS save");XCTAssertTrue(save.isEnabled);save.tap();XCTAssertFalse(app.buttons["好"].waitForExistence(timeout:3));XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:export)],timeout:20),.completed);XCTAssertTrue(count.label.contains("2 个已保存"));reach(ready);image("Real managed companions export keeps original audio")
  }

  func testLiveDownloadCoverLarge() throws { try liveDownloadCoverSize(1000, checkPlatforms: true) }
  func testLiveDownloadCoverSmall() throws { try liveDownloadCoverSize(256, checkPlatforms: false) }
  private func liveDownloadCoverSize(_ maximum:Int, checkPlatforms:Bool) throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func item(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:15));for _ in 0..<24{if element.isHittable{return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func tap(_ id:String){let element=item(id);reach(element);element.tap()}
    func summary(_ text:String){XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@",text),object:app.staticTexts["download-cover-size-summary"])],timeout:15),.completed)}
    func openCover(){openSettings(app,page:"downloads");tap("download-cover-open")}
    openCover();tap("download-cover-platform-wy");tap("download-cover-size-\(maximum)");summary("\(maximum)");image("Real cover NetEase longest edge \(maximum)")
    if checkPlatforms {
      tap("download-cover-platform-tx");tap("download-cover-size-1200");summary("1200");image("Real cover independent QQ 1200")
      tap("download-cover-platform-kw");tap("download-cover-size-500");summary("500");image("Real cover independent Kuwo 500")
      tap("download-cover-platform-tx");tap("download-cover-size-default");summary("默认最长边512");tap("download-cover-platform-wy");summary("\(maximum)");image("Real cover reset QQ preserves NetEase");tap("download-cover-platform-tx");tap("download-cover-size-1200");summary("1200")
    }
    app.terminate();app.launch();openCover();summary("\(maximum)");image("Real cover selected size restored \(maximum)")
    if checkPlatforms{tap("download-cover-platform-tx");summary("1200");tap("download-cover-platform-kw");summary("500");tap("download-cover-platform-wy");summary("\(maximum)")}
    tap("download-cover-open")
    for id in ["downloadAttachLyrics","downloadAttachCover","downloadAttachMetadata"]{let control=app.switches["download-attach-"+id];reach(control);if control.value as? String != "1"{control.tap()};XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","1"),object:control)],timeout:10),.completed)}
    tap("settings-open-downloadTasks");let count=app.staticTexts["offline-task-summary"];XCTAssertTrue(count.waitForExistence(timeout:15));XCTAssertTrue(count.label.contains("2 个已保存"))
    let export=app.buttons["导出音频文件：Shape of You · Ed Sheeran"];reach(export);export.tap()
    let activity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch
    for _ in 0..<5{if activity.waitForExistence(timeout:2)&&activity.isHittable{break};app.swipeUp()};XCTAssertTrue(activity.waitForExistence(timeout:30));image("Real cover prepared actual four files \(maximum)");activity.tap()
    let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","Export","保存","存储","导出","儲存"])).firstMatch;XCTAssertTrue(save.waitForExistence(timeout:60))
    let phone=app.cells.matching(NSPredicate(format:"label IN %@",["On My iPhone","我的iPhone","我的 iPhone","在我的 iPhone"])).firstMatch;if phone.exists&&phone.isHittable{phone.tap()}
    let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch;if folder.waitForExistence(timeout:3){folder.tap()}
    image("Real cover actual OS four file save \(maximum)");XCTAssertTrue(save.isEnabled);save.tap()
    XCTAssertFalse(app.buttons["好"].waitForExistence(timeout:3));XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:export)],timeout:20),.completed);XCTAssertTrue(count.label.contains("2 个已保存"));image("Real cover saved with two originals retained \(maximum)")
  }

  func testLiveDownloadAttachments() throws {
    XCUIDevice.shared.orientation = .portrait;defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<24{if element.isHittable{return};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    let ids=["downloadAttachLyrics","downloadAttachCover","downloadAttachMetadata"]
    openSettings(app,page:"downloads")
    for id in ids {let control=app.switches["download-attach-"+id];reach(control);if control.value as? String != "1"{control.tap()};let enabled=XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","1"),object:control);XCTAssertEqual(XCTWaiter.wait(for:[enabled],timeout:10),.completed)}
    image("Real companion export selected options")
    reach(app.staticTexts["download-name-preview"])
    let metadata=app.switches["download-attach-downloadAttachMetadata"];reach(metadata);metadata.tap()
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","0"),object:metadata)],timeout:10),.completed)
    XCTAssertEqual(app.switches["download-attach-downloadAttachLyrics"].value as? String,"1");XCTAssertEqual(app.switches["download-attach-downloadAttachCover"].value as? String,"1");image("Real companion metadata independently disabled")
    metadata.tap();XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","1"),object:metadata)],timeout:10),.completed);image("Real companion lower options and naming")
    app.terminate();app.launch();openSettings(app,page:"downloads")
    for id in ids {let control=app.switches["download-attach-"+id];reach(control);XCTAssertEqual(control.value as? String,"1")};image("Real companion export restored options")
    let tasks=app.buttons["settings-open-downloadTasks"];reach(tasks);tasks.tap();let summary=app.staticTexts["offline-task-summary"];XCTAssertTrue(summary.waitForExistence(timeout:10));XCTAssertTrue(summary.label.contains("2 个已保存"))
    let export=app.buttons["导出音频文件：Shape of You · Ed Sheeran"];reach(export);export.tap()
    let activity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch
    func openFiles(){for _ in 0..<5{if activity.waitForExistence(timeout:2)&&activity.isHittable{break};app.swipeUp()};XCTAssertTrue(activity.waitForExistence(timeout:15));activity.tap()}
    image("Real four file system share sheet");openFiles()
    let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","Export","保存","存储","导出","儲存"])).firstMatch
    if !save.waitForExistence(timeout:60){let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual companion preparation or picker failure";tree.lifetime = .keepAlways;add(tree);XCTFail("Real companions must be available and enter OS export");return}
    let phone=app.cells.matching(NSPredicate(format:"label IN %@",["On My iPhone","我的iPhone","我的 iPhone","在我的 iPhone"])).firstMatch;if phone.exists&&phone.isHittable{phone.tap()}
    let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch;if folder.waitForExistence(timeout:3){folder.tap()}
    image("Real four companion files OS export");XCTAssertTrue(save.isEnabled);save.tap()
    if app.buttons["好"].waitForExistence(timeout:5){let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual four file post-save system dialog";tree.lifetime = .keepAlways;add(tree);image("Real four file post-save system dialog");XCTFail("Review actual system completion dialog");return}
    let released=XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:export);XCTAssertEqual(XCTWaiter.wait(for:[released],timeout:20),.completed);XCTAssertTrue(summary.label.contains("2 个已保存"));image("Real companion export two originals retained")
    for attempt in 0..<2 {
      reach(export);export.tap();openFiles();XCTAssertTrue(save.waitForExistence(timeout:45));if attempt==0{image("Real four file export before cancellation")}
      for _ in 0..<6 {
        if export.exists && export.isEnabled && summary.isHittable{break}
        let cancel=app.buttons.matching(NSPredicate(format:"label IN %@",["Cancel","取消"])).firstMatch
        if cancel.waitForExistence(timeout:2) && cancel.isHittable{cancel.tap();continue}
        let back=app.buttons["BackButton"];if back.waitForExistence(timeout:2)&&back.isHittable{back.tap();continue}
        let dismiss=app.descendants(matching:.any).matching(identifier:"PopoverDismissRegion").firstMatch
        if dismiss.exists {
          // Observed actual sharing popover occupies y=546...923 on 430x932.
          // Its dismissal container is not itself reported as hittable.
          XCTAssertTrue(activity.waitForExistence(timeout:5));XCTAssertTrue(activity.isHittable);XCTAssertGreaterThan(activity.frame.minY,app.frame.height*0.4)
          if attempt==0{image("Real share popover outside cancellation region")}
          dismiss.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.3)).tap();break
        }
        break
      }
      let cancellationResult=XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:export)],timeout:20)
      if cancellationResult != .completed {let tree=XCTAttachment(string:app.debugDescription);tree.name="Actual failed OS cancellation hierarchy";tree.lifetime = .keepAlways;add(tree);image("Real failed OS cancellation state")}
      XCTAssertEqual(cancellationResult,.completed);XCTAssertTrue(summary.isHittable);XCTAssertTrue(summary.label.contains("2 个已保存"))
    }
    image("Real companion OS cancellation preserves originals")
  }

  func testLiveDownloadNamingExport() throws {
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<20{if element.isHittable{return};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    openSettings(app,page:"downloads");let order=app.descendants(matching:.any).matching(identifier:"download-name-artist-title").firstMatch;reach(order);XCTAssertTrue(order.isSelected);let separator=app.textFields["download-name-separator"];reach(separator);XCTAssertEqual(separator.value as? String,"__")
    let tasks=app.buttons["settings-open-downloadTasks"];reach(tasks);tasks.tap();let summary=app.staticTexts["offline-task-summary"];XCTAssertTrue(summary.waitForExistence(timeout:10));XCTAssertTrue(summary.label.contains("2 个已保存"))
    let export=app.buttons["导出音频文件：Shape of You · Ed Sheeran"];reach(export);export.tap()
    let activity=app.descendants(matching:.any).matching(NSPredicate(format:"label IN %@",["Save to Files","存储到文件","儲存到檔案","保存到“文件”"])).firstMatch
    for _ in 0..<5{if activity.exists&&activity.isHittable{break};app.swipeUp()};XCTAssertTrue(activity.waitForExistence(timeout:15));activity.tap()
    let filename=app.textFields.firstMatch;XCTAssertTrue(filename.waitForExistence(timeout:10));XCTAssertTrue((filename.value as? String ?? "").hasPrefix("Ed Sheeran__Shape of You"));image("Real named audio retained OS export")
    let save=app.buttons.matching(NSPredicate(format:"label IN %@",["Save","保存","儲存","存储"])).firstMatch;XCTAssertTrue(save.waitForExistence(timeout:10));save.tap();XCTAssertTrue(summary.waitForExistence(timeout:15));XCTAssertTrue(summary.label.contains("2 个已保存"));image("Real named audio export retained two originals")
    reach(export);export.tap();XCTAssertTrue(activity.waitForExistence(timeout:15));activity.tap();XCTAssertTrue(filename.waitForExistence(timeout:10))
    // iOS 26 exposes BackButton inside a selected folder, with Cancel at
    // the browser root. Use the actual navigation rather than assuming a
    // Cancel item exists on every Files page.
    var cancelled=false
    for _ in 0..<5 {
      if export.exists && export.isEnabled && summary.isHittable{cancelled=true;break}
      let cancel=app.buttons.matching(NSPredicate(format:"label IN %@",["Cancel","取消"])).firstMatch
      if cancel.exists && cancel.isHittable{cancel.tap();cancelled=true;break}
      let back=app.buttons["BackButton"].firstMatch
      if back.waitForExistence(timeout:2){back.tap()}else{
        // Leaving Files can return to the activity popover (observed at
        // y=546..923 on this 430x932 device). Dismiss its real outside region.
        let dismiss=app.descendants(matching:.any).matching(identifier:"PopoverDismissRegion").firstMatch
        if dismiss.exists && dismiss.isHittable{dismiss.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.3)).tap()}
        let returned=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in export.exists && export.isEnabled && summary.isHittable},object:nil);cancelled = XCTWaiter.wait(for:[returned],timeout:5) == .completed;break}
    }
    XCTAssertTrue(cancelled,"OS export cancellation must return to the usable App");XCTAssertTrue(summary.waitForExistence(timeout:15));let released=XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:export);XCTAssertEqual(XCTWaiter.wait(for:[released],timeout:15),.completed);XCTAssertTrue(summary.label.contains("2 个已保存"));image("Real named audio OS cancellation preserves originals")
  }

  func testLiveDownloadPolicy() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<20{if element.isHittable{return};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func choose(_ value:Int){let e=app.descendants(matching:.any).matching(identifier:"download-concurrency-\(value)").firstMatch;reach(e);e.tap()}
    func expect(_ value:Int){let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@","最多 \(value) 个任务"),object:app.staticTexts["download-concurrency-summary"]);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:15),.completed)}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let e=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;reach(e);e.tap()}
    func play(){let clear=app.buttons["清空歌曲筛选"];if clear.exists{clear.tap()};let f=app.textFields["搜索本地歌曲艺术家专辑"];reach(f);f.tap();for c in "Shape of You"{f.typeText(String(c))};XCTAssertEqual(f.value as? String,"Shape of You");f.typeText("\n");app.buttons["local-track-0"].tap();app.buttons["收起本地音频"].tap();app.buttons["打开播放页"].tap();XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4))}
    selectClassicSourcePlayback(in:app);openLocal();app.buttons["导入音频文件"].tap();selectLocalFixture("Shape of You - Ed Sheeran",in:app);XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20));play();image("Real download policy actual PCM before settings");app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].tap()
    openSettings(app,page:"downloads");choose(1);expect(1);image("Real download policy recommended one")
    choose(2);XCTAssertTrue(app.alerts["提高下载并发？"].waitForExistence(timeout:5));image("Real download policy two confirmation");app.alerts.buttons["保持当前"].tap();expect(1)
    choose(2);app.alerts.buttons["使用 2 并发"].tap();expect(2);image("Real download policy two saved")
    choose(3);XCTAssertTrue(app.alerts["提高下载并发？"].waitForExistence(timeout:5));image("Real download policy three confirmation");app.alerts.buttons["使用 3 并发"].tap();expect(3);image("Real download policy three saved")
    app.terminate();app.launch();openSettings(app,page:"downloads");reach(app.staticTexts["download-concurrency-summary"]);expect(3);image("Real download policy three after restart");choose(1);expect(1);image("Real download policy lower to one")
    app.terminate();app.launch();openSettings(app,page:"downloads");reach(app.staticTexts["download-concurrency-summary"]);expect(1);image("Real download policy one after restart");openLocal();play();app.buttons["暂停"].firstMatch.tap();image("Real download policy actual PCM after restart")
  }

  func testLiveRetainedAudio() throws {
    XCUIDevice.shared.orientation = .portrait
    defer{XCUIDevice.shared.orientation = .portrait}
    let app=XCUIApplication();app.launch()
    func image(_ name:String){let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    func reach(_ element:XCUIElement){XCTAssertTrue(element.waitForExistence(timeout:10));for _ in 0..<18{if element.isHittable{return};let above=element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.3:0.7)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.96,dy:above ? 0.7:0.3)))};XCTAssertTrue(element.isHittable)}
    func tap(_ label:String){let b=app.buttons[label].firstMatch;reach(b);b.tap()}
    func openLocal(){app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap();let b=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch;reach(b);b.tap();XCTAssertTrue(app.buttons["local-retained-open"].waitForExistence(timeout:10))}
    func search(_ value:String){let clear=app.buttons["清空歌曲筛选"];if clear.exists{reach(clear);clear.tap()};let field=app.textFields["搜索本地歌曲艺术家专辑"];reach(field);field.tap();for c in value{field.typeText(String(c))};XCTAssertEqual(field.value as? String,value);field.typeText("\n")}
    func hide(){let b=app.buttons["从列表移除"].firstMatch;reach(b);b.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","已从列表移除 1 首")).firstMatch.waitForExistence(timeout:10))}
    selectClassicSourcePlayback(in:app);openLocal();tap("local-retained-open");let all=app.buttons["retained-restore-all"];if all.exists{all.tap();XCTAssertTrue(app.staticTexts["没有保留副本"].waitForExistence(timeout:10))};tap("retained-close");tap("local-scan-open");while app.buttons["local-scan-root-remove-0"].exists{tap("local-scan-root-remove-0")};tap("local-scan-save");tap("local-scan-rescan");let reset=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons["local-scan-rescan"].isEnabled && app.staticTexts["local-scan-message"].label.hasPrefix("扫描完成")},object:nil);XCTAssertEqual(XCTWaiter.wait(for:[reset],timeout:45),.completed);tap("local-scan-close")
    for name in ["Shape of You - Ed Sheeran","Perfect - Ed Sheeran"]{tap("导入音频文件");selectLocalFixture(name,in:app);XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:20))}
    search("Shape of You");tap("local-track-0");tap("收起本地音频");tap("打开播放页");XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));image("Real retained actual playback before index removal");tap("收起播放页")
    openLocal();search("Shape of You");hide();search("Perfect");hide();tap("local-retained-open");XCTAssertTrue(app.staticTexts["retained-summary"].label.contains("共 2 首"));image("Real retained two public owned copies")
    tap("删除副本：Shape of You - Ed Sheeran");XCTAssertTrue(app.alerts["删除此设备保留的音频？"].waitForExistence(timeout:5));image("Real retained deletion confirmation");app.alerts.buttons["保留"].tap();XCTAssertTrue(app.staticTexts["retained-summary"].label.contains("共 2 首"))
    tap("删除副本：Shape of You - Ed Sheeran");app.alerts.buttons["删除副本"].tap();let error=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","操作未完成"),object:app.staticTexts["retained-message"]);XCTAssertEqual(XCTWaiter.wait(for:[error],timeout:15),.completed);XCTAssertTrue(app.staticTexts["retained-summary"].label.contains("共 2 首"));image("Real retained playing lease protected")
    tap("删除副本：Perfect - Ed Sheeran");app.alerts.buttons["删除副本"].tap();let deleted=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","共 1 首"),object:app.staticTexts["retained-summary"]);XCTAssertEqual(XCTWaiter.wait(for:[deleted],timeout:15),.completed);XCTAssertFalse(app.buttons["删除副本：Perfect - Ed Sheeran"].exists);image("Real retained nonplaying copy deleted")
    tap("恢复到列表：Shape of You - Ed Sheeran");XCTAssertTrue(app.staticTexts["没有保留副本"].waitForExistence(timeout:10));image("Real retained restored empty manager");tap("retained-close");tap("收起本地音频");tap("打开播放页");XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:10));app.buttons["暂停"].firstMatch.tap();tap("收起播放页")
    app.terminate();app.launch();openLocal();search("Shape of You");XCTAssertTrue(app.buttons["local-track-0"].waitForExistence(timeout:10));tap("local-retained-open");XCTAssertTrue(app.staticTexts["没有保留副本"].waitForExistence(timeout:10));image("Real retained empty after restart");tap("retained-close");tap("local-track-0");tap("收起本地音频");tap("打开播放页");XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));app.buttons["暂停"].firstMatch.tap();image("Real retained restored actual playback after restart");tap("收起播放页")
    openLocal();let clear=app.buttons["清空歌曲筛选"];if clear.exists{clear.tap()};tap("local-scan-open");tap("local-scan-add")
    let folder=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@","Nexus UITest Fixtures")).firstMatch,open=app.buttons.matching(NSPredicate(format:"label IN %@",["打开","Open","选择","Choose"])).firstMatch
    let root=app.descendants(matching:.any).matching(NSPredicate(format:"identifier BEGINSWITH %@","DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: Nexus UITest Fixtures")).firstMatch
    var picked=false,entered=false
    for _ in 0..<24{if (entered || root.exists || app.navigationBars.staticTexts["Nexus UITest Fixtures"].exists)&&open.exists&&open.isEnabled{open.tap();picked=true;break};if folder.exists&&folder.isHittable{folder.tap();entered=true}else if let phone=app.cells.matching(NSPredicate(format:"label IN %@",["我的iPhone","我的 iPhone","在我的 iPhone","On My iPhone"])).allElementsBoundByIndex.first(where:{$0.isHittable}){phone.tap()}else{let browse=app.buttons.matching(NSPredicate(format:"label IN %@",["浏览","Browse"])).firstMatch;if browse.exists&&browse.isHittable{browse.tap()}};RunLoop.current.run(until:Date().addingTimeInterval(2))};XCTAssertTrue(picked)
    let allow=app.alerts.buttons.matching(NSPredicate(format:"label IN %@",["允许","Allow"])).firstMatch;if allow.waitForExistence(timeout:2){allow.tap()};XCTAssertTrue(app.staticTexts["扫描完成 · 2 首"].waitForExistence(timeout:45))
    reach(app.buttons["local-scan-root-remove-0"]);XCTAssertTrue(app.staticTexts["Nexus UITest Fixtures"].exists);tap("local-scan-root-remove-0");tap("local-scan-save");XCTAssertTrue(app.staticTexts["规则已保存，重新扫描后生效"].waitForExistence(timeout:10));tap("local-scan-rescan");XCTAssertTrue(app.staticTexts["扫描完成 · 1 首"].waitForExistence(timeout:45));tap("local-scan-close");search("Shape of You");hide();tap("local-retained-open")
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","已移出扫描范围")).firstMatch.exists);XCTAssertTrue(app.staticTexts["retained-summary"].label.contains("共 2 首"));image("Real retained mixed hidden and scan excluded copies")
    tap("retained-restore-all");XCTAssertTrue(app.staticTexts["没有保留副本"].waitForExistence(timeout:10));tap("retained-close");if clear.exists{clear.tap()};tap("local-scan-open");tap("local-scan-rescan");XCTAssertTrue(app.staticTexts["扫描完成 · 2 首"].waitForExistence(timeout:45));XCTAssertFalse(app.buttons["local-scan-root-remove-0"].exists);image("Real retained independent imports survive empty root scan");tap("local-scan-close")
    app.terminate();app.launch();openLocal();XCTAssertTrue(app.staticTexts["local-filter-count"].label.contains("2 / 2 首"));tap("local-retained-open");XCTAssertTrue(app.staticTexts["没有保留副本"].waitForExistence(timeout:10));image("Real retained all restored after final restart");tap("retained-close");search("Perfect");tap("local-track-0");tap("收起本地音频");tap("打开播放页");XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60));RunLoop.current.run(until:Date().addingTimeInterval(4));app.buttons["暂停"].firstMatch.tap();image("Real retained formerly excluded Perfect plays after restart")
  }

  func testLocalPlaylistDualSystem() throws {
    let app=XCUIApplication();app.launch()
    selectClassicSourcePlayback(in:app)
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap();app.buttons["导入音频文件"].tap()
    selectLocalFixture("Synthetic Tagged Tone",in:app)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","已导入")).firstMatch.waitForExistence(timeout:15))
    app.buttons["歌单"].tap()
    image("Local playlists default list")
    let liked=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","打开本地歌单：我喜欢的 · ")).firstMatch
    XCTAssertTrue(liked.waitForExistence(timeout:10),"The default device-only playlist must always exist")
    // The device playlist store persists across runs; a run-unique suffix
    // keeps every query unambiguous despite leftovers from failed runs.
    let suffix=Int(Date().timeIntervalSince1970)%100000
    let name="夜跑\(suffix)"
    let field=app.textFields["新本地歌单名称"]
    for _ in 0..<8 {if field.isHittable{break};app.swipeUp()}
    XCTAssertTrue(field.isHittable);field.tap();field.typeText(name)
    app.buttons["local-playlist-create"].tap()
    XCTAssertTrue(app.buttons["返回本地歌单"].waitForExistence(timeout:8),"Creating a local playlist opens its detail")
    XCTAssertTrue(app.buttons["删除歌单"].firstMatch.exists,"A user-created local playlist offers deletion")
    XCTAssertFalse(app.buttons["移除"].firstMatch.waitForExistence(timeout:3),"A fresh local playlist has no songs yet")
    app.buttons["返回本地歌单"].tap()
    liked.tap()
    XCTAssertFalse(app.buttons["删除歌单"].firstMatch.exists,"The default playlist must not offer deletion")
    XCTAssertTrue(app.buttons["返回本地歌单"].waitForExistence(timeout:8))
    app.buttons["返回本地歌单"].tap()
    // Add the imported file through the device-only picker.
    app.buttons["歌曲"].tap()
    let addTo=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","加入歌单")).firstMatch
    XCTAssertTrue(addTo.waitForExistence(timeout:8));addTo.tap()
    let nightRow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","添加到本地歌单：\(name)")).firstMatch
    XCTAssertTrue(nightRow.waitForExistence(timeout:8),"The local picker lists local playlists only")
    XCTAssertFalse(app.buttons.matching(NSPredicate(format:"label CONTAINS %@","我喜欢的")).firstMatch.exists,"The local picker excludes the default playlist")
    nightRow.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","已添加到本地歌单「\(name)」")).firstMatch.waitForExistence(timeout:8),"Submitting must close the picker and confirm")
    image("Local picker submitted and closed")
    XCTAssertFalse(nightRow.exists,"Local picker closes after submitting (unlike the search-page picker)")
    app.buttons["歌单"].tap()
    let openNight=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","打开本地歌单：\(name) · ")).firstMatch
    XCTAssertTrue(openNight.waitForExistence(timeout:8))
    image("Local playlists after add");openNight.tap()
    XCTAssertTrue(app.buttons["移除"].firstMatch.waitForExistence(timeout:8),"The added file lives in the local playlist")
    // Device-only deletion has no confirmation dialog and takes effect now.
    app.buttons["删除歌单"].tap()
    XCTAssertEqual(app.alerts.count,0,"Local playlist deletion must not ask for confirmation")
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","已删除本地歌单「\(name)」")).firstMatch.waitForExistence(timeout:8))
    XCTAssertTrue(liked.waitForExistence(timeout:8),"The default playlist survives other deletions")
    // Isolation: the library playlist domain never saw the local name.
    app.buttons["收起本地音频"].tap()
    let mine=app.buttons["我的歌单"];XCTAssertTrue(mine.waitForExistence(timeout:8));mine.tap()
    XCTAssertFalse(app.buttons.matching(NSPredicate(format:"label CONTAINS %@",name)).firstMatch.exists,"Library playlists and device playlists stay mutually invisible")
  }

  func testYLocalAudioFileImport() throws {
    let app=XCUIApplication();app.launch()
    selectClassicSourcePlayback(in:app)
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","本地音频 ·")).firstMatch
    XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap();app.buttons["导入音频文件"].tap()
    // The picker may restore the previous directory without a Browse button.
    // Use the same real-row navigation as the image/font import paths.
    selectLocalFixture("Synthetic Tagged Tone",in:app)
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
    // Classic now exposes queue mutations through its actual queue sheet.
    let queue=app.buttons["查看播放队列"]
    for _ in 0..<12 {if queue.isHittable{break};if queue.exists && queue.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
    XCTAssertTrue(queue.isHittable);queue.tap()
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
  func testAMPlayerWithLargeText() throws {try verifyAM2Window(largeText:true,am:true)}
  func testAMPlayerWindowRotation() throws {try verifyAM2Window(largeText:false,am:true)}
  func testStageStylesAndWindow() throws {try verifyAM2Window(largeText:false,stage:true)}
  func testStageStylesWithLargeText() throws {try verifyAM2Window(largeText:true,stage:true)}
  func testPhotoArtworkAspectAndFallback() throws {try verifyAM2Window(largeText:false,photo:true,artwork:true)}
  func testPhotoPlayerWindowRotation() throws {try verifyAM2Window(largeText:false,photo:true)}
  func testPhotoPlayerWithLargeText() throws {try verifyAM2Window(largeText:true,photo:true)}

  private func verifyAM2Window(largeText:Bool,classic:Bool=false,am:Bool=false,photo:Bool=false,artwork:Bool=false,stage:Bool=false) throws {
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
    if artwork {
      openSettings(app,page:"background")
      let photoName=app.staticTexts["visual-photo-name"];reveal(photoName)
      XCTAssertTrue(photoName.label.contains("尚未导入"),"This isolated artwork scenario requires an empty fixture photo slot")
      let cover=element("player-background-artwork");reveal(cover);cover.tap();XCTAssertTrue(cover.isSelected)
    }
    let fixtureUser=artwork ? "fixture-photo":"fixture-user"
    openSettings(app,page:"skins");let am2=element(classic ? "player-layout-classic":stage ? "player-layout-stage":photo ? "player-layout-photo":am ? "player-layout-am":"player-layout-am2");reveal(am2);am2.tap()
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["skins-sheet-close"]);waitForExpectations(timeout:10)
    openSettings(app,page:"sources")
    for (label,value) in [("Navidrome服务器地址","http://127.0.0.1:18439"),("Navidrome用户名",fixtureUser),("Navidrome密码","fixture-password")]{
      let field=label=="Navidrome密码" ? app.secureTextFields[label] : app.textFields[label]
      reveal(field);field.tap();for character in value{field.typeText(String(character))};field.typeText("\n")
    }
    let save=app.buttons["验证并保存连接"];reveal(save);save.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","连接成功")).firstMatch.waitForExistence(timeout:15))
    let rail=element("rail-tab-library");(rail.exists ? rail : element("tab-library")).tap()
    element("tab-private").tap();let account=element("navidrome-account-"+fixtureUser);reveal(account);account.tap()
    let album=element("navidrome-item-album-fixture-album");XCTAssertTrue(album.waitForExistence(timeout:15));album.tap();app.buttons["播放全部"].tap()
    let open=app.buttons["打开播放页"];XCTAssertTrue(open.waitForExistence(timeout:10));open.tap()
    if artwork {
      func fixtureRequests() throws -> [String:Int] {
        let data=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/photo-artwork-fixture-control")!)
        let result=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
        return try XCTUnwrap(result["requests"] as? [String:Int])
      }
      func actions(){if !element("photo-quick-actions").exists{app.buttons["photo-actions-toggle"].tap()};XCTAssertTrue(element("photo-quick-actions").waitForExistence(timeout:5))}
      func cycle(_ target:String){
        for _ in 0..<3 {let button=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","循环：")).firstMatch;if button.label==target{break};button.tap()}
        XCTAssertTrue(app.buttons[target].exists)
      }
      app.buttons["更多播放控制"].tap();app.buttons["队列与播放选项"].tap()
      let shuffled=app.buttons["随机：开"].exists
      if shuffled{let button=app.buttons["随机：开"];reveal(button);button.tap()}
      let close=app.buttons["收起播放选项"];reveal(close);close.tap()
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !close.exists && app.buttons["暂停"].isHittable},object:nil)],timeout:8),.completed)
      actions();let repeatBefore=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","循环：")).firstMatch.label;cycle("循环：all")
      if element("photo-quick-actions").exists{app.buttons["photo-actions-toggle"].tap()}
      for (index,kind) in ["portrait","landscape","missing","corrupt","portrait"].enumerated() {
        XCTAssertTrue(app.staticTexts[kind+" artwork tone"].waitForExistence(timeout:10));XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout:10));app.buttons["暂停"].tap()
        let valid=kind=="portrait" || kind=="landscape"
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in ((try? fixtureRequests()[kind]) ?? 0)>0},object:nil)],timeout:10),.completed,"The real cover endpoint must serve the selected fixture")
        if valid {
          var measured: CGRect?,expected:CGFloat=0
          let rendered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
            guard element("photo-hero-image").exists,let image=BackgroundPixels.decode(XCUIScreen.main.screenshot().pngRepresentation),let bounds=BackgroundPixels.greenBounds(image) else{return false}
            let source=kind=="portrait" ? CGSize(width:64,height:256):CGSize(width:256,height:64)
            expected=16*max(CGFloat(image.width)/source.width,CGFloat(image.height)/source.height);measured=bounds
            return abs(bounds.width/bounds.height-1)<0.12 && abs(bounds.width/expected-1)<0.2 && abs(bounds.height/expected-1)<0.2
          },object:nil)
          XCTAssertEqual(XCTWaiter.wait(for:[rendered],timeout:12),.completed,"The actual raster circle must remain circular under cover cropping: \(kind), bounds \(String(describing:measured)), expected diameter \(expected)")
        } else {
          XCTAssertFalse(element("photo-hero-image").exists,"404 and corrupt bytes must not retain the preceding track image")
          XCTAssertTrue(app.buttons["播放"].isHittable);openPhotoLyricSource(app)
        }
        let attachment=XCTAttachment(screenshot:XCUIScreen.main.screenshot());attachment.name="Photo artwork \(index) \(kind)";attachment.lifetime = .keepAlways;add(attachment)
        actions();let progress=element("播放进度");XCTAssertTrue(progress.isHittable);XCTAssertTrue(app.buttons["播放"].exists)
        if index<4{app.buttons["下一首"].tap()}else{cycle(repeatBefore);app.buttons["photo-actions-toggle"].tap()}
      }
      app.buttons["更多播放控制"].tap();app.buttons["队列与播放选项"].tap()
      if shuffled{let button=app.buttons["随机：关"];reveal(button);button.tap()}
      reveal(close);close.tap()
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !close.exists && app.buttons["播放"].isHittable},object:nil)],timeout:8),.completed)
      app.buttons["收起播放页"].tap();openSettings(app,page:"sources")
      let remove=app.buttons["移除连接：fixture-photo"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10));return
    }
    if stage {
      XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout:10));app.buttons["暂停"].tap()
      let progress=element("播放进度")
      XCTAssertTrue(progress.isHittable)
      progress.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()
      expectation(for:NSPredicate(format:"value == %@","1:00 / 2:00"),evaluatedWith:progress);waitForExpectations(timeout:5)
      let viewport=element("stage-lyric-viewport"),group=element("lyric-stage-group"),selector=app.buttons["stage-style-selector"]
      XCTAssertTrue(group.waitForExistence(timeout:10));XCTAssertEqual(group.label,"two")
      XCTAssertGreaterThan(viewport.frame.height,100);XCTAssertTrue(app.frame.insetBy(dx:-1,dy:-1).contains(viewport.frame));XCTAssertTrue(app.buttons["播放"].isHittable);XCTAssertTrue(selector.isHittable)
      selector.tap();let backdrop=app.switches["舞台背景"];XCTAssertTrue(backdrop.waitForExistence(timeout:5));reveal(backdrop)
      let beforeBackdrop=backdrop.value as? String == "1"
      let beforeStyle=["classic","neon","cyberpunk","aurora"].first{element("stage-style-"+$0).isSelected}!
      // IMG_4872 captures the panel with 经典 selected and 动态背景 still on.
      let classicOption=element("stage-style-classic")
      if !classicOption.isSelected{classicOption.tap()}
      if backdrop.value as? String != "1"{backdrop.tap()}
      let stageStyleShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());stageStyleShot.name="Stage style panel";stageStyleShot.lifetime = .keepAlways;add(stageStyleShot)
      // The ink-difference loop below compares every backdrop with the switch off.
      if backdrop.value as? String == "1"{backdrop.tap()}
      let initialClose=app.buttons["收起舞台样式"];reveal(initialClose);initialClose.tap()
      var rendered:[[UInt8]]=[]
      for (id,label) in [("classic","经典"),("neon","霓虹"),("cyberpunk","赛博"),("aurora","炫彩")] {
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in selector.isHittable},object:nil)],timeout:8),.completed)
        selector.tap();let option=element("stage-style-"+id);XCTAssertTrue(option.waitForExistence(timeout:5));reveal(option);option.tap()
        expectation(for:NSPredicate(format:"selected == true"),evaluatedWith:option);waitForExpectations(timeout:5)
        let closeStage=app.buttons["收起舞台样式"];reveal(closeStage);closeStage.tap()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in selector.isHittable && selector.value as? String == label},object:nil)],timeout:8),.completed)
        XCTAssertFalse(element("stage-backdrop").exists);XCTAssertEqual(progress.value as? String,"1:00 / 2:00");XCTAssertTrue(app.buttons["播放"].isHittable)
        let shot=group.screenshot(),image=try XCTUnwrap(BackgroundPixels.decode(shot.pngRepresentation))
        var samples:[UInt8]=[]
        for y in 0..<32{for x in 0..<96{samples += BackgroundPixels.rgba(image,at:CGPoint(x:(CGFloat(x)+0.5)*CGFloat(image.width)/96,y:(CGFloat(y)+0.5)*CGFloat(image.height)/32))}}
        XCTAssertEqual(samples.count,96*32*4)
        if !largeText {for previous in rendered{XCTAssertNotEqual(samples,previous,"Native ink must visibly change with backdrop disabled: \(id)")};rendered.append(samples)}
        let attachment=XCTAttachment(screenshot:XCUIScreen.main.screenshot());attachment.name="Stage native \(id) large \(largeText)";attachment.lifetime = .keepAlways;add(attachment)
      }
      selector.tap();reveal(backdrop);backdrop.tap();let closeStage=app.buttons["收起舞台样式"];reveal(closeStage);closeStage.tap()
      XCTAssertTrue(element("stage-backdrop").waitForExistence(timeout:8))
      app.terminate();app.launch();let reopen=app.buttons["打开播放页"];XCTAssertTrue(reopen.waitForExistence(timeout:10));reopen.tap()
      XCTAssertTrue(selector.waitForExistence(timeout:10));XCTAssertEqual(selector.value as? String,"炫彩");XCTAssertTrue(element("stage-backdrop").exists);XCTAssertTrue(app.buttons["播放"].isHittable)
      if !largeText {
        XCUIDevice.shared.orientation = .landscapeLeft;app.activate()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.frame.width>app.frame.height && app.buttons["播放"].isHittable && selector.isHittable},object:nil)],timeout:15),.completed)
        XCTAssertTrue(app.buttons["选择歌词来源"].isHittable)
        let landscape=XCTAttachment(screenshot:XCUIScreen.main.screenshot());landscape.name="Stage landscape native controls";landscape.lifetime = .keepAlways;add(landscape)
        XCUIDevice.shared.orientation = .portrait;app.activate()
      }
      selector.tap();if !beforeBackdrop{reveal(backdrop);backdrop.tap()};let original=element("stage-style-"+beforeStyle);reveal(original);original.tap();let cleanupClose=app.buttons["收起舞台样式"];reveal(cleanupClose);cleanupClose.tap()
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.buttons["收起播放页"].isHittable && !app.buttons["收起舞台样式"].exists},object:nil)],timeout:8),.completed)
      app.buttons["收起播放页"].tap();openSettings(app,page:"sources")
      let remove=app.buttons["移除连接：fixture-user"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap();XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10));return
    }
    if photo {
      XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout:10));app.buttons["暂停"].tap()
      let viewport=element("photo-lyric-viewport"),list=element("photo-lyrics-list"),info=element("photo-song-info")
      XCTAssertTrue(list.waitForExistence(timeout:10));XCTAssertTrue(app.buttons["播放"].isHittable)
      XCTAssertGreaterThan(viewport.frame.height,100);XCTAssertTrue(app.frame.insetBy(dx:-1,dy:-1).contains(viewport.frame));XCTAssertTrue(app.frame.insetBy(dx:-1,dy:-1).contains(info.frame))
      openPhotoLyricSource(app)
      let portrait=XCTAttachment(screenshot:XCUIScreen.main.screenshot());portrait.name=largeText ? "Photo accessibility lyrics and song controls":"Photo portrait composition";portrait.lifetime = .keepAlways;add(portrait)
      if !largeText {
        XCUIDevice.shared.orientation = .landscapeLeft;app.activate()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in element("photo-horizontal").exists && viewport.frame.height>100},object:nil)],timeout:15),.completed)
        XCTAssertTrue(app.buttons["播放"].isHittable);XCTAssertTrue(app.buttons["更多播放控制"].isHittable);XCTAssertTrue(app.buttons["选择歌词来源"].isHittable)
        let landscape=XCTAttachment(screenshot:XCUIScreen.main.screenshot());landscape.name="Photo landscape lyric column";landscape.lifetime = .keepAlways;add(landscape)
        XCUIDevice.shared.orientation = .portrait;app.activate()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in element("photo-vertical").exists},object:nil)],timeout:15),.completed)
      }
      app.buttons["photo-actions-toggle"].tap();let progress=element("播放进度");XCTAssertTrue(progress.waitForExistence(timeout:5));XCTAssertTrue(progress.isHittable)
      app.buttons["更多播放控制"].tap();XCTAssertTrue(app.buttons["收起播放选项"].waitForExistence(timeout:5));app.buttons["收起播放选项"].tap()
      XCTAssertFalse(element("photo-quick-actions").exists,"Opening another presentation clears photo action state")
      let restored=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !app.buttons["收起播放选项"].exists && element("photo-player").exists && app.buttons["播放"].isHittable},object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[restored],timeout:8),.completed,"The native options sheet must finish dismissing and restore the actual photo transport")
      XCTAssertTrue(app.buttons["播放"].isHittable);app.buttons["收起播放页"].tap()
      openSettings(app,page:"sources");let remove=app.buttons["移除连接：fixture-user"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
      XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10));return
    }
    if classic {
      let viewport=element("classic-player-scroll")
      XCTAssertTrue(viewport.waitForExistence(timeout:10))
      XCTAssertGreaterThanOrEqual(viewport.frame.minY,app.frame.minY+20)
      XCTAssertLessThanOrEqual(viewport.frame.maxY,app.frame.maxY-10)
      let openQueue=app.buttons["查看播放队列"].firstMatch
      reveal(openQueue);openQueue.tap()
      let queue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
      XCTAssertTrue(queue.waitForExistence(timeout:10));reveal(queue);queue.tap()
      let closeQueue=app.buttons["收起队列"];XCTAssertTrue(closeQueue.waitForExistence(timeout:10));closeQueue.tap()
      XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeQueue)],timeout:10),.completed)
      let closeContent=app.buttons["收起播放选项"].firstMatch
      XCTAssertTrue(closeContent.waitForExistence(timeout:10));closeContent.tap()
      XCTAssertTrue(waitForGone(closeContent,timeout:10),"Closing the queue host must restore the classic viewport before safe-area checks")
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
    let lyrics=app.buttons[am ? "am-content-lyrics":"am2-content-lyrics"];XCTAssertTrue(lyrics.isHittable);lyrics.tap()
    XCTAssertTrue(element(am ? "am-lyrics-list":"am2-lyrics-list").waitForExistence(timeout:10))
    let progress=element("播放进度"),beforeScroll=progress.value as? String
    let line=app.buttons["定位歌词：Synthetic lyric two"].firstMatch;XCTAssertTrue(line.waitForExistence(timeout:10))
    let lyricList=element(am ? "am-lyrics-list":"am2-lyrics-list")
    for _ in 0..<5 {if line.isHittable{break};lyricList.swipeUp()}
    XCTAssertEqual(progress.value as? String,beforeScroll,"Scrolling lyrics must keep the paused playback position")
    let beforeTap=XCTAttachment(screenshot:app.screenshot());beforeTap.name=am ? "AM actual lyric before double tap":"AM2 actual lyric before double tap";beforeTap.lifetime = .keepAlways;add(beforeTap)
    XCTAssertTrue(line.isHittable);line.doubleTap()
    expectation(for:NSPredicate(format:"value == %@","0:06 / 2:00"),evaluatedWith:progress);waitForExpectations(timeout:5)
    XCTAssertEqual(progress.value as? String,"0:06 / 2:00")
    if am && largeText {
      let startVisible=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in line.frame.minY>=lyricList.frame.minY-1 && line.frame.minY<lyricList.frame.maxY-30},object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[startVisible],timeout:10),.completed,"An oversized AM lyric must show its beginning, rather than centering a clipped middle fragment")
    }
    let play=app.buttons["播放"];XCTAssertTrue(play.isHittable);XCTAssertLessThanOrEqual(play.frame.maxY,app.frame.maxY)
    let portrait=XCTAttachment(screenshot:app.screenshot());portrait.name=am ? "AM actual lyrics and transport large text \(largeText)" : largeText ? "AM2 accessibility XXXL actual lyrics and transport" : "AM2 portrait actual lyrics and transport";portrait.lifetime = .keepAlways;add(portrait)
    if !largeText{
      line.press(forDuration:0.7)
      let closeLyrics=app.buttons["收起全部歌词"];XCTAssertTrue(closeLyrics.waitForExistence(timeout:5));closeLyrics.tap()
      XCTAssertEqual(progress.value as? String,"0:06 / 2:00","Long press opens settings without seeking")
    }
    if !largeText{
      XCUIDevice.shared.orientation = .landscapeLeft
      let rotated=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in app.frame.width>app.frame.height && element(am ? "am-horizontal":"am2-horizontal").exists},object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[rotated],timeout:15),.completed)
      XCTAssertTrue(play.isHittable,"Landscape transport must fit in its column")
      XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"Landscape lyric source must fit in its column")
      var previousPanel=CGRect.zero,stableFrames=0
      let settled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        let panel=element(am ? "am-body":"am2-content-panel").frame
        stableFrames=panel==previousPanel ? stableFrames+1:0;previousPanel=panel
        return (am ? panel.width>100 : panel.minX>app.frame.width*0.4) && panel.height>100 && stableFrames>=2
      },object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[settled],timeout:10),.completed,"Capture the final native columns after rotation settles")
      let landscape=XCTAttachment(screenshot:app.screenshot());landscape.name=am ? "AM native landscape body and transport":"AM2 native landscape columns and transport";landscape.lifetime = .keepAlways;add(landscape)
      let display=XCTAttachment(screenshot:XCUIScreen.main.screenshot());display.name=am ? "AM landscape full display":"AM2 landscape full display";display.lifetime = .keepAlways;add(display)
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
    // Colour scores are only meaningful under the shipping default theme. A
    // previous run can persist classic/blue/solid, so restore blush/rose/gradient
    // through the real settings pages before any screenshot is captured.
    let blush=app.descendants(matching:.any).matching(identifier:"visual-blush")
    openSettings(app,page:"background")
    let blushChoice=blush.firstMatch
    if blushChoice.exists && !blushChoice.isSelected {blushChoice.tap()}
    let gradient=app.descendants(matching:.any).matching(identifier:"background-gradient").firstMatch
    if gradient.exists && !gradient.isSelected {gradient.tap()}
    // Use the shipping theme for colour evidence, including settings captures.
    let backgroundScroll=app.descendants(matching:.any).matching(identifier:"background-sheet-scroll").firstMatch
    func reveal(_ element:XCUIElement){for _ in 0..<40 {if element.exists && element.isHittable{break};let above=element.exists && element.frame.midY<backgroundScroll.frame.midY;backgroundScroll.coordinate(withNormalizedOffset:CGVector(dx:0.03,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:backgroundScroll.coordinate(withNormalizedOffset:CGVector(dx:0.03,dy:above ? 0.65 : 0.35)))};XCTAssertTrue(element.exists && element.isHittable)}
    func reachValue(_ identifier:String,_ target:String,_ up:Bool){
      let label=app.staticTexts["visual-value-"+identifier]
      for _ in 0..<18 {
        if label.exists && label.label==target {return}
        let step=app.buttons["visual-"+identifier+(up ? "-up":"-down")]
        if !step.exists {reveal(label)}
        XCTAssertTrue(step.waitForExistence(timeout:5));if !step.exists {return}
        if !step.isHittable {reveal(step)}
        let before=label.exists ? label.label : ""
        step.tap()
        for _ in 0..<20 {
          if label.exists && label.label != before {break}
          RunLoop.current.run(until:Date().addingTimeInterval(0.05))
        }
      }
    }
    // A preceding failed import test can leave its one-pixel photo selected.
    // Photo skin intentionally prefers the local photo over the cover, so
    // remove only that known public fixture before asserting cover rendering.
    let photoName=app.staticTexts["visual-photo-name"];reveal(photoName)
    if photoName.label.contains("Nexus Visual Fixture.png"){
      let remove=app.buttons["visual-remove-photo"];reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
      expectation(for:NSPredicate(format:"label CONTAINS %@","尚未导入"),evaluatedWith:photoName);waitForExpectations(timeout:10)
    }
    XCTAssertTrue(photoName.label.contains("尚未导入"),"Cover regression requires no unrelated personal photo")
    openSettings(app,page:"background")
    let reset=app.buttons["appearance-reset"]
    XCTAssertTrue(reset.waitForExistence(timeout:5));reset.tap()
    // IMG_4855 records 纯色 / 卡片 30%. Keep the required shipping blush+rose
    // theme, but match the non-colour state through the real settings.
    let solid=app.descendants(matching:.any).matching(identifier:"background-solid").firstMatch
    reveal(solid);solid.tap();XCTAssertTrue(solid.isSelected)
    reachValue("cardOpacity","30%",false)
    openSettings(app,page:"background")
    let preview=app.descendants(matching:.any).matching(identifier:"theme-preview-card").firstMatch
    XCTAssertTrue(preview.waitForExistence(timeout:10))
    let previewSummary=app.descendants(matching:.any).matching(identifier:"theme-preview-summary").firstMatch
    XCTAssertTrue(previewSummary.waitForExistence(timeout:5));XCTAssertTrue(previewSummary.label.contains("纯色 · 卡片 30%"))
    let appearanceShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());appearanceShot.name="Appearance background page";appearanceShot.lifetime = .keepAlways;add(appearanceShot)
    if backgroundScroll.exists {backgroundScroll.swipeUp()}
    // IMG_4856 records 背景透明度 100% / 卡片透明度 30% / 背景遮罩 0% / 背景模糊 0; move
    // the real sliders to those values so the comparison is not a default mismatch.
    reachValue("backgroundOpacity","100%",true)
    reachValue("cardOpacity","30%",false)
    reachValue("playerBlur","0",false)
    // IMG_4856 shows the background-type capsule at a 136.7pt lower edge and
    // Exact 4855/4856 normalization now lives in the deterministic Visual Lab
    // fixture. This broad playback regression only needs the real lower sheet
    // state, so reach the final slider and capture without legacy gesture math.
    let blurValue=app.staticTexts["visual-value-playerBlur"]
    reveal(blurValue)
    let lowerAppearanceShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());lowerAppearanceShot.name="Appearance background page scrolled";lowerAppearanceShot.lifetime = .keepAlways;add(lowerAppearanceShot)
    // Supplementary same-state capture: IMG_4856 sits on a blue-grey surface while
    // the shipping default is warm paper. Capture the same measured layout under
    // the closest built-in theme (柔和) while keeping the default rose accent, which
    // already matches the reference field value (#E83D56). The blush capture above
    // stays the baseline and the app defaults, fixture contract and photo pixel
    // assertion are untouched.
    openSettings(app,page:"background")
    let softTone=app.descendants(matching:.any).matching(identifier:"visual-soft").firstMatch
    XCTAssertTrue(softTone.waitForExistence(timeout:10));reveal(softTone);softTone.tap()
    openSettings(app,page:"background")
    reveal(blurValue)
    let softShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());softShot.name="Appearance background supplementary soft rose";softShot.lifetime = .keepAlways;add(softShot)
    // 25% and 55 are deliberately not on the slider step lattice. Restore via
    // the real reset action, rather than attempting unreachable stepping loops.
    openSettings(app,page:"background")
    XCTAssertTrue(reset.waitForExistence(timeout:5));reset.tap()
    let restoredBlush=app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch
    if restoredBlush.waitForExistence(timeout:5) && !restoredBlush.isSelected {restoredBlush.tap()}
    openSettings(app,page:"accent")
    let rose=app.descendants(matching:.any).matching(identifier:"accent-rose").firstMatch
    if rose.exists && !rose.isSelected {rose.tap()}
    openSettings(app,page:"skins")
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
    // Queue capture fixture: eight tracks expose the real row rhythm and the
    // list beneath the header instead of a single-row screen.
    XCTAssertNotNil(try? Data(contentsOf:URL(string:"http://127.0.0.1:18439/am-fixture-control?longQueue=1")!))
    let album=app.descendants(matching:.any).matching(identifier:"navidrome-item-album-fixture-album").firstMatch
    XCTAssertTrue(album.waitForExistence(timeout:15));album.tap()
    let play=app.buttons["播放全部"];XCTAssertTrue(play.waitForExistence(timeout:10));play.tap()
    let open=app.buttons["打开播放页"];XCTAssertTrue(open.waitForExistence(timeout:10));open.tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:10))
    XCTAssertTrue(app.buttons["Synthetic lyric one"].waitForExistence(timeout:5)||app.buttons["Synthetic lyric two"].exists)
    for _ in 0..<3 {if app.buttons["暂停"].firstMatch.isHittable{break};app.swipeUp()}
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:5))
    // Classic now keeps its style selector in the options sheet like the reference,
    // instead of rendering an inline list above the artwork.
    app.buttons["更多播放控制"].tap();XCTAssertTrue(app.buttons["播放界面样式"].waitForExistence(timeout:5));app.buttons["播放界面样式"].tap()
    let am=app.descendants(matching:.any).matching(identifier:"play-skin-am").firstMatch
    XCTAssertTrue(am.waitForExistence(timeout:5));for _ in 0..<5 {if am.isHittable{break};app.swipeUp()};am.tap()
    XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5), "Skin change must preserve paused intent")
    let amCover=app.descendants(matching:.any).matching(identifier:"am-artwork-square").firstMatch
    let amBody=app.descendants(matching:.any).matching(identifier:"am-body").firstMatch
    XCTAssertTrue(amCover.waitForExistence(timeout:5))
    XCTAssertEqual(amCover.frame.width,amCover.frame.height,accuracy:1)
    XCTAssertGreaterThan(amCover.frame.width,app.frame.width*0.75,"AM must have a real large cover body")
    XCTAssertTrue(amBody.frame.insetBy(dx:-1,dy:-1).contains(amCover.frame),"Full AM cover must fit inside its measured body")
    XCTAssertFalse(app.buttons["选择歌词来源"].exists,"Hidden lyrics must leave the accessibility tree")
    let amCoverImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());amCoverImage.name="AM full cover body";amCoverImage.lifetime = .keepAlways;add(amCoverImage)
    app.buttons["am-content-lyrics"].tap()
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"am-lyrics-list").firstMatch.waitForExistence(timeout:10))
    XCTAssertFalse(amCover.exists)
    let pausedAMClock=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch.value as? String
    app.buttons["am-content-queue"].tap()
    XCTAssertTrue(app.staticTexts["播放队列"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","1. Synthetic tone")).firstMatch.isHittable)
    XCTAssertFalse(app.descendants(matching:.any).matching(identifier:"am-lyrics-list").firstMatch.exists)
    let singleMode=app.descendants(matching:.any).matching(identifier:"queue-mode-one").firstMatch
    let shuffleMode=app.descendants(matching:.any).matching(identifier:"queue-mode-shuffle").firstMatch
    let sequenceMode=app.descendants(matching:.any).matching(identifier:"queue-mode-off").firstMatch
    singleMode.tap();XCTAssertTrue(singleMode.isSelected)
    shuffleMode.tap();XCTAssertTrue(shuffleMode.isSelected);XCTAssertFalse(singleMode.isSelected)
    sequenceMode.tap();XCTAssertTrue(sequenceMode.isSelected)
    XCTAssertTrue(app.staticTexts["· 1/8"].waitForExistence(timeout:5),"Queue heading must retain the current position and all eight entries")
    XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","2. Synthetic tone 2")).firstMatch.isHittable,"The second queue row must be on screen beneath the header")
    let amQueueImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());amQueueImage.name="AM exclusive authoritative queue body";amQueueImage.lifetime = .keepAlways;add(amQueueImage)
    _ = try? Data(contentsOf:URL(string:"http://127.0.0.1:18439/am-fixture-control?longQueue=0")!)
    app.buttons["am-content-queue"].tap()
    XCTAssertTrue(amCover.waitForExistence(timeout:5),"Repeated body selection returns to the cover")
    XCTAssertFalse(app.staticTexts["播放队列"].exists)
    XCTAssertEqual(app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch.value as? String,pausedAMClock,"Body switching must not seek")
    XCTAssertTrue(app.buttons["播放"].isHittable,"Body switching must preserve paused intent")
    app.buttons["am-content-lyrics"].tap()
    let amLyricImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());amLyricImage.name="AM full scrolling lyrics body";amLyricImage.lifetime = .keepAlways;add(amLyricImage)
    // IMG_4861 is a mid-song frame whose fill spans 41% of the track. Tap the
    // progress bar at that fraction so the capture matches the reference state.
    let amProgress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    amProgress.coordinate(withNormalizedOffset:CGVector(dx:0.41,dy:0.5)).tap()
    Thread.sleep(forTimeInterval:0.3)
    // IMG_4861 is a playing frame: the play control shows pause bars and the
    // clock keeps running. Capture that exact state, then restore paused intent.
    app.buttons["播放"].firstMatch.tap()
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:5),"AM capture must run while playback is active")
    Thread.sleep(forTimeInterval:0.8)
    let amPlayingImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());amPlayingImage.name="AM full scrolling lyrics body playing";amPlayingImage.lifetime = .keepAlways;add(amPlayingImage)
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:5),"AM capture must restore paused intent")
    // IMG_4861 has no inline diagnostic row: the lyric-source entry now lives in
    // the playback options menu, so assert that path instead of the old inline one.
    let amMore=app.buttons["更多播放控制"].firstMatch
    XCTAssertTrue(amMore.isHittable)
    amMore.tap()
    app.buttons["歌词显示设置"].firstMatch.tap()
    XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.waitForExistence(timeout:5),"AM lyric selection must remain reachable from the lyrics settings panel")
    app.buttons["收起歌词显示设置"].firstMatch.tap()
    app.buttons["收起播放选项"].firstMatch.tap()
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
    let artworkViewport=app.descendants(matching:.any).matching(identifier:"player-artwork-viewport").firstMatch
    let artworkSquare=app.descendants(matching:.any).matching(identifier:"player-artwork-square").firstMatch
    XCTAssertTrue(artworkViewport.waitForExistence(timeout:5));XCTAssertTrue(artworkSquare.exists)
    XCTAssertEqual(artworkViewport.frame.width,artworkViewport.frame.height,accuracy:1,"Immersive artwork must be displayed as a complete square")
    XCTAssertTrue(artworkViewport.frame.insetBy(dx:-1,dy:-1).contains(artworkSquare.frame),"The actual square cover must not be clipped by a shorter parent")
    XCTAssertTrue(app.buttons["播放"].isHittable, "Immersive transport controls must fit on screen")
    app.buttons["调整播放界面"].tap()
    XCTAssertTrue(app.staticTexts["播放界面样式"].waitForExistence(timeout:5), "The dedicated style control must open the style sheet")
    app.buttons["收起播放界面样式"].tap()
    let immersiveImage=XCTAttachment(screenshot:app.screenshot());immersiveImage.lifetime = .keepAlways;add(immersiveImage)
    for layout in ["photo","vinyl","wave","stage","am2"] {
      app.buttons["更多播放控制"].tap()
      if layout=="vinyl" {
        XCTAssertTrue(app.buttons["队列与播放选项"].waitForExistence(timeout:5))
        let menuShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());menuShot.name="Vinyl playback options menu";menuShot.lifetime = .keepAlways;add(menuShot)
        app.buttons["播放倍速"].tap()
        XCTAssertTrue(app.buttons["倍速 1.25x"].waitForExistence(timeout:5))
        let rateShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());rateShot.name="Playback rate sheet";rateShot.lifetime = .keepAlways;add(rateShot)
        app.buttons["倍速 1.25x"].tap();app.buttons["倍速 1x"].tap()
        app.buttons["返回播放选项"].tap()
        XCTAssertTrue(app.buttons["睡眠定时器"].waitForExistence(timeout:5));app.buttons["睡眠定时器"].tap()
        XCTAssertTrue(app.buttons["15 分钟"].waitForExistence(timeout:5))
        let sleepShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());sleepShot.name="Sleep timer sheet";sleepShot.lifetime = .keepAlways;add(sleepShot)
        app.buttons["自定义"].tap()
        XCTAssertTrue(app.buttons["开始定时"].waitForExistence(timeout:5))
        let customShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());customShot.name="Sleep timer custom";customShot.lifetime = .keepAlways;add(customShot)
        app.buttons["15 分钟"].tap();XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"sleep-status").firstMatch.waitForExistence(timeout:5))
        app.buttons["取消睡眠定时"].tap();app.buttons["返回播放选项"].tap()
        XCTAssertTrue(app.buttons["播放界面样式"].waitForExistence(timeout:5),"The options sheet must return after the timer panel closes")
      }
      app.buttons["播放界面样式"].tap()
      app.descendants(matching:.any).matching(identifier:"play-skin-\(layout)").firstMatch.tap()
      // Wait for the style sheet to actually dismiss. The vinyl composition mounts
      // more layers than the other skins, so checking hittability while the sheet
      // is still animating produced a false "transport does not fit" failure.
      let styleDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.buttons["收起播放界面样式"])
      XCTAssertEqual(XCTWaiter.wait(for:[styleDismissed],timeout:8),.completed,"Style sheet must dismiss before transport checks in \(layout)")
      XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
      // iOS keeps a dismissal snapshot above the player after the sheet's AX
      // elements disappear. Wait for the real hit test instead of asserting on
      // the first frame, which previously reported a false "transport does not fit".
      let tappable=XCTNSPredicateExpectation(predicate:NSPredicate(format:"isHittable == true"),object:app.buttons["播放"])
      if XCTWaiter.wait(for:[tappable],timeout:8) != .completed {
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Transport hierarchy \(layout)";hierarchy.lifetime = .keepAlways;add(hierarchy)
        let failureShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());failureShot.name="Transport failure \(layout)";failureShot.lifetime = .keepAlways;add(failureShot)
      }
      XCTAssertTrue(app.buttons["播放"].isHittable, "Transport must fit in \(layout)")
      if layout=="photo" {
        let element: (String)->XCUIElement = { app.descendants(matching:.any).matching(identifier:$0).firstMatch }
        let viewport=element("photo-lyric-viewport"),list=element("photo-lyrics-list"),mask=element("photo-hero-mask")
        XCTAssertTrue(list.waitForExistence(timeout:10));XCTAssertTrue(mask.waitForExistence(timeout:10))
        let hero=element("photo-hero-image")
        XCTAssertTrue(hero.waitForExistence(timeout:10),"The actual fullbleed image must enter the accessibility tree before pixel validation")
        XCTAssertGreaterThan(viewport.frame.height,150);XCTAssertTrue(app.frame.insetBy(dx:-1,dy:-1).contains(viewport.frame))
        let activeLine=app.buttons["定位歌词：Synthetic lyric two"].firstMatch
        XCTAssertTrue(activeLine.isHittable);XCTAssertTrue(viewport.frame.insetBy(dx:-1,dy:-1).contains(activeLine.frame))
        XCTAssertFalse(element("photo-quick-actions").exists,"Hidden photo controls must be absent from AX and touch")
        var observedTop=0,observedBottom=0
        let artworkRendered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
          guard let image=BackgroundPixels.decode(XCUIScreen.main.screenshot().pngRepresentation) else{return false}
          observedTop=Int(BackgroundPixels.rgba(image,at:CGPoint(x:CGFloat(image.width)*0.5,y:CGFloat(image.height)*0.2)).prefix(3).max() ?? 0)
          observedBottom=Int(BackgroundPixels.rgba(image,at:CGPoint(x:CGFloat(image.width)*0.5,y:CGFloat(image.height)*0.86)).prefix(3).max() ?? 0)
          return observedTop>observedBottom+40
        },object:nil)
        let rendered=XCTWaiter.wait(for:[artworkRendered],timeout:15)
        let shot=XCUIScreen.main.screenshot()
        let attachment=XCTAttachment(screenshot:shot);attachment.name="Photo clear masked hero and virtual lyrics";attachment.lifetime = .keepAlways;add(attachment)
        if let image=BackgroundPixels.decode(shot.pngRepresentation) {
          let top=BackgroundPixels.rgba(image,at:CGPoint(x:CGFloat(image.width)*0.5,y:CGFloat(image.height)*0.2))
          let bottom=BackgroundPixels.rgba(image,at:CGPoint(x:CGFloat(image.width)*0.5,y:CGFloat(image.height)*0.86))
          XCTAssertEqual(rendered,.completed,"Actual fullbleed artwork must finish rendering before capture; observed top \(observedTop), bottom \(observedBottom)")
          XCTAssertGreaterThan(Int(top.prefix(3).max() ?? 0),Int(bottom.prefix(3).max() ?? 0)+40,"Actual fullbleed artwork must fade into the dark lyric foundation")
        } else { XCTFail("Photo screenshot must decode") }
        app.buttons["photo-actions-toggle"].tap();XCTAssertTrue(element("photo-quick-actions").waitForExistence(timeout:5));XCTAssertTrue(progress.isHittable)
        let pausedPosition=progress.value as? String
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in !element("photo-quick-actions").exists},object:nil)],timeout:9),.completed,"Idle photo actions expire")
        app.buttons["photo-actions-toggle"].tap();XCTAssertTrue(progress.waitForExistence(timeout:5));XCTAssertEqual(progress.value as? String,pausedPosition,"Showing and expiring photo actions never seeks the paused controller")
        let controls=XCTAttachment(screenshot:app.screenshot());controls.name="Photo revealed controls and shared paused progress";controls.lifetime = .keepAlways;add(controls)
        app.buttons["photo-actions-toggle"].tap();XCTAssertFalse(element("photo-quick-actions").exists)
      }
      if layout=="wave" {
        let viewport=app.descendants(matching:.any).matching(identifier:"player-artwork-viewport").firstMatch
        let cover=app.descendants(matching:.any).matching(identifier:"player-artwork-square").firstMatch
        XCTAssertTrue(viewport.exists && cover.exists)
        XCTAssertEqual(viewport.frame.width,viewport.frame.height,accuracy:1)
        XCTAssertTrue(viewport.frame.insetBy(dx:-1,dy:-1).contains(cover.frame),"Wave cover must remain complete above its lyric group")
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Wave complete cover";image.lifetime = .keepAlways;add(image)
      }
      if layout=="vinyl" {
        let turntable=app.descendants(matching:.any).matching(identifier:"vinyl-turntable").firstMatch
        let needle=app.descendants(matching:.any).matching(identifier:"vinyl-tonearm").firstMatch
        XCTAssertTrue(turntable.waitForExistence(timeout:10));XCTAssertTrue(needle.exists)
        let canvas=app.descendants(matching:.any).matching(identifier:"vinyl-canvas").firstMatch
        let deck=app.descendants(matching:.any).matching(identifier:"vinyl-deck").firstMatch
        let platter=app.descendants(matching:.any).matching(identifier:"vinyl-platter").firstMatch
        let spindle=app.descendants(matching:.any).matching(identifier:"vinyl-spindle").firstMatch
        let pivot=app.descendants(matching:.any).matching(identifier:"vinyl-pivot").firstMatch
        XCTAssertTrue(canvas.exists && deck.exists && platter.exists && spindle.exists && pivot.exists)
        XCTAssertGreaterThan(canvas.frame.width,app.frame.width*0.75,"The turntable must occupy the main artwork area rather than a small lyric illustration")
        XCTAssertTrue(canvas.frame.contains(deck.frame) && deck.frame.contains(platter.frame),"The complete deck and platter must fit their actual visible canvas")
        XCTAssertEqual(platter.frame.midX,spindle.frame.midX,accuracy:1);XCTAssertEqual(platter.frame.midY,spindle.frame.midY,accuracy:1)
        XCTAssertLessThan(platter.frame.midX,canvas.frame.midX,"Leave space for the independent tonearm pivot")
        XCTAssertGreaterThan(pivot.frame.midX,platter.frame.midX);XCTAssertLessThan(pivot.frame.midY,platter.frame.midY)
        XCTAssertTrue(canvas.frame.contains(pivot.frame),"The fixed pivot must remain visible")
        let cartridge=app.descendants(matching:.any).matching(identifier:"vinyl-cartridge").firstMatch
        let counterweight=app.descendants(matching:.any).matching(identifier:"vinyl-counterweight").firstMatch
        XCTAssertTrue(cartridge.exists && counterweight.exists)
        let parkedVisible=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
          let bounds=canvas.frame.insetBy(dx:-1,dy:-1)
          return !cartridge.frame.isEmpty && !counterweight.frame.isEmpty && bounds.contains(cartridge.frame) && bounds.contains(counterweight.frame)
        },object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[parkedVisible],timeout:5),.completed,"Parked head and rear weight must fit within the 1pt geometry budget; canvas \(canvas.frame), head \(cartridge.frame), weight \(counterweight.frame)")
        XCTAssertTrue(app.buttons["睡眠定时"].isHittable,"IMG_4851 keeps a real sleep-timer tool beside the queue tool")
        let parkedHead=cartridge.frame,parkedPivot=pivot.frame
        XCTAssertGreaterThan(counterweight.frame.midX,platter.frame.midX);XCTAssertLessThan(counterweight.frame.midY,pivot.frame.midY,"Rear weight belongs behind the pivot")
        let composition=XCTAttachment(screenshot:XCUIScreen.main.screenshot());composition.name="Vinyl reference composition";composition.lifetime = .keepAlways;add(composition)
        func discPixels()->[UInt8]{
          guard let image=BackgroundPixels.decode(XCUIScreen.main.screenshot().pngRepresentation) else{return []}
          let frame=platter.frame,diameter=frame.width*0.91,scale=UIScreen.main.scale
          return (-4...4).flatMap{y->[UInt8] in (-4...4).flatMap{x in
            BackgroundPixels.rgba(image,at:CGPoint(x:(frame.midX+CGFloat(x)*diameter*0.035)*scale,y:(frame.midY+CGFloat(y)*diameter*0.035)*scale))
          }}
        }
        let pausedDisc=discPixels();XCTAssertEqual(pausedDisc.count,324,"Read actual asymmetric cover pixels, never an empty stability baseline")
        XCTAssertEqual(pausedDisc,discPixels(),"Paused disc must retain its native phase")
        app.buttons["播放"].tap()
        let engaged=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in cartridge.frame.midX<parkedHead.midX-20},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[engaged],timeout:10),.completed,"Playing must move the actual needle onto the disc")
        XCTAssertLessThan(cartridge.frame.midX,parkedHead.midX-20,"Engagement must carry the actual head left onto the record")
        XCTAssertTrue(platter.frame.contains(cartridge.frame),"The engaged head must remain on the actual platter")
        // IMG_4851 shows the complete rear weight projecting above the deck.
        XCTAssertTrue(app.frame.contains(counterweight.frame),"The engaged rear weight must remain complete on screen")
        XCTAssertLessThan(counterweight.frame.minY,deck.frame.minY-2,"The rear weight must project above the deck rather than being cropped at its upper edge")
        XCTAssertEqual(pivot.frame.midX,parkedPivot.midX,accuracy:0.5);XCTAssertEqual(pivot.frame.midY,parkedPivot.midY,accuracy:0.5)
        let spinning=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
          let next=discPixels();return next.count==324 && zip(pausedDisc,next).reduce(0){$0+abs(Int($1.0)-Int($1.1))}>100
        },object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[spinning],timeout:10),.completed,"Native rotation must change actual asymmetric cover pixels")
        let playingShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());playingShot.name="Vinyl engaged needle and rotating asymmetric cover";playingShot.lifetime = .keepAlways;add(playingShot)
        XCUIDevice.shared.press(.home);app.activate()
        XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout:10),"Foreground restoration retains playback intent")
        let beforeResume=discPixels()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in let next=discPixels();return next.count==324 && next != beforeResume},object:nil)],timeout:10),.completed,"Actual disc resumes after foreground restoration")
        app.buttons["暂停"].tap()
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in abs(cartridge.frame.midX-parkedHead.midX)<1 && abs(cartridge.frame.midY-parkedHead.midY)<1},object:nil)],timeout:10),.completed,"Pause returns the actual needle to its parked angle")
        XCTAssertEqual(cartridge.frame.midX,parkedHead.midX,accuracy:1);XCTAssertEqual(cartridge.frame.midY,parkedHead.midY,accuracy:1)
        // AX needle geometry and the screenshot compositor settle separately.
        // Require three consecutive byte-identical, nonempty disc samples;
        // preserve exact pixel equality rather than introducing a tolerance.
        var stopped=discPixels(),stableSamples=1
        XCTAssertEqual(stopped.count,324)
        let discStopped=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
          let next=discPixels()
          if next.count==324 && next==stopped {stableSamples += 1}else{stableSamples=1}
          stopped=next
          return next.count==324 && stableSamples>=3
        },object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[discStopped],timeout:10),.completed,"Pause freezes the disc independently of returning the needle (three exact samples)")
        let parkedShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());parkedShot.name="Vinyl parked needle and stopped asymmetric cover";parkedShot.lifetime = .keepAlways;add(parkedShot)
      }
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
      if layout=="vinyl" {
        XCTAssertTrue(app.buttons["歌词与来源"].isHittable,"Vinyl keeps lyrics in its dedicated tool rather than shrinking the record")
        app.buttons["歌词与来源"].tap()
        XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.waitForExistence(timeout:5))
      }
      if layout=="photo"{openPhotoLyricSource(app)}else{XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.isHittable,"Lyric selection must fit in \(layout)")}
      if layout=="vinyl" {
        XCTAssertTrue(app.buttons["Synthetic lyric two"].firstMatch.isHittable,"The original shared lyric content remains available")
        app.buttons["收起黑胶歌词"].tap()
        XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5),"Returning from lyrics must preserve paused playback")
      }
      if layout=="stage" {
        let group=app.descendants(matching:.any).matching(identifier:"lyric-stage-group").firstMatch
        XCTAssertTrue(group.waitForExistence(timeout:10));XCTAssertEqual(group.label,"two","Stage must select the last real timed group at the shared 60-second position")
        let stageImage=XCTAttachment(screenshot:app.screenshot());stageImage.name="Stage real group with paused transport";stageImage.lifetime = .keepAlways;add(stageImage)
      }
      if layout=="wave" {
        let activeLyric=app.buttons["Synthetic lyric two"].firstMatch
        XCTAssertTrue(activeLyric.isHittable,"Wave layout must show its active lyric completely below the selector")
        let lyricViewport=app.descendants(matching:.any).matching(identifier:"player-lyric-viewport").firstMatch
        XCTAssertTrue(lyricViewport.frame.insetBy(dx:-1,dy:-1).contains(activeLyric.frame),"Actual lyric frame must fit its clipping viewport, not only exist in AX")
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
    // The sheet dismisses after the layout is persisted; capturing immediately
    // caught its dismissal animation and covered the classic page (the score was
    // then compared against IMG_4854 and reported the sheet, not the player).
    // Wait for the sheet content to leave the hierarchy and for the classic
    // anchors to settle before taking the reference capture.
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch.waitForNonExistence(timeout:10),"Style sheet must finish dismissing before the classic capture")
    XCTAssertTrue(app.buttons["选择歌词来源"].firstMatch.waitForExistence(timeout:10),"Classic page must be on screen after the style sheet closes")
    let classicProgress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    var classicFrame=CGRect.zero,classicStable=0
    let classicSettled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let frame=classicProgress.exists ? classicProgress.frame : .zero
      classicStable=frame==classicFrame ? classicStable+1:0;classicFrame=frame
      return frame.height>0 && classicStable>=2
    },object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[classicSettled],timeout:10),.completed,"Classic layout must stop moving before capture")
    // IMG_4854 is playing at 04:26/04:44 (93.66%). The fixture is 120s, so seek
    // to the same fraction through the real progress responder before capture;
    // otherwise the filled track and knob are compared at a different moment.
    classicProgress.coordinate(withNormalizedOffset:CGVector(dx:0.934,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"value CONTAINS %@","1:52"),evaluatedWith:classicProgress);waitForExpectations(timeout:5)
    // IMG_4854 is playing: capture the pause bars in the same intent, then
    // restore the paused fixture the remaining assertions rely on.
    app.buttons["播放"].firstMatch.tap()
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:5),"Classic capture must run while playback is active")
    Thread.sleep(forTimeInterval:0.2)
    let classicShot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());classicShot.name="Classic reference composition";classicShot.lifetime = .keepAlways;add(classicShot)
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:5),"Classic capture must restore paused intent")
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
    func themeState(_ query:String="") throws -> [String:Any] {
      let bytes=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/theme-fixture-control"+(query.isEmpty ? "" : "?"+query))!)
      return try JSONSerialization.jsonObject(with:bytes) as? [String:Any] ?? [:]
    }
    func themeControl(_ query:String="") throws -> Int {
      (try themeState(query))["held"] as? Int ?? -1
    }
    func waitForHeldCover(_ color:String) -> XCTWaiter.Result {
      let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        let colors=(try? themeState())?["heldColors"] as? [String] ?? []
        return colors.contains(color)
      },object:nil)
      return XCTWaiter.wait(for:[expectation],timeout:30)
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
    openSettings(app,page:"background");let classicTheme=app.descendants(matching:.any).matching(identifier:"visual-classic").firstMatch;reveal(classicTheme);classicTheme.tap()
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
    let queueEntry=app.buttons["查看播放队列"];reveal(queueEntry);queueEntry.tap()
    let fullQueue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
    reveal(fullQueue);fullQueue.tap()
    let closeQueue=app.buttons["收起队列"];XCTAssertTrue(closeQueue.waitForExistence(timeout:10));closeQueue.tap()
    let queueDismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeQueue)
    XCTAssertEqual(XCTWaiter.wait(for:[queueDismissed],timeout:10),.completed)
    let closeOptions=app.buttons["收起播放选项"];reveal(closeOptions);closeOptions.tap()
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:closeOptions)],timeout:10),.completed)
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
    // The standalone discovery entry that once opened a non-player full screen
    // from the search page was removed with batch 2 (search is its own page);
    // queue-modal layering above still guards presentation ownership. Root
    // motion must still run after the player closes and a plain tab shows.
    motion(true)
    let rootPixels=backgroundPixels()
    let rootMotion=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let next=backgroundPixels()
      return next.count==30 && zip(rootPixels,next).reduce(0){$0+abs(Int($1.0)-Int($1.1))}>=5
    },object:app)
    XCTAssertEqual(XCTWaiter.wait(for:[rootMotion],timeout:20),.completed,"Root background motion must resume on a plain tab after the player closes")
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
    XCTAssertTrue(transitionRed.waitForExistence(timeout:15));reveal(transitionRed)
    // Recorder startup can exceed the real cover loader's 10s timeout on CI.
    // Establish video readiness before creating the deliberately held request.
    _=try themeControl("record=1")
    transitionRed.tap()
    // Cover extraction is bounded by the native cache queue and can follow
    // the preceding blue request; give that queue its documented headroom.
    let heldRedResult=waitForHeldCover("red")
    if heldRedResult != .completed {
      let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="Red cover request observation failure";shot.lifetime = .keepAlways;add(shot)
      let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Red cover request failure hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
    }
    XCTAssertEqual(heldRedResult,.completed,"The new red cover must reach the held HTTP fixture")
    expectTint(false,"Previous blue scene retained while red cover HTTP is held")
    // Theme changes are verified below with multi-point scene samples; keep
    // this held-request checkpoint focused on the async owner identity.
    let heldThemeImage=XCTAttachment(screenshot:XCUIScreen.main.screenshot());heldThemeImage.name="Pending red identity while blue scene remains visible after theme rebuild";heldThemeImage.lifetime = .keepAlways;add(heldThemeImage)
    _=try themeControl("release=red")
    expectTint(true,"Current red scene after bounded crossfade")
    _=try themeControl("stop=1")
    let transitionBlue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","transition blue tone")).firstMatch
    let missing=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","transition missing tone")).firstMatch
    // Resolve both rows before starting the native request's ten-second clock.
    // Slow AX snapshots/scrolling must not turn this late-response probe into
    // a legitimate timeout and fallback of the current blue identity.
    reveal(missing);reveal(transitionBlue)
    XCTAssertTrue(missing.isHittable)
    let missingFrame=missing.frame,appFrame=app.frame
    let missingPoint=app.coordinate(withNormalizedOffset:.zero).withOffset(CGVector(dx:missingFrame.midX-appFrame.minX,dy:missingFrame.midY-appFrame.minY))
    transitionBlue.tap()
    XCTAssertEqual(waitForHeldCover("blue"),.completed,"The blue identity itself must reach the held HTTP fixture")
    expectTint(true,"Previous red scene retained while blue cover HTTP is held")
    missingPoint.tap()
    XCTAssertEqual(waitForHeldCover("missing"),.completed,"The missing identity itself must supersede the held blue request before tint validation")
    let barrierState=try themeState()
    let blueAge=(barrierState["heldAgesMs"] as? [String:NSNumber])?["blue"]?.doubleValue
    XCTAssertNotNil(blueAge,"The old blue response must still be pending when the new owner starts")
    XCTAssertLessThan(blueAge ?? .infinity,10_000,"The owner switch must precede the production HTTP timeout")
    let timing=XCTAttachment(string:String(describing:barrierState));timing.name="Cover owner barrier ages before late blue release";timing.lifetime = .keepAlways;add(timing)
    _=try themeControl("release=blue")
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
    let panel=app.descendants(matching:.any).matching(identifier:"discovery-actions").firstMatch
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
    // The standalone discovery modal was removed with batch 2 (the discover
    // tab is the only presentation); re-enter the same detail there to prove
    // the second add still preserves the duplicate entry.
    tab("discover");detail();actions();evidence("Embedded discovery owns its song action sheet after tab return")
    action("加入歌单").tap();XCTAssertTrue(app.buttons["取消添加"].waitForExistence(timeout:10));app.buttons["取消添加"].tap()
    XCTAssertTrue(more.waitForExistence(timeout:10));actions();action("加入歌单").tap()
    let existing=app.buttons[name+" · 1 首"];XCTAssertTrue(existing.waitForExistence(timeout:10));reach(existing);existing.tap()
    XCTAssertTrue(more.waitForExistence(timeout:10))
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
        // Left content padding avoids both curve/slider responders and the
        // native scroll indicator at the right edge (x396 on the cloud phone).
        surface.coordinate(withNormalizedOffset:CGVector(dx:0.04,dy:above ? 0.25 : 0.75)).press(forDuration:0.05,thenDragTo:surface.coordinate(withNormalizedOffset:CGVector(dx:0.04,dy:above ? 0.75 : 0.25)))
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
    XCTAssertTrue(waitForHittable(close,timeout:5));XCTAssertFalse(app.buttons["settings-open-background"].exists)
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"player-style-sheet").firstMatch.exists)
    let wave=item("wave");reveal(wave);XCTAssertTrue((wave.value as? String)?.contains("实时音频频谱环") == true);wave.tap()
    XCTAssertTrue(waitForGone(close,timeout:10),"Saving a style must dismiss the sheet before touching its previous controls")
    XCTAssertTrue(app.staticTexts["settings-title-appearance"].exists)
    XCTAssertEqual(entry.frame.midY,entryY,accuracy:2,"Saving a style must retain the underlying category scroll")
    entry.tap();XCTAssertTrue(waitForHittable(close,timeout:10));reveal(wave);XCTAssertTrue(wave.isSelected)
    let image=XCTAttachment(screenshot:app.screenshot());image.name="Player style sheet at accessibility XXXL with persisted choice";image.lifetime = .keepAlways;add(image)
    let title=app.staticTexts["settings-title-skins"]
    title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    XCTAssertTrue(waitForGone(close,timeout:10),"Swipe dismissal must remove the sheet before checking persisted state")
    XCTAssertEqual(entry.frame.midY,entryY,accuracy:2);entry.tap();XCTAssertTrue(waitForHittable(close,timeout:10));reveal(wave);XCTAssertTrue(wave.isSelected)
    close.tap();XCTAssertTrue(waitForGone(close,timeout:10))
    entry.tap();XCTAssertTrue(waitForHittable(close,timeout:10));reveal(wave);XCTAssertTrue(wave.isSelected,"Closing without a choice must preserve the style")
    close.tap();XCTAssertTrue(waitForGone(close,timeout:10))
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(wave);XCTAssertTrue(wave.isSelected,"Restart must restore the saved layout")
    let stage=item("stage");reveal(stage);stage.tap()
    XCTAssertTrue(waitForGone(close,timeout:10))
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(stage);XCTAssertTrue(stage.isSelected,"Restart must restore the new stage layout too")
    let am2=item("am2");reveal(am2);am2.tap()
    XCTAssertTrue(waitForGone(close,timeout:10))
    app.terminate();app.launch();openSettings(app,page:"skins");reveal(am2);XCTAssertTrue(am2.isSelected,"Restart must restore AM2 independently from AM")
    let classic=item("classic");reveal(classic);classic.tap()
    XCTAssertTrue(waitForGone(close,timeout:10))
  }
  func testBackgroundSheetWithLargeTextAndPersistence() throws {
    let app=XCUIApplication();app.launchArguments=["-UIPreferredContentSizeCategoryName","UICTContentSizeCategoryAccessibilityXXXL"];app.launch()
    func element(_ id:String)->XCUIElement{app.descendants(matching:.any).matching(identifier:id).firstMatch}
    func reveal(_ item:XCUIElement){
      let scroll=element("background-sheet-scroll")
      for _ in 0..<35 {
        // AX can report content extending beyond the sheet's visible window.
        // Keep both drag endpoints inside the visible scroll area, away from
        // the rounded sheet edge, as in the mini settings regression fixture.
        let viewport=scroll.frame.intersection(app.frame)
        if item.exists && item.isHittable && viewport.contains(item.frame){break}
        guard !viewport.isNull && viewport.width>44 && viewport.height>100 else{break}
        let above=item.exists && item.frame.midY<viewport.midY
        let base=app.coordinate(withNormalizedOffset:CGVector(dx:0,dy:0))
        let start=base.withOffset(CGVector(dx:viewport.midX-app.frame.minX,dy:viewport.minY+viewport.height*(above ? 0.25:0.75)-app.frame.minY))
        let end=base.withOffset(CGVector(dx:viewport.midX-app.frame.minX,dy:viewport.minY+viewport.height*(above ? 0.75:0.25)-app.frame.minY))
        start.press(forDuration:0.05,thenDragTo:end)
      }
      if !item.isHittable {
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Background sheet unreachable control";image.lifetime = .keepAlways;add(image)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Background sheet unreachable hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertTrue(item.isHittable,"Background control must remain reachable: \(item.identifier), frame: \(item.frame), scroll: \(scroll.frame), window: \(app.frame)")
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
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:app.buttons["background-sheet-close"]);waitForExpectations(timeout:10)
    expectation(for:NSPredicate(format:"hittable == true"),evaluatedWith:app.buttons["settings-open-background"]);waitForExpectations(timeout:10)
    let entry=app.buttons["settings-open-background"],entryY=app.buttons["settings-open-background"].frame.midY
    XCTAssertTrue(entry.isHittable);entry.tap();reveal(soft);XCTAssertTrue(soft.isSelected)
    let handle=app.buttons["background-sheet-close"]
    XCTAssertTrue(handle.waitForExistence(timeout:5))
    handle.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.95)))
    expectation(for:NSPredicate(format:"exists == false"),evaluatedWith:handle);waitForExpectations(timeout:10)
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
        let viewport=scroll.frame.intersection(app.frame)
        if item.exists && item.isHittable && viewport.contains(item.frame){break}
        guard !viewport.isNull && viewport.width>44 && viewport.height>100 else {break}
        let above=item.exists && item.frame.midY<viewport.midY
        let base=app.coordinate(withNormalizedOffset:CGVector(dx:0,dy:0))
        let start=base.withOffset(CGVector(dx:viewport.midX-app.frame.minX,dy:viewport.minY+viewport.height*(above ? 0.25:0.75)-app.frame.minY))
        let end=base.withOffset(CGVector(dx:viewport.midX-app.frame.minX,dy:viewport.minY+viewport.height*(above ? 0.75:0.25)-app.frame.minY))
        start.press(forDuration:0.05,thenDragTo:end)
      }
      if !item.isHittable {
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Mini sheet unreachable control";image.lifetime = .keepAlways;add(image)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Mini sheet unreachable hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertTrue(item.isHittable,"Mini control must remain reachable: \(item.identifier), frame: \(item.frame), scroll: \(scroll.frame), window: \(app.frame)")
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
    let viewportElement=app.descendants(matching:.any).matching(identifier:"settings-viewport-equalizer").firstMatch
    XCTAssertTrue(viewportElement.waitForExistence(timeout:10),"EQ viewport must replace any restored full-screen player")
    for _ in 0..<60 {
      let viewport=viewportElement.frame
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
    for _ in 0..<20 {if classic.isHittable{break};app.swipeUp()};XCTAssertTrue(classic.isHittable);classic.tap()
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
    try exerciseVisualImagesAndPlayerBackgroundPersistence(imageName:"Nexus Visual Fixture.png")
  }
  func testLiveBackgroundPersistence() throws {
    let app=XCUIApplication();app.launch()
    let player=app.buttons["打开播放页"].firstMatch;XCTAssertTrue(player.waitForExistence(timeout:10));player.tap()
    XCTAssertTrue(app.staticTexts["Shape of You"].firstMatch.waitForExistence(timeout:10))
    let play=app.buttons["播放"].firstMatch;if play.waitForExistence(timeout:3){play.tap()}
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:60))
    let progress=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","播放进度")).firstMatch
    XCTAssertTrue(progress.waitForExistence(timeout:10));let before=progress.value as? String ?? "";XCTAssertTrue(before.contains("/ 3:53"))
    RunLoop.current.run(until:Date().addingTimeInterval(4));XCTAssertNotEqual(progress.value as? String,before,"Public MP3 native timeline must advance")
    app.buttons["暂停"].firstMatch.tap();app.buttons["收起播放页"].firstMatch.tap()
    try exerciseVisualImagesAndPlayerBackgroundPersistence(imageName:"Shape-cover.jpg")
  }
  private func exerciseVisualImagesAndPlayerBackgroundPersistence(imageName:String) throws {
    let app=XCUIApplication();app.launch()
    let viewport=app.descendants(matching:.any).matching(identifier:"background-sheet-scroll").firstMatch
    func reveal(_ element:XCUIElement,companion:XCUIElement?=nil,expectAbove:Bool?=nil){
      let handle=app.buttons["background-sheet-close"]
      func visibleRect()->CGRect {
        var rect=viewport.frame.intersection(app.frame)
        // RN can expose the scroll content's unclipped AX frame. Absolute
        // screen points must stay below the sheet's real dismissal handle.
        if handle.exists {let top=max(rect.minY,handle.frame.maxY+8);rect=CGRect(x:rect.minX,y:top,width:rect.width,height:max(0,rect.maxY-top))}
        return rect
      }
      func visible()->Bool {
        guard element.exists,viewport.exists,companion == nil || companion!.exists else{return false}
        let frame=companion.map{element.frame.union($0.frame)} ?? element.frame,rect=visibleRect()
        // A value label is read, not tapped. iOS can expose its geometry
        // while reporting it as non-hittable; scrolling again at the top
        // would hand the downward gesture to the dismissible sheet.
        return frame.width>0 && frame.height>0 && rect.contains(CGPoint(x:frame.midX,y:frame.midY)) && frame.minY>=rect.minY+6 && frame.maxY<=rect.maxY-6 && (element.elementType == .staticText || element.isHittable || !element.isEnabled)
      }
      for _ in 0..<45 {
        if visible(){break}
        guard viewport.waitForExistence(timeout:10),waitForHittable(handle,timeout:10) else{XCTFail("Background sheet must remain open during reveal: \(element.identifier)");return}
        let rect=visibleRect();guard !rect.isNull,rect.width>16,rect.height>80 else{XCTFail("Background scroll viewport must have visible geometry");return}
        let above=expectAbove ?? (element.exists && element.frame.midY<rect.midY),x=rect.minX+8,high=rect.minY+rect.height*0.3,low=rect.minY+rect.height*0.7
        let origin=app.coordinate(withNormalizedOffset:.zero)
        origin.withOffset(CGVector(dx:x-app.frame.minX,dy:(above ? high:low)-app.frame.minY)).press(forDuration:0.05,thenDragTo:origin.withOffset(CGVector(dx:x-app.frame.minX,dy:(above ? low:high)-app.frame.minY)))
      }
      if !visible(){let tree=XCTAttachment(string:app.debugDescription);tree.name="Background reveal geometry failure";tree.lifetime = .keepAlways;add(tree)}
      XCTAssertTrue(visible(),"Visual control must be visible: \(element.identifier)")
    }
    func choose(_ id:String,expectAbove:Bool?=nil){
      let control=app.descendants(matching:.any).matching(identifier:id).firstMatch
      let parts=id.split(separator:"-")
      if parts.count==3 && parts[0]=="visual" && (parts[2]=="up" || parts[2]=="down") {
        // Reveal the value header together with its stepper. A hittable plus
        // alone can leave the value clipped above the dismissal handle.
        let value=app.staticTexts["visual-value-"+String(parts[1])];XCTAssertTrue(value.waitForExistence(timeout:10))
        reveal(control,companion:value,expectAbove:expectAbove)
      }else{reveal(control,expectAbove:expectAbove)}
      control.tap()
    }
    func importFixture(_ id:String){
      choose(id)
      selectLocalFixture((imageName as NSString).deletingPathExtension,in:app)
    }
    func expectImported(_ id:String){
      let name=app.staticTexts[id]
      let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@",imageName),object:name)
      let result=XCTWaiter.wait(for:[ready],timeout:20)
      if result != .completed {
        let image=XCTAttachment(screenshot:app.screenshot());image.name="Visual import failure";image.lifetime = .keepAlways;add(image)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Visual import failure hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
      }
      XCTAssertEqual(result,.completed,"Image name must update after import; status: \(app.staticTexts["visual-status"].exists ? app.staticTexts["visual-status"].label : "no status")")
    }
    openSettings(app,page:"background")
    // A prior failed run can leave an imported slot. Reset through the real
    // removal UI before asserting the empty-state contract.
    for slot in ["background","photo"] {
      let remove=app.buttons["visual-remove-"+slot]
      if remove.exists {
        reveal(remove);remove.tap();app.alerts.buttons["移除"].tap()
        let empty=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label CONTAINS %@","尚未导入"),object:app.staticTexts["visual-"+slot+"-name"])
        XCTAssertEqual(XCTWaiter.wait(for:[empty],timeout:10),.completed)
      }
    }
    let imageBackground=app.descendants(matching:.any).matching(identifier:"background-image").firstMatch
    reveal(imageBackground,expectAbove:true);XCTAssertFalse(imageBackground.isEnabled,"Image background must stay unavailable until a theme image is imported")
    let background=app.buttons["visual-import-background"];reveal(background);importFixture("visual-import-background")
    expectImported("visual-background-name")
    let photo=app.buttons["visual-import-photo"];reveal(photo);importFixture("visual-import-photo")
    expectImported("visual-photo-name")
    let importedImage=XCTAttachment(screenshot:app.screenshot());importedImage.name="Imported background and photo previews";importedImage.lifetime = .keepAlways;add(importedImage)
    choose("background-image",expectAbove:true);choose("player-background-photo")
    var savedValues:[String]=[]
    for id in ["backgroundOpacity","playerBlur","coverRadius"]{
      let value=app.staticTexts["visual-value-"+id];reveal(value,expectAbove:id=="backgroundOpacity" ? true:nil);let before=value.label
      choose("visual-"+id+"-up");reveal(value)
      // A retained live preference can already be at its upper bound. Keep
      // the original plus operation, then require a real edit before restart.
      if value.label==before{choose("visual-"+id+"-down");reveal(value)}
      XCTAssertNotEqual(value.label,before,"Parameter must actually change before persistence is checked: \(id)")
      savedValues.append(value.label)
    }
    for id in ["visual-cover-color","visual-motion"] {let control=app.switches[id];reveal(control);if control.value as? String != "1" {control.tap()};expectation(for:NSPredicate(format:"value == %@","1"),evaluatedWith:control);waitForExpectations(timeout:10)}
    app.terminate();app.launch();openSettings(app,page:"background")
    let restoredPhoto=app.staticTexts["visual-photo-name"];reveal(restoredPhoto);XCTAssertTrue(restoredPhoto.label.contains(imageName));let motion=app.switches["visual-motion"];reveal(motion);XCTAssertEqual(motion.value as? String,"1");let selected=app.descendants(matching:.any).matching(identifier:"player-background-photo").firstMatch;reveal(selected,expectAbove:true);XCTAssertTrue(selected.isSelected);var restoredValues:[String]=[];for id in ["backgroundOpacity","playerBlur","coverRadius"]{let value=app.staticTexts["visual-value-"+id];reveal(value,expectAbove:id=="backgroundOpacity" ? true:nil);restoredValues.append(value.label)};XCTAssertEqual(restoredValues,savedValues)
    let removeBackground=app.buttons["visual-remove-background"];reveal(removeBackground,expectAbove:true);removeBackground.tap();app.alerts.buttons["移除"].tap();expectation(for:NSPredicate(format:"label CONTAINS %@","尚未导入"),evaluatedWith:app.staticTexts["visual-background-name"]);waitForExpectations(timeout:10);let retainedPhoto=app.staticTexts["visual-photo-name"];reveal(retainedPhoto);XCTAssertTrue(retainedPhoto.label.contains(imageName),"Removing a shared background must retain the photo slot")
    let removePhoto=app.buttons["visual-remove-photo"];reveal(removePhoto);removePhoto.tap();app.alerts.buttons["移除"].tap();expectation(for:NSPredicate(format:"label CONTAINS %@","尚未导入"),evaluatedWith:app.staticTexts["visual-photo-name"]);waitForExpectations(timeout:10)
    app.terminate();app.launch();openSettings(app,page:"background");reveal(app.staticTexts["visual-background-name"]);XCTAssertTrue(app.staticTexts["visual-background-name"].label.contains("尚未导入"));XCTAssertTrue(app.staticTexts["visual-photo-name"].label.contains("尚未导入"))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.name="Persisted visual image settings and fallback";screenshot.lifetime = .keepAlways;add(screenshot)
  }
  // Explicitly selected local-only live validation. Keep all imported sources.
  func testLiveSourceCatalog() throws {
    let bytes=try Data(contentsOf:URL(string:"http://127.0.0.1:18439/live-source-index")!)
    let rows=try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [[String:Any]])
    XCTAssertFalse(rows.isEmpty);XCTAssertLessThanOrEqual(rows.count,32)
    let app=XCUIApplication();app.launch();openSettings(app,page:"sources")
    func reach(_ item:XCUIElement){
      for _ in 0..<30 {if item.isHittable{break};let above=item.exists && item.frame.midY<app.frame.midY
        if above{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(item.isHittable)
    }
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    let address=app.textFields["音源订阅地址"],submit=app.buttons["从地址导入"]
    for row in rows {
      let index=try XCTUnwrap(row["index"] as? Int)
      reach(address);address.tap()
      for character in "http://127.0.0.1:18439/live-source-\(index).js"{address.typeText(String(character))}
      address.typeText("\n");reach(submit);submit.tap()
      let imported=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
        let value=address.value as? String ?? ""
        return !value.contains("127.0.0.1") && address.isEnabled
      },object:nil)
      XCTAssertEqual(XCTWaiter.wait(for:[imported],timeout:20),.completed,"Live source import must finish through the production catalog")
    }
    let select=app.buttons["全选"].firstMatch;reach(select);select.tap()
    let enable=app.buttons["启用"].firstMatch;reach(enable);enable.tap()
    let complete=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","完成 ")).firstMatch
    XCTAssertTrue(complete.waitForExistence(timeout:180));image("Live source catalog initialization results")
    try verifyLiveSourcePlayback(app)
  }
  func testLiveSourcePlayback() throws {
    let app=XCUIApplication();app.launch();try verifyLiveSourcePlayback(app)
  }
  // Batch 3 real-source acceptance: queue editing (index/total, lock, locate,
  // clear-after-current) runs against a live public search result queue. Pause
  // first: it aborts any in-flight resolution, so the auto-skip path cannot
  // move the current index under the assertions.
  func testLiveQueueEditing() throws {
    let app=XCUIApplication();app.launch()
    let handle=app.buttons["player-drag-handle"].firstMatch
    if handle.waitForExistence(timeout:2) {
      if handle.isHittable {handle.tap()} else {handle.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()}
      _ = waitForGone(handle,timeout:8)
    }
    func reach(_ item:XCUIElement){
      for _ in 0..<24 {if item.isHittable{break};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(item.isHittable)
    }
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    let clearHistory=app.buttons["search-history-clear"]
    if clearHistory.exists {clearHistory.tap();XCTAssertTrue(app.buttons["search-history-0"].waitForNonExistence(timeout:5))}
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();for character in "Shape of You"{query.typeText(String(character))};query.typeText("\n")
    let first=app.buttons["search-track-wy-0"]
    XCTAssertTrue(first.waitForExistence(timeout:45),"Live public search must return real rows")
    reach(first);first.tap()
    XCTAssertTrue(app.buttons["打开播放页"].waitForExistence(timeout:30));app.buttons["打开播放页"].firstMatch.tap()
    let pause=app.buttons["暂停"].firstMatch
    if pause.waitForExistence(timeout:8) && pause.isHittable {pause.tap()}
    app.buttons["更多播放控制"].firstMatch.tap();app.buttons["播放界面样式"].firstMatch.tap()
    let classic=app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch
    XCTAssertTrue(classic.waitForExistence(timeout:10));classic.tap()
    XCTAssertTrue(classic.waitForNonExistence(timeout:10))
    let openQueue=app.buttons["查看播放队列"].firstMatch;reach(openQueue);openQueue.tap()
    let queue=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","完整队列与拖动排序")).firstMatch
    XCTAssertTrue(queue.waitForExistence(timeout:10));reach(queue);queue.tap()
    XCTAssertTrue(app.staticTexts["播放队列"].waitForExistence(timeout:10),"Queue panel must open from the classic player")
    let total=app.staticTexts.matching(NSPredicate(format:"label MATCHES %@","· [0-9]+/[0-9]+")).firstMatch
    XCTAssertTrue(total.waitForExistence(timeout:10),"Header must show the current index over the total")
    image("Live queue header index total")
    let rowEdits=NSPredicate(format:"label BEGINSWITH %@","移除：")
    XCTAssertTrue(app.buttons.matching(rowEdits).firstMatch.exists,"Unlocked rows must expose remove controls")
    app.switches["锁定队列"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["队列已锁定，逐行编辑已隐藏；点按歌曲仍可切换播放。"].waitForExistence(timeout:5))
    XCTAssertFalse(app.buttons.matching(rowEdits).firstMatch.exists,"Lock must hide per-row editing")
    XCTAssertFalse(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","拖动排序：")).firstMatch.exists)
    image("Live queue locked hides row edits")
    app.switches["解锁队列"].firstMatch.tap()
    XCTAssertTrue(app.buttons.matching(rowEdits).firstMatch.waitForExistence(timeout:5))
    app.swipeUp();app.swipeUp()
    let clearAfter=app.buttons["queue-clear-after"];reach(clearAfter);clearAfter.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label CONTAINS %@","清除当前之后（0 首）")).firstMatch.waitForExistence(timeout:5),"Clear-after-current must drop every upcoming entry")
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label MATCHES %@","· [0-9]+/[0-9]+")).firstMatch.exists)
    image("Live queue clear after current")
    app.buttons["收起队列"].firstMatch.tap()
    let collapse=app.buttons["收起播放页"].firstMatch;reach(collapse);collapse.tap()
    _ = waitForGone(collapse,timeout:10)
    let clear=app.buttons["search-clear"];reach(clear);clear.tap()
    if app.buttons["search-history-0"].waitForExistence(timeout:5) {app.buttons["search-history-clear"].tap();XCTAssertTrue(app.buttons["search-history-0"].waitForNonExistence(timeout:5))}
  }

  // Batch 2 real-source acceptance: the search state machine, explicit
  // load-more, history and suggestions must all run against live public
  // metadata with the user's real sources, not synthetic fixtures.
  func testLiveSourceSearchStates() throws {
    let app=XCUIApplication();app.launch()
    // A previous run can relaunch straight into the full-screen player; the
    // search tab is only reachable after that presentation is dismissed.
    let handle=app.buttons["player-drag-handle"].firstMatch
    if handle.waitForExistence(timeout:2) {
      if handle.isHittable {handle.tap()} else {handle.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()}
      _ = waitForGone(handle,timeout:8)
    }
    func reach(_ item:XCUIElement){
      for _ in 0..<24 {if item.isHittable{break};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(item.isHittable)
    }
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    let clearHistory=app.buttons["search-history-clear"]
    if clearHistory.exists {clearHistory.tap();XCTAssertTrue(app.buttons["search-history-0"].waitForNonExistence(timeout:5))}
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();for character in "Shape of You"{query.typeText(String(character))};query.typeText("\n")
    let first=app.buttons["search-track-wy-0"]
    XCTAssertTrue(first.waitForExistence(timeout:45),"Live public search must return real rows");image("Live search real results")
    let more=app.buttons["search-load-more-wy"]
    XCTAssertTrue(more.waitForExistence(timeout:20),"A popular real query must expose the explicit load-more entry")
    reach(more);more.tap()
    XCTAssertTrue(app.buttons["search-track-wy-30"].waitForExistence(timeout:45),"Appending page two must extend the real result list")
    image("Live search after load more")
    // Unified playback intent: one tap on a row makes that result set the
    // authoritative queue and drives the current track without leaving search.
    // A restored session already shows a mini player and the mini title is
    // collapsed under its button label, so the check opens the full player and
    // matches its exposed title text. Scroll momentum can shift rows under the
    // tap point, so settle before tapping and prefer a row whose title differs
    // from row zero's to keep the assertion discriminating.
    func titleOf(_ index:Int)->String{app.buttons["search-track-wy-\(index)"].label}
    var pick = 1
    for index in 1...8 where titleOf(index) != titleOf(0) { pick = index; break }
    let row=app.buttons["search-track-wy-\(pick)"]
    reach(row);Thread.sleep(forTimeInterval:0.8);XCTAssertTrue(row.isHittable)
    let rowTitle=String(row.label.dropFirst(2))
    row.tap()
    let mini=app.descendants(matching:.any).matching(identifier:"mini-player").firstMatch
    XCTAssertTrue(mini.waitForExistence(timeout:30))
    app.buttons["打开播放页"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts[rowTitle].waitForExistence(timeout:20),"Tapping a row must drive the current track: \(rowTitle)")
    image("Live search single tap queue rebuild")
    let collapse=app.buttons["收起播放页"].firstMatch;reach(collapse);collapse.tap()
    XCTAssertTrue(waitForGone(collapse,timeout:10))
    let clear=app.buttons["search-clear"];reach(clear);clear.tap()
    let history=app.buttons["search-history-0"];XCTAssertTrue(history.waitForExistence(timeout:5))
    XCTAssertEqual(history.label,"搜索历史：Shape of You")
    image("Live search history recorded")
    query.tap();query.typeText("Shape")
    let suggestion=app.buttons["search-suggestion-0"];XCTAssertTrue(suggestion.waitForExistence(timeout:5))
    XCTAssertEqual(suggestion.label,"搜索建议：Shape of You")
    suggestion.tap()
    XCTAssertEqual(query.value as? String,"Shape of You")
    XCTAssertTrue(app.buttons["search-track-wy-0"].waitForExistence(timeout:45))
    image("Live search suggestion resubmit")
    reach(clear);clear.tap()
    XCTAssertTrue(app.buttons["search-history-0"].waitForExistence(timeout:5))
    app.buttons["search-history-clear"].tap()
    XCTAssertTrue(app.buttons["search-history-0"].waitForNonExistence(timeout:5))
    XCTAssertTrue(app.staticTexts["输入歌曲、歌手或专辑名开始搜索。"].exists)
    image("Live search history cleared")
  }
  private func verifyLiveSourcePlayback(_ app:XCUIApplication) throws {
    func reach(_ item:XCUIElement){
      for _ in 0..<30 {if item.isHittable{break};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(item.isHittable)
    }
    func image(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
    // Real public metadata and live script resolution, with the production entry.
    openSettings(app,page:"playback")
    let basic=app.descendants(matching:.any).matching(identifier:"128k").firstMatch;reach(basic);basic.tap()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];reach(query);query.tap()
    for character in "Shape of You"{query.typeText(String(character))};query.typeText("\n")
    let search=app.buttons["run-online-search"];reach(search);search.tap()
    let first=app.buttons["search-track-wy-0"];XCTAssertTrue(first.waitForExistence(timeout:45));reach(first);image("Live source public search results");first.tap()
    let mini=app.buttons["打开播放页"];XCTAssertTrue(mini.waitForExistence(timeout:30));mini.tap()
    app.buttons["更多播放控制"].tap();app.buttons["播放界面样式"].tap()
    let classic=app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch
    XCTAssertTrue(classic.waitForExistence(timeout:10));classic.tap()
    XCTAssertTrue(classic.waitForNonExistence(timeout:10))
    let artwork=app.descendants(matching:.any).matching(identifier:"classic-artwork").firstMatch
    XCTAssertTrue(artwork.descendants(matching:.any).matching(identifier:"cover-image").firstMatch.waitForExistence(timeout:30),"Public song artwork must replace the placeholder")
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:120))
    let transport=app.buttons["暂停"].firstMatch
    XCTAssertTrue(transport.isHittable);XCTAssertLessThanOrEqual(transport.frame.maxY,app.windows.firstMatch.frame.maxY-16,"Long real lyrics must leave the full transport visible")
    XCTAssertTrue(app.buttons["上一首"].firstMatch.isHittable);XCTAssertTrue(app.buttons["下一首"].firstMatch.isHittable)
    image("Live source actual decoded playback")
    let pause=app.buttons["暂停"].firstMatch;reach(pause);pause.tap()
  }

  func testLiveSourceMeshBackground() throws {
    let app=XCUIApplication();app.launch()
    // A previous run can relaunch straight into the full-screen player; the
    // settings shell is only reachable after that presentation is dismissed.
    let handle=app.buttons["player-drag-handle"].firstMatch
    if handle.waitForExistence(timeout:2) {
      if handle.isHittable {handle.tap()} else {handle.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()}
      _ = waitForGone(handle,timeout:8)
    }
    func reach(_ item:XCUIElement){
      for _ in 0..<24 {if item.isHittable{break};if item.exists && item.frame.midY<app.frame.midY{app.swipeDown()}else{app.swipeUp()}}
      XCTAssertTrue(item.isHittable)
    }
    openSettings(app,page:"playback")
    let basic=app.descendants(matching:.any).matching(identifier:"128k").firstMatch;reach(basic);basic.tap()
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];reach(query);query.tap()
    for character in "Shape of You"{query.typeText(String(character))};query.typeText("\n")
    let search=app.buttons["run-online-search"];reach(search);search.tap()
    let first=app.buttons["search-track-wy-0"];XCTAssertTrue(first.waitForExistence(timeout:45));reach(first);first.tap()
    let mini=app.buttons["打开播放页"];XCTAssertTrue(mini.waitForExistence(timeout:30));mini.tap()
    app.buttons["更多播放控制"].tap();app.buttons["播放界面样式"].tap()
    let am=app.descendants(matching:.any).matching(identifier:"play-skin-am").firstMatch
    XCTAssertTrue(am.waitForExistence(timeout:10));am.tap()
    XCTAssertTrue(am.waitForNonExistence(timeout:10))
    // Decision 0081: the AM backdrop composes the native mesh from the real
    // cover palette, under the existing readability gradient.
    let mesh=app.descendants(matching:.any).matching(identifier:"ambient-mesh").firstMatch
    XCTAssertTrue(mesh.waitForExistence(timeout:30),"AM backdrop must run the native mesh with the real cover palette")
    XCTAssertGreaterThan(mesh.frame.width,300,"Mesh must cover the player width")
    XCTAssertGreaterThan(mesh.frame.height,600,"Mesh must cover the player height")
    let playing=XCTAttachment(screenshot:app.screenshot());playing.name="Live source AM mesh playing";playing.lifetime = .keepAlways;add(playing)
    let pause=app.buttons["暂停"].firstMatch;reach(pause);pause.tap()
    let still=app.descendants(matching:.any).matching(identifier:"ambient-mesh-still").firstMatch
    XCTAssertTrue(still.waitForExistence(timeout:10),"Paused intent must park the mesh drift")
    XCTAssertTrue(mesh.exists,"The mesh palette must survive the pause")
    let paused=XCTAttachment(screenshot:app.screenshot());paused.name="Live source AM mesh paused";paused.lifetime = .keepAlways;add(paused)
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

  // Focused capture for the visual lab: the two settings-sheet golden states
  // without the ~9 minute playback script. Keep the state steps identical to
  // testZNavidromePlaybackAndCredentials so the lab compares the same pixels.
  func testVisualLabAppearanceSheet(){
    captureAppearanceSheet(direct:false)
  }
  func testStructuredNavidromeLyrics(){
    // Offscreen UIKit controls diagnose fonts only; these are not App or
    // reference-alignment screenshots and never enter the shipping bundle.
    for explicitEmoji in [false,true] {
      let text="前👩‍💻中é后",font=UIFont.systemFont(ofSize:80,weight:.semibold)
      let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center;paragraph.minimumLineHeight=100;paragraph.maximumLineHeight=100
      let attributes=NSMutableAttributedString(string:text,attributes:[.font:font,.foregroundColor:UIColor.white.withAlphaComponent(0.56),.paragraphStyle:paragraph])
      if explicitEmoji,let emoji=UIFont(name:"AppleColorEmoji",size:80){attributes.addAttribute(.font,value:emoji,range:NSRange(location:1,length:5))}
      let size=CGSize(width:382,height:300)
      let label=UILabel(frame:CGRect(origin:.zero,size:size));label.numberOfLines=0;label.attributedText=attributes
      let labelImage=UIGraphicsImageRenderer(size:size).image { renderer in
        UIColor.black.setFill();renderer.fill(CGRect(origin:.zero,size:size));label.layer.render(in:renderer.cgContext)
      }
      let storage=NSTextStorage(attributedString:attributes),manager=NSLayoutManager(),container=NSTextContainer(size:size)
      container.lineFragmentPadding=0;storage.addLayoutManager(manager);manager.addTextContainer(container);manager.ensureLayout(for:container)
      let textImage=UIGraphicsImageRenderer(size:size).image { renderer in
        UIColor.black.setFill();renderer.fill(CGRect(origin:.zero,size:size));manager.drawGlyphs(forGlyphRange:manager.glyphRange(for:container),at:.zero)
      }
      for (kind,image) in [("UILabel",labelImage),("TextKit",textImage)] {
        let attachment=XCTAttachment(image:image);attachment.name="Emoji control \(kind) explicit \(explicitEmoji)";attachment.lifetime = .keepAlways;add(attachment)
      }
    }
    let app=XCUIApplication();app.launch()
    let open=app.buttons["打开播放页"].firstMatch
    XCTAssertTrue(open.waitForExistence(timeout:30));open.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:10));app.buttons["播放"].firstMatch.tap()
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    expectation(for:NSPredicate(format:"value CONTAINS %@","2:00"),evaluatedWith:progress);waitForExpectations(timeout:20)
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:10));app.buttons["暂停"].firstMatch.tap()
    progress.coordinate(withNormalizedOffset:CGVector(dx:0.01,dy:0.5)).tap()
    app.buttons["更多播放控制"].tap();app.buttons["播放界面样式"].tap()
    let stage=app.descendants(matching:.any).matching(identifier:"play-skin-stage").firstMatch
    XCTAssertTrue(stage.waitForExistence(timeout:10));stage.tap()
    XCTAssertTrue(waitForGone(stage,timeout:10))
    let group=app.descendants(matching:.any).matching(identifier:"lyric-stage-group").firstMatch
    XCTAssertTrue(group.waitForExistence(timeout:15));XCTAssertEqual(group.value as? String,"逐字歌词","Start-only OpenSubsonic cues must reach the real native lyric view")
    XCTAssertTrue(["Synthetic ","lyric ","one"].contains(group.label))
    let words=XCTAttachment(screenshot:app.screenshot());words.name="Structured start-only timed group";words.lifetime = .keepAlways;add(words)
    let stageProgress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.06,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"label == %@ AND value == %@","Synthetic lyric two","行级歌词"),evaluatedWith:group);waitForExpectations(timeout:10)
    XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Seeking a bad cue fallback must preserve paused intent")
    let fallback=XCTAttachment(screenshot:app.screenshot());fallback.name="Structured invalid words readable fallback";fallback.lifetime = .keepAlways;add(fallback)
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.101,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"label == %@","Guest"),evaluatedWith:group);waitForExpectations(timeout:10)
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.115,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"label == %@ AND value == %@","Lead","逐字歌词"),evaluatedWith:group);waitForExpectations(timeout:10)
    let lead=XCTAttachment(screenshot:app.screenshot());lead.name="Structured later main replaces guest";lead.lifetime = .keepAlways;add(lead)
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.151,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"label == %@ AND value == %@","前👩‍💻中é后","部分逐字歌词"),evaluatedWith:group);waitForExpectations(timeout:10)
    let sparseFrame=group.frame,scale=UIScreen.main.scale
    let pixelFrame=CGRect(x:floor(sparseFrame.minX*scale),y:floor(sparseFrame.minY*scale),width:floor(sparseFrame.width*scale),height:floor(sparseFrame.height*scale))
    let width=Int(pixelFrame.width),height=Int(pixelFrame.height)
    func sparsePixels(_ name:String?=nil)->[UInt8]{
      let shot=XCUIScreen.main.screenshot()
      if let name {let attachment=XCTAttachment(screenshot:shot);attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)}
      guard width>0,height>0,width*height<2_000_000,let image=BackgroundPixels.decode(shot.pngRepresentation),let crop=image.cropping(to:pixelFrame) else{return []}
      var bytes=[UInt8](repeating:0,count:width*height*4)
      let ok=bytes.withUnsafeMutableBytes { memory -> Bool in
        guard let context=CGContext(data:memory.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue|CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
        context.draw(crop,in:CGRect(x:0,y:0,width:width,height:height));return true
      }
      return ok ? bytes:[]
    }
    let before=sparsePixels("Structured sparse before cues");XCTAssertEqual(before.count,width*height*4)
    guard before.count==width*height*4 else{return}
    var left=width,right = -1
    for x in 0..<width {for y in 0..<height {let i=(y*width+x)*4;if before[i...i+2].max()!>80 {left=min(left,x);right=max(right,x)}}}
    XCTAssertGreaterThan(right-left,60,"The full sparse line must contain visible ink")
    guard right>left else{return}
    // The 80pt stage can wrap. Find the first and last static-ink row bands,
    // rather than treating a horizontal strip through every row as one glyph.
    let brightRows=(0..<height).filter { y in (0..<width).contains { x in let i=(y*width+x)*4;return before[i]>120 && before[i+1]>120 && before[i+2]>120 } }
    guard let first=brightRows.first,let last=brightRows.last else {XCTFail("Static sparse text must have full active ink");return}
    var firstEnd=first,lastStart=last
    while firstEnd+1<height && brightRows.contains(firstEnd+1){firstEnd+=1}
    while lastStart>0 && brightRows.contains(lastStart-1){lastStart-=1}
    func inkColumns(_ rows:ClosedRange<Int>)->[Int]{
      (0..<width).filter { x in rows.contains { y in let i=(y*width+x)*4;return before[i]>120 && before[i+1]>120 && before[i+2]>120 } }
    }
    let firstColumns=inkColumns(first...firstEnd),lastColumns=inkColumns(lastStart...last)
    guard let prefixX=firstColumns.first,let suffixX=lastColumns.last else {XCTFail("Static edge glyphs must have visible ink");return}
    let prefix=CGRect(x:prefixX,y:first,width:min(8,width-prefixX),height:firstEnd-first+1)
    let suffix=CGRect(x:max(0,suffixX-7),y:lastStart,width:min(8,suffixX+1),height:last-lastStart+1)
    print("Sparse frame \(sparseFrame), pixels \(pixelFrame), ink \(left)..\(right), static prefix \(prefix), suffix \(suffix)")
    func peak(_ region:CGRect)->UInt8 {
      var value:UInt8=0
      for y in Int(region.minY)..<Int(region.maxY) {for x in Int(region.minX)..<Int(region.maxX) {let i=(y*width+x)*4;value=max(value,before[i],before[i+1],before[i+2])}}
      return value
    }
    // The classic stage intentionally uses 56% white (143/255), not opaque white.
    XCTAssertGreaterThan(peak(prefix),120,"Untimed prefix must use full active ink, not the 32% timed base")
    XCTAssertGreaterThan(peak(suffix),120,"Untimed suffix must use full active ink, not the 32% timed base")
    func regionChange(_ other:[UInt8],_ region:CGRect)->Int {
      guard other.count==before.count else{return Int.max}
      var sum=0
      for y in Int(region.minY)..<Int(region.maxY) {for x in Int(region.minX)..<Int(region.maxX) {let i=(y*width+x)*4;for c in 0..<3 {sum+=abs(Int(before[i+c])-Int(other[i+c]))}}}
      return sum
    }
    func staticChange(_ other:[UInt8])->Int {
      guard other.count==before.count else{return Int.max}
      var sum=0
      for i in stride(from:0,to:before.count,by:4) {
        if before[i]>120 && before[i+1]>120 && before[i+2]>120 {
          for c in 0..<3 {sum+=abs(Int(before[i+c])-Int(other[i+c]))}
        }
      }
      return sum
    }
    func maxChange(_ other:[UInt8],_ region:CGRect)->Int {
      guard other.count==before.count else{return Int.max}
      var result=0
      for y in Int(region.minY)..<Int(region.maxY) {for x in Int(region.minX)..<Int(region.maxX) {let i=(y*width+x)*4;for c in 0..<3 {result=max(result,abs(Int(before[i+c])-Int(other[i+c])))}}}
      return result
    }
    func change(_ other:[UInt8],_ range:Range<Int>)->Int {
      guard other.count==before.count else{return Int.max}
      var sum=0
      for y in 0..<height {for x in range {let i=(y*width+x)*4;for c in 0..<3 {sum+=abs(Int(before[i+c])-Int(other[i+c]))}}}
      return sum
    }
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.207,dy:0.5)).tap()
    XCTAssertEqual(group.label,"前👩‍💻中é后");XCTAssertEqual(group.frame.minY,sparseFrame.minY,accuracy:1)
    let filled=sparsePixels("Structured sparse filled cues")
    XCTAssertGreaterThan(change(filled,left..<right),500,"Only real supplied cue spans must visibly fill after their end times")
    XCTAssertGreaterThan(maxChange(filled,CGRect(x:0,y:0,width:width,height:height)),16,"Timed fill must exceed one-step rendering quantization")
    XCTAssertEqual(regionChange(filled,prefix),0,"Untimed prefix must stay fully visible without invented timing")
    XCTAssertEqual(regionChange(filled,suffix),0,"Untimed suffix must stay fully visible without invented timing")
    XCTAssertEqual(staticChange(filled),0,"Every bright untimed ink pixel must remain stable across wrapped rows")
    let sparse=XCTAttachment(screenshot:app.screenshot());sparse.name="Structured sparse cues with static holes";sparse.lifetime = .keepAlways;add(sparse)
    stageProgress.coordinate(withNormalizedOffset:CGVector(dx:0.151,dy:0.5)).tap()
    XCTAssertEqual(change(sparsePixels(),left..<right),0,"Seeking backward while paused must restore source-timed ink exactly")
    XCTAssertTrue(app.buttons["播放"].firstMatch.exists,"Sparse seek must preserve paused intent")
    app.buttons["播放"].firstMatch.tap()
    let sparseMotion=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in maxChange(sparsePixels(),CGRect(x:0,y:0,width:width,height:height))>16},object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[sparseMotion],timeout:5),.completed,"Real playback must advance the native sparse cue ink")
    let running=sparsePixels("Structured sparse running cues")
    var staticChanged=0,staticMax=0,staticTotal=0
    if running.count==before.count {
      for i in stride(from:0,to:before.count,by:4) {
        if before[i]>120 && before[i+1]>120 && before[i+2]>120 {
          staticTotal+=1
          let delta=(0..<3).map {abs(Int(before[i+$0])-Int(running[i+$0]))}.max() ?? 0
          if delta>0 {staticChanged+=1;staticMax=max(staticMax,delta)}
        }
      }
    }
    print("Sparse running static pixels: changed \(staticChanged)/\(staticTotal), max channel delta \(staticMax), prefix sum \(regionChange(running,prefix)), suffix sum \(regionChange(running,suffix)), total sum \(staticChange(running))")
    let emojiFamilies=UIFont.familyNames.filter{$0.localizedCaseInsensitiveContains("emoji")}
    print("Emoji font availability: \(UIFont(name:"AppleColorEmoji",size:80)?.fontName ?? "missing"), families \(emojiFamilies)")
    // Two independent captures measured a single 8-bit step during live
    // compositing. Paused/seek checks above still require exact equality.
    XCTAssertLessThanOrEqual(maxChange(running,prefix),1)
    XCTAssertLessThanOrEqual(maxChange(running,suffix),1)
    XCTAssertLessThanOrEqual(staticMax,1,"Static ink may quantize by one step, never dim or follow a cue")
    app.buttons["暂停"].firstMatch.tap()
    app.buttons["收起播放页"].firstMatch.tap();XCTAssertTrue(open.waitForExistence(timeout:5))
  }
  func testVisualLabClassicDirect(){captureClassicDirect(lines:3)}
  func testVisualLabClassicShortDirect(){captureClassicDirect(lines:2)}
  func testVisualLabClassicReferenceDirect(){captureClassicDirect(lines:3,reference:true)}
  func testVisualLabVinylReferenceDirect(){
    let app=XCUIApplication();app.launch()
    let open=app.buttons["打开播放页"].firstMatch
    XCTAssertTrue(open.waitForExistence(timeout:30));open.tap()
    let play=app.buttons["播放"].firstMatch
    XCTAssertTrue(play.waitForExistence(timeout:10));play.tap()
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    expectation(for:NSPredicate(format:"value CONTAINS %@","4:44"),evaluatedWith:progress);waitForExpectations(timeout:20)
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:10))
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:10))
    var previous=CGRect.zero,stable=0
    let settled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let frame=progress.frame;stable=frame==previous ? stable+1:0;previous=frame
      return frame.height>0 && stable>=2
    },object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[settled],timeout:10),.completed)
    print("Vinyl progress frame \(progress.frame) app \(app.frame)")
    // Seek while paused so the clock is deterministic: a 92.2s seed plus the
    // ~1.1s of tap/AX/screenshot latency lands inside 01:33 at capture.
    progress.coordinate(withNormalizedOffset:CGVector(dx:92.2/284.0,dy:0.5)).tap()
    expectation(for:NSPredicate(format:"value CONTAINS %@","1:32"),evaluatedWith:progress);waitForExpectations(timeout:5)
    app.buttons["播放"].firstMatch.tap()
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:5))
    Thread.sleep(forTimeInterval:0.6)
    let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="Vinyl reference content";shot.lifetime = .keepAlways;add(shot)
    if app.buttons["暂停"].firstMatch.exists {app.buttons["暂停"].firstMatch.tap()}
  }
  private func captureClassicDirect(lines:Int,reference:Bool=false){
    let app=XCUIApplication();app.launch()
    let open=app.buttons["打开播放页"].firstMatch
    XCTAssertTrue(open.waitForExistence(timeout:30));open.tap()
    let play=app.buttons["播放"].firstMatch
    XCTAssertTrue(play.waitForExistence(timeout:10));play.tap()
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    expectation(for:NSPredicate(format:"value CONTAINS %@",reference ? "4:44" : "2:00"),evaluatedWith:progress);waitForExpectations(timeout:20)
    XCTAssertTrue(app.buttons["暂停"].firstMatch.waitForExistence(timeout:10))
    var expectedLines=["这是一行合成歌词文字","音枢经典播放器三行布局测试","下一行用于验证歌词排版"]
    if reference {
      guard let data=try? Data(contentsOf:URL(string:"http://127.0.0.1:18439/classic-reference-scene")!),let json=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let text=json["lyrics"] as? [String],text.count==3 else {XCTFail("Local reference scene is missing");return}
      expectedLines=text
    }
    for line in expectedLines.prefix(lines) {
      XCTAssertTrue(app.buttons[line].firstMatch.waitForExistence(timeout:15),"All three fixture lines must render before capture")
    }
    var previous=CGRect.zero,stable=0
    let settled=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in
      let frame=progress.frame;stable=frame==previous ? stable+1:0;previous=frame
      return frame.height>0 && stable>=2
    },object:nil)
    XCTAssertEqual(XCTWaiter.wait(for:[settled],timeout:10),.completed)
    if abs(app.frame.width-430)<1 && abs(app.frame.height-932)<1 {XCTAssertEqual(progress.frame.midY,671.17,accuracy:1,"Lyric line count must not shift the control stack")}
    // Aim inside the reference second so coordinate rounding does not floor
    // a seek on its boundary to 4:25. Querying AX before capture also advances
    // playback; judge the actual clock in the PNG rather than an earlier value.
    progress.coordinate(withNormalizedOffset:CGVector(dx:reference ? 266.5/284.0 : 0.93,dy:0.5)).tap()
    if !reference {expectation(for:NSPredicate(format:"value CONTAINS %@","1:52"),evaluatedWith:progress);waitForExpectations(timeout:5)}
    Thread.sleep(forTimeInterval:0.2)
    let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name=reference ? "Classic reference content" : lines==3 ? "Classic direct three lines" : "Classic direct two lines";shot.lifetime = .keepAlways;add(shot)
    app.buttons["暂停"].firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].firstMatch.waitForExistence(timeout:5))
    app.buttons["收起播放页"].firstMatch.tap()
    XCTAssertTrue(open.waitForExistence(timeout:5))
  }
  func testVisualLabAppearanceDirect(){
    captureAppearanceSheet(direct:true)
  }
  private func captureAppearanceSheet(direct:Bool){
    let app=XCUIApplication();app.launchEnvironment["NEXUS_UI_APPEARANCE_SCROLL_ANCHOR"]="1";app.launch()
    if !direct {openSettings(app,page:"background")}
    let scroll=app.descendants(matching:.any).matching(identifier:"background-sheet-scroll").firstMatch
    func reveal(_ element:XCUIElement){for _ in 0..<40 {if element.isHittable{break};let above=element.exists && element.frame.midY<app.frame.midY;app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.35 : 0.65)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:above ? 0.65 : 0.35)))};XCTAssertTrue(element.isHittable)}
    func reachValue(_ identifier:String,_ target:String,_ up:Bool){
      let label=app.staticTexts["visual-value-"+identifier]
      for _ in 0..<18 {
        if label.exists && label.label==target {return}
        let step=app.buttons["visual-"+identifier+(up ? "-up":"-down")]
        if !step.exists {reveal(label)}
        XCTAssertTrue(step.waitForExistence(timeout:5));if !step.exists {return}
        if !step.isHittable {reveal(step)}
        let before=label.exists ? label.label : ""
        step.tap()
        for _ in 0..<20 {
          if label.exists && label.label != before {break}
          RunLoop.current.run(until:Date().addingTimeInterval(0.05))
        }
      }
    }
    func setPlayerBlurZero(){
      let label=app.staticTexts["visual-value-playerBlur"]
      if !label.exists{reveal(label)}
      let zero=NSPredicate(format:"label == %@","0")
      expectation(for:zero,evaluatedWith:label);waitForExpectations(timeout:5)
    }
    if !direct {
    let reset=app.buttons["appearance-reset"]
    XCTAssertTrue(reset.waitForExistence(timeout:10));reset.tap()
    let solid=app.descendants(matching:.any).matching(identifier:"background-solid").firstMatch
    reveal(solid);solid.tap();XCTAssertTrue(solid.isSelected)
    reachValue("cardOpacity","30%",false)
    reachValue("backgroundOpacity","100%",true)
    setPlayerBlurZero()
    Thread.sleep(forTimeInterval:0.6)
    let preview=app.descendants(matching:.any).matching(identifier:"theme-preview-card").firstMatch
    XCTAssertTrue(preview.waitForExistence(timeout:10))
    // Reset and slider taps leave the sheet mid-page; reopening starts it at the
    // title so the 4855 capture matches the reference's scroll position.
    openSettings(app,page:"background")
    }
    let reopenedPreview=app.descendants(matching:.any).matching(identifier:"theme-preview-card").firstMatch
    XCTAssertTrue(reopenedPreview.waitForExistence(timeout:10))
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"background-solid").firstMatch.isSelected)
    XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch.isSelected)
    XCTAssertEqual(app.staticTexts["accent-hex"].label,"#E83D56")
    XCTAssertEqual(app.staticTexts["visual-value-cardOpacity"].label,"30%")
    let container=app.descendants(matching:.any).matching(identifier:"appearance-sheet-container").firstMatch
    XCTAssertTrue(container.exists)
    if abs(app.frame.width-430)<1 && abs(app.frame.height-932)<1 {XCTAssertEqual(container.frame.minY,86,accuracy:1,"Sheet container must own the reference top instead of compensating with child padding")}
    let primaryThemes=["blush","blushpink","pearl","mint","sunset","azure","marigold","violet","khaki","plumtea","lotus"]
    for identifier in primaryThemes {
      let element=app.descendants(matching:.any).matching(identifier:"visual-"+identifier).firstMatch
      XCTAssertTrue(element.exists,"Primary theme \(identifier) must remain reachable")
    }
    let themeRows=Dictionary(grouping:primaryThemes){identifier in Int(app.descendants(matching:.any).matching(identifier:"visual-"+identifier).firstMatch.frame.minY.rounded())}
      .values.map(\.count).sorted(by: { $0 > $1 })
    XCTAssertEqual(themeRows,[3,3,3,2],"IMG_4855 primary themes must keep the reference 3/3/3/2 rows")
    // The launch-only 4856 anchor can win the race against services loading and
    // land the sheet scrolled before this shot. IMG_4855 is the unscrolled top
    // state, so normalize through the real ScrollView; its title only returns
    // at the content origin.
    let sheetTitle=app.staticTexts["settings-title-background"]
    reveal(sheetTitle)
    XCTAssertTrue(sheetTitle.isHittable,"4855 capture must start at the sheet top")
    let favorite=app.buttons["appearance-favorite-theme"]
    XCTAssertTrue(favorite.waitForExistence(timeout:5))
    if favorite.isSelected {
      favorite.tap()
      expectation(for:NSPredicate(format:"selected == false"),evaluatedWith:favorite);waitForExpectations(timeout:5)
    }
    Thread.sleep(forTimeInterval:0.3)
    let top=XCTAttachment(screenshot:XCUIScreen.main.screenshot());top.name="Visual lab 4855 appearance top";top.lifetime = .keepAlways;add(top)
    favorite.tap()
    expectation(for:NSPredicate(format:"selected == true"),evaluatedWith:favorite);waitForExpectations(timeout:5)
    reachValue("backgroundOpacity","100%",true)
    reachValue("cardOpacity","30%",false)
    setPlayerBlurZero()
    Thread.sleep(forTimeInterval:0.6)
    // Slider accessibility steps may scroll the sheet while reaching the lower
    // rows. Reopen the same persisted state so the launch-only anchor can place
    // the color field without gesture momentum or screenshot-only pages.
    openSettings(app,page:"background")
    Thread.sleep(forTimeInterval:1.2)
    let colorField=app.descendants(matching:.any).matching(identifier:"accent-color-field").firstMatch
    XCTAssertTrue(colorField.waitForExistence(timeout:5))
    // The reference's first painted field edge and accessibility frame both
    // normalize to216pt. The launch-only fixture uses the real ScrollView to
    // measure and land the field; no synthetic page or gesture momentum is used.
    let referenceFieldTop:CGFloat=216, fieldFrameTarget:CGFloat=216
    for _ in 0..<20 {
      if abs(colorField.frame.minY-fieldFrameTarget)<0.6 {break}
      RunLoop.current.run(until:Date().addingTimeInterval(0.1))
    }
    Thread.sleep(forTimeInterval:0.8)
    XCTAssertEqual(colorField.frame.minY,fieldFrameTarget,accuracy:4,"Scrolled capture must meet its declared field anchor")
    let title=app.staticTexts["settings-title-background"]
    if title.exists {XCTAssertFalse(title.isHittable,"Title must scroll away with its content")}
    let evidence=XCTAttachment(string:"accent-color-field minY=\(colorField.frame.minY)pt; frame target\(fieldFrameTarget)pt; reference painted edge\(referenceFieldTop)pt; container top=\(container.frame.minY)pt")
    evidence.name="Visual lab 4856 field evidence";evidence.lifetime = .keepAlways;add(evidence)
    let scrolled=XCTAttachment(screenshot:XCUIScreen.main.screenshot());scrolled.name="Visual lab 4856 appearance scrolled";scrolled.lifetime = .keepAlways;add(scrolled)
    let extraTheme=app.descendants(matching:.any).matching(identifier:"visual-soft").firstMatch
    reveal(extraTheme);extraTheme.tap()
    for _ in 0..<20 {if extraTheme.isSelected{break};RunLoop.current.run(until:Date().addingTimeInterval(0.05))}
    XCTAssertTrue(extraTheme.isSelected,"Extra Nexus themes remain selectable through the real scroll view")
    let close=app.buttons["background-sheet-close"]
    XCTAssertTrue(close.isHittable)
    close.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.1,thenDragTo:close.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:4.5)))
    XCTAssertTrue(waitForGone(close,timeout:5),"Handle swipe must dismiss after scrolling")
    openSettings(app,page:"background")
    reveal(extraTheme);XCTAssertTrue(extraTheme.isSelected,"Extra theme choice survives closing and normal navigation")
    XCTAssertTrue(close.isHittable);close.tap();XCTAssertTrue(waitForGone(close,timeout:5))
    openSettings(app,page:"background")
    let favoriteTheme=app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch
    reveal(favoriteTheme)
    favoriteTheme.tap()
    expectation(for:NSPredicate(format:"selected == true"),evaluatedWith:favoriteTheme);waitForExpectations(timeout:5)
    let favoriteButton=app.buttons["appearance-favorite-theme"]
    // The header row scrolls with the sheet content (settings-title-background
    // is asserted offscreen above), so returning to the first theme leaves the
    // bookmark action above the viewport. Reveal the real control before
    // asserting its persisted selection; no fixed-header contract exists.
    reveal(favoriteButton)
    XCTAssertTrue(favoriteButton.isSelected,"Favorite appearance theme survives normal navigation")
    XCTAssertTrue(close.isHittable);close.tap();XCTAssertTrue(waitForGone(close,timeout:5),"Fixed close handle remains reachable after reopening")
  }

}
