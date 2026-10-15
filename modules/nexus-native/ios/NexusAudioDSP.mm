#import "NexusAudioDSP.h"
#import <MediaToolbox/MediaToolbox.h>
#include "AudioDSP.hpp"
#include <memory>

struct NexusTapStorage { std::shared_ptr<nexus::AudioDSP> core; };
@implementation NexusAudioDSP {
  std::shared_ptr<nexus::AudioDSP> _core;
}
- (instancetype)init {
  if ((self = [super init])) _core=std::make_shared<nexus::AudioDSP>();
  return self;
}
- (AVAudioMix *)audioMixForTrack:(AVAssetTrack *)track {
  auto storage=new NexusTapStorage{_core};
  MTAudioProcessingTapCallbacks callbacks={};
  callbacks.version=kMTAudioProcessingTapCallbacksVersion_0;
  callbacks.clientInfo=storage;
  callbacks.init=[](MTAudioProcessingTapRef tap,void *client,void **outStorage) { *outStorage=client; };
  callbacks.finalize=[](MTAudioProcessingTapRef tap) { delete static_cast<NexusTapStorage *>(MTAudioProcessingTapGetStorage(tap)); };
  callbacks.prepare=[](MTAudioProcessingTapRef tap,CMItemCount maximumFrames,const AudioStreamBasicDescription *format) {
    auto core=static_cast<NexusTapStorage *>(MTAudioProcessingTapGetStorage(tap))->core.get();
    bool supported=format->mFormatID==kAudioFormatLinearPCM && (format->mFormatFlags&kAudioFormatFlagIsFloat) && format->mBitsPerChannel==32 && format->mChannelsPerFrame<=8;
    core->prepare(format->mSampleRate,supported);
  };
  callbacks.unprepare=[](MTAudioProcessingTapRef tap) {};
  callbacks.process=[](MTAudioProcessingTapRef tap,CMItemCount requested,MTAudioProcessingTapFlags flags,AudioBufferList *buffers,CMItemCount *provided,MTAudioProcessingTapFlags *outFlags) {
    OSStatus status=MTAudioProcessingTapGetSourceAudio(tap,requested,buffers,outFlags,nullptr,provided);
    if(status!=noErr) { *provided=0; return; }
    if(*provided<=0) return;
    auto core=static_cast<NexusTapStorage *>(MTAudioProcessingTapGetStorage(tap))->core.get();
    float *channels[8]={}; uint32_t strides[8]={},count=0;
    for(UInt32 buffer=0;buffer<buffers->mNumberBuffers;buffer++) {
      const AudioBuffer& item=buffers->mBuffers[buffer];
      if(!item.mData || item.mDataByteSize<static_cast<size_t>(*provided)*item.mNumberChannels*sizeof(float)) return;
      for(UInt32 channel=0;channel<item.mNumberChannels;channel++) {
        if(count>=8) return;
        channels[count]=static_cast<float *>(item.mData)+channel; strides[count++]=item.mNumberChannels;
      }
    }
    core->process(channels,strides,count,static_cast<uint32_t>(*provided));
  };
  MTAudioProcessingTapRef tap=nullptr;
  OSStatus status=MTAudioProcessingTapCreate(kCFAllocatorDefault,&callbacks,kMTAudioProcessingTapCreationFlag_PreEffects,&tap);
  if(status!=noErr || tap==nullptr) { delete storage; return nil; }
  AVMutableAudioMixInputParameters *parameters=[AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:track];
  parameters.audioTapProcessor=tap;
  AVMutableAudioMix *mix=[AVMutableAudioMix audioMix]; mix.inputParameters=@[parameters];
  CFRelease(tap);
  return mix;
}
- (void)configureEnabled:(BOOL)enabled gains:(NSArray<NSNumber *> *)gains preampDB:(double)preampDB {
  std::array<float,10> values{};
  for(NSUInteger i=0;i<MIN(10,gains.count);i++) values[i]=gains[i].floatValue;
  _core->configure(enabled,values,static_cast<float>(preampDB));
}
- (NSDictionary<NSString *,id> *)snapshot {
  auto bands=_core->spectrum(); NSMutableArray *values=[NSMutableArray arrayWithCapacity:32];
  for(float value:bands) [values addObject:@(value)];
  return @{ @"bands": values, @"supported": @(_core->supported.load()), @"headroomDB": @(_core->headroomDB()) };
}
@end
