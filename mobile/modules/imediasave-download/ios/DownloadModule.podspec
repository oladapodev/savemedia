Pod::Spec.new do |s|
  s.name           = 'IMediaSaveDownload'
  s.version        = '1.0.0'
  s.summary        = 'iMediaSave native background download bridge'
  s.description    = 'App Group backed background URLSession downloads for iMediaSave.'
  s.license        = { :type => 'MIT' }
  s.author         = 'iMediaSave'
  s.homepage       = 'https://imediasave.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.exclude_files  = '**/*Tests.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Foundation', 'UniformTypeIdentifiers', 'UIKit'
  s.swift_version = '5.9'

  s.test_spec 'Tests' do |test_spec|
    test_spec.source_files = '**/*Tests.swift'
    test_spec.frameworks = 'XCTest'
  end
end
