#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN
@interface NexusAudioDSP : NSObject
- (nullable AVAudioMix *)audioMixForTrack:(AVAssetTrack *)track NS_SWIFT_NAME(audioMix(for:));
- (void)configureEnabled:(BOOL)enabled gains:(NSArray<NSNumber *> *)gains NS_SWIFT_NAME(configure(enabled:gains:));
- (NSDictionary<NSString *, id> *)snapshot;
@end
NS_ASSUME_NONNULL_END
