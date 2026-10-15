require 'xcodeproj'

path = File.expand_path('../ios/app.xcodeproj', __dir__)
project = Xcodeproj::Project.open(path)
app = project.targets.find { |target| target.name == 'app' }
target = project.targets.find { |item| item.name == 'NexusMusicUITests' }
unless target
  target = project.new_target(:ui_test_bundle, 'NexusMusicUITests', :ios, '15.1')
  target.add_dependency(app)
  target.build_configurations.each do |config|
    config.build_settings.merge!({
      'PRODUCT_BUNDLE_IDENTIFIER' => 'com.nexusmusic.app.uitests',
      'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0',
      'TEST_TARGET_NAME' => 'app', 'CODE_SIGNING_ALLOWED' => 'NO',
      'TARGETED_DEVICE_FAMILY' => '1,2'
    })
  end
  group = project.main_group.new_group('NexusMusicUITests', 'NexusMusicUITests')
  ref = group.new_file('SourceSettingsTests.swift')
  target.add_file_references([ref])
  project.root_object.attributes['TargetAttributes'] ||= {}
  project.root_object.attributes['TargetAttributes'][target.uuid] = { 'TestTargetID' => app.uuid }
  project.save
end
target.product_name = 'NexusMusicUITests'
target.product_reference.path = 'NexusMusicUITests.xctest'
target.build_configurations.each { |config| config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)' }
project.save
scheme_path = File.join(path, 'xcshareddata/xcschemes/app.xcscheme')
scheme = Xcodeproj::XCScheme.new(scheme_path)
unless scheme.test_action.testables.any? { |testable| testable.buildable_references.any? { |ref| ref.target_uuid == target.uuid } }
  scheme.add_build_target(target)
  scheme.add_test_target(target)
end
entry = scheme.build_action.entries.find { |item| item.buildable_references.any? { |ref| ref.target_uuid == target.uuid } }
if entry
  %w[buildForRunning buildForProfiling buildForArchiving buildForAnalyzing].each { |key| entry.xml_element.attributes[key] = 'NO' }
end
scheme.save_as(path, 'app', true)
