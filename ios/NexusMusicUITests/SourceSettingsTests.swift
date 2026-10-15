import XCTest

final class SourceSettingsTests: XCTestCase {
  override func setUpWithError() throws {continueAfterFailure=false}
  func testWWebDAVBrowseTagsPlaybackAndRemoval() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    let entry=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","WebDAV ·")).firstMatch
    XCTAssertTrue(entry.waitForExistence(timeout:15));entry.tap()
    let later=app.buttons.matching(NSPredicate(format:"label IN %@",["以后","Not Now"])).firstMatch
    if later.waitForExistence(timeout:2){later.tap()}
    let address=app.textFields["WebDAV服务器根目录"]
    if !address.waitForExistence(timeout:2){
      app.buttons["管理WebDAV连接"].tap()
      XCTAssertTrue(app.staticTexts["http://127.0.0.1:18439/dav/"].exists,"Only remove this test's fixture connection")
      app.buttons["移除WebDAV连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    }
    XCTAssertTrue(address.waitForExistence(timeout:10))
    address.tap();for character in "http://127.0.0.1:18439/dav/"{address.typeText(String(character))};address.typeText("\n")
    let user=app.textFields["WebDAV用户名"];user.tap();for character in "fixture-user"{user.typeText(String(character))};user.typeText("\n")
    let password=app.secureTextFields["WebDAV密码"];password.tap();for character in "fixture-password"{password.typeText(String(character))};password.typeText("\n")
    app.buttons["验证并保存WebDAV"].tap()
    if later.waitForExistence(timeout:3){later.tap()}
    let folder=app.buttons["文件夹：Fixture album"];XCTAssertTrue(folder.waitForExistence(timeout:20))
    if later.exists{later.tap()};folder.tap()
    let tagged=app.buttons.matching(NSPredicate(format:"identifier == %@ AND label CONTAINS %@","webdav-track-album/Remote%20Fixture.mp3","已读取远程音频标签")).firstMatch
    XCTAssertTrue(tagged.waitForExistence(timeout:20));XCTAssertTrue(tagged.label.contains("Synthetic tagged tone"))
    let song=app.buttons["webdav-track-album/Remote%20Fixture.mp3"];XCTAssertTrue(song.isEnabled);song.tap()
    app.buttons["收起WebDAV"].tap();app.buttons["打开播放页"].tap()
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
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
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
  func testZNavidromePlaybackAndCredentials() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let address=app.textFields["Navidrome服务器地址"]
    XCTAssertTrue(address.waitForExistence(timeout:15))
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
    XCTAssertTrue(app.staticTexts["Synthetic tone"].firstMatch.exists)
    let progress=app.descendants(matching:.any).matching(identifier:"播放进度").firstMatch
    let beforeSeek=progress.value as? String
    progress.coordinate(withNormalizedOffset:CGVector(dx:0.25,dy:0.5)).press(forDuration:0.1,thenDragTo:progress.coordinate(withNormalizedOffset:CGVector(dx:0.7,dy:0.5)))
    XCTAssertTrue(app.buttons["播放"].exists, "Seeking must preserve paused intent")
    XCTAssertNotEqual(progress.value as? String,beforeSeek)
    let amImage=XCTAttachment(screenshot:app.screenshot());amImage.lifetime = .keepAlways;add(amImage)
    app.buttons["更多播放控制"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-immersive").firstMatch.tap()
    XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
    XCTAssertTrue(app.buttons["播放"].isHittable, "Immersive transport controls must fit on screen")
    let immersiveImage=XCTAttachment(screenshot:app.screenshot());immersiveImage.lifetime = .keepAlways;add(immersiveImage)
    for layout in ["photo","vinyl","wave"] {
      app.buttons["更多播放控制"].tap()
      app.descendants(matching:.any).matching(identifier:"play-skin-\(layout)").firstMatch.tap()
      XCTAssertTrue(app.buttons["播放"].waitForExistence(timeout:5))
      XCTAssertTrue(app.buttons["播放"].isHittable, "Transport must fit in \(layout)")
      XCTAssertTrue(app.staticTexts["Synthetic tone"].firstMatch.exists)
      let image=XCTAttachment(screenshot:app.screenshot());image.lifetime = .keepAlways;add(image)
    }
    app.buttons["更多播放控制"].tap()
    app.descendants(matching:.any).matching(identifier:"play-skin-classic").firstMatch.tap()
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
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    for _ in 0..<5 {if app.buttons["移除连接：fixture-user"].isHittable{break};app.swipeDown()}
    app.buttons["移除连接：fixture-user"].tap();app.alerts.buttons["移除"].tap()
    XCTAssertTrue(app.staticTexts["连接与凭据已移除"].waitForExistence(timeout:10))
    let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.lifetime = .keepAlways;add(screenshot)
  }
  func testDiscoveryAndAppearance() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
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
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    func reveal(_ element:XCUIElement) {
      for _ in 0..<36 {
        if element.exists && element.isHittable && element.frame.minY >= 110 && element.frame.maxY <= app.frame.height-180 { return }
        let above=element.exists && element.frame.minY < 110
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
    app.terminate();app.launch();app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let preset=app.buttons["Nexus EQ Test"];reveal(preset);preset.tap()
    app.buttons["删除预设Nexus EQ Test"].tap();XCTAssertFalse(preset.exists)
    reveal(slider);XCTAssertEqual(value.label,savedValue)
    let restoredBand=app.staticTexts["eq-gain-4"];reveal(restoredBand);XCTAssertEqual(restoredBand.label,savedBand)
    reveal(flat);flat.tap();reveal(value);XCTAssertEqual(value.label,"0.0 dB")
    let timer=app.buttons["15分钟"];reveal(timer);timer.tap()
    XCTAssertTrue(app.staticTexts["sleep-status"].label.contains("剩余"))
    let cancel=app.buttons["取消睡眠定时"];reveal(cancel);cancel.tap();XCTAssertEqual(app.staticTexts["sleep-status"].label,"未开启")
  }
  func testAppearancePersistenceAndPrimaryNavigation() throws {
    let app=XCUIApplication();app.launch()
    let discover=app.descendants(matching:.any).matching(identifier:"tab-discover").firstMatch
    XCTAssertTrue(discover.waitForExistence(timeout:15));discover.tap()
    XCTAssertTrue(app.staticTexts["发现"].firstMatch.exists)
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let blue=app.descendants(matching:.any).matching(identifier:"accent-blue").firstMatch
    for _ in 0..<14 {if blue.isHittable{break};app.swipeUp()}
    XCTAssertTrue(blue.isHittable);blue.tap()
    let classic=app.descendants(matching:.any).matching(identifier:"visual-classic").firstMatch
    for _ in 0..<3 {if classic.isHittable{break};app.swipeDown()};classic.tap()
    let light=app.descendants(matching:.any).matching(identifier:"theme-light").firstMatch
    for _ in 0..<3 {if light.isHittable{break};app.swipeDown()};light.tap()
    let settingsImage=XCTAttachment(screenshot:app.screenshot());settingsImage.lifetime = .keepAlways;add(settingsImage)
    app.terminate();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let restored=app.descendants(matching:.any).matching(identifier:"accent-blue").firstMatch
    for _ in 0..<14 {if restored.isHittable{break};app.swipeUp()}
    XCTAssertTrue(restored.isSelected)
    let pink=app.descendants(matching:.any).matching(identifier:"visual-blush").firstMatch
    for _ in 0..<3 {if pink.isHittable{break};app.swipeDown()};pink.tap()
    app.descendants(matching:.any).matching(identifier:"tab-library").firstMatch.tap()
    app.descendants(matching:.any).matching(identifier:"tab-private").firstMatch.tap()
    XCTAssertTrue(app.staticTexts["私人曲库"].firstMatch.exists)
    discover.tap()
    let homeImage=XCTAttachment(screenshot:app.screenshot());homeImage.lifetime = .keepAlways;add(homeImage)
  }
  func testLiveLXPlayback() throws {
    let app=XCUIApplication();app.launch()
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let field=app.textFields["音源订阅地址"]
    for _ in 0..<8 {if field.isHittable{break};app.swipeUp()}
    XCTAssertTrue(field.exists);field.tap();for character in "http://127.0.0.1:18439/source.js" {field.typeText(String(character))};field.typeText("\n")
    app.buttons["从地址导入"].tap()
    let enable=app.buttons["启用音源：Nexus Live Validation Source"]
    for _ in 0..<5 {if enable.isHittable{break};app.swipeUp()}
    if enable.waitForExistence(timeout:3) {enable.tap()} else {XCTAssertTrue(app.buttons["停用音源：Nexus Live Validation Source"].exists)}
    XCTAssertTrue(app.staticTexts["已启用"].waitForExistence(timeout:25))
    app.descendants(matching:.any).matching(identifier:"tab-search").firstMatch.tap()
    let query=app.textFields["搜索歌曲或歌手"];XCTAssertTrue(query.waitForExistence(timeout:10))
    app.descendants(matching:.any).matching(identifier:"网易云").firstMatch.tap()
    query.tap();query.typeText("test\n");app.buttons["搜索"].firstMatch.tap()
    let first=app.descendants(matching:.any).matching(identifier:"search-track-wy-0").firstMatch
    XCTAssertTrue(first.waitForExistence(timeout:25));first.tap()
    app.buttons["打开播放页"].tap()
    XCTAssertTrue(app.staticTexts["实时音频频谱"].waitForExistence(timeout:45))
    for _ in 0..<3 {if app.buttons["暂停"].firstMatch.isHittable{break};app.swipeUp()}
    app.buttons["暂停"].firstMatch.tap()
    for _ in 0..<5 {if app.buttons["收起播放页"].isHittable{break};app.swipeDown()};app.buttons["收起播放页"].tap()
    app.descendants(matching:.any).matching(identifier:"tab-settings").firstMatch.tap()
    let selected=app.descendants(matching:.any).matching(identifier:"选择音源：Nexus Live Validation Source").firstMatch
    for _ in 0..<8 {if selected.isHittable{break};app.swipeUp()}
    selected.tap();app.buttons["删除"].firstMatch.tap();app.alerts.buttons["删除"].tap()
    XCTAssertTrue(app.staticTexts["完成 1 项"].waitForExistence(timeout:10))
  }

}
