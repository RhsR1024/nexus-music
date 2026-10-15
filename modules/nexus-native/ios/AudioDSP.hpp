// Original NexusMusic DSP. No allocation or locks in the render path.
#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <complex>
#include <cstdint>

namespace nexus {
class AudioDSP {
  struct Filter { double b0=1,b1=0,b2=0,a1=0,a2=0; };
  struct Memory { double z1=0,z2=0; };
  static constexpr size_t ringSize=16384, fftSize=2048;
  std::array<float,ringSize> ring{};
  std::atomic<size_t> write{0},read{0};
  std::array<std::atomic<float>,10> gains{};
  std::array<Filter,10> filters{};
  std::array<std::array<Memory,10>,8> memory{};
  std::atomic<bool> enabled{false};
  std::atomic<double> sampleRate{44100};
  std::array<float,fftSize> history{};
  size_t historyPosition=0,historyCount=0;
  float preamp=1;
  bool active=false;
  static constexpr double pi=3.14159265358979323846;
public:
  static constexpr std::array<double,10> frequencies={31,62,125,250,500,1000,2000,4000,8000,16000};
  std::atomic<bool> supported{false};
  void prepare(double rate, bool floatingPoint) {
    sampleRate.store(rate>0?rate:44100); supported.store(floatingPoint);
    for(auto& channel:memory) for(auto& state:channel) state={};
  }
  void configure(bool on, const std::array<float,10>& values) {
    for(size_t i=0;i<10;i++) gains[i].store(std::isfinite(values[i])?std::clamp(values[i],-12.f,12.f):0.f);
    enabled.store(on);
  }
  void beginBuffer() {
    active=enabled.load();
    double largest=0,rate=sampleRate.load();
    for(size_t i=0;i<10;i++) {
      const double gain=gains[i].load(); largest=std::max(largest,gain);
      const double amplitude=std::pow(10.,gain/40.), omega=2*pi*std::min(frequencies[i],rate*.475)/rate;
      const double alpha=std::sin(omega)/2, cosine=std::cos(omega), a0=1+alpha/amplitude;
      filters[i]={(1+alpha*amplitude)/a0, -2*cosine/a0, (1-alpha*amplitude)/a0,
                  -2*cosine/a0, (1-alpha/amplitude)/a0};
    }
    preamp=static_cast<float>(std::pow(10.,-1.5*largest/20.));
  }
  float headroomDB() const {
    float largest=0; for(const auto& gain:gains) largest=std::max(largest,gain.load()); return -1.5f*largest;
  }
  void process(float* const channels[], const uint32_t strides[], uint32_t channelCount, uint32_t frames) {
    if(!supported.load() || channelCount==0 || channelCount>8) return;
    beginBuffer();
    for(uint32_t frame=0;frame<frames;frame++) {
      float mono=0;
      for(uint32_t channel=0;channel<channelCount;channel++) {
        float& sample=channels[channel][frame*strides[channel]];
        if(active) {
          double value=std::isfinite(sample)?sample*preamp:0;
          for(size_t band=0;band<10;band++) {
            const auto& f=filters[band]; auto& state=memory[channel][band];
            const double output=f.b0*value+state.z1;
            state.z1=f.b1*value-f.a1*output+state.z2;
            state.z2=f.b2*value-f.a2*output;
            value=output;
          }
          sample=std::isfinite(value)?static_cast<float>(std::clamp(value,-1.,1.)):0;
        }
        mono+=std::isfinite(sample)?sample:0;
      }
      const size_t index=write.load(std::memory_order_relaxed), next=(index+1)%ringSize;
      if(next!=read.load(std::memory_order_acquire)) {
        ring[index]=mono/channelCount; write.store(next,std::memory_order_release);
      }
    }
  }
  std::array<float,32> spectrum() {
    size_t index=read.load(std::memory_order_relaxed), end=write.load(std::memory_order_acquire);
    while(index!=end) {
      history[historyPosition]=ring[index]; historyPosition=(historyPosition+1)%fftSize;
      historyCount=std::min(historyCount+1,fftSize); index=(index+1)%ringSize;
    }
    read.store(index,std::memory_order_release);
    std::array<float,32> result{};
    if(historyCount<fftSize || !supported.load()) return result;
    std::array<std::complex<float>,fftSize> bins{};
    for(size_t i=0;i<fftSize;i++) bins[i]={history[(historyPosition+i)%fftSize]*static_cast<float>(.5-.5*std::cos(2*pi*i/(fftSize-1))),0};
    for(size_t i=1,j=0;i<fftSize;i++) {
      size_t bit=fftSize>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit;
      if(i<j) std::swap(bins[i],bins[j]);
    }
    for(size_t length=2;length<=fftSize;length<<=1) {
      const std::complex<float> root=std::polar(1.f,static_cast<float>(-2*pi/length));
      for(size_t start=0;start<fftSize;start+=length) {
        std::complex<float> weight(1,0);
        for(size_t offset=0;offset<length/2;offset++) {
          const auto even=bins[start+offset], odd=bins[start+offset+length/2]*weight;
          bins[start+offset]=even+odd; bins[start+offset+length/2]=even-odd; weight*=root;
        }
      }
    }
    const double rate=sampleRate.load(), upper=std::min(20000.,rate/2);
    for(size_t band=0;band<32;band++) {
      const double low=20*std::pow(upper/20,band/32.), high=20*std::pow(upper/20,(band+1)/32.);
      const size_t first=std::max<size_t>(1,static_cast<size_t>(low*fftSize/rate));
      const size_t last=std::min<size_t>(fftSize/2,std::max(first+1,static_cast<size_t>(high*fftSize/rate)));
      float peak=0; for(size_t bin=first;bin<last;bin++) peak=std::max(peak,std::abs(bins[bin])*4/fftSize);
      result[band]=std::clamp((20*std::log10(std::max(peak,1e-6f))+80)/80,0.f,1.f);
    }
    return result;
  }
};
}
