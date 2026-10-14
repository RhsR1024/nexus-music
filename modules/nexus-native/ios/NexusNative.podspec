Pod::Spec.new do |s|
  s.name = 'NexusNative'
  s.version = '0.1.0'
  s.summary = 'NexusMusic native adapters'
  s.description = 'Independent JavaScriptCore LX script contexts and native I/O.'
  s.author = 'NexusMusic contributors'
  s.homepage = 'https://github.com/RhsR1024/nexus-music'
  s.source = { :git => 'https://github.com/RhsR1024/nexus-music.git' }
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'NexusNative' => ['bootstrap.js'] }
  s.frameworks = 'JavaScriptCore', 'Security'
  s.libraries = 'z'
end
