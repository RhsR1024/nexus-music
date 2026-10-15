require 'yaml'
before = YAML.load_file(ARGV.fetch(0))
after = YAML.load_file(ARGV.fetch(1))
known_yoga_checksums = %w[3fd22c2cae22d7a2b0f0b538f55f7c2a17dc94d5 5934998fbeaef7845dbf698f698518695ab4cd1a]
original = before.fetch('SPEC CHECKSUMS').fetch('Yoga')
generated = after.fetch('SPEC CHECKSUMS').fetch('Yoga')
if original != generated
  abort 'Unexpected generated Yoga podspec checksum' unless known_yoga_checksums.include?(original) && known_yoga_checksums.include?(generated)
  after['SPEC CHECKSUMS']['Yoga'] = original
  puts 'Accepted known Intel/Apple Silicon generated Yoga checksum difference; pod versions remain locked.'
end
abort 'Pod install changed locked dependencies or configuration' unless before == after
puts 'Pod lock verification passed'
