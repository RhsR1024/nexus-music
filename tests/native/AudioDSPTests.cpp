#include "../../modules/nexus-native/ios/AudioDSP.hpp"
#include <cassert>
#include <iostream>
#include <vector>
static constexpr double pi=3.14159265358979323846;
double rms(const std::vector<float>& samples,size_t from=4096) {
  double sum=0; for(size_t i=from;i<samples.size();i++) sum+=samples[i]*samples[i];
  return std::sqrt(sum/(samples.size()-from));
}
std::vector<float> sine(double frequency) {
  std::vector<float> result(8192); for(size_t i=0;i<result.size();i++) result[i]=.1f*std::sin(2*pi*frequency*i/48000); return result;
}
void render(nexus::AudioDSP& dsp,std::vector<float>& data) {
  for(size_t offset=0;offset<data.size();offset+=256) {
    float* channels[]={data.data()+offset}; uint32_t strides[]={1}; dsp.process(channels,strides,1,256);
  }
}
int main() {
  nexus::AudioDSP dsp; dsp.prepare(48000,true);
  auto original=sine(1000), bypass=original; render(dsp,bypass); assert(bypass==original);
  std::array<float,10> gains{}; gains[5]=-12; dsp.configure(true,gains);
  auto cut=original; render(dsp,cut); assert(rms(cut)/rms(original)<.27);
  dsp.configure(false,gains); auto disabled=original; render(dsp,disabled); assert(disabled==original);
  auto spectrum=dsp.spectrum(); auto peak=std::max_element(spectrum.begin(),spectrum.end())-spectrum.begin();
  assert(peak>=17 && peak<=19);
  gains.fill(12); dsp.configure(true,gains); auto boosted=original; render(dsp,boosted);
  for(float value:boosted) assert(std::isfinite(value) && std::abs(value)<=1);
  assert(dsp.headroomDB()==-18);
  // Flat EQ isolates the manual preamp from filter response and automatic headroom.
  gains.fill(0);
  for(float gain:{-6.f,6.f}) {
    nexus::AudioDSP preamp; preamp.prepare(48000,true); preamp.configure(true,gains,gain);
    auto actual=original; render(preamp,actual);
    assert(std::abs(rms(actual)/rms(original)-std::pow(10.,gain/20.))<.0001);
    preamp.configure(false,gains,gain); auto off=original; render(preamp,off); assert(off==original);
  }
  nexus::AudioDSP bounded; bounded.prepare(48000,true); bounded.configure(true,gains,999);
  auto limited=original; render(bounded,limited); assert(std::abs(rms(limited)/rms(original)-std::pow(10.,12./20.))<.0001);
  bounded.configure(true,gains,NAN); auto finite=original; render(bounded,finite);
  // Enabled neutral biquads can retain sub-ULP history on ARM fused multiply-add.
  // Only disabled bypass promises bit identity; NaN preamp must normalize to unity.
  for(size_t i=0;i<finite.size();i++) assert(std::isfinite(finite[i]) && std::abs(finite[i]-original[i])<1e-6f);
  assert(std::abs(rms(finite)/rms(original)-1.)<1e-5);
  nexus::AudioDSP silent; silent.prepare(48000,true); std::vector<float> zeros(8192); render(silent,zeros);
  for(float value:silent.spectrum()) assert(value==0);
  std::cout<<"Native DSP checks passed: bit-exact bypass/1kHz EQ attenuation/FFT peak/headroom/manual preamp RMS/clamping/finite output/silence\n";
}
